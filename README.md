# STUDY AI

Plataforma de estudos com IA, desenvolvida com React, TypeScript, Vite e Supabase.

## Recursos implementados
- Interface responsiva para desktop, tablet e celular.
- Autenticação por e-mail e senha via Supabase Auth.
- Tarefas de estudo persistidas por usuário.
- Upload de materiais para bucket privado do Supabase Storage.
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
A Edge Function `study-assistant` está implantada no projeto Supabase e exige JWT válido. Configure a chave OpenAI como segredo do projeto, nunca no frontend:

- Supabase Dashboard → Edge Functions → Secrets
- Nome: `OPENAI_API_KEY`
- Valor: sua chave OpenAI atual

A função utiliza `gpt-4.1-mini` pela Responses API. Consulte [supabase/OPENAI_SETUP.md](supabase/OPENAI_SETUP.md).

## Banco de dados
A estrutura foi aplicada no projeto Supabase `bpjvbfjtbczpvkdpzrht`. Inclui perfis, matérias, tarefas, materiais, chunks vetoriais, sessões, conversas, mensagens, flashcards, simulados, tentativas, respostas e metas. Todas as tabelas têm RLS habilitado.

## Publicação
O GitHub Actions compila o frontend e tenta publicar no GitHub Pages. O Pages hospeda somente a aplicação estática; Auth, banco, storage e IA são fornecidos pelo Supabase.

## Segurança
- Não inclua chaves privadas, service-role ou OpenAI no código do navegador.
- Não desative RLS em tabelas com dados de usuários.
- O bucket `study-materials` é privado e cada usuário só pode acessar a própria pasta.
- O limite atual do upload é 50 MB.
- A função de IA exige sessão autenticada e limita o tamanho da entrada.

## Estado atual
A fundação do banco e a Edge Function já estão implantadas. O tutor só responderá quando `OPENAI_API_KEY` for cadastrada nos Secrets do Supabase. O fluxo de upload armazena os arquivos e registra seus metadados; extração de texto/OCR e indexação vetorial ainda precisam ser implementadas. A geração completa de simulados e flashcards e o aplicativo Tauri também permanecem em desenvolvimento.
