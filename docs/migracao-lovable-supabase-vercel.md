# Sair do Lovable → Supabase próprio + Vercel

## Contexto

O projeto roda inteiro dentro do Lovable hoje: o Supabase (`tsvgweufuczlzskeoqma`)
é provisionado como "Lovable Cloud" — `mcp__claude_ai_Supabase__list_projects`
retornou vazio na sua conta, ou seja, ele não aparece no seu Supabase pessoal.
O build usa `@lovable.dev/vite-tanstack-config` (que já embute o plugin
Cloudflare, proxy de assets do sandbox Lovable e outras coisas amarradas ao
ambiente deles) e o deploy atual mira Cloudflare Workers (`wrangler.jsonc`),
não Vercel. Tem também um servidor MCP (`@lovable.dev/mcp-js`, rota `/mcp`,
consent OAuth em `/.lovable/oauth/consent`) — combinado que sai.

Estratégia: **paralelo, não corte seco**. O Lovable continua no ar,
funcionando normalmente para a Anna, do começo ao fim da migração. A gente
constrói a cópia — Supabase próprio + Vercel — do lado, testa à vontade sem
pressa e sem risco, porque ninguém depende dela ainda. Só quando a cópia
estiver validada de ponta a ponta é que a gente aponta o domínio real para
ela e desliga o Lovable. Nenhum registro (pacientes, atendimentos, despesas,
contas, usuários, logo enviada) pode se perder nesse meio-tempo.

Você respondeu "não sei, preciso verificar" sobre ter acesso direto ao banco
(dashboard/connection string). Por isso a Fase 0 existe: ela decide qual
caminho de cópia de dados a Fase 3 usa.

## Fase 0 — Descobrir o nível de acesso ao Supabase (bloqueante)

1. No editor do Lovable, abrir o painel de Database/Supabase do projeto e
   procurar por "Connect" / "Database settings" / "Connection string". Anotar
   se existe host + porta + usuário + senha do Postgres (formato
   `postgresql://postgres:[senha]@db.tsvgweufuczlzskeoqma.supabase.co:5432/postgres`
   ou o pooler correspondente).
2. Também checar se dá para logar direto em https://supabase.com/dashboard
   com o projeto `tsvgweufuczlzskeoqma` aparecendo — significaria que você já
   é owner/colaborador do projeto Supabase por trás, só não sincronizado com
   a conta usada aqui no MCP.
3. Resultado decide a Fase 3:
   - **Tem connection string ou acesso ao dashboard** → migração via
     `pg_dump`/`pg_restore` direto (Fase 3-A), preserva UUIDs de
     `auth.users` sem retrabalho.
   - **Só tem URL pública + chave anônima** → migração via API
     (`@supabase/supabase-js` com service role, se conseguir pedir a chave
     ao Lovable) ou exportação tabela a tabela (Fase 3-B), mais lenta e
     exige recriar o mapeamento de UUIDs de usuário.

Não avançar para Fase 3 sem essa resposta.

## Fase 1 — Provisionar o novo Supabase (sem tocar em produção)

1. Criar projeto Supabase novo, na sua conta (`mcp__claude_ai_Supabase__create_project`
   ou dashboard), região próxima da atual.
2. Replayar o schema: `supabase/migrations/` já tem as 27 migrations completas
   e versionadas no repo — é a fonte da verdade do schema. Rodar
   `supabase link --project-ref <novo-ref>` e `supabase db push` (ou
   `mcp__claude_ai_Supabase__apply_migration` uma a uma) contra o projeto novo,
   **vazio**, sem dados ainda.
3. Recriar o bucket `logos` (único bucket em uso — confirmado via
   `grep storage.from(` no código) com as mesmas políticas de acesso
   (RLS de storage: users só leem/escrevem sob seu próprio prefixo,
   conforme `use-logo.ts`).
4. Conferir que `list_tables`/`get_advisors` no projeto novo não acusam nada
   fora do que existe no projeto Lovable — schema tem que bater 1:1 antes de
   qualquer dado entrar.

Nada disso afeta o app em produção: é um projeto Supabase paralelo, vazio.

## Fase 2 — Desacoplar o app do Lovable (ainda apontando pro Supabase antigo)

Objetivo desta fase: o código builda e roda sem nenhum pacote/rota do
Lovable, mas ainda contra o banco de produção atual — para validar que nada
quebrou antes de trocar o banco também. Dois riscos separados não se
misturam.

