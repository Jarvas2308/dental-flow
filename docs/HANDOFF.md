# Handoff Técnico — Sistema Financeiro Odontológico

Documento final de transferência técnica. Descreve o estado atual do sistema,
as regras financeiras consolidadas, fluxos principais, RPCs, testes, pendências
técnicas controladas e comandos úteis.

---

## 1. Resumo do estado atual

Sistema pessoal de gestão financeira para consultório odontológico (usuário
único: o proprietário). Stack: **TanStack Start (React 19)** + **Tailwind CSS v4**

- **shadcn/UI** no frontend e **Lovable Cloud (Supabase / PostgreSQL)** no backend.

Estado atual:

- Regras financeiras centralizadas em `src/lib/finance.ts` e reutilizadas por
  **Dashboard**, **Fluxo de Caixa** e **Consultório**, evitando divergência
  entre telas.
- Busca de dados do Consultório otimizada: carrega atendimentos do período
  selecionado **mais** atendimentos antigos ainda com saldo em aberto, sem
  puxar todo o histórico.
- Paginação client-side simples (hook `usePagination` + componente
  `TablePagination`) aplicada nas tabelas mais pesadas: Consultório, Despesas
  (Contas), Consultas e Follow-up. A paginação afeta apenas a renderização;
  totais, filtros e ordenação operam sobre a lista completa.
- Testes unitários de `finance.ts` com Vitest.
- Lint configurado (ESLint + Prettier); formatação normalizada.

Testes, typecheck e build estão passando.

---

## 2. Regras financeiras finais

Regime de **caixa** — só valores efetivamente movimentados entram no resultado
realizado.

- **Recebimento** entra pela **data do recebimento**.
- **Despesa paga** entra pela **`data_pagamento`**.
- **Despesa pendente** entra pelo **vencimento**.
- **Despesa pendente não reduz** o caixa realizado.
- **Caixa realizado** = recebimentos efetivos − despesas pagas.
- **Resultado previsto** = caixa realizado − despesas pendentes.
- Atendimentos antigos com saldo em aberto podem aparecer no Consultório **sem**
  que seus recebimentos antigos entrem no mês atual (o recebimento continua
  contabilizado apenas no mês em que ocorreu).
- Valor líquido é derivado da taxa da forma de pagamento; cálculos financeiros
  não devem ser alterados.

Helpers principais em `src/lib/finance.ts`:

| Helper                                                                     | Finalidade                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| `fatorLiquido(a)`                                                          | Fator bruto→líquido de um atendimento (considera taxa). |
| `resumoAtendimento(...)`                                                   | Total, recebido, saldo, status por atendimento.         |
| `receitasRecebidas(...)`                                                   | Entradas efetivamente recebidas.                        |
| `valoresEmAberto(...)`                                                     | Saldos pendentes por atendimento.                       |
| `contasAReceber(...)`                                                      | Lista consolidada de contas a receber.                  |
| `noMes(data, mes)`                                                         | Verifica se uma data pertence ao mês (`monthKey`).      |
| `recebimentosNoMes(...)`                                                   | Recebimentos filtrados pela data do recebimento.        |
| `despesasPagas / despesasPagasNoMes / totalDespesasPagasNoMes`             | Despesas pagas por `data_pagamento`.                    |
| `despesasPendentes / despesasPendentesNoMes / totalDespesasPendentesNoMes` | Despesas pendentes por vencimento.                      |
| `caixaRealizado(entradas, saidasPagas)`                                    | Recebimentos − despesas pagas.                          |
| `resultadoPrevisto(caixa, pendentes)`                                      | Caixa realizado − despesas pendentes.                   |

---

## 3. Fluxo de recebimentos

- Um atendimento à vista conta quando `status_pagamento != 'pendente'`.
- Um atendimento **parcelado** não gera parcelas fixas: o valor combinado fica
  como conta a receber e cada **recebimento real** (de valor livre) é
  contabilizado individualmente, na sua própria data.
- Recebimento gravado com valor bruto, taxa e valor líquido coerentes
  (validado na RPC: `valor_liquido ≈ valor * (1 - taxa/100)`).
- A soma dos recebimentos não pode exceder o valor bruto do atendimento
  (tolerância mínima).
- Recebimento de saldo pendente valida valor > 0 e ≤ saldo restante.
- Proteção contra recebimento duplicado no frontend (estado de submit/pending).
- Compatibilidade: atendimentos antigos com registros na tabela `parcelas`
  continuam tratados pelas parcelas pagas.

---

## 4. Fluxo de despesas recorrentes

