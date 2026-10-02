import { useState, useEffect, useMemo, useRef, type ElementType } from 'react';
import { Target, Plus, Home, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Expense } from '../types';
import { getCategoryLabel, localMonthISO } from '../utils';
import { categoryIcon } from '../lib/categoryIcons';
import { monthLabel } from './ExpenseFilters';
import {
  type Macro, type BudgetLimits, type MacroSpending,
  loadLimits, updateLimits, onLimitsChange, monthSpending, TOTAL_LABEL,
} from '../lib/budgetLimits';

interface Props {
  apartmentId: string;
  expenses: Expense[];
  rentExchangeRate: number;
  hogarCategories: string[];
  personalCategories: string[];
}

/** Qué se limita: el total de hogar/personal o una categoría. */
type Target = { kind: 'total' } | { kind: 'cat'; cat: string };

const MACROS: { id: Macro; title: string; hint: string }[] = [
  { id: 'hogar', title: 'Hogar', hint: 'Lo que gastan entre todos' },
  { id: 'personal', title: 'Personal', hint: 'Solo tus gastos' },
];

/** Gastos redondeados; el límite tal como se escribió (120.50 no es 121). */
function formatPEN(n: number, exact = false) {
  return exact
    ? `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`
    : `S/ ${Math.round(n).toLocaleString('es-PE')}`;
}

function prevMonthKey(month: string) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function statusColor(p: number) {
  if (p >= 100) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' };
  if (p >= 80)  return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-white dark:bg-zinc-900', border: 'border-zinc-200 dark:border-zinc-800' };
}

const targetKey = (t: Target) => (t.kind === 'total' ? 'total' : `cat:${t.cat}`);
const labelOf = (macro: Macro, t: Target) => (t.kind === 'total' ? TOTAL_LABEL[macro] : getCategoryLabel(t.cat));
const iconOf = (macro: Macro, t: Target): ElementType =>
  t.kind === 'total' ? (macro === 'hogar' ? Home : User) : categoryIcon(t.cat);
const limitOf = (limits: BudgetLimits, macro: Macro, t: Target) =>
  t.kind === 'total' ? limits[macro].total : limits[macro].categories[t.cat];
const spentOf = (s: Record<Macro, MacroSpending>, macro: Macro, t: Target) =>
  t.kind === 'total' ? s[macro].total : (s[macro].byCategory[t.cat] ?? 0);

/**
 * Límites de gasto del mes. Solo se muestran los que el usuario eligió; el
 * resto se agrega con "Agregar". Antes se listaban todas las categorías con
 * "Sin límite definido", y no había forma de decir cuáles importaban.
 */
