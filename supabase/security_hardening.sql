-- ============================================================
-- Mi Depa — Parche de seguridad
--
-- IMPORTANTE: son 2 bloques SQL separados por un deploy de código.
-- Correr en orden. NO pegar todo junto.
--
--   PASO 1 (este archivo, bloque A) -> Supabase SQL Editor
--   PASO 2  deploy del código a Vercel
--   PASO 3 (este archivo, bloque B) -> Supabase SQL Editor
-- ============================================================


-- ============================================================
-- BLOQUE A  —  PASO 1
-- Elimina las tablas de chat. chat_reads tiene "using (true)",
-- que expone apartment_id y user_id a internet sin necesidad
-- de login. El chat ya no existe en la app.
-- No rompe nada.
-- ============================================================

DROP TABLE IF EXISTS public.chat_reads;
DROP TABLE IF EXISTS public.chat_messages;


-- ============================================================
-- BLOQUE B  —  PASO 3  (después de deployar el código)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- B1. Unirse a un depa exige el código de invitación
--
-- Política vieja: WITH CHECK (auth.uid() = user_id OR is_member(...))
-- El primer OR dejaba a CUALQUIER usuario autenticado meterse a
-- CUALQUIER depa con solo saber su id. El código era decorativo.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION join_apartment(code text, display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  apt_id     uuid;
  pending_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF display_name IS NULL OR btrim(display_name) = '' THEN
    RAISE EXCEPTION 'Nombre requerido';
  END IF;

  SELECT id INTO apt_id
    FROM apartments
   WHERE invite_code = upper(btrim(code));

  IF apt_id IS NULL THEN
    RAISE EXCEPTION 'Código inválido';
  END IF;

  INSERT INTO apartment_members (apartment_id, user_id, role)
  VALUES (apt_id, auth.uid(), 'member')
  ON CONFLICT (apartment_id, user_id) DO NOTHING;

  -- Reclamar un slot de roommate pendiente con el mismo nombre, o crear uno
  SELECT id INTO pending_id
    FROM roommates
   WHERE apartment_id = apt_id
     AND name = btrim(display_name)
     AND user_id IS NULL
   LIMIT 1;

  IF pending_id IS NOT NULL THEN
    UPDATE roommates SET user_id = auth.uid() WHERE id = pending_id;
  ELSE
    INSERT INTO roommates (apartment_id, name, income, color, sort_order, user_id)
    VALUES (apt_id, btrim(display_name), 0, '#ec4899', 99, auth.uid());
  END IF;

  RETURN apt_id;
END;
$$;

REVOKE ALL ON FUNCTION join_apartment(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION join_apartment(text, text) TO authenticated;

-- Reemplazar la política permisiva.
-- El segundo OR permite que quien CREA un depa se registre como dueño
-- (en ese instante todavía no es miembro), pero solo en un depa que
-- él mismo acaba de crear.
DROP POLICY IF EXISTS "members can insert" ON apartment_members;

CREATE POLICY "members can insert" ON apartment_members
  FOR INSERT WITH CHECK (
    is_member(apartment_id)
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM apartments
         WHERE id = apartment_id AND created_by = auth.uid()
      )
    )
  );


-- ─────────────────────────────────────────────────────────────
-- B2. Gastos personales privados A NIVEL BASE DE DATOS
--
-- Hoy el filtro vive solo en el cliente: cualquier roommate puede
-- leerlos con una llamada directa a la API REST.
-- ─────────────────────────────────────────────────────────────

-- Devuelve el roommate.id del usuario actual dentro de ese depa
CREATE OR REPLACE FUNCTION my_roommate_id(apt_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM roommates
   WHERE apartment_id = apt_id AND user_id = auth.uid()
   LIMIT 1;
$$;

DROP POLICY IF EXISTS "members full access" ON expenses;

-- Lectura: gastos de hogar para todos; personales solo para quien los pagó
CREATE POLICY "expenses select" ON expenses FOR SELECT USING (
  is_member(apartment_id)
  AND (
    macro_category IS DISTINCT FROM 'personal'
    OR paid_by = my_roommate_id(apartment_id)::text
  )
);

CREATE POLICY "expenses insert" ON expenses FOR INSERT
  WITH CHECK (is_member(apartment_id));

CREATE POLICY "expenses update" ON expenses FOR UPDATE
  USING (is_member(apartment_id)) WITH CHECK (is_member(apartment_id));

CREATE POLICY "expenses delete" ON expenses FOR DELETE
  USING (is_member(apartment_id));


-- ─────────────────────────────────────────────────────────────
-- B3. Verificación — revisa el resultado de esta consulta
-- ─────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;