1. **`vite.config.ts`**: substituir `@lovable.dev/vite-tanstack-config` por
   uma config manual com os mesmos plugins que ele hoje compõe:
   `tanstackStart` (entry `server`), `viteReact`, `@tailwindcss/vite`,
   `vite-tsconfig-paths`. Remover o `mcpPlugin()`.
2. **Remover MCP e OAuth consent do Lovable** (decisão já tomada: remover):
   - apagar `src/routes/mcp.ts`, `src/routes/[.mcp]/`,
     `src/routes/[.well-known]/oauth-protected-resource.ts`,
     `src/routes/[.]lovable.oauth.consent.tsx`, `src/lib/mcp/`,
     `.lovable/mcp/manifest.json`.
   - remover `@lovable.dev/mcp-js` do `package.json`.
   - conferir `src/routes/__root.tsx` e `src/routes/sitemap[.]xml.ts` por
     referências a essas rotas (apareceram no grep) e limpar.
3. **`package.json`**: remover `@lovable.dev/vite-tanstack-config`,
   `@lovable.dev/mcp-js`, `@cloudflare/vite-plugin`. Trocar `wrangler.jsonc`
   por config do Nitro para o preset Vercel (`nitro.config.ts` com
   `preset: "vercel"`, ou deixar zero-config — Nitro detecta Vercel
   automaticamente no build).
4. **Assets/URLs hardcoded do Lovable**: `src/routes/__root.tsx` e
   `src/routes/login.tsx` têm `og:url` e imagem og hospedada em
   `*.r2.dev`/`*.lovable.app` — trocar pelo domínio final e subir a imagem
   og para `public/`.
5. Rodar `bun run check` (typecheck + lint + test + build) localmente.
   Não faz push ainda — só valida que o app funciona sem o Lovable no meio,
   apontando pro banco de produção atual via `.env.production` local.

## Fase 3 — Copiar os dados (primeira cópia, de validação)

Lovable continua no ar, Anna continua usando ele normalmente. Esta é uma
**cópia**, não uma migração destrutiva — o banco antigo não é tocado, só
lido. Ela serve para validar todo o resto (Fases 4, 6) contra dados reais.
Como o Lovable segue recebendo escritas depois desta cópia, ela vai ficando
desatualizada — por isso a Fase 7 repete este mesmo processo como
**resincronização final**, no dia do corte, e essa segunda rodada é a que
precisa estar 100% completa.

### Fase 3-A — se houver connection string (caminho recomendado)

1. `pg_dump` do projeto Lovable, schemas `public` e `auth` (preserva UUIDs de
   usuário — crítico, porque toda tabela de negócio tem `user_id` referenciando
   `auth.users.id`), formato custom:
   `pg_dump -Fc --schema=public --schema=auth "postgresql://...tsvgweufuczlzskeoqma..." -f backup.dump`
2. `pg_restore` no projeto novo (schema `public` já existe da Fase 1 —
   restaurar só os dados, `--data-only`, ou dropar e restaurar schema+dados
   juntos e comparar com as migrations depois).
3. Storage (`bucket logos`): script pequeno que lista objetos via
   `storage.from("logos").list()` no projeto antigo, baixa cada um
   (`download()`) e reenvia (`upload()`) no projeto novo, mesmo `path` —
   metadata de storage não vem no `pg_dump` do jeito que os arquivos
   binários precisam.
4. Conferir contagem de linhas por tabela (`select count(*)`) e contagem de
   objetos no bucket, projeto antigo vs. novo — têm que bater exatamente.

### Fase 3-B — sem connection string (fallback)

1. Pedir ao Lovable a `service_role` key do projeto (ou exportação de dados)
   — só com ela dá para ler todas as linhas sem RLS bloquear.
2. Script Node com `@supabase/supabase-js` (service role) lendo cada tabela
   do projeto antigo e inserindo no novo, na ordem que respeita as foreign
   keys (`pacientes` antes de `atendimentos`, etc. — checar
   `supabase/migrations/` pelas `references`).
3. `auth.users`: sem acesso direto ao Postgres, recriar usuários via Admin
   API (`supabase.auth.admin.createUser`) no projeto novo. **UUIDs mudam.**
   Precisa de um passo extra: mapear UUID-antigo → UUID-novo e rodar
   `UPDATE` em todo `user_id` das tabelas de negócio no projeto novo, para
   religar os dados aos usuários certos.
