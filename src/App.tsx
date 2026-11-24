import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, BrainCircuit, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, Flame, FolderOpen, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, Sparkles, Target, Upload, X, Zap } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { askStudyAI } from "./lib/ai";

type Task = { id: string; title: string; subject: string; time: string; done: boolean };
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string|null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [toast, setToast] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  useEffect(() => { if (!userEmail) localStorage.setItem("study-ai-tasks", JSON.stringify(tasks)); }, [tasks,userEmail]);
  useEffect(() => { if (!supabase) return; supabase.auth.getSession().then(({data}) => setUserEmail(data.session?.user.email ?? null)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>{ setUserEmail(s?.user.email??null); setConversationId(null); setAnswer(""); if(!s?.user){setTasks(initialTasks);setFileName("");} }); return ()=>data.subscription.unsubscribe(); }, []);
  useEffect(() => { let alive=true; const load=async()=>{ if(!supabase||!userEmail) return; const {data,error}=await supabase.from("study_tasks").select("id,title,completed_at,due_at,subjects(name)").order("created_at",{ascending:false}); if(!alive)return; if(error){notify("Não foi possível carregar suas tarefas.");return;} setTasks((data??[]).map((t:any)=>({id:t.id,title:t.title,subject:t.subjects?.name??"Geral",time:t.due_at?new Date(t.due_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"Sem horário",done:Boolean(t.completed_at)}))); }; void load(); return()=>{alive=false;}; }, [userEmail]);
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
    setFileName(file.name); notify("Material enviado com segurança para sua biblioteca."); setModal(null);
  };
  const signIn = async () => { if (!supabase) { setAuthMessage("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para ativar contas reais."); return; } const {error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPassword}); setAuthMessage(error?.message ?? "Login realizado."); };
  const signUp = async () => { if (!supabase) { setAuthMessage("Configure o Supabase para criar contas individuais com segurança."); return; } const {error}=await supabase.auth.signUp({email:authEmail,password:authPassword}); setAuthMessage(error?.message ?? "Verifique seu e-mail para confirmar a conta."); };
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
          {active==="Meu tutor IA"?<><div className="placeholder-icon"><BrainCircuit size={25}/></div><h2>Seu tutor, sempre por perto.</h2><p>Faça perguntas, peça explicações e aprofunde seus estudos. A conexão com o serviço de IA será ativada na etapa de backend.</p><div className="chat-demo"><div className="chat-bubble bot"><Sparkles size={15}/> Olá! Sou seu espaço de tutoria. Como posso ajudar nos seus estudos?</div>{answer&&<div className="chat-bubble bot">{answer}</div>}{aiLoading&&<div className="chat-bubble bot"><Sparkles size={15}/> Preparando sua explicação...</div>}<div className="chat-compose"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askTutor()} placeholder="Digite sua dúvida..." disabled={aiLoading}/><button onClick={askTutor} disabled={aiLoading}><ArrowRight size={17}/></button></div></div></>:
          active==="Materiais"?<><div className="placeholder-icon"><FolderOpen size={25}/></div><h2>Seu conhecimento, em um só lugar.</h2><p>Organize PDFs, documentos e anotações. O armazenamento privado e a análise inteligente dependem da configuração do backend.</p><button className="primary-btn" onClick={()=>setModal("upload")}><Upload size={16}/> Adicionar material</button>{fileName&&<div className="uploaded-file"><FileText size={18}/>{fileName}<span>Selecionado nesta sessão</span></div>}</>:
          active==="Simulados"?<><div className="placeholder-icon"><Target size={25}/></div><h2>Pratique para chegar mais longe.</h2><p>Os simulados personalizados serão gerados com base nos seus materiais quando a integração de IA estiver conectada.</p><button className="primary-btn" onClick={()=>notify("O gerador de simulados será conectado ao motor de IA.")}>Preparar simulado <ArrowRight size={16}/></button></>:
          active==="Flashcards"?<><div className="placeholder-icon"><Zap size={25}/></div><h2>Memorize no seu ritmo.</h2><p>Flashcards com revisão espaçada para transformar conteúdo em conhecimento duradouro.</p><div className="flashcard" onClick={e=>e.currentTarget.classList.toggle("flipped")}><span>TOQUE PARA REVELAR</span><strong>O que é fotossíntese?</strong><small>Resposta no verso ↗</small></div></>:
          <><div className="placeholder-icon"><CalendarDays size={25}/></div><h2>Planeje sua evolução.</h2><p>Crie metas, organize matérias e acompanhe seu cronograma de estudos.</p><button className="primary-btn" onClick={()=>setModal("task")}><Plus size={16}/> Adicionar tarefa</button><div className="plan-summary"><strong>Seu plano atual</strong><span>{tasks.length} tarefas · {completed} concluídas</span><div className="progress-track"><i style={{width:progress+"%"}}/></div></div></>}
        </section>}
        <footer className="footer"><span>© 2026 STUDY AI</span><span>Feito para aprender melhor <span className="footer-heart">✦</span></span><span className={isSupabaseConfigured?"connection-ok":"connection-demo"}>{isSupabaseConfigured?"● Conexão configurada":"● Modo demonstração"}</span></footer>
      </div>
    </main>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}><div className="modal"><div className="modal-head"><div><span className="eyebrow">STUDY AI</span><h2>{modal==="task"?"Nova tarefa":modal==="upload"?"Adicionar material":modal==="auth"?"Sua conta":"Tutor IA"}</h2></div><button className="icon-btn" onClick={()=>setModal(null)}><X size={19}/></button></div>
      {modal==="task"&&<><label>O que você precisa estudar?</label><input className="field" autoFocus value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Ex.: Revisar geometria analítica"/><button className="primary-btn full-btn" onClick={addTask}>Adicionar ao plano <ArrowRight size={16}/></button></>}
      {modal==="upload"&&<label className="dropzone"><Upload size={25}/><strong>Escolha um arquivo para começar</strong><span>PDF, DOCX, PPTX, TXT ou imagem</span><input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" onChange={e=>uploadFile(e.target.files?.[0])}/></label>}
      {modal==="auth"&&<><p className="modal-description">Entre ou crie sua conta para sincronizar seus estudos em todos os dispositivos.</p><label>E-mail</label><input className="field" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="voce@email.com"/><label>Senha</label><input className="field" type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/><div className="auth-actions"><button className="primary-btn" onClick={signIn}>Entrar</button><button className="secondary-btn" onClick={signUp}>Criar conta</button></div>{authMessage&&<p className="form-message">{authMessage}</p>}</>}
      {modal==="assistant"&&<><p className="modal-description">O tutor está pronto para receber sua dúvida. A geração de respostas reais será ativada após conectar o backend de IA.</p><input className="field" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="O que você quer aprender?" disabled={aiLoading}/><button className="primary-btn full-btn" onClick={()=>{void askTutor();setModal(null);}}>Enviar pergunta <ArrowRight size={16}/></button></>}
    </div></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}
export default App;
