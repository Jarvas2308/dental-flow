# Handoff Técnico — Sistema Financeiro Odontológico

Documento final de transferência técnica. Descreve o estado atual do sistema,
as regras financeiras consolidadas, fluxos principais, RPCs, testes, pendências
técnicas controladas e comandos úteis.

---

## 1. Resumo do estado atual

Sistema pessoal de gestão financeira para consultório odontológico (usuário
único: o proprietário). Stack: **TanStack Start (React 19)** + **Tailwind CSS v4**
+ **shadcn/UI** no frontend e **Lovable Cloud (Supabase / PostgreSQL)** no backend.

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

| Helper | Finalidade |
| --- | --- |
| `fatorLiquido(a)` | Fator bruto→líquido de um atendimento (considera taxa). |
| `resumoAtendimento(...)` | Total, recebido, saldo, status por atendimento. |
| `receitasRecebidas(...)` | Entradas efetivamente recebidas. |
| `valoresEmAberto(...)` | Saldos pendentes por atendimento. |
| `contasAReceber(...)` | Lista consolidada de contas a receber. |
| `noMes(data, mes)` | Verifica se uma data pertence ao mês (`monthKey`). |
| `recebimentosNoMes(...)` | Recebimentos filtrados pela data do recebimento. |
| `despesasPagas / despesasPagasNoMes / totalDespesasPagasNoMes` | Despesas pagas por `data_pagamento`. |
| `despesasPendentes / despesasPendentesNoMes / totalDespesasPendentesNoMes` | Despesas pendentes por vencimento. |
| `caixaRealizado(entradas, saidasPagas)` | Recebimentos − despesas pagas. |
| `resultadoPrevisto(caixa, pendentes)` | Caixa realizado − despesas pendentes. |

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

| RPC | Finalidade |
| --- | --- |
| `salvar_atendimento_completo(...)` | Cria/edita atendimento com procedimentos e recebimentos numa única transação. Valida paciente, valor bruto, data, status de NF, coerência de cada recebimento (valor/taxa/líquido) e que a soma dos recebimentos não exceda o valor bruto. Retorna `{ atendimento_id, created, procedimentos, recebimentos }`. |
| `gerar_despesas_recorrentes(p_competencia)` | Gera as ocorrências mensais das despesas recorrentes para a competência informada, de forma idempotente. Retorna `{ criadas, existentes }`. |

Ambas usam `auth.uid()` e `SET search_path = public`.

---

## 8. Testes existentes

Arquivo: `src/lib/finance.test.ts` (Vitest). Cenários cobertos:

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

UI ainda não é testada automaticamente.

---

## 9. Pendências técnicas controladas

Lint, testes, typecheck e build estão passando. Não há pendências ativas de lint conhecidas:

- **`@typescript-eslint/no-explicit-any`**: zerado em todo o projeto. Todos os arquivos permitidos foram tipados, substituindo `any` por tipos específicos do Supabase, `unknown` onde o tipo é realmente desconhecido ou tipos auxiliares pequenos.
- **`react-hooks/exhaustive-deps`**: zerado. Não restam dependências de efeito omitidas intencionalmente em telas.

Nenhuma alteração de banco, layout, regras financeiras ou comportamento funcional foi feita para alcançar esse estado.

---

## 10. Comandos úteis

```bash
bun run test        # roda os testes (vitest run)
bun run test:watch  # testes em watch
tsgo --noEmit       # typecheck (TypeScript)
bun run build       # build de produção (vite build)
bun run build:dev   # build em modo development
bun run lint        # eslint .
bun run format      # prettier --write .
```

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

Escopo verificado em todas as 17 tabelas do schema `public`
(`atendimento_procedimentos`, `atendimentos`, `consultas_previstas`,
`custos_laboratorio`, `despesas`, `formas_pagamento`, `gastos_fixos`,
`gastos_variaveis`, `laboratorios`, `pacientes`, `parcelas`, `procedimentos`,
`recebimentos`, `receitas_extras`, `tentativas_contato`, `tipos_trabalho`,
`tratamentos_propostos`):

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
