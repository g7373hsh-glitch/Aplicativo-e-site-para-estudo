# STUDY AI

Plataforma de estudos com IA, desenvolvida com React, TypeScript, Vite e Supabase.

## Recursos implementados
- Interface responsiva para desktop, tablet e celular.
- Autenticação por e-mail e senha via Supabase Auth.
- Tarefas de estudo persistidas por usuário.
- Upload de materiais para bucket privado do Supabase Storage (limite de 50 MB).\n- Extração de texto e indexação semântica de PDF com texto, DOCX, PPTX, TXT e CSV.\n- Busca vetorial dos trechos relevantes da biblioteca privada durante as respostas do tutor, com referência ao arquivo e página quando disponível.
- Tutor IA via Supabase Edge Function e OpenAI Responses API.
- Histórico de conversas e mensagens com isolamento por usuário.
- Banco de dados para matérias, sessões, flashcards, simulados, metas e trechos de materiais com embeddings.
- RLS nas tabelas e políticas de acesso por proprietário.

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage e Edge Functions
- OpenAI Responses API (chamada somente no backend)
- Tauri para o aplicativo Windows (etapa posterior)

## Desenvolvimento local
1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env.local`.
4. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave publicável do projeto.
5. Execute `npm run dev`.

Sem sessão autenticada, o site mostra dados de demonstração; os dados privados só são sincronizados após login.

## Configuração do backend de IA
As Edge Functions `study-assistant` e `process-material` estão implantadas no projeto Supabase e exigem JWT válido. `process-material` extrai texto de PDF textual, DOCX, PPTX, TXT e CSV e gera embeddings com `text-embedding-3-small`. O responsável pelo projeto informou que já cadastrou `OPENAI_API_KEY` em Supabase → Edge Functions → Secrets. O valor do segredo não é legível pelas ferramentas conectadas e nunca é armazenado no repositório. A função utiliza `gpt-4.1-mini` pela Responses API. O teste ponta a ponta ainda depende de executar upload e conversa com uma conta autenticada na aplicação.

## Banco de dados
A estrutura foi aplicada no projeto Supabase `bpjvbfjtbczpvkdpzrht`. Inclui perfis, matérias, tarefas, materiais, chunks vetoriais, sessões, conversas, mensagens, flashcards, simulados, tentativas, respostas e metas. Todas as tabelas têm RLS habilitado.

## Publicação
O GitHub Actions compila o frontend e publica no GitHub Pages. O último deploy confirmado concluiu build e deploy com sucesso. O Pages hospeda somente a aplicação estática; Auth, banco, storage e IA são fornecidos pelo Supabase.

## Segurança
- Não inclua chaves privadas, service-role ou OpenAI no código do navegador.
- Não desative RLS em tabelas com dados de usuários.
- O bucket `study-materials` é privado e cada usuário só pode acessar a própria pasta.
- O limite atual do upload é 50 MB.
- A função de IA exige sessão autenticada e limita o tamanho da entrada.

## Estado atual
A fundação do banco e as Edge Functions estão implantadas. `OPENAI_API_KEY` foi informada como cadastrada nos Secrets; falta validar uma sessão real de upload, indexação e conversa. O processamento de PDF textual, DOCX, PPTX, TXT e CSV e a busca vetorial pelo tutor estão implementados. PDFs digitalizados e imagens ainda precisam de OCR. A geração completa de simulados e flashcards e o aplicativo Tauri permanecem em desenvolvimento.
