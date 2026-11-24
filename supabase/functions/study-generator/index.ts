import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const cors={"Access-Control-Allow-Origin":Deno.env.get("APP_ORIGIN")??"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...cors,"Content-Type":"application/json"}});
async function generate(key:string,prompt:string){
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",input:prompt,max_output_tokens:5000})});
 if(!r.ok){console.error("OpenAI generation error",r.status,(await r.text()).slice(0,500));throw new Error(r.status===429?"Limite de uso da IA atingido.":"Falha ao gerar atividade com a IA.");}
 const data=await r.json(),text=(data.output??[]).flatMap((x:{content?:Array<{type?:string;text?:string}>})=>x.content??[]).filter((x:{type?:string})=>x.type==="output_text").map((x:{text?:string})=>x.text??"").join("\n").trim();
 const cleaned=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
 try{return JSON.parse(cleaned);}catch{throw new Error("A IA retornou um formato inválido. Tente gerar novamente.");}
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return reply({error:"Método não permitido."},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),key=Deno.env.get("OPENAI_API_KEY");if(!url||!anon||!key)return reply({error:"Servidor não configurado."},503);
 const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return reply({error:"Faça login para gerar atividades."},401);
 const sb=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}),{data:{user},error:ae}=await sb.auth.getUser(auth.slice(7));if(ae||!user)return reply({error:"Sessão inválida."},401);
 let body:any;try{body=await req.json();}catch{return reply({error:"JSON inválido."},400);}
 const kind=body.kind,count=Math.max(5,Math.min(20,Number(body.count)||10)),difficulty=["easy","medium","hard","mixed"].includes(body.difficulty)?body.difficulty:"medium";
 if(!["quiz","flashcards"].includes(kind))return reply({error:"Tipo de atividade inválido."},400);
 const {data:materials,error:me}=await sb.from("study_materials").select("id,file_name,extracted_text,processing_status").eq("processing_status","ready").order("created_at",{ascending:false}).limit(8);
 if(me)return reply({error:"Não foi possível consultar seus materiais."},500);
 const usable=(materials??[]).filter((m:any)=>typeof m.extracted_text==="string"&&m.extracted_text.trim().length>80);
 if(!usable.length)return reply({error:"Envie e processe pelo menos um material com texto antes de gerar atividades."},400);
 const source=usable.map((m:any)=>"MATERIAL: "+m.file_name+"\n"+m.extracted_text.slice(0,10000)).join("\n\n---\n\n").slice(0,28000);
 const title=(typeof body.title==="string"&&body.title.trim()?body.title.trim().slice(0,140):kind==="quiz"?"Simulado personalizado":"Revisão dos materiais");
 const prompt=kind==="quiz"
 ?`Crie exatamente ${count} questões de múltipla escolha em português brasileiro, dificuldade ${difficulty}, usando SOMENTE o conteúdo-fonte. Evite ambiguidades. Cada questão deve ter 4 alternativas plausíveis, apenas uma correta. Retorne APENAS JSON válido no formato {"title":"título curto","questions":[{"question":"...","options":["A...","B...","C...","D..."],"correctIndex":0,"explanation":"Explicação didática baseada na fonte."}]}. correctIndex é índice 0 a 3. Não inclua markdown.\n\nCONTEÚDO-FONTE:\n${source}`
 :`Crie exatamente ${count} flashcards de revisão em português brasileiro, cobrindo os conceitos mais importantes do conteúdo-fonte. Perguntas curtas e respostas claras, úteis para memorização ativa. Retorne APENAS JSON válido no formato {"title":"título curto","cards":[{"front":"Pergunta ou conceito","back":"Resposta explicativa concisa"}]}. Não inclua markdown.\n\nCONTEÚDO-FONTE:\n${source}`;
 try{
  const generated=await generate(key,prompt);
  if(kind==="quiz"){
   if(!Array.isArray(generated.questions)||generated.questions.length!==count||generated.questions.some((q:any)=>typeof q.question!=="string"||!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(q.correctIndex)||q.correctIndex<0||q.correctIndex>3||typeof q.explanation!=="string"))throw new Error("Questões geradas incompletas. Tente novamente.");
   const {data:quiz,error:qe}=await sb.from("quizzes").insert({user_id:user.id,title:(generated.title||title).slice(0,160),difficulty,question_count:count}).select("id,title,difficulty,question_count,created_at").single();if(qe||!quiz)throw new Error("Não foi possível salvar o simulado.");
   const rows=generated.questions.map((q:any,i:number)=>({user_id:user.id,quiz_id:quiz.id,position:i+1,question:q.question,options:q.options,correct_answer:q.correctIndex,explanation:q.explanation}));
   const {error:ie}=await sb.from("quiz_questions").insert(rows);if(ie){await sb.from("quizzes").delete().eq("id",quiz.id);throw new Error("Não foi possível salvar as questões.");}
   return reply({kind,quiz,questions:generated.questions.map((q:any,i:number)=>({id:String(i+1),position:i+1,question:q.question,options:q.options,explanation:q.explanation})),sourceCount:usable.length});
  }
  if(!Array.isArray(generated.cards)||generated.cards.length!==count||generated.cards.some((c:any)=>typeof c.front!=="string"||typeof c.back!=="string"))throw new Error("Flashcards gerados incompletos. Tente novamente.");
  const {data:deck,error:de}=await sb.from("flashcard_decks").insert({user_id:user.id,title:(generated.title||title).slice(0,160)}).select("id,title,created_at").single();if(de||!deck)throw new Error("Não foi possível salvar o baralho.");
  const rows=generated.cards.map((c:any)=>({user_id:user.id,deck_id:deck.id,front:c.front,back:c.back,due_at:new Date().toISOString()}));
  const {error:ce}=await sb.from("flashcards").insert(rows);if(ce){await sb.from("flashcard_decks").delete().eq("id",deck.id);throw new Error("Não foi possível salvar os flashcards.");}
  return reply({kind,deck,count:rows.length,sourceCount:usable.length});
 }catch(e){return reply({error:e instanceof Error?e.message:"Falha ao gerar atividade."},422);}
});