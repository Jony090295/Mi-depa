-- ============================================================
-- Mi Depa — Esquema real de la base de datos
--
-- Estructura de tablas y políticas verificadas contra la base de
-- producción el 2026-08-30, después del endurecimiento de seguridad.
--
-- ESTE ARCHIVO ES DOCUMENTACIÓN, NO UN SCRIPT DE INSTALACIÓN.
-- La versión anterior llevaba meses desactualizada y eso escondió
-- tres vulnerabilidades: describía políticas que ya no existían y
-- omitía la tabla trusted_services por completo. Si cambias algo en
-- Supabase, actualiza este archivo en el mismo commit.
--
-- Para regenerar la lista de columnas:
--   SELECT table_name, string_agg(column_name || ' ' || data_type,
--          E'\n  ' ORDER BY ordinal_position)
--     FROM information_schema.columns
--    WHERE table_schema = 'public' GROUP BY table_name ORDER BY table_name;
--
-- Para regenerar las políticas:
--   SELECT tablename, policyname, cmd, qual, with_check
--     FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- Nota: los DEFAULT y las FOREIGN KEY de abajo vienen del esquema
-- original de creación. Las columnas y las políticas sí están
-- verificadas contra la base viva; los defaults no se re-verificaron.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- TABLAS
-- ════════════════════════════════════════════════════════════

-- Departamentos
CREATE TABLE apartments (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL DEFAULT 'Mi Depa',
  rent                      numeric NOT NULL DEFAULT 0,
  rent_currency             text NOT NULL DEFAULT 'PEN',
  rent_exchange_rate        numeric NOT NULL DEFAULT 3.80,
  maintenance               numeric NOT NULL DEFAULT 0,
  invite_code               text UNIQUE NOT NULL DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by                uuid REFERENCES auth.users(id),
  created_at                timestamptz DEFAULT now(),
  address                   text NOT NULL DEFAULT '',
  default_split_type        text,
  default_split_percentages jsonb,
  onboarding_complete       boolean,
  custom_hogar_categories   text[]
);

-- Usuarios que pertenecen a un departamento
CREATE TABLE apartment_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid REFERENCES apartments(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member',   -- 'owner' | 'member'
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(apartment_id, user_id)
);

-- Personas del depa. user_id enlaza con la cuenta cuando existe;
-- es NULL para un roommate creado antes de que se registre.
CREATE TABLE roommates (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id               uuid REFERENCES apartments(id) ON DELETE CASCADE,
  name                       text NOT NULL,
  income                     numeric NOT NULL DEFAULT 0,
  color                      text NOT NULL DEFAULT '#6366f1',
  sort_order                 int DEFAULT 0,
  created_at                 timestamptz DEFAULT now(),
  user_id                    uuid REFERENCES auth.users(id),
  custom_personal_categories text[]
);

-- Gastos. macro_category ('hogar' | 'personal') decide la
-- visibilidad: los personales solo los ve quien los pagó.
-- paid_by guarda un roommates.id, NO un auth.users.id.
CREATE TABLE expenses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id         uuid REFERENCES apartments(id) ON DELETE CASCADE,
  title                text NOT NULL,
  amount               numeric NOT NULL,
  category             text NOT NULL DEFAULT 'otros',
  paid_by              text NOT NULL,
  date                 date NOT NULL,
  split_type           text NOT NULL DEFAULT 'equitativo',
  splits               jsonb NOT NULL DEFAULT '{}',
  calculated_shares    jsonb NOT NULL DEFAULT '{}',
  currency             text NOT NULL DEFAULT 'PEN',
  exchange_rate        numeric NOT NULL DEFAULT 1,
  recurrent_bill_id    uuid,
  recurrent_bill_month text,
  receipt_image        text,                     -- imagen en base64
  created_at           timestamptz DEFAULT now(),
  macro_category       text
);