- Geração via RPC `gerar_despesas_recorrentes(p_competencia date)`.
- Para cada despesa base recorrente (`recorrente = true` e `origem_id IS NULL`),
  cria a ocorrência do mês da competência com vencimento ajustado ao último dia
  válido do mês.
- Despesas de tipo `variavel` são criadas com valor nulo (a preencher).
- Idempotente: `ON CONFLICT DO NOTHING` impede duplicação; a RPC retorna
  `{ criadas, existentes }`.
- Despesa pendente entra no cálculo por vencimento e não reduz o caixa realizado
  até ser paga (`data_pagamento`).

---

## 5. Regras de nota fiscal

- Campo `nota_fiscal_status` no atendimento.
- Valores permitidos (validados na RPC `salvar_atendimento_completo`):
  `pendente`, `emitida`, `nao_emitida`, `nao_se_aplica`.
- Status inválido gera exceção na RPC.
- Exibição com badge de status na UI. Comportamento visual preservado.

---

## 6. Vínculo por `paciente_id`

- Atendimentos referenciam `paciente_id` (FK para `pacientes`), validado na RPC
  contra o `user_id` do usuário autenticado.
- Histórico do paciente prioriza `paciente_id`; o nome normalizado é usado
  apenas como fallback disjunto (`buildPacienteHistoryCounter` em
  `src/lib/pacientes.ts`), para contemplar registros antigos sem `paciente_id`.

---

## 7. RPCs existentes

| RPC                                         | Finalidade                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `salvar_atendimento_completo(...)`          | Cria/edita atendimento com procedimentos e recebimentos numa única transação. Valida paciente, valor bruto, data, status de NF, coerência de cada recebimento (valor/taxa/líquido) e que a soma dos recebimentos não exceda o valor bruto. Retorna `{ atendimento_id, created, procedimentos, recebimentos }`. |
| `gerar_despesas_recorrentes(p_competencia)` | Gera as ocorrências mensais das despesas recorrentes para a competência informada, de forma idempotente. Retorna `{ criadas, existentes }`.                                                                                                                                                                    |

Ambas usam `auth.uid()` e `SET search_path = public`.

---

## 8. Testes existentes

Suíte em Vitest, executada com `bun run test`. O estado atualizado da cobertura
está na seção 15.5; o núcleo financeiro continua sendo `src/lib/finance.test.ts`,
com os cenários de regime de caixa:

- Recebimento entra no mês pela data do recebimento.
- Recebimento de mês anterior não entra no mês atual.
- Cada recebimento é contabilizado na sua própria data.
- Despesa paga entra no mês por `data_pagamento`.
- Despesa pendente entra por vencimento.
- Despesa pendente não reduz o caixa realizado.
- Caixa realizado = recebimentos efetivos − despesas pagas.
- Resultado previsto = caixa realizado − despesas pendentes.
- Despesa vencida em um mês e paga no mês seguinte só entra no caixa realizado
  no mês do pagamento.

A interface é testada desde a Fase 2 (seção 13.2).

---

## 9. Pendências técnicas controladas

Lint, testes, typecheck e build estão passando. Não há pendências ativas de lint conhecidas:

- **`@typescript-eslint/no-explicit-any`**: zerado no código de produção. Resta uma única supressão, em `src/lib/mcp/tools/resumo-financeiro.test.ts`, onde o fake do PostgREST é injetado no lugar do cliente Supabase: reproduzir o tipo gerado inteiro só para um dublê de teste não agregaria segurança nenhuma.
- **`react-hooks/exhaustive-deps`**: zerado. Não restam dependências de efeito omitidas intencionalmente em telas.

Nenhuma alteração de banco, layout, regras financeiras ou comportamento funcional foi feita para alcançar esse estado.

---

## 10. Comandos úteis

```bash
bun install         # instala dependências (bun 1.4.2, fixado em packageManager)
bun run test        # roda os testes (vitest run)
bun run test:watch  # testes em watch
bun run typecheck   # typecheck (tsc --noEmit)
bun run lint        # eslint .
bun run check       # typecheck + lint + test, na mesma ordem do CI
bun run build       # build de produção (vite build)
bun run build:dev   # build em modo development
bun run format      # prettier --write .
```

O CI (`.github/workflows/ci.yml`) roda exatamente `typecheck`, `lint`, `test` e
`build` sobre `bun install --frozen-lockfile`.

---

## 11. Checklist de regressão validado

