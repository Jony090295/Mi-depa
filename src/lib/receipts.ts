import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const BUCKET = 'receipts';
const SIGNED_URL_TTL = 60 * 60; // 1 hora

/**
 * Los recibos vivían como data-URLs base64 dentro de expenses.receipt_image.
 * Ahora se guardan en Storage y la columna solo lleva la ruta del objeto.
 * Las filas viejas siguen funcionando: todo lo que empiece con "data:" se
 * trata como una imagen inline.
 */
export function isLegacyBase64(value: string | undefined): boolean {
  return !!value && value.startsWith('data:');
}

/** Comprime una imagen antes de subirla. Una foto de celular pesa 3-5 MB. */
async function compress(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))),
      'image/jpeg',
      quality
    );
  });
}

/**
 * Sube un recibo y devuelve la ruta a guardar en expenses.receipt_image.
 * El primer segmento debe ser el apartment_id: las políticas de Storage
 * lo leen para decidir quién puede ver el archivo.
 */
export async function uploadReceipt(file: File, apartmentId: string): Promise<string> {
  const blob = await compress(file);
  const path = `${apartmentId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;
  return path;
}

/** Borra un recibo. Ignora las filas viejas en base64, que no tienen objeto. */
export async function deleteReceipt(value: string | undefined): Promise<void> {
  if (!value || isLegacyBase64(value)) return;
  await supabase.storage.from(BUCKET).remove([value]);
}

/**
 * Sube un recibo que estaba guardado como data-URL y apunta la fila a
 * Storage. Devuelve la ruta nueva.
 *
 * La columna se actualiza solo si la subida salió bien, así que un fallo
 * a medias deja el base64 intacto y se puede reintentar.
 */
export async function migrateLegacyReceipt(
  expenseId: string,
  dataUrl: string,
  apartmentId: string
): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], 'recibo.jpg', { type: blob.type || 'image/jpeg' });

  const path = await uploadReceipt(file, apartmentId);

  const { error } = await supabase
    .from('expenses')
    .update({ receipt_image: path })
    .eq('id', expenseId);

  if (error) {
    // La fila sigue con el base64; borra el huérfano para no dejar basura.
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return path;
}

const urlCache = new Map<string, { url: string; expires: number }>();

/** Resuelve una ruta de Storage a una URL firmada, con caché en memoria. */
export async function getReceiptUrl(value: string): Promise<string | undefined> {
  if (isLegacyBase64(value)) return value;

  const hit = urlCache.get(value);
  if (hit && hit.expires > Date.now()) return hit.url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL);

  if (error || !data) return undefined;

  // Renovar un minuto antes de que expire, para no servir un link muerto
  urlCache.set(value, { url: data.signedUrl, expires: Date.now() + (SIGNED_URL_TTL - 60) * 1000 });
  return data.signedUrl;
}

/**
 * URL mostrable para un recibo. Devuelve las base64 tal cual y firma las
 * rutas de Storage bajo demanda.
 */
export function useReceiptUrl(value: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(
    isLegacyBase64(value) ? value : undefined
  );

  useEffect(() => {
    if (!value) { setUrl(undefined); return; }
    if (isLegacyBase64(value)) { setUrl(value); return; }

    let cancelled = false;
    getReceiptUrl(value).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [value]);

  return url;
}
