# STUDY AI

Plataforma de estudos com IA — aplicação web responsiva e base para aplicativo desktop Windows.

> Estado inicial: fundação do frontend em desenvolvimento. Recursos que dependem de Supabase e de um provedor de IA só ficam ativos após configurar as credenciais no ambiente de implantação.

## Stack
- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth, PostgreSQL e Storage) — integração preparada
- Tauri (desktop Windows) — etapa posterior

## Desenvolvimento local

1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase.
4. Execute `npm run dev`.

Sem credenciais do Supabase, a interface abre em modo demonstração local. Esse modo não oferece autenticação real nem sincronização entre dispositivos.

## Variáveis de ambiente
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nunca coloque chaves `service_role` ou chaves privadas de provedores de IA no frontend.

## Publicação
O workflow do GitHub Actions publica o frontend no GitHub Pages. O Pages hospeda somente a aplicação estática; banco, autenticação, processamento de documentos e chamadas de IA precisam de serviços backend externos.

## Segurança
O esquema inicial do banco fica em `supabase/migrations`. Ative RLS e revise as políticas antes de armazenar dados reais. Não use dados pessoais reais no modo demonstração.