- [x] Criar atendimento com procedimentos e recebimento inicial.
- [x] Editar atendimento (sem duplicar histórico de recebimentos).
- [x] Receber saldo pendente (valida valor ≤ saldo).
- [x] Impedir recebimento duplicado.
- [x] Consulta marcada como realizada criando atendimento.
- [x] Follow-up fechado criando atendimento.
- [x] Geração de despesas recorrentes sem duplicar (idempotente).
- [x] Dashboard, Consultório e Fluxo de Caixa com valores consistentes.
- [x] Nota fiscal com status correto.
- [x] Histórico do paciente usando `paciente_id`.
- [x] Paginação mantendo filtros, busca, ordenação e totais corretos.
- [x] Atendimento antigo com saldo aparece no mês atual.
- [x] Recebimento antigo não entra no recebido do mês atual.
- [x] Atendimento quitado antigo não aparece sem necessidade.

---

## 12. Revisão de segurança (Supabase / RLS)

Revisão realizada em 2026-07-09. Resultado: **sem problemas encontrados**.
Nenhuma migration foi necessária.

Escopo verificado nas 17 tabelas do schema `public` que existiam naquela data
(`atendimento_procedimentos`, `atendimentos`, `consultas_previstas`,
`custos_laboratorio`, `despesas`, `formas_pagamento`, `gastos_fixos`,
`gastos_variaveis`, `laboratorios`, `pacientes`, `parcelas`, `procedimentos`,
`recebimentos`, `receitas_extras`, `tentativas_contato`, `tipos_trabalho`,
`tratamentos_propostos`). O schema hoje tem 20 tabelas: `dtm_acompanhamentos` e
`dtm_consultas` entraram na Fase 3 (seção 14.1) já com RLS por usuário, e
`app_settings` era a exceção documentada na seção 15.3 — foi criada como linha
global única, sem `user_id`, e passou a ser por usuário na migração aplicada em
2026-09-09:

- **RLS ativo:** habilitado em todas as tabelas.
- **Cobertura de políticas:** todas as tabelas possuem políticas para
  `SELECT`, `INSERT`, `UPDATE` e `DELETE` (algumas via política `FOR ALL`,
  outras via políticas por comando).
- **Isolamento por usuário (leitura/edição/exclusão):** todas as políticas de
  `SELECT`/`UPDATE`/`DELETE` usam `USING (auth.uid() = user_id)`, impedindo
  acesso a registros de outro usuário.
- **Inserts:** todas as políticas de `INSERT` usam
  `WITH CHECK (auth.uid() = user_id)`, garantindo que o registro criado
  pertence ao usuário autenticado.
- **Updates sem `WITH CHECK` explícito:** seguro. No PostgreSQL, quando um
  `UPDATE` não define `WITH CHECK`, a expressão de `USING`
  (`auth.uid() = user_id`) é reutilizada como verificação da nova linha,
  impedindo reatribuição de `user_id` para outro usuário.
- **Nenhuma política concede acesso ao papel `anon`:** todo acesso exige
  usuário autenticado.
- **RPCs:** `salvar_atendimento_completo` e `gerar_despesas_recorrentes`
  usam `auth.uid()` (rejeitando chamadas não autenticadas) e definem
  `SET search_path = public` explicitamente.
- **Linter do banco:** executado sem apontamentos (`No linter issues found`).

Nenhuma alteração de banco, layout ou regras financeiras foi feita nesta
revisão — apenas documentação.

---

## 13. Fase 2 — UX operacional e testes de interface (concluída)

Concluída em 2026-07-09. Nenhuma alteração de banco, layout, regras
financeiras ou comportamento funcional — apenas melhorias de apresentação/
navegação e cobertura de testes.

### 13.1 Melhorias de UX implementadas

- **Tela de Pacientes:** linhas expansíveis com card de resumo por paciente
  (total de atendimentos, valor recebido, saldo em aberto, consultas futuras,
  follow-ups/propostas em aberto) e histórico cronológico consolidado
  (atendimentos, recebimentos, consultas, propostas e tentativas de contato).
  Vínculo prioriza `paciente_id`, com nome normalizado apenas como fallback
  para registros antigos. Helper: `src/lib/paciente-detalhe.ts`.
- **Alertas visuais** (componente `AlertBanner`): consultas atrasadas
  (Consultas), follow-ups pendentes hoje (Follow-up) e contas a receber
  vencidas (Contas a Receber), com contagens derivadas dos dados existentes.
- **Atalhos de navegação:** "Receber saldo" (Contas a Receber), "Ver paciente"
  quando há paciente vinculado (`VerPacienteButton` → Pacientes com filtro por
  nome) e "Editar atendimento" quando já existe a relação.
