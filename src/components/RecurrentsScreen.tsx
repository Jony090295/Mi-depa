import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader, Check, RefreshCw } from 'lucide-react';
import { RecurrentBill, Roommate } from '../types';
import { getCategoryLabel, configManagedBillKind } from '../utils';
import { categoryIcon } from '../lib/categoryIcons';

type Macro = 'hogar' | 'personal';

interface Props {
  initialTab?: Macro;
  bills: RecurrentBill[];
  roommates: Roommate[];
  hogarCategories: string[];
  personalCategories: string[];
  /** Tipo de cambio a usar si un recurrente en soles pasa a dólares. */
  defaultExchangeRate: number;
  onUpdate: (bill: RecurrentBill) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

function money(b: Pick<RecurrentBill, 'amount' | 'currency'>) {
  const n = Number(b.amount) || 0;
  return `${b.currency === 'USD' ? '$' : 'S/'} ${n.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`;
}

/**
 * Lista de recurrentes (plantillas de gasto) para verlos, editarlos y
 * borrarlos. Antes no había ningún lugar para eso: la pestaña Recurrentes se
 * quitó y solo quedaron el interruptor del formulario (crear) y "Cargar desde
 * recurrente" (usar).
 *
 * Crear sigue siendo desde el formulario de gasto: un recurrente hereda de ahí
 * pagador y reparto, y rehacer ese formulario aquí no vale la pena.
 */
export default function RecurrentsScreen({
  initialTab = 'hogar', bills, roommates, hogarCategories, personalCategories,
  defaultExchangeRate, onUpdate, onDelete, onClose,
}: Props) {
  const [tab, setTab]           = useState<Macro>(initialTab);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast]       = useState('');

