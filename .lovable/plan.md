# Melhorias: Pacientes, Múltiplos Procedimentos e Consultas Futuras

## Visão geral

Três novos recursos, mantendo total compatibilidade com fluxo de caixa, dashboard, relatórios e contas a receber existentes:

1. Cadastro simples de pacientes com autocomplete e criação rápida.
2. Vários procedimentos por atendimento, com valor por procedimento e total somado automaticamente.
3. Módulo de consultas previstas + cards de previsão no dashboard.

## 1. Banco de dados (migração)

Três novas tabelas no schema `public`, todas com `user_id`, `created_at` e RLS por usuário (mesmo padrão das tabelas atuais):

```text
pacientes
- nome (text)

atendimento_procedimentos   (itens de um atendimento)
- atendimento_id (uuid, FK -> atendimentos, on delete cascade)
- procedimento (text)
- valor (numeric)

consultas_previstas
- paciente (text)
- data_prevista (date)
- valor_estimado (numeric, opcional / default 0)
- observacao (text, opcional)
```

A coluna `atendimentos.procedimento` (texto) e `atendimentos.valor_bruto` continuam existindo e passam a guardar, respectivamente, os nomes concatenados ("Limpeza, Clareamento, Restauração") e a SOMA dos valores — assim toda a lógica financeira atual (`finance.ts`, dashboard, fluxo de caixa, contas a receber) segue funcionando sem alteração.

Cada `CREATE TABLE` virá com GRANTs (authenticated + service_role) e políticas RLS escopadas em `auth.uid()`, conforme o padrão do projeto.

## 2. Pacientes

- Adicionar `pacientes` à lista de tabelas em `src/hooks/use-data.ts`.
- No `atendimento-form.tsx`, trocar o `Input` de paciente por um combobox com autocomplete (mesmo padrão já usado no campo de procedimento): busca nos pacientes existentes + opção "Criar novo paciente" inline (evita duplicidade por nome).
- Ao salvar um atendimento com paciente inédito, criar automaticamente o registro em `pacientes`.
- O mesmo seletor de paciente será reutilizado no formulário de consultas previstas.

## 3. Múltiplos procedimentos por atendimento

- No `atendimento-form.tsx`, substituir o seletor único de procedimento por uma lista dinâmica de linhas: cada linha = procedimento (combobox com criação rápida) + valor. Botões "adicionar procedimento" / remover.
- O **valor bruto total** passa a ser a soma automática dos valores das linhas (campo somado, somente leitura). Taxa e forma de pagamento continuam aplicadas ao atendimento inteiro; valor líquido = total × (1 − taxa%).
- Ao salvar:
  - grava o atendimento com `procedimento` = nomes unidos, `valor_bruto` = soma, `valor_liquido` calculado;
  - grava as linhas em `atendimento_procedimentos`.
- Na edição, carrega as linhas existentes; se um atendimento antigo não tiver itens, usa o `procedimento`/`valor_bruto` atuais como uma única linha (retrocompatível).
- `procedures-analytics.tsx`: passa a agrupar pelos itens de `atendimento_procedimentos` quando existirem (rateando líquido/lab proporcional ao valor do item), com fallback para o campo de texto nos atendimentos antigos — assim os relatórios por procedimento ficam corretos com múltiplos procedimentos.

## 4. Consultas previstas

- Nova rota `src/routes/_app/consultas.tsx` (módulo simples, não uma agenda): lista de consultas futuras ordenadas por data, com formulário (paciente via autocomplete, data prevista, valor estimado opcional, observação opcional) e ação de excluir/editar e "marcar como realizada".
- Novo formulário `src/components/consulta-form.tsx`.
- Adicionar `consultas_previstas` em `use-data.ts` e o item de menu em `app-sidebar.tsx` (desktop + mobile), com ícone de calendário.

## 5. Dashboard

Nova seção "Próximas consultas" com três cards:
- **Consultas hoje** — contagem de consultas previstas com data = hoje.
- **Consultas na semana** — contagem dentro da semana corrente.
- **Valor previsto da semana** — soma de `valor_estimado` das consultas da semana (em BRL).

## Detalhes técnicos

- Arquivos novos: migração SQL; `src/routes/_app/consultas.tsx`; `src/components/consulta-form.tsx`.
- Arquivos editados: `src/hooks/use-data.ts` (3 novas tabelas), `src/components/atendimento-form.tsx` (paciente autocomplete + linhas de procedimento), `src/components/procedures-analytics.tsx` (itens), `src/routes/_app/dashboard.tsx` (cards de previsão), `src/components/app-sidebar.tsx` (menu).
- Padrões reaproveitados: combobox Popover+Command, `useCreate/useUpdate/useDelete`, `StatCard`, helpers de data (`monthKey`, `parseLocalDate`, `startOfWeek`).
- Mobile: a grade de menu passa de 8 para 9 colunas; layout responsivo mantido.
- Sem agenda complexa e sem prontuário, conforme solicitado.