- **Estados vazios** padronizados (componente `EmptyState`) nas telas
  principais, com mensagens claras. Filtros e paginação mantidos como antes.

### 13.2 Estrutura de testes de interface adicionada

- **Stack:** Vitest + React Testing Library + `@testing-library/user-event` +
  `@testing-library/jest-dom`, ambiente `jsdom`.
- **Config:** `vitest.config.ts` (ambiente jsdom, `globals`, setup file).
- **Infra de testes (`src/test/`):**
  - `supabase-mock.ts` — mock seguro do cliente Supabase (sem rede), com dados
    configuráveis por tabela e spies de escrita (`insert`/`update`/`delete`/`rpc`).
  - `setup.ts` — registra o mock do Supabase e um mock leve do
    `@tanstack/react-router` (navegação inerte), além de polyfills de jsdom
    (`matchMedia`, `ResizeObserver`, PointerEvent APIs).
  - `harness.tsx` — `renderWithProviders` (QueryClient + AuthContext falso) e
    `getRouteComponent` para renderizar componentes de rota isoladamente.

### 13.3 Cobertura de testes

- **Financeiros** (`src/lib/finance.test.ts`, 9 testes) — todos preservados:
  recebimento pela data do recebimento; recebimento antigo fora do mês atual;
  cada recebimento na própria data; despesa paga por `data_pagamento`; despesa
  pendente por vencimento; pendente não reduz caixa realizado; caixa realizado
  = recebimentos − despesas pagas; resultado previsto = caixa − pendentes;
  despesa vencida em um mês e paga no seguinte só entra no caixa no mês do
  pagamento.
- **Renderização sem quebrar** (`render-smoke.test.tsx`, 5 testes): Dashboard,
  Consultório, Contas/Despesas, Consultas, Follow-up.
- **Recebimento** (`recebimento-form.test.tsx`, 4 testes): botão aparece com
  saldo em aberto; mensagem de quitado sem saldo; bloqueio de valor acima do
  saldo; recebimento válido dentro do saldo.
- **Fluxo de atendimento** (`atendimento-flow.test.tsx`, 2 testes): consulta só
  vira "realizada" e proposta só vira "fechado" após o fluxo de atendimento
  (`onSaved`), nunca antes.

### 13.4 Verificação (2026-07-09)

- **Total de testes:** 20 passando (4 arquivos) — 9 financeiros + 11 de interface.
- **Lint:** sem problemas (exit 0).
- **Testes:** 20/20 (exit 0).
- **Typecheck:** sem erros (exit 0).
- **Build:** sucesso (exit 0).

## 14. Fase 3 — Módulo Acompanhamento DTM (v1)

Módulo **operacional/clínico leve** para controlar consultas realizadas de
tratamentos DTM já pagos. **Não impacta financeiro**: não cria atendimentos,
recebimentos ou parcelas, e não aparece em Dashboard, Fluxo de Caixa nem
Contas a Receber.

### 14.1 Tabelas criadas

- `dtm_acompanhamentos` — `paciente`, `paciente_id` (FK `pacientes`, ON DELETE
  SET NULL), `total_consultas` (> 0), `status` (`em_acompanhamento` |
  `concluido`), `data_inicio`, timestamps + trigger `updated_at`.
- `dtm_consultas` — `acompanhamento_id` (FK, ON DELETE CASCADE), `numero` (> 0),
  `data_realizada`. `UNIQUE (acompanhamento_id, numero)` impede números
  duplicados dentro do mesmo acompanhamento.

Ambas com **RLS habilitado** e políticas separadas por operação (select/
insert/update/delete) restritas ao próprio usuário (`auth.uid() = user_id`);
`GRANT` explícito para `authenticated` e `service_role`.

### 14.2 Regras funcionais

- Contador de realizadas é derivado das linhas em `dtm_consultas`.
- Nova consulta recebe `numero = realizadas + 1` (próximo da sequência).
- Bloqueio de registrar quando `realizadas >= total_consultas` (botão desabilitado).
- Edição de `total_consultas` não permite valor menor que o já realizado.
- Quando `realizadas >= total`, um `AlertBanner` sugere a conclusão manual;
  **nada é concluído automaticamente**. Botão "Concluir acompanhamento" apenas
  seta `status = 'concluido'`.
- Vínculo com paciente prioriza `paciente_id` (reutiliza `PacienteCombobox` e
  `resolvePacienteId` do fluxo existente); nome normalizado é fallback.

### 14.3 UI