  // La RLS ya oculta los personales ajenos; aquí solo se separa por pestaña
  // y se esconden los marcados como borrados.
  const list = bills.filter(b => !b.deletedAt && (b.macroCategory ?? 'hogar') === tab);
  const selectedBill = bills.find(b => b.id === selected) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) setSelected(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onClose]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2200);
  }

  const payerName = (id?: string) => roommates.find(r => r.id === id)?.name;

  return (
    <div
      className="fixed inset-0 z-[300] bg-zinc-50 dark:bg-zinc-950 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Recurrentes"
    >
      <div className="max-w-md mx-auto px-4 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        {/* Header */}
        <div className="flex items-center gap-2 h-12">
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver"
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300 active:bg-zinc-200/60 dark:active:bg-zinc-800"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">Recurrentes</h1>
        </div>

        {/* Hogar / Personales */}
        <div className="flex bg-zinc-200/60 dark:bg-zinc-800 rounded-2xl p-1 mt-2" role="tablist">
          {(['hogar', 'personal'] as const).map(m => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={tab === m}
              onClick={() => setTab(m)}
              className={`flex-1 h-9 rounded-xl text-[13px] font-semibold transition ${
                tab === m
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {m === 'hogar' ? 'Hogar' : 'Personales'}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2.5 px-1">
          {tab === 'hogar'
            ? 'Los ve todo el depa. Si cambias uno, cambia para todos.'
            : 'Solo tú los ves.'}
        </p>

        {list.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-5 py-8 text-center">
            <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <RefreshCw size={19} />
            </div>
            <p className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">
              {tab === 'hogar' ? 'Sin recurrentes de hogar' : 'Sin recurrentes personales'}
            </p>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed max-w-[260px] mx-auto">
              Registra un gasto{tab === 'personal' ? ' personal' : ''} y activa
              {' '}<span className="font-semibold">"Guardar como gasto recurrente"</span>.
              La próxima vez lo cargas con un toque.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              {list.map((b, i) => {
                const Icon = categoryIcon(b.category ?? 'otros');
                const payer = tab === 'hogar' ? payerName(b.paidBy) : undefined;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelected(b.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-zinc-50 dark:active:bg-zinc-800/60 transition ${i > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''}`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                      <Icon size={17} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-medium text-zinc-900 dark:text-zinc-100 truncate">{b.name}</span>
                      <span className="block text-[12px] text-zinc-400 dark:text-zinc-500 truncate">
                        {getCategoryLabel(b.category ?? 'otros')}{payer ? ` · Paga ${payer}` : ''}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">{money(b)}</span>
                    <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 px-1 leading-relaxed">
              Para crear uno, registra un gasto y activa "Guardar como gasto recurrente".
            </p>
          </>
        )}
      </div>

      {selectedBill && (
        <RecurrentSheet
          key={selectedBill.id}
          bill={selectedBill}
          roommates={roommates}
          categories={tab === 'hogar' ? hogarCategories : personalCategories}
          defaultExchangeRate={defaultExchangeRate}
          onClose={() => setSelected(null)}
          onSave={async updated => {
            await onUpdate(updated);
            setSelected(null);
            flash('Recurrente actualizado');
          }}
          onDelete={async () => {
            await onDelete(selectedBill.id);
            setSelected(null);
            flash('Recurrente eliminado');
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-[320] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-medium px-4 py-2.5 rounded-full shadow-lg inline-flex items-center gap-2 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        >
          <Check size={14} /> {toast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

interface SheetProps {
  // React's JSX `key` is not available in this project without the optional
  // @types/react package, so declare it for type-checking only.
  key?: string;
  bill: RecurrentBill;
  roommates: Roommate[];
  categories: string[];
  defaultExchangeRate: number;
  onClose: () => void;
  onSave: (bill: RecurrentBill) => Promise<void>;
  onDelete: () => Promise<void>;
}

function RecurrentSheet({ bill, roommates, categories, defaultExchangeRate, onClose, onSave, onDelete }: SheetProps) {
  const isPersonal = bill.macroCategory === 'personal';
  // El alquiler y el mantenimiento los reescribe "Configuración del depa" al
  // guardarse; si se editaran aquí, el próximo guardado de Configuración los
  // pisaría. Mejor decirlo que dejar que pase en silencio.
  const managedBy = configManagedBillKind(bill);

  const [step, setStep]         = useState<'edit' | 'delete'>('edit');
  const [name, setName]         = useState(bill.name);
  const [amount, setAmount]     = useState(String(bill.amount ?? ''));
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(bill.currency ?? 'PEN');
  const [category, setCategory] = useState(bill.category ?? 'otros');
  const [paidBy, setPaidBy]     = useState(bill.paidBy ?? '');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');

  const Icon = categoryIcon(category);
  // Una categoría que ya no está en la lista (legacy) se sigue mostrando
  // para no cambiarla sin querer.
  const catOptions = categories.includes(category) ? categories : [...categories, category];

  const parsed = parseFloat(amount.replace(',', '.'));
  const changed =
    name.trim() !== bill.name ||
    (!managedBy && (parsed !== Number(bill.amount) || currency !== (bill.currency ?? 'PEN'))) ||
    category !== (bill.category ?? 'otros') ||
    (!isPersonal && paidBy !== (bill.paidBy ?? ''));

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message ?? 'Algo falló. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!changed) { onClose(); return; }
    if (!name.trim()) { setError('Escribe un nombre.'); return; }
    if (!managedBy && (!Number.isFinite(parsed) || parsed <= 0)) { setError('Escribe un monto mayor a cero.'); return; }

    const updated: RecurrentBill = {
      ...bill,
      name: name.trim(),
      category,
      ...(managedBy ? {} : {
        amount: Math.round(parsed * 100) / 100,
        currency,
        exchangeRate: currency === 'USD'
          ? (bill.currency === 'USD' && bill.exchangeRate ? bill.exchangeRate : defaultExchangeRate)
          : 1,
      }),
      ...(isPersonal ? {} : { paidBy: paidBy || undefined }),
    };
    run(() => onSave(updated));
  }

  return (
    <div className="fixed inset-0 z-[310] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl px-5 pt-3 shadow-2xl animate-slide-up max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="w-9 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 mx-auto mb-4" />

        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
            <Icon size={18} />
          </span>
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {step === 'edit' ? bill.name : `Eliminar ${bill.name}`}
          </h2>
        </div>

        {step === 'edit' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="rec-name" className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Nombre</label>
              <input
                id="rec-name"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                maxLength={40}
                disabled={busy}
                className="mt-1 w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="rec-amount" className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Monto</label>
              {managedBy ? (
                <div className="mt-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2.5">
                  <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{money(bill)}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    El {managedBy} se cambia en Configuración del depa.
                  </p>
                </div>
              ) : (
                <div className="mt-1 flex gap-2">
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-0.5 shrink-0">
                    {(['PEN', 'USD'] as const).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        disabled={busy}
                        aria-pressed={currency === c}
                        className={`px-2.5 h-9 rounded-lg text-[12px] font-bold transition ${
                          currency === c ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500'
                        }`}
                      >
                        {c === 'PEN' ? 'S/' : '$'}
                      </button>
                    ))}
                  </div>
                  <input
                    id="rec-amount"
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setError(''); }}
                    disabled={busy}
                    className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">Categoría</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
                {catOptions.map(c => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={category === c}
                    onClick={() => setCategory(c)}
                    disabled={busy}
                    className={`h-9 px-3 rounded-xl text-[13px] font-medium border transition ${
                      category === c
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {getCategoryLabel(c)}
                  </button>
                ))}
              </div>
            </div>

            {!isPersonal && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">Quién lo paga</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quién lo paga">
                  {roommates.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={paidBy === r.id}
                      onClick={() => setPaidBy(r.id)}
                      disabled={busy}
                      className={`h-9 pl-1.5 pr-3 rounded-full text-[13px] font-medium border transition inline-flex items-center gap-2 ${
                        paidBy === r.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: r.color }}>
                        {r.name.charAt(0)}
                      </span>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-[12px] text-rose-500 font-medium">{error}</p>}

            <div>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="w-full h-12 rounded-2xl bg-indigo-600 text-white text-[14px] font-semibold flex items-center justify-center disabled:opacity-60"
              >
                {busy ? <Loader size={17} className="animate-spin" /> : changed ? 'Guardar' : 'Listo'}
              </button>
              <button
                type="button"
                onClick={() => { setError(''); setStep('delete'); }}
                disabled={busy}
                className="mt-2 w-full h-11 rounded-2xl text-rose-600 dark:text-rose-400 text-[14px] font-semibold"
              >
                Eliminar recurrente
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Deja de aparecer en "Cargar desde recurrente". Los gastos que ya registraste con él no cambian.
            </p>
            {managedBy && (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                El {managedBy} del depa se mantiene en Configuración.
              </p>
            )}
            {error && <p className="text-[12px] text-rose-500 font-medium mt-2">{error}</p>}
            <button
              type="button"
              onClick={() => run(onDelete)}
              disabled={busy}
              className="mt-4 w-full h-12 rounded-2xl bg-rose-600 text-white text-[14px] font-semibold flex items-center justify-center disabled:opacity-60"
            >
              {busy ? <Loader size={17} className="animate-spin" /> : 'Eliminar'}
            </button>
            <button type="button" onClick={() => setStep('edit')} disabled={busy}
              className="mt-2 w-full h-11 rounded-2xl text-zinc-500 text-[14px] font-medium">
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