-- Gastos recurrentes
CREATE TABLE bills (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id          uuid REFERENCES apartments(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  amount                numeric NOT NULL,
  due_date              text,
  status                text NOT NULL DEFAULT 'por pagar',
  alert_sent            boolean NOT NULL DEFAULT false,
  notes                 text,
  paid_by               text,
  split_type            text DEFAULT 'equitativo',
  splits                jsonb,
  associated_expense_id text,
  currency              text NOT NULL DEFAULT 'PEN',
  exchange_rate         numeric NOT NULL DEFAULT 1,
  category              text DEFAULT 'servicio',
  is_auto_debit         boolean NOT NULL DEFAULT false,
  deleted_at            text,
  created_at            timestamptz DEFAULT now()
);

-- Historial de pagos de recurrentes
CREATE TABLE bill_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id   uuid REFERENCES apartments(id) ON DELETE CASCADE,
  bill_id        uuid REFERENCES bills(id) ON DELETE CASCADE,
  name           text,
  amount         numeric,
  due_date       text,
  notes          text,
  paid_by        text,
  split_type     text,
  splits         jsonb,
  currency       text DEFAULT 'PEN',
  exchange_rate  numeric DEFAULT 1,
  month_paid_for text,
  date_paid      date,
  status         text DEFAULT 'pagado',
  category       text,
  is_auto_debit  boolean,
  created_at     timestamptz DEFAULT now()
);

-- Liquidaciones de deuda entre roommates
CREATE TABLE settlements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id  uuid REFERENCES apartments(id) ON DELETE CASCADE,
  from_id       text NOT NULL,
  to_id         text NOT NULL,
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'PEN',
  exchange_rate numeric NOT NULL DEFAULT 1,
  date          date NOT NULL,
  note          text,
  created_at    timestamptz DEFAULT now()
);

-- Foro "Red Vecinal".
--
-- DECISIÓN DELIBERADA (2026-08-30): es global. Se consulta SIN filtro de
-- apartment_id, a propósito — la gracia del foro es que trascienda tu
-- depa. NO le agregues un filtro por apartment_id creyendo que es un bug.
--
-- La columna apartment_id se conserva para saber de dónde salió cada
-- post, pero no se usa para filtrar.
CREATE TABLE forum_posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid REFERENCES apartments(id) ON DELETE CASCADE,
  author       text NOT NULL,
  title        text NOT NULL,
  content      text NOT NULL,
  type         text NOT NULL DEFAULT 'tip',
  created_at   timestamptz DEFAULT now(),
  user_id      uuid REFERENCES auth.users(id)
);

-- Respuestas del foro. No tiene user_id, por eso sus políticas de
-- escritura no pueden restringirse al autor.
CREATE TABLE forum_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  author     text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Directorio de servicios. Global igual que el foro, y por la misma
-- decisión deliberada: la recomendación de un buen gasfitero solo sirve
-- si la ven los vecinos, no solo tu roommate.
--
-- Consecuencia asumida: los teléfonos que guardes aquí los ve cualquier
-- usuario de la app. No metas contactos privados.
CREATE TABLE trusted_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id   uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  name           text NOT NULL,
  category       text NOT NULL,
  phone          text NOT NULL,
  rating         int,
  description    text,
  recommended_by text,
  created_at     timestamptz DEFAULT now(),
  user_id        uuid REFERENCES auth.users(id)
);


-- ════════════════════════════════════════════════════════════
-- TABLAS OBSOLETAS — siguen existiendo, ya nada las usa
-- ════════════════════════════════════════════════════════════
--
-- shopping_items  — la lista de compras se eliminó de la app
-- chat_messages   — el chat se reemplazó por Límites de gasto
-- chat_reads      — idem
--
-- Conservan datos. Para eliminarlas, ver supabase/security_hardening.sql.


-- ════════════════════════════════════════════════════════════
-- FUNCIONES
-- ════════════════════════════════════════════════════════════

-- ¿El usuario actual es miembro de este depa?
-- Es el motor de casi todas las políticas. NO le quites EXECUTE al rol
-- `authenticated`: las políticas se evalúan con los permisos de quien
-- consulta, así que revocarlo rompe la app entera.
--
-- ── Sobre las advertencias del Security Advisor (revisado 2026-08-30) ──
--
-- El linter marca is_member, my_roommate_id y join_apartment con
-- "SECURITY DEFINER function executable". Se revisaron una por una y se
-- decidió NO actuar. El razonamiento:
--
--   * is_member y my_roommate_id solo devuelven datos del propio
--     llamante. Verificado contra producción: a un anónimo le responden
--     `false` y `null`. No hay filtración posible.
--   * join_apartment DEBE ser llamable por usuarios autenticados — es la
--     única puerta para unirse a un depa. Ya está revocada para `anon`.
--   * La sugerencia del linter de revocar EXECUTE a `authenticated`
--     rompería todas las políticas que llaman a estas funciones.
--
-- El arreglo "correcto" (mover las funciones a un esquema privado fuera
-- de la API) obligaría a reescribir todas las políticas de abajo y aun
-- así dejaría la advertencia de join_apartment. No compensa.
CREATE OR REPLACE FUNCTION is_member(apt_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM apartment_members
     WHERE apartment_id = apt_id AND user_id = auth.uid()
  );
