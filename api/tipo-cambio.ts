import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/tipo-cambio?fecha=YYYY-MM-DD
 *
 * Tipo de cambio SBS (S/ por US$, venta) — el oficial que usa SUNAT — vigente
 * en esa fecha, desde la API pública del BCRP (serie PD04640PD).
 *
 * Existe porque el BCRP no manda Access-Control-Allow-Origin: el navegador no
 * puede consultarlo directo. Solo pide esa serie con una fecha validada, así
 * que no sirve como proxy abierto.
 *
 * El BCRP publica solo días hábiles y con un día de retraso (fines de semana,
 * feriados y "hoy" salen "n.d."), así que se devuelve el último valor
 * publicado hasta la fecha pedida, y en `fechaTc` de qué día es.
 */

const SERIES = 'PD04640PD';
const BCRP = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api';
const LOOKBACK_DAYS = 15; // cubre fines de semana largos, feriados y el retraso

const MONTHS: Record<string, string> = {
  Ene: '01', Feb: '02', Mar: '03', Abr: '04', May: '05', Jun: '06',
  Jul: '07', Ago: '08', Set: '09', Sep: '09', Oct: '10', Nov: '11', Dic: '12',
};

/** "29.Set.26" → "2026-09-29" */
function parsePeriod(name: string): string | null {
  const m = /^(\d{2})\.([A-Za-z]{3})\.(\d{2})$/.exec(name);
  if (!m || !MONTHS[m[2]]) return null;
  return `20${m[3]}-${MONTHS[m[2]]}-${m[1]}`;
}

function isoUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Dos rarezas del servidor del BCRP, ambas medidas:
 *
 * 1. Es PHP con Xdebug encendido. Si el User-Agent no tiene la forma
 *    "Nombre/versión" (el de Node es solo "node"), dispara un aviso
 *    ("Undefined offset: 1") y pega una tabla HTML DESPUÉS del JSON, que
 *    rompe JSON.parse siempre. Con un User-Agent correcto llega limpio; igual
 *    se corta lo que venga después del JSON, por si eso cambia.
 *
 * 2. Un filtro anti-bots responde, al azar, 200 con una página HTML de
 *    desafío en vez del JSON (la mitad de las consultas seguidas). No es un
 *    bloqueo: reintentar lo resuelve.
 *
 * Tope de 8 s en total, por el límite de 10 s de las funciones de Vercel.
 */
const USER_AGENT = 'MiDepa/1.0 (+https://mi-depa.vercel.app)';
async function fetchBcrpJson(url: string): Promise<any | null> {
  const deadline = Date.now() + 8000;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const left = deadline - Date.now();
    if (left < 500) break;
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(Math.min(4000, left)),
      });
      const text = (await r.text()).trimStart();
      if (r.ok && text.startsWith('{')) {
        // Este JSON nunca contiene '<': lo que venga desde ahí es HTML pegado
        const cut = text.indexOf('<');
        return JSON.parse(cut === -1 ? text : text.slice(0, cut));
      }
    } catch {
      // timeout, red o JSON inválido: se reintenta igual
    }
    await sleep(300 * attempt);
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const fecha = String(req.query.fecha ?? '');
  const target = new Date(`${fecha}T00:00:00Z`);
  // isoUTC(target) === fecha descarta fechas imposibles como 2026-02-31
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(target.getTime()) || isoUTC(target) !== fecha) {
    return res.status(400).json({ error: 'Usa ?fecha=AAAA-MM-DD' });
  }
  if (fecha < '2000-01-01' || target.getTime() > Date.now() + 2 * 86400000) {
    return res.status(400).json({ error: 'Fecha fuera de rango' });
  }

  const start = new Date(target);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);

  const data = await fetchBcrpJson(`${BCRP}/${SERIES}/json/${isoUTC(start)}/${fecha}`);
  if (!data) {
    // El cliente cae a un tipo de cambio guardado; no hace falta más detalle
    return res.status(502).json({ error: 'No se pudo consultar el BCRP' });
  }

  const points = (data?.periods ?? [])
    .map((p: any) => ({ fecha: parsePeriod(p?.name ?? ''), venta: parseFloat(p?.values?.[0]) }))
    .filter((p: { fecha: string | null; venta: number }) => p.fecha && p.fecha <= fecha && Number.isFinite(p.venta) && p.venta > 0);

  const last = points[points.length - 1];
  if (!last) return res.status(404).json({ error: 'Sin tipo de cambio publicado para esa fecha' });

  // Si ya hay valor publicado para ese mismo día, no va a cambiar: caché larga.
  // Si es el de un día anterior (fin de semana, feriado, aún no publicado),
  // caché corta, porque el valor del día puede aparecer más tarde.
  res.setHeader(
    'Cache-Control',
    last.fecha === fecha
      ? 'public, s-maxage=31536000, immutable'
      : 'public, s-maxage=3600, stale-while-revalidate=86400',
  );
  return res.status(200).json({
    fecha,
    fechaTc: last.fecha,
    venta: Math.round(last.venta * 1000) / 1000,
    fuente: 'SBS',
  });
}
