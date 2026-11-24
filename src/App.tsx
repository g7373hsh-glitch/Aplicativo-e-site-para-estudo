import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, BrainCircuit, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, Flame, FolderOpen, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, Sparkles, Target, Upload, X, Zap } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { askStudyAI } from "./lib/ai";

type Task = { id: string; title: string; subject: string; time: string; done: boolean };
type Material = { id:string; file_name:string; storage_path:string; size_bytes:number|null; processing_status:string; processing_error?:string|null; created_at:string };
type Quiz = {id:string;title:string;difficulty:string;question_count:number;created_at:string};
type QuizQuestion = {id:string;position:number;question:string;options:string[];correct_answer:number;explanation:string};
type FlashDeck = {id:string;title:string;created_at:string};
type Flashcard = {id:string;deck_id:string;front:string;back:string;interval_days:number;repetitions:number;ease_factor:number;due_at:string|null};
const initialTasks: Task[] = [
  { id: "demo-1", title: "Revisar funções do 2º grau", subject: "Matemática", time: "09:30", done: false },
  { id: "demo-2", title: "Ler capítulo 04 — Citologia", subject: "Biologia", time: "11:00", done: false },
  { id: "demo-3", title: "Resolver lista de exercícios", subject: "Física", time: "14:30", done: true },
];
const nav = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Meu tutor IA", icon: BrainCircuit },
  { label: "Materiais", icon: FolderOpen },
  { label: "Simulados", icon: Target },
  { label: "Flashcards", icon: Zap },
  { label: "Planejamento", icon: CalendarDays },
];
const subjectColors: Record<string,string> = { Matemática: "#9b8cff", Biologia: "#56c99b", Física: "#65a9ff", História: "#f0b86a" };

