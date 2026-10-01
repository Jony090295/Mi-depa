-- ============================================================
-- Mi Depa — Recurrentes personales
-- Correr en: Supabase > SQL Editor > New query > Run
--
-- Correr ANTES de publicar el código que lo usa: ese código escribe
-- macro_category en bills y bill_history, y si la columna no existe
-- cualquier recurrente falla al guardarse.
--
-- Correrlo antes es seguro: el código viejo no manda macro_category, la
-- columna queda NULL, y NULL se trata como hogar — igual que en expenses.
-- ============================================================

BEGIN;

-- Misma convención que expenses: 'hogar' | 'personal', NULL = hogar.
ALTER TABLE public.bills        ADD COLUMN IF NOT EXISTS macro_category text;
ALTER TABLE public.bill_history ADD COLUMN IF NOT EXISTS macro_category text;

COMMENT ON COLUMN public.bills.macro_category IS
  '''hogar'' | ''personal''. NULL = hogar. Un recurrente personal solo lo ve '
  'y lo edita el roommate en paid_by — ver políticas "bills *".';

-- ─────────────────────────────────────────────────────────────
-- Políticas: un recurrente personal solo existe para quien lo paga.
-- Antes era "members full access", así que un recurrente creado desde
-- un gasto personal quedaba visible — con nombre y monto — para todo el
-- depa. Misma regla que expenses (ver active_privacy_hardening.sql).
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "members full access" ON public.bills;
DROP POLICY IF EXISTS "bills select" ON public.bills;
DROP POLICY IF EXISTS "bills insert" ON public.bills;
DROP POLICY IF EXISTS "bills update" ON public.bills;
DROP POLICY IF EXISTS "bills delete" ON public.bills;

CREATE POLICY "bills select" ON public.bills FOR SELECT USING (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);
CREATE POLICY "bills insert" ON public.bills FOR INSERT WITH CHECK (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);
CREATE POLICY "bills update" ON public.bills FOR UPDATE USING (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
) WITH CHECK (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);
CREATE POLICY "bills delete" ON public.bills FOR DELETE USING (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);

DROP POLICY IF EXISTS "members full access" ON public.bill_history;
DROP POLICY IF EXISTS "bill_history select" ON public.bill_history;
DROP POLICY IF EXISTS "bill_history insert" ON public.bill_history;
DROP POLICY IF EXISTS "bill_history update" ON public.bill_history;
DROP POLICY IF EXISTS "bill_history delete" ON public.bill_history;

CREATE POLICY "bill_history select" ON public.bill_history FOR SELECT USING (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);
CREATE POLICY "bill_history insert" ON public.bill_history FOR INSERT WITH CHECK (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);
CREATE POLICY "bill_history update" ON public.bill_history FOR UPDATE USING (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
) WITH CHECK (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);
CREATE POLICY "bill_history delete" ON public.bill_history FOR DELETE USING (
  is_member(apartment_id)
  AND (macro_category IS DISTINCT FROM 'personal' OR paid_by = my_roommate_id(apartment_id)::text)
);

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Verificación: deben salir 4 políticas por tabla, todas con true
-- ─────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd,
       COALESCE(qual, '') || COALESCE(with_check, '') LIKE '%my_roommate_id%' AS protege_personales
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('bills', 'bill_history')
 ORDER BY tablename, policyname;