- Nova rota `/dtm` no menu lateral (ícone `Activity`, entre Follow-up e
  Laboratório).
- Lista com progresso `realizadas/total`, faltantes, status, data de início e
  última consulta realizada. Linhas expansíveis exibem barra de progresso,
  lista das consultas realizadas com número/data, botão de registrar e o
  alerta de conclusão quando aplicável.
- `EmptyState` claro quando não há acompanhamentos ou consultas.
- Expansão da tela de Pacientes ganhou uma seção "Acompanhamentos DTM" com
  progresso, faltantes e últimas datas realizadas (leitura, priorizando
  `paciente_id`).

### 14.4 Testes adicionados

`src/routes/_app/__tests__/dtm.test.tsx` (6 testes):

- renderização da tela (estado vazio);
- criar acompanhamento com total de consultas;
- registrar consulta realizada com o próximo número da sequência;
- bloqueio de registro acima do total + sugestão de conclusão;
- conclusão manual muda `status` para `concluido`;
- exibição do acompanhamento DTM na expansão do paciente.

Mock do Supabase estendido com `.ilike/.like/.not/.is` para suportar
`resolvePacienteId` nos testes.

### 14.5 Verificação (2026-07-14)

- **Total de testes:** 30 passando (6 arquivos) — 9 financeiros + 21 de interface.
- **Lint:** exit 0.
- **Testes:** 30/30 (exit 0).
- **Typecheck:** exit 0.
- **Build:** exit 0.

---

## 15. Fase 4 — Revisão geral e correções (2026-09-08)

Revisão completa do sistema, seguida da correção dos defeitos encontrados na
ordem de prioridade: primeiro o que produz número errado em silêncio, depois o
que quebra funcionalidade, depois exposição de dados, depois o que degrada com
o crescimento da base, e por fim manutenção.

### 15.1 Fonte única da verdade do resumo mensal

A ferramenta MCP `resumo_financeiro` refazia a conta do mês com SQL próprio e
respondia números diferentes dos do Dashboard para o mesmo mês. Ela ignorava
`receitas_extras` e `custos_laboratorio`, e classificava atendimentos pela data
do atendimento em casos que a tela classifica pela data do recebimento.

Em vez de corrigir o SQL, a fórmula do Dashboard virou função pura
`resumoMensal(dados, mes)` em `src/lib/finance.ts`, e os dois consumidores
passaram a chamá-la. A resposta da ferramenta manteve o formato anterior e
ganhou `ganhos_extras`, `receita_total` e `custos_laboratorio`.

O recorte de linhas que a ferramenta precisa carregar está em
`carregarDadosDoMes` (`src/lib/mcp/tools/_supabase.ts`). Buscar só os
recebimentos do mês não basta: `receitasRecebidas` decide o ramo de cada
atendimento por `recs.length > 0`, então um atendimento à vista cujo único
recebimento caiu em outro mês cairia no ramo "sem recebimentos" e seria contado
pela data do atendimento. Por isso os atendimentos relevantes são descobertos
primeiro (pelos recebimentos e parcelas do mês) e só então **todos** os
recebimentos e parcelas deles são carregados.

### 15.2 Paginação das leituras do Supabase

O PostgREST aplica um teto de linhas por resposta (`max-rows`, 1000 por padrão)
e **não sinaliza erro quando corta**: a consulta volta com sucesso e menos
linhas do que existem. Num app financeiro é a pior falha possível, porque o
total exibido fica menor que o real sem nenhum aviso.

`src/lib/supabase-pagination.ts` concentra a solução:

- `fetchAllPages(page)` percorre a consulta com `.range()` até receber um bloco
  **vazio**. O avanço é pelo tamanho do bloco recebido, não por `PAGE_SIZE`.
  Parar no primeiro bloco menor que `PAGE_SIZE` pareceria mais direto, mas
  assume que o servidor nunca devolve menos do que foi pedido — e o `max-rows`
  é configurável: se for menor que `PAGE_SIZE`, toda página vem curta e a
  paginação encerraria já na primeira, reintroduzindo o corte silencioso.
- `fetchAllPorIds(ids, page)` divide listas de ids em blocos de 200 antes do
  `.in(...)`. O filtro vai na query string; uma lista grande estoura o limite de
  tamanho da URL e o servidor responde 414 antes de a consulta rodar.

**Requisito de uso:** toda consulta paginada precisa de ordenação total. Um
`.order()` com empates permite que o banco devolva a mesma linha em duas páginas
(ou em nenhuma), então todas as consultas paginadas ganharam `.order("id")` como
desempate estável. Isso vale para `useTable`, `useConsultorioData` e
`usePacienteDetalhe` em `src/hooks/use-data.ts`.

