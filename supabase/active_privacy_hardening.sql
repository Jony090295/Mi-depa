-- ============================================================
-- Mi Depa — Privacidad de gastos personales y recibos activos
--
-- Ejecutar manualmente en Supabase SQL Editor después de desplegar
-- el cliente que guarda recibos en una de estas rutas:
--   {apartment_id}/hogar/{uuid}.jpg
--   {apartment_id}/personal/{roommate_id}/{uuid}.jpg
--
-- Este archivo no se ejecuta desde la aplicación.
-- ============================================================

BEGIN;

-- Un gasto personal solo puede pertenecer al roommate vinculado con la
-- cuenta que realiza la operación. La misma regla protege lectura,
-- inserción, actualización y borrado.
DROP POLICY IF EXISTS "expenses select" ON public.expenses;
DROP POLICY IF EXISTS "expenses insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses update" ON public.expenses;
DROP POLICY IF EXISTS "expenses delete" ON public.expenses;

CREATE POLICY "expenses select" ON public.expenses FOR SELECT USING (
  is_member(apartment_id)
  AND (
    macro_category IS DISTINCT FROM 'personal'
    OR paid_by = my_roommate_id(apartment_id)::text
  )
);

CREATE POLICY "expenses insert" ON public.expenses FOR INSERT WITH CHECK (
  is_member(apartment_id)
  AND (
    macro_category IS DISTINCT FROM 'personal'
    OR paid_by = my_roommate_id(apartment_id)::text
  )
);

CREATE POLICY "expenses update" ON public.expenses FOR UPDATE USING (
  is_member(apartment_id)
  AND (
    macro_category IS DISTINCT FROM 'personal'
    OR paid_by = my_roommate_id(apartment_id)::text
  )
) WITH CHECK (
  is_member(apartment_id)
  AND (
    macro_category IS DISTINCT FROM 'personal'
    OR paid_by = my_roommate_id(apartment_id)::text
  )
);

CREATE POLICY "expenses delete" ON public.expenses FOR DELETE USING (
  is_member(apartment_id)
  AND (
    macro_category IS DISTINCT FROM 'personal'
    OR paid_by = my_roommate_id(apartment_id)::text
  )
);

-- Los recibos de hogar siguen compartidos con el depa. Los personales solo
-- se pueden leer y borrar desde la cuenta dueña del roommate indicado en la
-- ruta. Para rutas antiguas ({apartment_id}/{uuid}.jpg), la fila de expenses
-- decide la visibilidad; un objeto huérfano antiguo deja de ser legible.
DROP POLICY IF EXISTS "receipts read"   ON storage.objects;
DROP POLICY IF EXISTS "receipts insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts delete" ON storage.objects;

CREATE POLICY "receipts read" ON storage.objects FOR SELECT USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1
      FROM public.apartment_members m
     WHERE m.user_id = auth.uid()
       AND m.apartment_id::text = (storage.foldername(name))[1]
       AND (
         (storage.foldername(name))[2] = 'hogar'
         OR (
           (storage.foldername(name))[2] = 'personal'
           AND (storage.foldername(name))[3] = public.my_roommate_id(m.apartment_id)::text
         )
         OR (
           cardinality(storage.foldername(name)) = 1
           AND EXISTS (
             SELECT 1
               FROM public.expenses e
              WHERE e.apartment_id = m.apartment_id
                AND e.receipt_image = name
                AND (
                  e.macro_category IS DISTINCT FROM 'personal'
                  OR e.paid_by = public.my_roommate_id(m.apartment_id)::text
                )
           )
         )
       )
  )
);

CREATE POLICY "receipts insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1
      FROM public.apartment_members m
     WHERE m.user_id = auth.uid()
       AND m.apartment_id::text = (storage.foldername(name))[1]
       AND (
         (storage.foldername(name))[2] = 'hogar'
         OR (
           (storage.foldername(name))[2] = 'personal'
           AND (storage.foldername(name))[3] = public.my_roommate_id(m.apartment_id)::text
         )
       )
  )
);

CREATE POLICY "receipts delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1
      FROM public.apartment_members m
     WHERE m.user_id = auth.uid()
       AND m.apartment_id::text = (storage.foldername(name))[1]
       AND (
         (storage.foldername(name))[2] = 'hogar'
         OR (
           (storage.foldername(name))[2] = 'personal'
           AND (storage.foldername(name))[3] = public.my_roommate_id(m.apartment_id)::text
         )
         OR (
           cardinality(storage.foldername(name)) = 1
           AND EXISTS (
             SELECT 1
               FROM public.expenses e
              WHERE e.apartment_id = m.apartment_id
                AND e.receipt_image = name
                AND (
                  e.macro_category IS DISTINCT FROM 'personal'
                  OR e.paid_by = public.my_roommate_id(m.apartment_id)::text
                )
           )
         )
       )
  )
);

COMMIT;
