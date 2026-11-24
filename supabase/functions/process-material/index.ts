import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getDocument } from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const decodeXml = (value: string) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
function xmlText(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...xml.matchAll(new RegExp("<" + escaped + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + escaped + ">", "g"))]
    .map(match => decodeXml(match[1].replace(/<[^>]+>/g, ""))).join(" ");
}
function splitChunks(pages: Array<{ page: number | null; text: string }>) {
  const chunks: Array<{ page_number: number | null; content: string }> = [];
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ").trim();
    for (let start = 0; start < text.length; start += 820) {
      const content = text.slice(start, start + 1000).trim();
      if (content.length >= 40) chunks.push({ page_number: page.page, content });
    }
  }
  return chunks;
}
async function extract(file: Uint8Array, name: string, mime: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "txt" || ext === "csv" || mime.startsWith("text/")) {
    return [{ page: null, text: new TextDecoder().decode(file) }];
  }
  if (ext === "pdf" || mime === "application/pdf") {
    const doc = await getDocument({ data: file, useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
    const pages: Array<{ page: number; text: string }> = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      pages.push({ page: pageNo, text: content.items.map((item: any) => "str" in item ? item.str : "").join(" ") });
      page.cleanup();
    }
    await doc.destroy();
    return pages;
  }
  if (ext === "docx" || ext === "pptx") {
    const files = unzipSync(file);
    const paths = Object.keys(files).filter(path => ext === "docx"
      ? path === "word/document.xml"
      : /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort();
    const pages = paths.map((path, index) => {
      const xml = strFromU8(files[path]);
      const tags = ext === "docx" ? ["w:t"] : ["a:t"];
      return { page: ext === "pptx" ? index + 1 : null, text: tags.map(tag => xmlText(xml, tag)).join(" ") };
    });
    return pages;
  }
  throw new Error("Formato ainda não suportado para leitura automática. Use PDF, DOCX, PPTX, TXT ou CSV.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey || !openaiKey) return json({ error: "Integração não configurada no servidor." }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Faça login para processar materiais." }, 401);
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(authorization.slice(7));
  if (authError || !user) return json({ error: "Sessão inválida ou expirada." }, 401);
  let body: { materialId?: string };
  try { body = await req.json(); } catch { return json({ error: "Corpo JSON inválido." }, 400); }
  if (!body.materialId || !/^[0-9a-f-]{36}$/i.test(body.materialId)) return json({ error: "Material inválido." }, 400);

  const { data: material, error: materialError } = await supabase.from("study_materials")
    .select("id,user_id,file_name,storage_path,mime_type,size_bytes")
    .eq("id", body.materialId).single();
  if (materialError || !material || material.user_id !== user.id) return json({ error: "Material não encontrado." }, 404);
  if ((material.size_bytes ?? 0) > 50 * 1024 * 1024) return json({ error: "Arquivo excede 50 MB." }, 413);

  await supabase.from("study_materials").update({ processing_status: "processing", processing_error: null }).eq("id", material.id);
  try {
    const { data: blob, error: downloadError } = await supabase.storage.from("study-materials").download(material.storage_path);
    if (downloadError || !blob) throw new Error("Não foi possível baixar o arquivo privado.");
    const extracted = await extract(new Uint8Array(await blob.arrayBuffer()), material.file_name, material.mime_type ?? "");
    const fullText = extracted.map(page => page.text).join("\n").replace(/\u0000/g, "").slice(0, 1_000_000);
    if (fullText.trim().length < 40) throw new Error("Não foi possível encontrar texto legível. PDFs digitalizados/imagens precisam de OCR, ainda não disponível.");
    const chunks = splitChunks(extracted);
    if (!chunks.length) throw new Error("O arquivo não contém texto suficiente para indexação.");

    const { error: deleteError } = await supabase.from("study_material_chunks").delete().eq("material_id", material.id);
    if (deleteError) throw new Error("Falha ao preparar a indexação do material.");
    for (let i = 0; i < chunks.length; i += 48) {
      const batch = chunks.slice(i, i + 48);
      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: batch.map(chunk => chunk.content) }),
      });
      if (!embeddingResponse.ok) throw new Error(embeddingResponse.status === 429 ? "Limite de uso da OpenAI atingido durante a indexação." : "Falha ao gerar índice semântico.");
      const embeddingData = await embeddingResponse.json();
      const rows = batch.map((chunk, index) => ({
        user_id: user.id, material_id: material.id, chunk_index: i + index,
        content: chunk.content, page_number: chunk.page_number,
        embedding: `[${embeddingData.data[index].embedding.join(",")}]`,
      }));
      const { error: insertError } = await supabase.from("study_material_chunks").insert(rows);
      if (insertError) throw new Error("Falha ao salvar trechos pesquisáveis do material.");
    }
    const { error: updateError } = await supabase.from("study_materials")
      .update({ extracted_text: fullText, processing_status: "ready", processing_error: null }).eq("id", material.id);
    if (updateError) throw new Error("Texto extraído, mas não foi possível concluir o processamento.");
    return json({ success: true, materialId: material.id, chunks: chunks.length, characters: fullText.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar o material.";
    await supabase.from("study_materials").update({ processing_status: "failed", processing_error: message.slice(0, 500) }).eq("id", material.id);
    return json({ error: message }, 422);
  }
});