$$;

-- roommates.id del usuario actual dentro de un depa.
-- Traduce auth.users.id -> roommates.id, que es lo que guarda paid_by.
CREATE OR REPLACE FUNCTION my_roommate_id(apt_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id FROM roommates
   WHERE apartment_id = apt_id AND user_id = auth.uid()
   LIMIT 1;
$$;

-- Única puerta para unirse a un depa. Valida el código de invitación.
-- Es SECURITY DEFINER a propósito: así puede leer `apartments` sin que
-- esa tabla quede abierta a no-miembros.
-- Definición completa en supabase/security_hardening.sql.
--   join_apartment(code text, display_name text) RETURNS uuid


-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE apartments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_services  ENABLE ROW LEVEL SECURITY;

-- ── apartments ──────────────────────────────────────────────
-- Solo tuyos o donde eres miembro. Antes tenía un tercer OR
-- "invite_code IS NOT NULL" que era SIEMPRE verdadero (la columna es
-- NOT NULL), y dejaba a cualquier usuario leer todos los códigos.
CREATE POLICY "apartments_select" ON apartments FOR SELECT
  USING (created_by = auth.uid() OR is_member(id));

CREATE POLICY "apartments_insert" ON apartments FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "members can update" ON apartments FOR UPDATE
  USING (is_member(id));

-- ── apartment_members ───────────────────────────────────────
-- El segundo OR deja que quien crea un depa se registre como dueño
-- (en ese instante aún no es miembro), pero solo en uno que él creó.
CREATE POLICY "members can insert" ON apartment_members FOR INSERT
  WITH CHECK (
    is_member(apartment_id)
    OR (
      user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM apartments WHERE id = apartment_id AND created_by = auth.uid())
    )
  );

CREATE POLICY "members can read" ON apartment_members FOR SELECT
  USING (is_member(apartment_id));

CREATE POLICY "self can delete" ON apartment_members FOR DELETE
  USING (user_id = auth.uid());

-- ── expenses ────────────────────────────────────────────────
-- Los gastos personales solo los ve quien los pagó. Esto se aplica en
-- la base, no solo en el cliente: sin esto, un roommate puede leerlos
-- con una llamada directa a la API REST.
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

-- ── roommates, bills, bill_history, settlements ──────────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['roommates','bills','bill_history','settlements'] LOOP
    EXECUTE format(
      'CREATE POLICY "members full access" ON %I FOR ALL '
      'USING (is_member(apartment_id)) WITH CHECK (is_member(apartment_id))', t);
  END LOOP;
END $$;

-- ── forum_posts / trusted_services ──────────────────────────
-- Lectura global a propósito — ver la nota en la definición de las
-- tablas. Lo que sí está restringido es la escritura: antes la política
-- era FOR ALL con "auth.uid() IS NOT NULL", lo que dejaba a cualquier
-- usuario editar y BORRAR los posts y contactos de otros depas.
CREATE POLICY "forum_posts read"   ON forum_posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "forum_posts insert" ON forum_posts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "forum_posts update" ON forum_posts FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "forum_posts delete" ON forum_posts FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "trusted read"   ON trusted_services FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trusted insert" ON trusted_services FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "trusted update" ON trusted_services FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "trusted delete" ON trusted_services FOR DELETE USING (user_id = auth.uid());

-- ── forum_replies ───────────────────────────────────────────
-- Sin columna user_id no hay forma de restringir por autor, así que
-- se permite leer y responder, pero no editar ni borrar.
CREATE POLICY "forum_replies read"   ON forum_replies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "forum_replies insert" ON forum_replies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
