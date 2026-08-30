-- ============================================================
-- Mi Depa — Bucket de recibos
-- Correr en: Supabase > SQL Editor > New query > Run
--
-- Los recibos se guardaban como base64 dentro de expenses.receipt_image.
-- Eso inflaba cada fila (una foto de celular pesa 3-5 MB, y base64 le
-- suma otro 33%) y metía imágenes con datos sensibles dentro de la misma
-- tabla que se lee entera en cada carga.
--
-- Ahora van a Storage, en un bucket PRIVADO. La app pide una URL firmada
-- de 1 hora para mostrarlas.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. El bucket
--    Privado, máximo 5 MB por archivo, solo imágenes.
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 'receipts', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];


-- ─────────────────────────────────────────────────────────────
-- 2. Políticas
--
-- La ruta de cada archivo es  {apartment_id}/{uuid}.jpg  — el primer
-- segmento decide quién puede verlo. Se compara como texto a propósito:
-- castear a uuid haría fallar la política ante una ruta malformada en
-- vez de simplemente negarla.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "receipts read"   ON storage.objects;
DROP POLICY IF EXISTS "receipts insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts delete" ON storage.objects;

CREATE POLICY "receipts read" ON storage.objects FOR SELECT USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM apartment_members m
     WHERE m.user_id = auth.uid()
       AND m.apartment_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "receipts insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM apartment_members m
     WHERE m.user_id = auth.uid()
       AND m.apartment_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "receipts delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM apartment_members m
     WHERE m.user_id = auth.uid()
       AND m.apartment_id::text = (storage.foldername(name))[1]
  )
);


-- ─────────────────────────────────────────────────────────────
-- 3. Limpieza de tablas obsoletas
--    shopping_items: la lista de compras se eliminó de la app.
--    Descomenta solo si ya no quieres esos datos — es irreversible.
-- ─────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.shopping_items;


-- ─────────────────────────────────────────────────────────────
-- 4. Verificación
-- ─────────────────────────────────────────────────────────────

-- ¿Cuántos recibos viejos quedan en base64, y cuánto pesan?
SELECT count(*) FILTER (WHERE receipt_image LIKE 'data:%')      AS recibos_base64,
       count(*) FILTER (WHERE receipt_image IS NOT NULL
                          AND receipt_image NOT LIKE 'data:%')  AS recibos_en_storage,
       pg_size_pretty(COALESCE(sum(length(receipt_image))
                        FILTER (WHERE receipt_image LIKE 'data:%'), 0)) AS peso_base64
  FROM expenses;

-- Políticas del bucket
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname = 'storage' AND tablename = 'objects'
   AND policyname LIKE 'receipts%'
 ORDER BY policyname;
