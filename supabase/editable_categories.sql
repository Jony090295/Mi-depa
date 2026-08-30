-- ============================================================
-- Mi Depa — Categorías editables
-- Correr en: Supabase > SQL Editor > New query > Run
--
-- Hasta ahora la lista de categorías era  [DEFAULTS_FIJOS, ...extras]
-- y no había forma de quitar una. Eso hacía imposible ofrecer
-- "sugerencias": lo que el usuario no quería le aparecía igual.
--
-- Ahora cada depa guarda SU lista completa de categorías de hogar, y
-- cada roommate la suya de personales.
--
-- Se usan columnas NUEVAS en vez de reinterpretar las viejas: si
-- `custom_hogar_categories` pasara de significar "extras" a "lista
-- completa", todo depa que ya tenga extras perdería los defaults en
-- cuanto se despliegue el código. Con columnas nuevas, NULL significa
-- "todavía sin gestionar" y la app cae al comportamiento anterior.
-- Por eso este SQL se puede correr antes o después del deploy.
-- ============================================================

ALTER TABLE apartments ADD COLUMN IF NOT EXISTS hogar_categories    text[];
ALTER TABLE roommates  ADD COLUMN IF NOT EXISTS personal_categories text[];

COMMENT ON COLUMN apartments.hogar_categories IS
  'Lista COMPLETA de categorías de hogar del depa. NULL = nunca se editó; '
  'la app usa los defaults + custom_hogar_categories. Reemplaza a esa columna.';

COMMENT ON COLUMN roommates.personal_categories IS
  'Lista COMPLETA de categorías personales del roommate. NULL = nunca se '
  'editó; la app usa los defaults + custom_personal_categories.';


-- ─────────────────────────────────────────────────────────────
-- Relleno opcional
--
-- NO hace falta correrlo: la app maneja NULL sin problema, y escribe la
-- lista completa la primera vez que alguien edita sus categorías.
-- Está aquí por si prefieres dejar los datos explícitos desde ya.
--
-- Conserva el orden de los defaults y agrega al final los extras que no
-- estuvieran ya incluidos.
-- ─────────────────────────────────────────────────────────────

-- UPDATE apartments SET hogar_categories =
--   ARRAY['alquiler','servicio','comida','limpieza','membresia','auto','otros']
--   || ARRAY(
--        SELECT c FROM unnest(COALESCE(custom_hogar_categories, '{}')) AS c
--         WHERE c <> ALL (ARRAY['alquiler','servicio','comida','limpieza','membresia','auto','otros'])
--      )
-- WHERE hogar_categories IS NULL;

-- UPDATE roommates SET personal_categories =
--   ARRAY['salud','auto','ropa','comida','deporte','otros']
--   || ARRAY(
--        SELECT c FROM unnest(COALESCE(custom_personal_categories, '{}')) AS c
--         WHERE c <> ALL (ARRAY['salud','auto','ropa','comida','deporte','otros'])
--      )
-- WHERE personal_categories IS NULL;


-- ─────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (   (table_name = 'apartments' AND column_name = 'hogar_categories')
        OR (table_name = 'roommates'  AND column_name = 'personal_categories'))
 ORDER BY table_name;
