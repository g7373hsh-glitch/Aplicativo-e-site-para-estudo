import { supabase } from "./supabase";

export type TutorMode = "professor" | "simples" | "aprofundado" | "socratico" | "revisao";

export async function askStudyAI(message: string, options: { context?: string; mode?: TutorMode } = {}) {
  if (!supabase) throw new Error("Supabase não está configurado.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Entre na sua conta para conversar com o STUDY AI.");

  const { data, error } = await supabase.functions.invoke("study-assistant", {
    body: { message, context: options.context ?? "", mode: options.mode ?? "professor" },
  });
  if (error) throw new Error(error.message || "Falha ao chamar o tutor.");
  if (data?.error) throw new Error(data.error);
  if (typeof data?.answer !== "string") throw new Error("Resposta inválida do tutor.");
  return data.answer as string;
}
