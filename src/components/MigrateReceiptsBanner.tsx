import { useState } from 'react';
import { Upload, Loader, CheckCircle } from 'lucide-react';
import { Expense } from '../types';
import { isLegacyBase64, migrateLegacyReceipt } from '../lib/receipts';

interface Props {
  expenses: Expense[];
  apartmentId: string;
  onMigrated: (expenseId: string, path: string) => void;
}

function prettySize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Los recibos viejos viven como base64 dentro de la fila del gasto, así que
 * viajan enteros en cada carga de la app. Esto los mueve a Storage.
 *
 * Es un botón y no algo automático a propósito: son varios MB de subida y
 * el usuario puede estar con datos móviles.
 */
export default function MigrateReceiptsBanner({ expenses, apartmentId, onMigrated }: Props) {
  const [running, setRunning] = useState(false);
  const [done, setDone]       = useState(0);
  const [failed, setFailed]   = useState(0);
  const [finished, setFinished] = useState(false);

  const pending = expenses.filter(e => isLegacyBase64(e.receiptImage));
  if (pending.length === 0 && !finished) return null;

  const totalBytes = pending.reduce((s, e) => s + (e.receiptImage?.length ?? 0), 0);

  async function run() {
    setRunning(true);
    setDone(0);
    setFailed(0);
    let ok = 0, bad = 0;

    for (const exp of pending) {
      try {
        const path = await migrateLegacyReceipt(exp.id, exp.receiptImage!, apartmentId);
        onMigrated(exp.id, path);
        setDone(++ok);
      } catch {
        setFailed(++bad);
      }
    }

    setRunning(false);
    setFinished(true);
  }

  if (finished && failed === 0) {
    return (
      <div className="mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 flex items-center gap-2.5">
        <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-[12px] font-medium text-emerald-800 dark:text-emerald-300">
          {done} {done === 1 ? 'recibo movido' : 'recibos movidos'} a almacenamiento. La app va a cargar más rápido.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 p-4">
      <div className="flex items-start gap-2.5">
        <Upload size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-indigo-800 dark:text-indigo-300">
            {pending.length} {pending.length === 1 ? 'recibo antiguo' : 'recibos antiguos'}
          </p>
          <p className="text-[12px] text-indigo-700 dark:text-indigo-400 mt-0.5 leading-relaxed">
            Ocupan {prettySize(totalBytes)} dentro de tus gastos y se descargan cada vez que abres la app.
            Muévelos para que cargue más rápido.
          </p>

          {failed > 0 && !running && (
            <p className="text-[12px] text-rose-600 dark:text-rose-400 mt-1.5 font-medium">
              {failed} {failed === 1 ? 'falló' : 'fallaron'}. Puedes reintentar.
            </p>
          )}

          <button
            onClick={run}
            disabled={running}
            className="mt-2.5 h-9 px-4 rounded-xl bg-indigo-600 disabled:opacity-60 text-white text-[12px] font-semibold inline-flex items-center gap-2"
          >
            {running ? (
              <><Loader size={13} className="animate-spin" /> Moviendo {done + failed} de {pending.length}…</>
            ) : failed > 0 ? 'Reintentar' : 'Mover ahora'}
          </button>

          {running && (
            <p className="text-[11px] text-indigo-500 dark:text-indigo-500 mt-1.5">
              Mejor con WiFi. No cierres la app.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
