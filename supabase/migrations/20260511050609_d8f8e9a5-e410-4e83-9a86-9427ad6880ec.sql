
-- Cadastros auxiliares
create table public.procedimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table public.formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  taxa numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.laboratorios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table public.tipos_trabalho (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

-- Gastos
create table public.gastos_fixos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric(12,2) not null,
  data date not null,
  categoria text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table public.gastos_variaveis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric(12,2) not null,
  data date not null,
  categoria text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- Atendimentos
create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paciente text not null,
  procedimento text not null,
  valor_bruto numeric(12,2) not null,
  forma_pagamento text not null,
  taxa numeric(5,2) not null default 0,
  valor_liquido numeric(12,2) not null,
  nota_fiscal boolean not null default false,
  data date not null,
  created_at timestamptz not null default now()
);

-- Custos laboratório
create table public.custos_laboratorio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  laboratorio text not null,
  tipo_trabalho text not null,
  paciente text not null,
  procedimento text,
  atendimento_id uuid references public.atendimentos(id) on delete set null,
  valor numeric(12,2) not null,
  data date not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.procedimentos enable row level security;
alter table public.formas_pagamento enable row level security;
alter table public.laboratorios enable row level security;
alter table public.tipos_trabalho enable row level security;
alter table public.gastos_fixos enable row level security;
alter table public.gastos_variaveis enable row level security;
alter table public.atendimentos enable row level security;
alter table public.custos_laboratorio enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['procedimentos','formas_pagamento','laboratorios','tipos_trabalho','gastos_fixos','gastos_variaveis','atendimentos','custos_laboratorio'])
  loop
    execute format('create policy "own select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own update" on public.%I for update using (auth.uid() = user_id)', t);
    execute format('create policy "own delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