export default function BudgetLimitsTab({ apartmentId, expenses, rentExchangeRate, hogarCategories, personalCategories }: Props) {
  const cats = useMemo(() => ({ hogar: hogarCategories, personal: personalCategories }), [hogarCategories, personalCategories]);

  // Los límites viven en el almacenamiento; esto solo fuerza a releerlos
  const [rev, setRev] = useState(0);
  useEffect(() => onLimitsChange(() => setRev(r => r + 1)), []);
  const limits = useMemo(() => loadLimits(apartmentId, cats), [apartmentId, cats, rev]);

  const month = localMonthISO();
  const prevMonth = prevMonthKey(month);
  const spending = useMemo(() => monthSpending(expenses, month, rentExchangeRate), [expenses, month, rentExchangeRate]);
  const prevSpending = useMemo(() => monthSpending(expenses, prevMonth, rentExchangeRate), [expenses, prevMonth, rentExchangeRate]);

  // target null = elegir qué limitar; con target = poner el monto
  const [sheet, setSheet] = useState<{ macro: Macro; target: Target | null } | null>(null);

  function save(macro: Macro, t: Target, value: number | undefined) {
    updateLimits(apartmentId, cats, l => {
      if (t.kind === 'total') {
        if (value === undefined) delete l[macro].total;
        else l[macro].total = value;
      } else if (value === undefined) {
        delete l[macro].categories[t.cat];
      } else {
        l[macro].categories[t.cat] = value;
      }
    });
  }

  const withLimit = (macro: Macro): Target[] => [
    ...(limits[macro].total !== undefined ? [{ kind: 'total' } as const] : []),
    ...cats[macro].filter(c => limits[macro].categories[c] !== undefined).map(cat => ({ kind: 'cat', cat } as const)),
  ];
  const withoutLimit = (macro: Macro): Target[] => [
    ...(limits[macro].total === undefined ? [{ kind: 'total' } as const] : []),
    ...cats[macro].filter(c => limits[macro].categories[c] === undefined).map(cat => ({ kind: 'cat', cat } as const)),
  ];

  // "octubre de 2026" → "Octubre de 2026" (con CSS capitalize salía "De")
  const monthName = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());

  return (
    <div className="space-y-6 pb-nav">
      <div className="flex items-center gap-3 pt-1">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
          <Target size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100">Límites de gasto</h2>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{monthName}</p>
        </div>
      </div>

      {MACROS.map(({ id: macro, title, hint }) => {
        const set = withLimit(macro);
        const canAdd = withoutLimit(macro).length > 0;
        return (
          <section key={macro}>
            <div className="flex items-end justify-between mb-2.5">
              <div>
                <h3 className="text-[13px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</h3>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{hint}</p>
              </div>
              {set.length > 0 && canAdd && (
                <button
                  type="button"
                  onClick={() => setSheet({ macro, target: null })}
                  className="h-8 pl-2 pr-3 rounded-full text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 active:bg-indigo-50 dark:active:bg-indigo-950/40"
                >
                  <Plus size={15} aria-hidden="true" /> Agregar
                </button>
              )}
            </div>

            {set.length === 0 ? (
              <button
                type="button"
                onClick={() => setSheet({ macro, target: null })}
                className="w-full rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
              >
                <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Plus size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">Agregar un límite</span>
                  <span className="block text-[12px] text-zinc-400 dark:text-zinc-500">
                    Al total {macro === 'hogar' ? 'del hogar' : 'personal'} o a una categoría
                  </span>
                </span>
              </button>
            ) : (
              <div className="space-y-2.5">
                {set.map(t => (
                  <LimitRow
                    key={targetKey(t)}
                    label={labelOf(macro, t)}
                    Icon={iconOf(macro, t)}
                    spent={spentOf(spending, macro, t)}
                    limit={limitOf(limits, macro, t)!}
                    onEdit={() => setSheet({ macro, target: t })}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {sheet && (
        <LimitSheet
          macro={sheet.macro}
          initialTarget={sheet.target}
          options={withoutLimit(sheet.macro)}
          limits={limits}
          spending={spending}
          prevSpending={prevSpending}
          prevMonthLabel={monthLabel(prevMonth, month).toLowerCase()}
          onSave={(t, v) => { save(sheet.macro, t, v); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function LimitRow({ label, Icon, spent, limit, onEdit }: {
  // React's JSX `key` is not available in this project without the optional
  // @types/react package, so declare it for type-checking only.
  key?: string;
  label: string; Icon: ElementType; spent: number; limit: number; onEdit: () => void;
}) {
  const p = (spent / limit) * 100;
  const colors = statusColor(p);
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`w-full text-left rounded-2xl border p-4 transition active:scale-[0.99] ${colors.bg} ${colors.border}`}
    >
      <div className="flex items-center gap-3 mb-2.5">
        <span className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0 text-[14px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{label}</span>
        <span className={`text-[13px] font-bold tabular-nums ${colors.text}`}>{Math.round(p)}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-2 text-[12px]">
        <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">{formatPEN(spent)} de {formatPEN(limit, true)}</span>
        <span className={`font-medium tabular-nums ${p >= 100 ? colors.text : 'text-zinc-400 dark:text-zinc-500'}`}>
          {p >= 100 ? `Excedido por ${formatPEN(spent - limit)}` : `Quedan ${formatPEN(limit - spent, !Number.isInteger(limit))}`}
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────

function LimitSheet({ macro, initialTarget, options, limits, spending, prevSpending, prevMonthLabel, onSave, onClose }: {
  macro: Macro;
  /** null: empieza eligiendo qué limitar. */
  initialTarget: Target | null;
  /** Lo que todavía no tiene límite. */
  options: Target[];
  limits: BudgetLimits;
  spending: Record<Macro, MacroSpending>;
  prevSpending: Record<Macro, MacroSpending>;
  prevMonthLabel: string;
  onSave: (t: Target, value: number | undefined) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Target | null>(initialTarget);
  const current = target ? limitOf(limits, macro, target) : undefined;
  const [amount, setAmount] = useState(current !== undefined ? String(current) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  const cleaned = amount.trim().replace(',', '.');
  const value = /^\d+(\.\d{0,2})?$/.test(cleaned) ? parseFloat(cleaned) : NaN;
  const canSave = value > 0 && value !== current;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { if (target) inputRef.current?.focus(); }, [target]);

  function pick(t: Target) {
    setTarget(t);
    setAmount('');
  }

  const macroName = macro === 'hogar' ? 'Hogar' : 'Personal';

  return (
    <div className="fixed inset-0 z-[310] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl px-5 pt-3 shadow-2xl animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="w-9 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 mx-auto mb-4" />

        {!target ? (
          <>
            <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100">¿Qué quieres limitar?</h2>
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mb-3">{macroName} · gastado este mes</p>
            <div className="max-h-[60vh] overflow-y-auto -mx-2">
              {options.map(t => {
                const Icon = iconOf(macro, t);
                return (
                  <button
                    key={targetKey(t)}
                    type="button"
                    onClick={() => pick(t)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left active:bg-zinc-50 dark:active:bg-zinc-800"
                  >
                    <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0 text-[14px] font-medium text-zinc-800 dark:text-zinc-200 truncate">{labelOf(macro, t)}</span>
                    <span className="text-[13px] text-zinc-400 dark:text-zinc-500 tabular-nums">{formatPEN(spentOf(spending, macro, t))}</span>
                    <ChevronRight size={15} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              {initialTarget === null && (
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  aria-label="Elegir otra cosa"
                  className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-zinc-500 active:bg-zinc-100 dark:active:bg-zinc-800"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <span className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                {(() => { const Icon = iconOf(macro, target); return <Icon size={18} aria-hidden="true" />; })()}
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{labelOf(macro, target)}</h2>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500">{macroName}</p>
              </div>
            </div>

            <label htmlFor="limit-amount" className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Límite mensual</label>
            <div className="mt-1 flex items-center h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="pl-3.5 pr-1.5 text-[15px] font-semibold text-zinc-400">S/</span>
              <input
                id="limit-amount"
                ref={inputRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSave) onSave(target, value); }}
                className="flex-1 min-w-0 h-full bg-transparent pr-3 text-[17px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none"
              />
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2">
              Este mes llevas {formatPEN(spentOf(spending, macro, target))}
              {' · '}en {prevMonthLabel}, {formatPEN(spentOf(prevSpending, macro, target))}
            </p>

            <button
              type="button"
              onClick={() => canSave && onSave(target, value)}
              disabled={!canSave}
              className="mt-4 w-full h-12 rounded-2xl bg-indigo-600 text-white text-[14px] font-semibold disabled:opacity-40"
            >
              Guardar
            </button>
            {current !== undefined ? (
              <button
                type="button"
                onClick={() => onSave(target, undefined)}
                className="mt-2 w-full h-11 rounded-2xl text-rose-600 dark:text-rose-400 text-[14px] font-semibold"
              >
                Quitar límite
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="mt-2 w-full h-11 rounded-2xl text-zinc-500 text-[14px] font-medium"
              >
                Cancelar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
