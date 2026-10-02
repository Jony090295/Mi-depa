import { useEffect, useState } from 'react';

/** Tipo de cambio SBS (venta) vigente en `fecha`, publicado el `fechaTc`. */
export interface TcSbs {
  fecha: string;
  fechaTc: string;
  venta: number;
  fuente: string;
}

// Una consulta por fecha y por sesión. Si falla se olvida, para reintentar
// la próxima vez en vez de quedar pegado a un error.
const cache = new Map<string, Promise<TcSbs | null>>();

/**
 * Pide el tipo de cambio a /api/tipo-cambio (ver api/tipo-cambio.ts).
 * Nunca lanza: si falla devuelve null y quien llama usa su respaldo.
 */
export function fetchTcSbs(fecha: string): Promise<TcSbs | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return Promise.resolve(null);
  const hit = cache.get(fecha);
  if (hit) return hit;

  const p = fetch(`/api/tipo-cambio?fecha=${fecha}`)
    .then(r => (r.ok ? r.json() : null))
    .then((d: any) =>
      d && typeof d.venta === 'number' && d.venta > 0 && typeof d.fechaTc === 'string'
        ? (d as TcSbs)
        : null)
    .catch(() => null)
    .then(v => { if (!v) cache.delete(fecha); return v; });

  cache.set(fecha, p);
  return p;
}

/**
 * Tipo de cambio de una fecha. `loading` distingue "todavía no llegó" de
 * "no se pudo" (tc null y loading false), para que la UI no prometa un valor
 * que no va a venir.
 */
export function useTcSbs(fecha: string | null): { tc: TcSbs | null; loading: boolean } {
  const [state, setState] = useState<{ tc: TcSbs | null; loading: boolean }>({ tc: null, loading: !!fecha });
  useEffect(() => {
    if (!fecha) { setState({ tc: null, loading: false }); return; }
    let cancelled = false;
    setState(s => ({ tc: s.tc?.fecha === fecha ? s.tc : null, loading: true }));
    fetchTcSbs(fecha).then(tc => { if (!cancelled) setState({ tc, loading: false }); });
    return () => { cancelled = true; };
  }, [fecha]);
  return state;
}

/**
 * Tipo de cambio del gasto en dólares más reciente (por fecha). Es el
 * respaldo cuando el BCRP no responde: el último valor que el usuario usó,
 * en vez de una constante que envejece (antes era 3.80 fijo).
 */
export function lastUsdRate(expenses: { currency?: string; exchangeRate?: number; date?: string }[]): number | null {
  let best: { date: string; rate: number } | null = null;
  for (const e of expenses) {
    if (e.currency !== 'USD' || !e.exchangeRate || e.exchangeRate <= 1) continue;
    const d = e.date ?? '';
    if (!best || d > best.date) best = { date: d, rate: e.exchangeRate };
  }
  return best?.rate ?? null;
}

/** "2026-09-29" → "29/09" */
export function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