4. Storage: mesmo processo de download/upload da 3-A.
5. Mesma conferência de contagens no final.

## Fase 4 — Deploy de teste na Vercel (domínio provisório)

Objetivo: ter a cópia inteira — app + Supabase próprio — rodando num
endereço da Vercel (tipo `dental-flow.vercel.app`) que só você acessa. O
domínio real (`annajuliaodonto...`) continua apontado para o Lovable.

1. Criar projeto na Vercel a partir do repositório GitHub
   (`Jarvas2308/dental-flow`).
2. Variáveis de ambiente na Vercel: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY` (e as equivalentes sem prefixo, usadas no
   server — ver `src/integrations/supabase/client.ts`) apontando para o
   **projeto Supabase novo**, não o do Lovable.
3. Build: Nitro detecta o preset Vercel automaticamente; conferir que
   `bun run build` gera a saída certa localmente antes do primeiro deploy.
4. Deploy na Vercel usando o domínio provisório dela — sem mexer em DNS.

## Fase 5 — Validar a cópia lado a lado com o Lovable

Com Lovable e a cópia rodando ao mesmo tempo, comparar os dois de verdade.

1. Login com um usuário real (dados copiados na Fase 3) funciona na cópia.
2. Dashboard, listas de pacientes/atendimentos/contas mostram os mesmos
   números que o Lovable mostra agora — comparar lado a lado.
3. Testar fluxo completo: criar um atendimento de teste, editar, marcar
   recebimento, excluir — na cópia, sem afetar o Lovable.
4. Upload de logo funciona, arquivo aparece no bucket `logos` do Supabase
   novo.
5. Dark mode, mobile, todas as rotas do `src/lib/nav.ts` abrem sem erro.
6. Qualquer bug encontrado aqui é corrigido e testado de novo — sem pressa,
   o Lovable segue sendo o sistema real da Anna enquanto isso.

## Fase 6 — Congelar escopo, decidir a data do corte

Só chegar aqui depois da Fase 5 dar 100% certo por um tempo (alguns dias de
uso de teste, se possível). Combinar com a Anna uma janela curta (ex: fora
do expediente) para o corte final — é o único momento em que a ordem
importa, porque entre a última cópia e a troca de domínio nenhuma escrita
nova no Lovable pode ficar de fora.

## Fase 7 — Corte: resincronizar e trocar o domínio

1. No horário combinado, rodar a Fase 3 **de novo, por completo** — essa é
   a resincronização final, captura tudo que a Anna registrou no Lovable
   desde a primeira cópia. Mesmas checagens de contagem de linhas/objetos.
2. Trocar o domínio real (DNS / custom domain) para apontar pra Vercel.
3. Verificar em produção, no domínio real: login, dados batendo, upload de
   logo — os mesmos checks da Fase 5, agora valendo pra Anna.

## Fase 8 — Matar o Lovable

1. Manter o projeto Lovable **pausado, não deletado**, por pelo menos
   1–2 semanas como rede de segurança — se aparecer algo errado na cópia,
   ainda dá pra religar o domínio nele.
2. Passado esse período sem problema, decomissionar de vez (deletar
   projeto Lovable, revogar chaves antigas do Supabase-Lovable).
3. Atualizar `docs/HANDOFF.md` e `.env.example` com a nova realidade
   (sem Lovable Cloud, Supabase próprio, deploy Vercel).

## Verificação em cada fase

- Fase 1: `mcp__claude_ai_Supabase__list_tables` no projeto novo bate com a
  lista de tabelas das migrations.
- Fase 2: `bun run check` passa localmente, sem nenhum import de
  `@lovable.dev/*` restando (`grep -rn "@lovable.dev" src package.json`).
- Fase 3: contagem de linhas por tabela e de objetos no bucket, antigo vs.
  novo, idênticas.
- Fase 4: deploy funcional no domínio provisório da Vercel.
- Fase 5: checklist lado a lado (login, dados, CRUD, upload, tema, rotas)
  todo verde na cópia, sem afetar o Lovable.
- Fase 7: resync final com contagens batendo, domínio real na Vercel
  respondendo igual ou melhor que o Lovable respondia.
- Fase 8: Lovable pausado, depois removido; docs atualizados.