O mock de `src/test/supabase-mock.ts` passou a aplicar `.range()` de verdade
(continua ignorando os demais filtros). Sem isso ele devolveria a tabela inteira
a cada faixa e o laço de `fetchAllPages` nunca terminaria.

### 15.3 Configuração por usuário e escopo do storage

Dois pontos tratavam o sistema como instalação de usuário único:

- `app_settings` era uma linha global (`single_row`), então a configuração de um
  usuário sobrescreveria a de outro.
- As políticas do bucket `logos` permitiam que qualquer usuário autenticado
  lesse, sobrescrevesse ou apagasse o logo de outro.

A migração `20260908120000_app_settings_e_logos_por_usuario.sql` corrige os
dois: adiciona `user_id` a `app_settings`, troca a chave primária para
`user_id`, cria políticas próprias por operação, e substitui as políticas de
storage por versões restritas a `authenticated` e escopadas por
`(storage.foldername(name))[1] = auth.uid()::text`. O upload de
`src/hooks/use-logo.ts` grava em `${user.id}/logo-...` e remove o objeto
anterior depois que o novo é salvo.

A linha global foi atribuída ao usuário com mais atendimentos, e não ao mais
antigo: o banco tem duas contas, e a mais antiga é de teste (2 dos 132
atendimentos). Os 6 objetos do bucket `logos` pertencem à mesma conta que
recebeu a configuração, o que confirma a atribuição.

Logos antigas, gravadas na raiz do bucket, deixaram de ser alcançáveis pela API
direta. Isso não quebra a exibição: `logo_url` guarda uma URL assinada de dez
anos, cuja autorização é o próprio token. A remoção do objeto anterior na
próxima troca de logo vai falhar em silêncio para esses arquivos de raiz — o
código trata a remoção como não crítica.

### 15.4 Demais correções

- **Issuer do MCP** (`src/lib/mcp/index.ts`): derivado de `VITE_SUPABASE_URL`
  ou `VITE_SUPABASE_PROJECT_ID`, com erro explícito se nenhum existir.
- **Variáveis de ambiente do servidor** (`_supabase.ts`): as `SUPABASE_*` só
  existem no runtime do servidor e
  dependem do que a plataforma injeta no publish; as `VITE_SUPABASE_*`, que são
  as mesmas credenciais publicáveis, servem de fallback. Sem isso, o `!`
  produzia um cliente com URL `undefined` e as ferramentas MCP falhavam em
  produção com erro de rede sem relação aparente com configuração. Falta de
  configuração agora gera `Configuração ausente: ...`.
- **Sessão expirada** (`src/hooks/use-data.ts` e formulários): gravar sem
  sessão gerava erro genérico. `useCreate` e os formulários de atendimento,
  consulta, follow-up e DTM agora falham com a mensagem `SEM_SESSAO`
  ("Sessão expirada. Entre novamente para salvar.") em vez de `user!.id`.
- **Índices de leitura**: `20260908120100_indices_de_leitura.sql` cria 9 índices
  compostos para as consultas por período e por atendimento.
- **`signUp` removido** de `use-auth.tsx`, `use-auth-context.ts` e do harness de
  teste: não havia nenhuma tela de cadastro chamando. Sistema de usuário único,
  contas criadas pelo painel do Supabase. É uma decisão de produto, não técnica —
  se o cadastro na aplicação voltar a ser desejado, o código precisa voltar.
- **Índices por atendimento em `finance.ts`**: `resumosPorAtendimento` e
  `porAtendimento` substituem varreduras repetidas das listas de recebimentos e
  parcelas dentro de laços. `resumoAtendimento` manteve a assinatura pública.
- **`nextMonth`** movido para `src/lib/format.ts`, junto de `currentMonthKey`.
- **CI, `.env.example` e `.gitignore`**: pipeline em `.github/workflows/ci.yml`,
  `packageManager: bun@1.4.2` fixado no `package.json`, e as variáveis de
  ambiente documentadas.

### 15.5 Testes adicionados

- `src/lib/finance.test.ts` — 6 testes de `resumoMensal`, cobrindo os cinco
  eixos em que a versão SQL divergia da tela, a equivalência de composição exata
  e o mês vazio.
- `src/lib/supabase-pagination.test.ts` — 6 testes: total acima de uma página,
  total que cabe na primeira, múltiplo exato do tamanho da página, teto do
  servidor menor que `PAGE_SIZE`, propagação de erro em vez de resultado
  parcial, e divisão por blocos de ids.