function App() {
  const [active, setActive] = useState("Visão geral");
  const [tasks, setTasks] = useState<Task[]>(() => { try { return JSON.parse(localStorage.getItem("study-ai-tasks") || "null") || initialTasks; } catch { return initialTasks; } });
  const [modal, setModal] = useState<"task"|"upload"|"assistant"|"auth"|null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string|null>(null);
  const [fileName, setFileName] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quizzes,setQuizzes]=useState<Quiz[]>([]);
  const [decks,setDecks]=useState<FlashDeck[]>([]);
  const [selectedQuiz,setSelectedQuiz]=useState<Quiz|null>(null);
  const [quizQuestions,setQuizQuestions]=useState<QuizQuestion[]>([]);
  const [quizAnswers,setQuizAnswers]=useState<Record<string,number>>({});
  const [quizAttemptId,setQuizAttemptId]=useState<string|null>(null);
  const [quizResult,setQuizResult]=useState<{score:number;correct:number;total:number}|null>(null);
  const [activeDeck,setActiveDeck]=useState<FlashDeck|null>(null);
  const [deckCards,setDeckCards]=useState<Flashcard[]>([]);
  const [cardIndex,setCardIndex]=useState(0);
  const [cardFlipped,setCardFlipped]=useState(false);
  const [activityLoading,setActivityLoading]=useState(false);
  const [activityCount,setActivityCount]=useState(10);
  const [activityDifficulty,setActivityDifficulty]=useState("medium");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string|null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [toast, setToast] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  useEffect(() => { if (!userEmail) localStorage.setItem("study-ai-tasks", JSON.stringify(tasks)); }, [tasks,userEmail]);
  useEffect(() => { if (!supabase) return; supabase.auth.getSession().then(({data}) => setUserEmail(data.session?.user.email ?? null)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>{ setUserEmail(s?.user.email??null); setConversationId(null); setAnswer(""); if(!s?.user){setTasks(initialTasks);setFileName("");setMaterials([]);setQuizzes([]);setDecks([]);setSelectedQuiz(null);setActiveDeck(null);setQuizQuestions([]);setDeckCards([]);} }); return ()=>data.subscription.unsubscribe(); }, []);
  useEffect(() => { let alive=true; const load=async()=>{ if(!supabase||!userEmail) return; const {data,error}=await supabase.from("study_tasks").select("id,title,completed_at,due_at,subjects(name)").order("created_at",{ascending:false}); if(!alive)return; if(error){notify("Não foi possível carregar suas tarefas.");return;} setTasks((data??[]).map((t:any)=>({id:t.id,title:t.title,subject:t.subjects?.name??"Geral",time:t.due_at?new Date(t.due_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"Sem horário",done:Boolean(t.completed_at)}))); const {data:files,error:fileError}=await supabase.from("study_materials").select("id,file_name,storage_path,size_bytes,processing_status,created_at").order("created_at",{ascending:false}); if(alive&&!fileError)setMaterials(files??[]);
      const {data:quizData}=await supabase.from("quizzes").select("id,title,difficulty,question_count,created_at").order("created_at",{ascending:false}).limit(30);
      if(alive)setQuizzes(quizData??[]);
      const {data:deckData}=await supabase.from("flashcard_decks").select("id,title,created_at").order("created_at",{ascending:false}).limit(30);
      if(alive)setDecks(deckData??[]); }; void load(); return()=>{alive=false;}; }, [userEmail]);
  const completed = tasks.filter(t=>t.done).length;
  const progress = tasks.length ? Math.round(completed/tasks.length*100) : 0;
  const notify = (message:string) => { setToast(message); window.setTimeout(()=>setToast(""),2800); };
  const toggleTask = async (id:string) => {
    const task=tasks.find(t=>t.id===id); if(!task)return; const done=!task.done;
    setTasks(prev=>prev.map(t=>t.id===id?{...t,done}:t));
    if(supabase&&userEmail&&!id.startsWith("demo-")) { const {error}=await supabase.from("study_tasks").update({completed_at:done?new Date().toISOString():null}).eq("id",id); if(error)notify("Não foi possível sincronizar a tarefa."); }
  };
  const addTask = async () => {
    const titleValue=taskTitle.trim(); if(!titleValue)return;
    if(supabase&&userEmail) {
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){notify("Entre novamente para salvar a tarefa.");return;}
      const {data,error}=await supabase.from("study_tasks").insert({user_id:user.id,title:titleValue}).select("id,title").single();
      if(error||!data){notify("Não foi possível salvar a tarefa.");return;}
      setTasks(prev=>[{id:data.id,title:data.title,subject:"Geral",time:"Sem horário",done:false},...prev]);
    } else setTasks(prev=>[...prev,{id:String(Date.now()),title:titleValue,subject:"Geral",time:"A definir",done:false}]);
    setTaskTitle(""); setModal(null); notify("Tarefa adicionada ao seu plano.");
  };
  const removeTask = async (id:string) => {
    setTasks(prev=>prev.filter(t=>t.id!==id));
    if(supabase&&userEmail&&!id.startsWith("demo-")) { const {error}=await supabase.from("study_tasks").delete().eq("id",id); if(error)notify("Não foi possível excluir a tarefa."); }
  };
  const askTutor = async () => {
    const prompt=question.trim(); if(!prompt||aiLoading)return;
    if(!userEmail){setAnswer("Entre na sua conta para conversar com o tutor e manter seu histórico privado.");return;}
    setAiLoading(true); setAnswer("");
    try {
      if(!supabase)throw new Error("Supabase não está configurado.");
      const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error("Sua sessão expirou. Entre novamente.");
      let cid=conversationId;
      if(!cid){const {data,error}=await supabase.from("study_conversations").insert({user_id:user.id,title:prompt.slice(0,70),mode:"professor"}).select("id").single();if(error||!data)throw new Error("Não foi possível iniciar a conversa.");cid=data.id;setConversationId(cid);}
      const {error:saveQuestionError}=await supabase.from("study_messages").insert({user_id:user.id,conversation_id:cid,role:"user",content:prompt});
      if(saveQuestionError)throw new Error("Não foi possível salvar sua pergunta.");
      setQuestion("");
      const reply=await askStudyAI(prompt,{mode:"professor"});
      setAnswer(reply);
      const {error:saveAnswerError}=await supabase.from("study_messages").insert({user_id:user.id,conversation_id:cid,role:"assistant",content:reply});
      if(saveAnswerError)notify("Resposta gerada, mas não foi possível salvar no histórico.");
    } catch(e){setAnswer(e instanceof Error?e.message:"Ocorreu um erro ao consultar o tutor.");}
    finally{setAiLoading(false);}
  };
  const uploadFile = async (file?:File) => {
    if(!file)return;
    if(!supabase||!userEmail){notify("Entre na sua conta para enviar materiais.");return;}
    if(file.size>50*1024*1024){notify("O arquivo ultrapassa o limite de 50 MB.");return;}
    const {data:{user}}=await supabase.auth.getUser(); if(!user){notify("Sua sessão expirou.");return;}
    const safeName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"-").slice(-180);
    const path=user.id+"/"+crypto.randomUUID()+"-"+safeName;
    const {error:uploadError}=await supabase.storage.from("study-materials").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
    if(uploadError){notify("Falha no envio: "+uploadError.message);return;}
    const {error:recordError}=await supabase.from("study_materials").insert({user_id:user.id,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size,processing_status:"pending"});
    if(recordError){await supabase.storage.from("study-materials").remove([path]);notify("Não foi possível registrar o material.");return;}
    const {data:created}=await supabase.from("study_materials").select("id,file_name,storage_path,size_bytes,processing_status,created_at").eq("storage_path",path).single();
    if(created){
      setMaterials(prev=>[created,...prev]);
      notify("Arquivo enviado. Iniciando leitura e indexação para o tutor...");
      const {data:processed,error:processError}=await supabase.functions.invoke("process-material",{body:{materialId:created.id}});
      const {data:updated}=await supabase.from("study_materials").select("id,file_name,storage_path,size_bytes,processing_status,processing_error,created_at").eq("id",created.id).single();
      if(updated)setMaterials(prev=>prev.map(item=>item.id===created.id?updated:item));
      if(processError||processed?.error)notify("Arquivo salvo, mas a leitura falhou: "+(processed?.error||processError?.message||"tente novamente."));
      else notify("Material lido e indexado! O tutor já pode consultá-lo.");
    }
    setFileName(file.name); setModal(null);
  };
  const signIn = async () => { if (!supabase) { setAuthMessage("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para ativar contas reais."); return; } const {error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPassword}); setAuthMessage(error?.message ?? "Login realizado."); };
  const signUp = async () => { if (!supabase) { setAuthMessage("Configure o Supabase para criar contas individuais com segurança."); return; } const {error}=await supabase.auth.signUp({email:authEmail,password:authPassword}); setAuthMessage(error?.message ?? "Verifique seu e-mail para confirmar a conta."); };
  const openMaterial = async (path:string) => {
    if(!supabase)return;
    const {data,error}=await supabase.storage.from("study-materials").createSignedUrl(path,60);
    if(error||!data){notify("Não foi possível abrir o arquivo.");return;}
    window.location.assign(data.signedUrl);
  };
  const deleteMaterial = async (material:Material) => {
    if(!supabase)return;
    const {error:storageError}=await supabase.storage.from("study-materials").remove([material.storage_path]);
    if(storageError){notify("Não foi possível excluir o arquivo.");return;}
    const {error}=await supabase.from("study_materials").delete().eq("id",material.id);
    if(error){notify("Arquivo removido do armazenamento, mas o registro não foi excluído.");return;}
    setMaterials(prev=>prev.filter(m=>m.id!==material.id)); notify("Material excluído.");
  };
  const generateActivity=async(kind:"quiz"|"flashcards")=>{
    if(!supabase||!userEmail){notify("Entre na sua conta para salvar suas atividades.");return;}
    if(activityLoading)return;
    setActivityLoading(true);
    try{
      const {data,error}=await supabase.functions.invoke("study-generator",{body:{kind,count:activityCount,difficulty:activityDifficulty}});
      if(error||data?.error)throw new Error(data?.error||error?.message||"Falha ao gerar atividade.");
      if(kind==="quiz"){
        const quiz=data.quiz as Quiz;
        const {data:questions,error:qError}=await supabase.from("quiz_questions").select("id,position,question,options,correct_answer,explanation").eq("quiz_id",quiz.id).order("position");
        if(qError||!questions)throw new Error("Simulado criado, mas não foi possível carregar as questões.");
        setQuizzes(prev=>[quiz,...prev.filter(q=>q.id!==quiz.id)]);
        setSelectedQuiz(quiz);setQuizQuestions(questions as QuizQuestion[]);setQuizAnswers({});setQuizAttemptId(null);setQuizResult(null);
        notify("Simulado gerado com base nos seus materiais.");
      }else{
        setDecks(prev=>[data.deck,...prev.filter(d=>d.id!==data.deck.id)]);
        await openDeck(data.deck as FlashDeck);
        notify("Baralho de flashcards criado com sucesso.");
      }
    }catch(e){notify(e instanceof Error?e.message:"Não foi possível gerar a atividade.");}
    finally{setActivityLoading(false);}
  };
  const openQuiz=async(quiz:Quiz)=>{
    if(!supabase)return;
    const {data,error}=await supabase.from("quiz_questions").select("id,position,question,options,correct_answer,explanation").eq("quiz_id",quiz.id).order("position");
    if(error||!data){notify("Não foi possível abrir o simulado.");return;}
    setSelectedQuiz(quiz);setQuizQuestions(data as QuizQuestion[]);setQuizAnswers({});setQuizAttemptId(null);setQuizResult(null);
  };
  const finishQuiz=async()=>{
    if(!supabase||!selectedQuiz||!userEmail||quizResult)return;
    const unanswered=quizQuestions.filter(q=>quizAnswers[q.id]===undefined).length;
    if(unanswered){notify("Responda todas as questões antes de finalizar.");return;}
    const {data:{user}}=await supabase.auth.getUser();if(!user)return;
    let attemptId=quizAttemptId;
    if(!attemptId){const {data,error}=await supabase.from("quiz_attempts").insert({user_id:user.id,quiz_id:selectedQuiz.id,total_questions:quizQuestions.length}).select("id").single();if(error||!data){notify("Não foi possível registrar sua tentativa.");return;}attemptId=data.id;setQuizAttemptId(attemptId);}
    const correct=quizQuestions.filter(q=>quizAnswers[q.id]===Number(q.correct_answer)).length;
    const score=Math.round(correct/quizQuestions.length*100);
    const rows=quizQuestions.map(q=>({user_id:user.id,attempt_id:attemptId!,question_id:q.id,answer:quizAnswers[q.id],is_correct:quizAnswers[q.id]===Number(q.correct_answer)}));
    const {error:answersError}=await supabase.from("quiz_answers").upsert(rows,{onConflict:"attempt_id,question_id"});
    if(answersError){notify("Não foi possível salvar suas respostas.");return;}
    const {error:updateError}=await supabase.from("quiz_attempts").update({finished_at:new Date().toISOString(),score,total_questions:quizQuestions.length,correct_count:correct}).eq("id",attemptId);
    if(updateError){notify("Respostas salvas, mas houve falha ao registrar a nota.");return;}
    setQuizResult({score,correct,total:quizQuestions.length});
  };
  const openDeck=async(deck:FlashDeck)=>{
    if(!supabase)return;
    const {data,error}=await supabase.from("flashcards").select("id,deck_id,front,back,interval_days,repetitions,ease_factor,due_at").eq("deck_id",deck.id).order("created_at");
    if(error||!data){notify("Não foi possível abrir o baralho.");return;}
    setActiveDeck(deck);setDeckCards(data as Flashcard[]);setCardIndex(0);setCardFlipped(false);
  };
  const reviewCard=async(rating:"again"|"good"|"easy")=>{
    if(!supabase||!activeDeck||!deckCards[cardIndex])return;
    const card=deckCards[cardIndex],now=new Date(),old=card.interval_days||0;
    const interval=rating==="again"?1:rating==="good"?(old===0?1:old===1?3:Math.max(4,Math.round(old*2.5))):(old===0?3:Math.max(7,Math.round(old*3.5)));
    const repetitions=rating==="again"?0:card.repetitions+1;
    const ease=Math.max(1.3,Number(card.ease_factor)+(rating==="easy"?0.15:rating==="again"?-0.2:0));
    const due=new Date(now.getTime()+interval*86400000).toISOString();
    const {error}=await supabase.from("flashcards").update({interval_days:interval,repetitions,ease_factor:ease,last_reviewed_at:now.toISOString(),due_at:due,updated_at:now.toISOString()}).eq("id",card.id);
    if(error){notify("Não foi possível salvar sua revisão.");return;}
    setDeckCards(prev=>prev.filter((_,i)=>i!==cardIndex));
    setCardFlipped(false);setCardIndex(0);
  };
  const title = active === "Visão geral" ? "Visão geral" : active;
  const week = useMemo(()=>["SEG","TER","QUA","QUI","SEX","SÁB","DOM"].map((d,i)=>({d,n:((17+i+weekOffset*7-1)%31)+1})),[weekOffset]);
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen?"sidebar-open":""}`}>
      <div className="brand"><div className="brand-mark"><BrainCircuit size={21}/></div><span>STUDY<span className="brand-light"> AI</span></span><button className="mobile-close icon-btn" onClick={()=>setSidebarOpen(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace"><div className="workspace-avatar">G</div><div><strong>Meu espaço</strong><small>Plano pessoal</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">MENU PRINCIPAL</div>
      <nav>{nav.map(item=><button key={item.label} className={`nav-item ${active===item.label?"active":""}`} onClick={()=>{setActive(item.label);setSidebarOpen(false);}}><item.icon size={18}/><span>{item.label}</span>{item.label==="Meu tutor IA"&&<span className="nav-new">IA</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={17}/></div><strong>Estude com mais foco.</strong><p>Seu próximo nível começa com um bom plano.</p><button onClick={()=>notify("Em breve: planos STUDY AI.")}>Conhecer recursos <ArrowRight size={14}/></button></div><button className="nav-item" onClick={()=>notify("Configurações estarão disponíveis em breve.")}><Settings2 size={18}/>Configurações</button><div className="profile"><div className="profile-avatar">G</div><div className="profile-info"><strong>{userEmail ? userEmail.split("@")[0] : "Estudante"}</strong><small>{userEmail ?? "Modo demonstração"}</small></div><button className="icon-btn" onClick={()=>userEmail?supabase?.auth.signOut():setModal("auth")} title={userEmail?"Sair":"Entrar"}>{userEmail?<LogOut size={17}/>:<ArrowRight size={17}/>}</button></div></div>
    </aside>
    {sidebarOpen&&<button className="scrim" onClick={()=>setSidebarOpen(false)} aria-label="Fechar menu"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{title}</strong></div></div><div className="topbar-actions"><button className="search-trigger" onClick={()=>notify("Busca global em desenvolvimento.")}><Search size={16}/><span>Buscar materiais...</span><kbd>⌘ K</kbd></button><button className="icon-btn notification" onClick={()=>notify("Você está em dia! Nenhuma notificação nova.")}><Bell size={18}/><i/></button><button className="top-avatar" onClick={()=>setModal("auth")}>G</button></div></header>
      <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> QUARTA-FEIRA, 24 DE NOVEMBRO</div><h1>{active==="Visão geral"?"Bom dia, estudante.":title}<span className="heading-period">.</span></h1><p className="subheading">{active==="Visão geral"?"Pequenos passos todos os dias. Vamos avançar no seu aprendizado?":"Seu espaço de aprendizado, organizado para você evoluir."}</p></div><button className="primary-btn" onClick={()=>setModal("task")}><Plus size={17}/> Nova tarefa</button></div>
        {active==="Visão geral" ? <>
          <section className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Tempo de estudo</span><span className="stat-icon purple"><Clock3 size={17}/></span></div><div className="stat-value">3h 25m</div><div className="stat-foot"><span className="trend"><ArrowUpRight size={14}/> 12%</span> vs. semana passada</div><div className="mini-bars">{[25,42,33,58,45,76,52,68,46,85,61,72].map((h,i)=><i key={i} style={{height:h+"%"}}/>)}</div></div>
            <div className="stat-card"><div className="stat-top"><span>Tarefas concluídas</span><span className="stat-icon green"><Check size={17}/></span></div><div className="stat-value">{completed}<small>/{tasks.length}</small></div><div className="stat-foot"><span className="trend"><ArrowUpRight size={14}/> {progress}%</span> do plano concluído</div><div className="progress-track"><i style={{width:progress+"%"}}/></div></div>
            <div className="stat-card"><div className="stat-top"><span>Sequência atual</span><span className="stat-icon orange"><Flame size={17}/></span></div><div className="stat-value">5 <small>dias</small></div><div className="stat-foot">Continue assim! <span className="muted">Você está evoluindo.</span></div><div className="streak-days">{["S","T","Q","Q","S","S","D"].map((d,i)=><span key={i} className={i<5?"streak-done":""}>{i<5?<Check size={12}/>:d}</span>)}</div></div>
            <div className="stat-card"><div className="stat-top"><span>Desempenho médio</span><span className="stat-icon blue"><Activity size={17}/></span></div><div className="stat-value">86<small>%</small></div><div className="stat-foot"><span className="trend"><ArrowUpRight size={14}/> 4,8%</span> nas últimas atividades</div><div className="sparkline"><svg viewBox="0 0 220 42" preserveAspectRatio="none"><path d="M0 33 C20 30 24 20 43 25 S68 34 86 17 S110 26 128 14 S154 19 173 9 S198 13 220 3" fill="none" stroke="#69b8ff" strokeWidth="2.5" strokeLinecap="round"/><path d="M0 33 C20 30 24 20 43 25 S68 34 86 17 S110 26 128 14 S154 19 173 9 S198 13 220 3 V42 H0Z" fill="url(#fadeBlue)" opacity=".16"/><defs><linearGradient id="fadeBlue" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#69b8ff"/><stop offset="1" stopColor="#69b8ff" stopOpacity="0"/></linearGradient></defs></svg></div></div>
          </section>
          <section className="content-grid">
            <div className="panel tasks-panel"><div className="panel-heading"><div><h2>Seu plano de hoje</h2><p>Organize seu ritmo e mantenha o foco.</p></div><button className="text-btn" onClick={()=>setActive("Planejamento")}>Ver planejamento <ArrowRight size={14}/></button></div><div className="task-progress"><div><strong>{completed} de {tasks.length} tarefas</strong><span>{progress}% concluído</span></div><div className="progress-track"><i style={{width:progress+"%"}}/></div></div><div className="task-list">{tasks.map(t=><div className={`task-row ${t.done?"task-completed":""}`} key={t.id}><button className={`task-check ${t.done?"checked":""}`} onClick={()=>toggleTask(t.id)}>{t.done&&<Check size={13}/>}</button><div className="task-main"><strong>{t.title}</strong><span><i style={{background:subjectColors[t.subject]||"#9b8cff"}}/>{t.subject}</span></div><div className="task-time"><Clock3 size={13}/>{t.time}</div><button className="icon-btn task-more" onClick={()=>removeTask(t.id)}><MoreHorizontal size={17}/></button></div>)}</div><button className="add-task" onClick={()=>setModal("task")}><Plus size={16}/> Adicionar tarefa</button></div>
            <div className="panel calendar-panel"><div className="panel-heading"><div><h2>Seu calendário</h2><p>Uma semana de cada vez.</p></div><button className="icon-btn" onClick={()=>setWeekOffset(v=>v-1)}><ChevronLeft size={17}/></button><button className="icon-btn" onClick={()=>setWeekOffset(v=>v+1)}><ChevronRight size={17}/></button></div><div className="week-strip">{week.map((d,i)=><button key={i} className={i===2&&weekOffset===0?"day active-day": "day"}><span>{d.d}</span><strong>{d.n}</strong><i className={i===2?"day-dot":""}/></button>)}</div><div className="calendar-divider"/><div className="agenda-title"><strong>Próximos passos</strong><span>HOJE</span></div><div className="agenda-item"><div className="agenda-time">14:30</div><div className="agenda-mark purple-mark"/><div><strong>Lista de exercícios</strong><small>Física · 45 min</small></div></div><div className="agenda-item"><div className="agenda-time">16:00</div><div className="agenda-mark green-mark"/><div><strong>Revisão espaçada</strong><small>Biologia · 20 min</small></div></div><button className="calendar-link" onClick={()=>setActive("Planejamento")}>Abrir calendário completo <ArrowRight size={14}/></button></div>
          </section>
          <section className="bottom-grid"><div className="panel subjects-panel"><div className="panel-heading"><div><h2>Suas matérias</h2><p>Acompanhe seu progresso por disciplina.</p></div><button className="icon-btn" onClick={()=>notify("Gerenciamento de matérias em breve.")}><MoreHorizontal size={18}/></button></div>{[{name:"Matemática",detail:"12 tópicos estudados",value:78},{name:"Biologia",detail:"8 tópicos estudados",value:64},{name:"Física",detail:"6 tópicos estudados",value:42}].map(s=><div className="subject-row" key={s.name}><div className="subject-symbol" style={{color:subjectColors[s.name],background:subjectColors[s.name]+"18"}}><BookOpen size={17}/></div><div className="subject-info"><div><strong>{s.name}</strong><span>{s.value}%</span></div><small>{s.detail}</small><div className="progress-track"><i style={{width:s.value+"%",background:subjectColors[s.name]}}/></div></div></div>)}</div>
          <div className="ai-card"><div className="ai-glow"/><div className="ai-card-top"><div className="ai-logo"><Sparkles size={19}/></div><span className="ai-tag">STUDY AI</span></div><div className="ai-card-copy"><span>SEU ASSISTENTE PESSOAL</span><h2>Aprender pode ser mais inteligente.</h2><p>Tire dúvidas, transforme materiais em resumos e pratique com questões personalizadas.</p></div><button onClick={()=>{setActive("Meu tutor IA");setModal("assistant");}}>Conversar com o tutor <ArrowRight size={15}/></button><div className="ai-orbit orbit-one"/><div className="ai-orbit orbit-two"/></div></section>
        </> : <section className="section-placeholder panel">
          {active==="Meu tutor IA"?<><div className="placeholder-icon"><BrainCircuit size={25}/></div><h2>Seu tutor, sempre por perto.</h2><p>Faça perguntas, peça explicações e aprofunde seus estudos. O tutor consulta os trechos relevantes dos seus materiais privados quando disponíveis.</p><div className="chat-demo"><div className="chat-bubble bot"><Sparkles size={15}/> Olá! Sou seu espaço de tutoria. Como posso ajudar nos seus estudos?</div>{answer&&<div className="chat-bubble bot">{answer}</div>}{aiLoading&&<div className="chat-bubble bot"><Sparkles size={15}/> Preparando sua explicação...</div>}<div className="chat-compose"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askTutor()} placeholder="Digite sua dúvida..." disabled={aiLoading}/><button onClick={askTutor} disabled={aiLoading}><ArrowRight size={17}/></button></div></div></>:
          active==="Materiais"?<><div className="placeholder-icon"><FolderOpen size={25}/></div><h2>Seu conhecimento, em um só lugar.</h2><p>Organize PDFs, documentos e anotações. O armazenamento privado e a análise inteligente dependem da configuração do backend.</p><button className="primary-btn" onClick={()=>setModal("upload")}><Upload size={16}/> Adicionar material</button>{materials.length>0&&<div className="material-library">{materials.map(m=><div className="uploaded-file" key={m.id}><FileText size={18}/><div className="material-file-meta"><strong>{m.file_name}</strong><span>{m.size_bytes?`${(m.size_bytes/1024/1024).toFixed(1)} MB`:"Arquivo"} · {m.processing_status==="ready"?"Lido e indexado":m.processing_status==="processing"?"Lendo material":m.processing_status==="failed"?"Falha na leitura": "Aguardando análise"}</span></div><button className="secondary-btn" onClick={()=>openMaterial(m.storage_path)}>Abrir</button><button className="icon-btn" onClick={()=>deleteMaterial(m)} title="Excluir material"><X size={15}/></button></div>)}</div>}{materials.length===0&&fileName&&<div className="uploaded-file"><FileText size={18}/>{fileName}<span>Enviado nesta sessão</span></div>}</>:
          active==="Simulados"?<><div className="placeholder-icon"><Target size={25}/></div><h2>Simulados personalizados</h2><p>Gere questões a partir dos materiais que você já enviou e receba correção automática com explicações.</p>
            <div className="activity-controls"><label>Questões<select value={activityCount} onChange={e=>setActivityCount(Number(e.target.value))}><option value={5}>5 questões</option><option value={10}>10 questões</option><option value={15}>15 questões</option><option value={20}>20 questões</option></select></label><label>Dificuldade<select value={activityDifficulty} onChange={e=>setActivityDifficulty(e.target.value)}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option><option value="mixed">Mista</option></select></label></div>
            <button className="primary-btn" disabled={activityLoading} onClick={()=>generateActivity("quiz")}>{activityLoading?"Gerando...":"Gerar simulado com meus materiais"} <Sparkles size={16}/></button>
            {selectedQuiz?<div className="activity-workspace"><div className="activity-heading"><div><strong>{selectedQuiz.title}</strong><small>{quizQuestions.length} questões · {selectedQuiz.difficulty}</small></div><button className="secondary-btn" onClick={()=>{setSelectedQuiz(null);setQuizResult(null);}}>Voltar</button></div>
              {quizQuestions.map((q,i)=><div className="quiz-question" key={q.id}><strong>{i+1}. {q.question}</strong><div className="quiz-options">{(q.options as string[]).map((option,j)=><button key={j} disabled={!!quizResult} className={quizResult?(j===Number(q.correct_answer)?"option-correct":quizAnswers[q.id]===j?"option-wrong":""):(quizAnswers[q.id]===j?"option-selected":"")} onClick={()=>setQuizAnswers(prev=>({...prev,[q.id]:j}))}><span>{String.fromCharCode(65+j)}</span>{option}</button>)}</div>{quizResult&&<div className="quiz-explanation"><b>{quizAnswers[q.id]===Number(q.correct_answer)?"Correto!":"Resposta correta: "+String.fromCharCode(65+Number(q.correct_answer))}</b><p>{q.explanation}</p></div>}</div>)}
              {quizResult?<div className="quiz-result"><strong>{quizResult.score}%</strong><span>{quizResult.correct} de {quizResult.total} acertos</span><button className="primary-btn" onClick={()=>{setSelectedQuiz(null);setQuizResult(null);}}>Concluir</button></div>:<button className="primary-btn full-btn" onClick={finishQuiz}>Finalizar e corrigir simulado</button>}
            </div>:<div className="activity-library"><strong>Seus simulados</strong>{quizzes.length?quizzes.map(q=><button className="activity-list-item" key={q.id} onClick={()=>openQuiz(q)}><Target size={17}/><span><b>{q.title}</b><small>{q.question_count} questões · {new Date(q.created_at).toLocaleDateString("pt-BR")}</small></span><ArrowRight size={15}/></button>):<small>Seus simulados gerados aparecerão aqui.</small>}</div>}</>:
          active==="Flashcards"?<><div className="placeholder-icon"><Zap size={25}/></div><h2>Revisão inteligente</h2><p>Crie baralhos automaticamente a partir dos seus arquivos e revise com intervalos progressivos.</p>
            <div className="activity-controls"><label>Cartões<select value={activityCount} onChange={e=>setActivityCount(Number(e.target.value))}><option value={5}>5 cartões</option><option value={10}>10 cartões</option><option value={15}>15 cartões</option><option value={20}>20 cartões</option></select></label><span className="activity-hint">Baseado nos materiais processados</span></div>
            <button className="primary-btn" disabled={activityLoading} onClick={()=>generateActivity("flashcards")}>{activityLoading?"Gerando...":"Gerar flashcards com IA"} <Sparkles size={16}/></button>
            {activeDeck?<div className="activity-workspace"><div className="activity-heading"><div><strong>{activeDeck.title}</strong><small>{deckCards.length} cartões restantes nesta sessão</small></div><button className="secondary-btn" onClick={()=>setActiveDeck(null)}>Voltar</button></div>
              {deckCards.length>0?<><button className={"review-card "+(cardFlipped?"review-card-back":"")} onClick={()=>setCardFlipped(v=>!v)}><small>{cardFlipped?"RESPOSTA":"PERGUNTA"} · TOQUE PARA VIRAR</small><strong>{cardFlipped?deckCards[cardIndex].back:deckCards[cardIndex].front}</strong></button>{cardFlipped&&<div className="review-actions"><button onClick={()=>reviewCard("again")}>Rever amanhã</button><button onClick={()=>reviewCard("good")}>Lembrei</button><button onClick={()=>reviewCard("easy")}>Fácil</button></div>}</>:<div className="quiz-result"><strong>Revisão concluída!</strong><span>Você revisou todos os cartões desta sessão.</span></div>}
            </div>:<div className="activity-library"><strong>Seus baralhos</strong>{decks.length?decks.map(d=><button className="activity-list-item" key={d.id} onClick={()=>openDeck(d)}><Zap size={17}/><span><b>{d.title}</b><small>{new Date(d.created_at).toLocaleDateString("pt-BR")}</small></span><ArrowRight size={15}/></button>):<small>Seus baralhos gerados aparecerão aqui.</small>}</div>}</>:
          <><div className="placeholder-icon"><CalendarDays size={25}/></div><h2>Planeje sua evolução.</h2><p>Crie metas, organize matérias e acompanhe seu cronograma de estudos.</p><button className="primary-btn" onClick={()=>setModal("task")}><Plus size={16}/> Adicionar tarefa</button><div className="plan-summary"><strong>Seu plano atual</strong><span>{tasks.length} tarefas · {completed} concluídas</span><div className="progress-track"><i style={{width:progress+"%"}}/></div></div></>}
        </section>}
        <footer className="footer"><span>© 2026 STUDY AI</span><span>Feito para aprender melhor <span className="footer-heart">✦</span></span><span className={isSupabaseConfigured?"connection-ok":"connection-demo"}>{isSupabaseConfigured?"● Conexão configurada":"● Modo demonstração"}</span></footer>
      </div>
    </main>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}><div className="modal"><div className="modal-head"><div><span className="eyebrow">STUDY AI</span><h2>{modal==="task"?"Nova tarefa":modal==="upload"?"Adicionar material":modal==="auth"?"Sua conta":"Tutor IA"}</h2></div><button className="icon-btn" onClick={()=>setModal(null)}><X size={19}/></button></div>
      {modal==="task"&&<><label>O que você precisa estudar?</label><input className="field" autoFocus value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Ex.: Revisar geometria analítica"/><button className="primary-btn full-btn" onClick={addTask}>Adicionar ao plano <ArrowRight size={16}/></button></>}
      {modal==="upload"&&<label className="dropzone"><Upload size={25}/><strong>Escolha um arquivo para começar</strong><span>PDF, DOCX, PPTX, TXT ou imagem</span><input type="file" accept=".pdf,.docx,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={e=>uploadFile(e.target.files?.[0])}/></label>}
      {modal==="auth"&&<><p className="modal-description">Entre ou crie sua conta para sincronizar seus estudos em todos os dispositivos.</p><label>E-mail</label><input className="field" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/><label>Senha</label><input className="field" type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/><div className="auth-actions"><button className="primary-btn" onClick={signIn}>Entrar</button><button className="secondary-btn" onClick={signUp}>Criar conta</button></div>{authMessage&&<p className="form-message">{authMessage}</p>}</>}
      {modal==="assistant"&&<><p className="modal-description">O tutor está conectado à IA e pode buscar trechos relevantes da sua biblioteca privada.</p><input className="field" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="O que você quer aprender?" disabled={aiLoading}/><button className="primary-btn full-btn" onClick={()=>{void askTutor();setModal(null);}}>Enviar pergunta <ArrowRight size={16}/></button></>}
    </div></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}
export default App;
