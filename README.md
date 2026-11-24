# STUDY AI

Plataforma de estudos com IA, desenvolvida com React, TypeScript, Vite e Supabase.

## Recursos implementados
- Interface responsiva para desktop, tablet e celular.
- Autenticação por e-mail e senha via Supabase Auth.
- Tarefas de estudo persistidas por usuário.
- Upload de materiais para bucket privado do Supabase Storage (limite de 50 MB).
- Extração de texto e indexação semântica de PDF com texto, DOCX, PPTX, TXT e CSV.
- Busca vetorial dos trechos relevantes da biblioteca privada durante as respostas do tutor, com referência ao arquivo e página quando disponível.
- Tutor IA com histórico de conversas privado por usuário.
- Geração de simulados personalizados a partir dos materiais, com alternativas, correção automática, explicações e registro de tentativas.
- Geração de flashcards a partir dos materiais, com revisão e intervalos progressivos.
- Banco de dados para matérias, sessões, flashcards, simulados, metas e trechos de materiais com embeddings.
- Políticas RLS para isolamento dos dados por usuário.

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage e Edge Functions
- OpenAI Responses API e embeddings (chamadas somente no backend)
- Tauri para o aplicativo Windows (etapa posterior)

## Desenvolvimento local
1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env.local`.
4. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave publicável do projeto.
5. Execute `npm run dev`.

Sem sessão autenticada, o site mostra dados de demonstração; os dados privados só são sincronizados após login.

## Configuração do backend de IA
As Edge Functions `study-assistant`, `process-material` e `study-generator` estão implantadas no Supabase e exigem JWT válido. O processamento de materiais extrai texto de PDF textual, DOCX, PPTX, TXT e CSV e gera embeddings com `text-embedding-3-small`. O tutor usa busca vetorial para recuperar trechos relevantes. O gerador cria simulados e flashcards a partir dos materiais processados. O responsável pelo projeto informou que cadastrou `OPENAI_API_KEY` em Supabase → Edge Functions → Secrets. O valor do segredo não é legível pelas ferramentas conectadas e nunca é armazenado no repositório. As funções utilizam `gpt-4.1-mini` pela Responses API.

## Banco de dados
A estrutura foi aplicada no projeto Supabase `bpjvbfjtbczpvkdpzrht`. Inclui perfis, matérias, tarefas, materiais, chunks vetoriais, sessões, conversas, mensagens, flashcards, simulados, tentativas, respostas e metas. As tabelas de dados pessoais têm RLS habilitado.

## Publicação
O GitHub Actions compila o frontend e publica no GitHub Pages. O Pages hospeda somente a aplicação estática; autenticação, banco, armazenamento e IA são fornecidos pelo Supabase.

## Segurança e limitações
- Não inclua chaves privadas, service-role ou OpenAI no código do navegador.
- Não desative RLS em tabelas com dados de usuários.
- O bucket `study-materials` é privado e cada usuário só pode acessar os próprios arquivos.
- O limite atual do upload é 50 MB.
- PDF digitalizado e imagem ainda precisam de OCR; a extração atual é para documentos que já contêm texto.
- O fluxo completo deve ser validado com uma conta autenticada real.
- O aplicativo Windows com Tauri permanece em desenvolvimento.

## Estado atual
O backend de tutor, processamento de materiais e geração de atividades está implantado. Simulados e flashcards são persistidos por usuário. Ainda falta validar o fluxo completo na interface com uma conta real e implementar OCR para documentos digitalizados/imagens.
