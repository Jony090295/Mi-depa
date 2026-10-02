import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Check, Home, User, Layers } from 'lucide-react';

export type MacroFilter = 'todos' | 'hogar' | 'personal';
/** 'YYYY-MM' para un mes, o 'todo' para todo el historial. */
export type PeriodFilter = string;

export interface MonthOption {
  key: string;      // 'YYYY-MM'
  total: number;    // en soles
}

interface Props {
  macro: MacroFilter;
  onMacro: (m: MacroFilter) => void;
  period: PeriodFilter;
  onPeriod: (p: PeriodFilter) => void;
  /** Meses con gastos (más el actual), del más reciente al más antiguo. */
  months: MonthOption[];
  historyTotal: number;
  currentMonth: string; // 'YYYY-MM'
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** '2026-10' → 'Octubre', o 'Diciembre 2025' si no es del año en curso. */
export function monthLabel(key: string, currentMonth: string): string {
  const [y, m] = key.split('-');
  const name = MONTH_NAMES[Number(m) - 1] ?? key;
  return y === currentMonth.slice(0, 4) ? name : `${name} ${y}`;
}

const soles = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`;

const MACRO_OPTIONS: { id: MacroFilter; label: string; Icon: typeof Home }[] = [
  { id: 'todos', label: 'Todo', Icon: Layers },
  { id: 'hogar', label: 'Hogar', Icon: Home },
  { id: 'personal', label: 'Personal', Icon: User },
];

/**
 * Filtros de la lista de gastos: dos pastillas con desplegable (tipo y mes).
 *
 * Reemplaza a dos filas de chips donde "Todos" aparecía dos veces con
 * significados distintos y el período era solo "este mes" o "todo". Cada
 * pastilla dice su valor actual y se pinta cuando no está en el valor por
 * defecto, para ver de un vistazo que hay un filtro activo.
 */
export default function ExpenseFilters({ macro, onMacro, period, onPeriod, months, historyTotal, currentMonth }: Props) {
  const [open, setOpen] = useState<null | 'macro' | 'period'>(null);

  const macroOpt = MACRO_OPTIONS.find(o => o.id === macro) ?? MACRO_OPTIONS[0];
  const periodText = period === 'todo' ? 'Todo el historial' : monthLabel(period, currentMonth);

  return (
    <div className="flex items-center gap-2">
      <Pill
        label={macroOpt.label}
        icon={<macroOpt.Icon size={13} aria-hidden="true" />}
        active={macro !== 'todos'}
        open={open === 'macro'}
        onToggle={() => setOpen(o => (o === 'macro' ? null : 'macro'))}
        onClose={() => setOpen(null)}
        ariaLabel={`Tipo de gasto: ${macroOpt.label}`}
      >
        {MACRO_OPTIONS.map(o => (
          <MenuItem key={o.id} checked={macro === o.id}
            onSelect={() => { onMacro(o.id); setOpen(null); }}>
            <o.Icon size={14} className="text-zinc-400" aria-hidden="true" />
            <span className="flex-1">{o.label}</span>
          </MenuItem>
        ))}
      </Pill>

      <Pill
        label={periodText}
        active={period !== currentMonth}
        open={open === 'period'}
        onToggle={() => setOpen(o => (o === 'period' ? null : 'period'))}
        onClose={() => setOpen(null)}
        ariaLabel={`Período: ${periodText}`}
      >
        <div className="max-h-[320px] overflow-y-auto">
          {months.map(m => (
            <MenuItem key={m.key} checked={period === m.key}
              onSelect={() => { onPeriod(m.key); setOpen(null); }}>
              <span className="flex-1">{monthLabel(m.key, currentMonth)}</span>
              <span className="text-[12px] text-zinc-400 tabular-nums">{m.total > 0 ? soles(m.total) : '—'}</span>
            </MenuItem>
          ))}
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <MenuItem checked={period === 'todo'} onSelect={() => { onPeriod('todo'); setOpen(null); }}>
            <span className="flex-1">Todo el historial</span>
            <span className="text-[12px] text-zinc-400 tabular-nums">{soles(historyTotal)}</span>
          </MenuItem>
        </div>
      </Pill>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function Pill({ label, icon, active, open, onToggle, onClose, ariaLabel, children }: {
  label: string; icon?: ReactNode; active: boolean; open: boolean;
  onToggle: () => void; onClose: () => void; ariaLabel: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);

  // El menú se alinea a la izquierda de la pastilla; si eso lo saca de la
  // pantalla (pasa con la segunda pastilla cuando la primera dice "Personal"),
  // se corre a la izquierda lo justo. Se mide antes de pintar para que no salte.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) { setDx(0); return; }
    const margin = 12;
    const r = menuRef.current.getBoundingClientRect();
    const overflow = r.right - (window.innerWidth - margin);
    setDx(overflow > 0 ? -Math.min(overflow, r.left - margin) : 0);
  }, [open]);

  // Cerrar con Escape o tocando afuera
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`h-9 pl-3 pr-2.5 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 border transition active:scale-95 ${
          active
            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
        }`}
      >
        {icon}
        {label}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''} ${active ? 'text-indigo-400' : 'text-zinc-400'}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
          className="absolute left-0 top-full mt-1.5 z-40 min-w-[240px] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl p-1 animate-fadeIn"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ checked, onSelect, children }: {
  // React's JSX `key` is not available in this project without the optional
  // @types/react package, so declare it for type-checking only.
  key?: string;
  checked: boolean; onSelect: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[14px] whitespace-nowrap transition ${
        checked ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-zinc-700 dark:text-zinc-300 active:bg-zinc-50 dark:active:bg-zinc-800'
      }`}
    >
      {children}
      <Check size={14} className={checked ? 'text-indigo-600' : 'invisible'} aria-hidden="true" />
    </button>
  );
}