- `src/lib/mcp/tools/resumo-financeiro.test.ts` — 9 testes comparando
  `carregarDadosDoMes` + `resumoMensal` contra o cálculo que o Dashboard faria
  com todas as linhas em memória.
- `src/lib/mcp/tools/fake-postgrest.ts` — dublê do PostgREST que **aplica** os
  filtros (select/gte/lt/lte/eq/in/or/order/range) e simula o teto de linhas por
  resposta. O mock de `src/test/supabase-mock.ts` devolve a tabela inteira e
  ignora filtros: serve para testes de interface, mas não prova nada sobre quais
  linhas uma consulta traz — e era exatamente o recorte das consultas que fazia
  a ferramenta MCP divergir do Dashboard.

### 15.6 Verificação (2026-09-08)

- **Total de testes:** 96 passando (15 arquivos).
- **Typecheck:** exit 0.
- **Lint:** exit 0.

### 15.7 Migrações aplicadas (2026-09-09)

As duas migrações da Fase 4 foram aplicadas no banco de produção e registradas
em `supabase_migrations.schema_migrations`. Estado conferido depois de aplicar:

- `app_settings` sem a coluna `id`, com PK `user_id`, `DEFAULT auth.uid()` e as
  quatro políticas `own select/insert/update/delete`.
- `storage.objects` com as quatro políticas `own logos ...`, todas restritas ao
  papel `authenticated`; a política `Public can read logos`, que valia para
  `anon`, não existe mais.
- Os 9 índices compostos criados.

Duas correções foram necessárias no arquivo da primeira migração, descobertas
ao conferi-la contra o banco real:

- O nome da política de UPDATE era `Authenticated users can update app settings
row`, e não `Authenticated users can update app_settings`.
- A ordem estava errada: essa política filtra por `id = 1`, então o
  `DROP COLUMN id` falhava com `cannot drop column id ... because other objects
depend on it` enquanto ela existisse. Os `DROP POLICY` passaram para antes das
  alterações de coluna.

---

## 16. Fase 5 — Consolidação, dívida técnica e relatório de NF (2026-09-18)

Correções e unificações, sem mudança de regra financeira nem de layout, mais
uma tela nova de nota fiscal. Nenhum número existente muda de valor: todas as
consolidações apontam para a regra que já era a correta.

### 16.1 Despesas recorrentes: geração deixou de acontecer por navegação

A tela de Despesas tinha um efeito com dependência `[mes]` chamando
`gerar(mes, false)`. Navegar para um mês passado criava as recorrências daquele
mês no banco, em silêncio. Gravar linha financeira como efeito colateral de
navegação é o pior tipo de surpresa num sistema de caixa.

Agora existe uma única checagem automática, em `src/routes/_app.tsx`, uma vez
por sessão e sempre no mês corrente. Gerar outra competência é ação explícita,
pelo botão "Gerar recorrentes", que continua funcionando para qualquer mês.

`useGerarRecorrentes` (`src/hooks/use-recurring.ts`) ganhou `useCallback` e uma
trava síncrona por `useRef`. A guarda anterior lia `loading`, que é estado e só
vale no render seguinte: duas chamadas no mesmo tick passavam as duas. A RPC é
idempotente e não duplicava linhas, mas eram dois round-trips e duas
invalidações por abertura de tela.

### 16.2 Status de despesa com uma definição só

A tela de Despesas tinha a própria `computeStatus`, que considerava paga
qualquer linha com `status = 'pago'`, enquanto `despesasPagas` exige
`data_pagamento` para posicionar a saída no caixa. Uma despesa marcada como
paga sem data aparecia PAGA na tela e PENDENTE no Dashboard, no Fluxo de Caixa
e na ferramenta MCP.

`src/lib/finance.ts` passou a exportar `statusDespesa`, `comStatusDespesa`,
`totaisPorStatusDespesa` e `despesasDoMesPorVencimento`. `despesasPagas` e
`despesasPendentes` foram reescritas sobre `statusDespesa`, e `contas.tsx`
consome os mesmos helpers, inclusive para os quatro totais do topo.

Divergência que continua sendo de propósito: a tela de Despesas recorta pelo
VENCIMENTO (competência) e o Dashboard/Fluxo posiciona a saída pela
DATA_PAGAMENTO (caixa). Conta que vence em julho e é paga em agosto aparece em
meses diferentes nas duas visões.

### 16.3 Validação de recebimento no banco

Migração `20260918120000_validar_recebimento_no_update.sql`:

- `trg_validar_recebimento_nao_excede` passou a valer para
  `INSERT OR UPDATE OF valor, atendimento_id`. Só cobria INSERT, então um
  UPDATE de `recebimentos.valor` podia deixar a soma acima do `valor_bruto` do
  atendimento — e `useUpdate` é genérico sobre `TableName`, que inclui
  `recebimentos`.
- A função ganhou `SELECT ... FOR UPDATE` no atendimento. Sem o lock, dois
  inserts concorrentes leem a mesma soma, ambos passam na checagem e o total
  estoura.
- No UPDATE, a própria linha sai da soma pelo id; somá-la junto de `NEW`
  contaria o valor duas vezes e rejeitaria alteração legítima.

**Ainda não aplicada no banco.** Aplicar em branch do Supabase antes de
produção e confirmar os dois casos: UPDATE acima do saldo levanta exceção,
insert legítimo continua passando.

### 16.4 Duplicações removidas

- `fluxo-caixa.tsx`: `saldoAcumulado` e `saldoAtual` eram o mesmo cálculo com
  cortes de data diferentes. Viraram `saldoAte(limite)`.
- `consultorio.tsx`: os dois blocos de filtro (tabela e card "Recebido no
  período") viraram `filtrarPorAtributos`, com os padrões de NF e de forma de
  pagamento em `NF_DO_FILTRO` e `FORMA_DO_FILTRO`. O recorte por data continua
  separado, que é justamente a diferença entre as duas listas. A chave de
  ordenação `"lucrativos"`, idêntica a `"liquido_desc"`, foi removida — um link
  antigo com `?sort=lucrativos` cai no padrão `data_desc`.
- `contarPorAcomp`/`consultasPorAcomp` viraram `consultasPorAcompanhamento` em
  `src/lib/dtm.ts`, consumida por `dtm.tsx` e `pacientes.$id.tsx`.
- O rateio e a margem de `procedures-analytics.tsx` saíram do componente para
  `src/lib/procedures-analytics.ts` (`linhasDeProcedimento`,
  `agruparPorProcedimento`), agora com testes.

### 16.5 Leitura e configuração

- `QueryClient` (`src/router.tsx`) com `staleTime: 30_000` e
  `refetchOnWindowFocus: false`. As telas carregam tabelas inteiras e toda
  navegação refazia tudo. As mutações continuam invalidando as queries
  afetadas, e invalidação vence o `staleTime`.
- `fetchAllPages` ganhou `MAX_PAGES = 500`. O laço parava só com bloco vazio,
  o que depende de o servidor respeitar `Range`; um backend que o ignore
  devolve sempre a mesma página e a aba congelava sem erro. Agora vira exceção
  com mensagem.
- `src/integrations/supabase/client.server.ts` (service role, ignora RLS) e
  `auth-middleware.ts` foram removidos: nenhum dos dois era importado. A
  entrada `SUPABASE_SERVICE_ROLE_KEY` saiu do `.env.example` junto — manter
  referência a um segredo sem consumidor é risco sem contrapartida.
- `bun run check` passou a incluir `build`, igual ao CI.

### 16.6 Tela nova: Nota Fiscal (`/nota-fiscal`)

O campo `nota_fiscal_status` era editável no Consultório, mas não havia
nenhuma visão agregada — uma nota esquecida não reaparecia em lugar nenhum.

A tela recorta pela data do ATENDIMENTO (competência do documento) e mostra:

- total a emitir no mês e quanto desse valor já entrou no caixa (via
  `resumosPorAtendimento`, a mesma conta do Consultório);
- alerta de pendências de meses ANTERIORES ao selecionado, que é o buraco que
  a tela existe para fechar;
- abas por situação, busca, paginação e o status editável na linha;
- resumo de pendentes por mês nos últimos 12 meses, clicável.

Estado na URL: `?mes`, `?aba`, `?q`, validados por `src/lib/search-params.ts`.
Status ausente conta como `pendente`, que é o padrão do banco para linha
antiga.

### 16.7 Testes e verificação (2026-09-18)

- **Total de testes:** 137 passando (19 arquivos), contra 96 em 15 arquivos.
- Novos: `use-recurring` (trava, invalidação, toasts), `pacientes`
  (`resolvePacienteId`, incluindo o caso em que cria paciente),
  `procedures-analytics` (rateio e margem), `nota-fiscal` (rota), mais os
  status de despesa em `finance.test.ts` e o teto de páginas em
  `supabase-pagination.test.ts`.
- `bun run check` (typecheck + lint + test + build): exit 0.
