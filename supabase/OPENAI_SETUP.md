# Configuração segura da IA

A chave OpenAI **não deve ser adicionada ao Git, ao frontend, ao Vite ou ao arquivo .env público**.

No painel do projeto Supabase, abra **Edge Functions → Secrets** e cadastre:

- Nome: `OPENAI_API_KEY`
- Valor: sua chave OpenAI atual (não a copie para este arquivo).

A função `study-assistant` usa o segredo exclusivamente no servidor. O cliente exige uma sessão Supabase válida antes de chamar a função.

## Publicação

Instale e autentique o Supabase CLI e execute na raiz do projeto:

```bash
supabase link --project-ref bpjvbfjtbczpvkdpzrht
supabase functions deploy study-assistant
```

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas pelo ambiente gerenciado da Edge Function conforme a configuração do Supabase. Não coloque a service role no cliente.

## Uso no frontend

Importe `askStudyAI` de `src/lib/ai.ts`. Exemplo:

```ts
const answer = await askStudyAI("Explique fotossíntese", {
  mode: "professor",
  context: "Estou estudando biologia do ensino médio."
});
```

O tutor usa o modelo `gpt-4.1-mini` via Responses API. Ajuste o modelo no arquivo da Edge Function se necessário.
