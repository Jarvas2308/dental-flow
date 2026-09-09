-- Corrige as duas exceções à regra de multi-tenancy do projeto.
--
-- 1) public.app_settings era a única tabela do schema `public` fora do
--    invariante `auth.uid() = user_id`: uma linha global (CHECK id = 1) com
--    políticas `USING (true)`. Qualquer usuário autenticado lia e sobrescrevia
--    a configuração de todos os outros. A tabela foi criada depois da revisão
--    de RLS registrada em docs/HANDOFF.md §12, por isso passou despercebida.
--
-- 2) A política "Public can read logos" em storage.objects não tinha cláusula
--    TO, então valia também para o papel `anon`: qualquer visitante podia ler
--    e listar o bucket `logos`, apesar de o código o descrever como privado.
--
-- A linha global é atribuída ao usuário dono da maior parte dos dados, não ao
-- mais antigo: o banco tem duas contas e a mais antiga é a de testes, com 2 dos
-- 132 atendimentos. Os 6 objetos do bucket `logos` também pertencem à conta
-- com mais atendimentos, o que confirma a atribuição.

-- ---------------------------------------------------------------- app_settings

ALTER TABLE public.app_settings
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.app_settings
   SET user_id = (
         SELECT a.user_id
           FROM public.atendimentos a
          GROUP BY a.user_id
          ORDER BY count(*) DESC, a.user_id
          LIMIT 1
       )
 WHERE user_id IS NULL;

-- Sem nenhum usuário cadastrado a linha global fica órfã e é descartada; o
-- app recria a configuração no primeiro salvamento.
DELETE FROM public.app_settings WHERE user_id IS NULL;

ALTER TABLE public.app_settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.app_settings ALTER COLUMN user_id SET DEFAULT auth.uid();

-- As políticas antigas saem ANTES da coluna: a de UPDATE filtra por `id = 1`,
-- então o DROP COLUMN falha enquanto ela existir.
DROP POLICY "Authenticated users can read app_settings" ON public.app_settings;
DROP POLICY "Authenticated users can update app settings row" ON public.app_settings;

-- `id` era a chave lógica da linha única. Com uma linha por usuário ele perde
-- a função e o DEFAULT 1 passaria a colidir a cada novo usuário.
ALTER TABLE public.app_settings DROP CONSTRAINT single_row;
ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE public.app_settings DROP COLUMN id;
ALTER TABLE public.app_settings ADD PRIMARY KEY (user_id);

CREATE POLICY "own select" ON public.app_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.app_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.app_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.app_settings FOR DELETE USING (auth.uid() = user_id);

-- O app passa a criar a própria linha (upsert) em vez de depender de um seed.
GRANT INSERT, DELETE ON public.app_settings TO authenticated;

-- ------------------------------------------------------------ bucket de logos

DROP POLICY "Public can read logos" ON storage.objects;
DROP POLICY "Authenticated can upload logos" ON storage.objects;
DROP POLICY "Authenticated can update logos" ON storage.objects;
DROP POLICY "Authenticated can delete logos" ON storage.objects;

-- Cada usuário só alcança os objetos sob a pasta com o próprio id. O upload
-- passa a gravar em `<user_id>/logo-<timestamp>.<ext>` (ver hooks/use-logo.ts).
--
-- Objetos antigos, gravados na raiz do bucket, deixam de ser legíveis pela API
-- direta. Isso não quebra as logos já em uso: elas são exibidas por URL
-- assinada, cuja autorização é o próprio token da assinatura.
CREATE POLICY "own logos select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own logos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own logos update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own logos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
