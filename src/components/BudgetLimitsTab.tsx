import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Edit2, X, Target } from 'lucide-react';
import { Expense } from '../types';
import { CATEGORY_LABELS, getCategoryLabel } from '../utils';

interface Props {
  apartmentId: string;
  expenses: Expense[];
  rentExchangeRate: number;
  hogarCategories: string[];
  personalCategories: string[];
}

export interface BudgetLimits {
  global_hogar?: number;
  global_personal?: number;
  [category: string]: number | undefined;
}

function lsKey(apartmentId: string) {
  return `budget_limits_${apartmentId}`;
}

export function loadLimits(apartmentId: string): BudgetLimits {
  try {
    const raw = localStorage.getItem(lsKey(apartmentId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLimits(apartmentId: string, limits: BudgetLimits) {
  localStorage.setItem(lsKey(apartmentId), JSON.stringify(limits));
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(spent: number, limit: number) {
  if (!limit) return 0;
  return Math.min((spent / limit) * 100, 100);
}

function statusColor(p: number) {
  if (p >= 100) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' };
  if (p >= 80)  return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-white dark:bg-zinc-900', border: 'border-zinc-200 dark:border-zinc-800' };
}

interface EditModalProps {
  label: string;
  current?: number;
  onSave: (v: number | undefined) => void;
  onClose: () => void;
}

function EditModal({ label, current, onSave, onClose }: EditModalProps) {
  const [val, setVal] = useState(current ? String(current) : '');

  function handleSave() {
    const n = parseFloat(val.replace(',', '.'));
    onSave(isNaN(n) || n <= 0 ? undefined : n);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100">Límite — {label}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <X size={15} className="text-zinc-500" />
          </button>
        </div>
        <label className="block text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
          Límite mensual (S/)
        </label>
        <input
          type="number"
          inputMode="decimal"
          className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-[16px] font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Ej: 500"
          value={val}
          onChange={e => setVal(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3 mt-5">
          {current !== undefined && (
            <button
              onClick={() => { onSave(undefined); onClose(); }}
              className="flex-1 h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[14px] font-semibold"
            >
              Eliminar límite
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 h-12 rounded-2xl bg-indigo-600 text-white text-[14px] font-semibold shadow-md shadow-indigo-500/30"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

interface BarRowProps {
  label: string;
  spent: number;
  limit?: number;
  onEdit: () => void;
}

function BarRow({ label, spent, limit, onEdit }: BarRowProps) {
  const p = limit ? pct(spent, limit) : 0;
  const colors = statusColor(p);
  const hasLimit = limit !== undefined;

  return (
    <div className={`rounded-2xl border p-4 ${hasLimit ? colors.bg : 'bg-zinc-50 dark:bg-zinc-900'} ${hasLimit ? colors.border : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 truncate pr-2">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {hasLimit && p >= 80 && (
            <AlertTriangle size={13} className={colors.text} />
          )}
          {hasLimit && p < 80 && (
            <CheckCircle size={13} className="text-emerald-500" />
          )}
          <button
            onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm"
          >
            <Edit2 size={12} className="text-zinc-500" />
          </button>
        </div>
      </div>

      {hasLimit ? (
        <>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className={`text-[12px] font-medium ${colors.text}`}>
              {formatPEN(spent)} de {formatPEN(limit)}
            </span>
            <span className={`text-[11px] font-bold ${colors.text}`}>{Math.round(p)}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
              style={{ width: `${p}%` }}
            />
          </div>
          {p >= 80 && p < 100 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1.5">
              Queda {formatPEN(limit - spent)} ({Math.round(100 - p)}%) del límite
            </p>
          )}
          {p >= 100 && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1.5">
              Límite superado por {formatPEN(spent - limit)}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[12px] text-zinc-400 dark:text-zinc-500">Gastado: {formatPEN(spent)}</span>
          <span className="text-[11px] text-zinc-300 dark:text-zinc-600">· Sin límite definido</span>
        </div>
      )}
    </div>
  );
}

export default function BudgetLimitsTab({ apartmentId, expenses, rentExchangeRate, hogarCategories, personalCategories }: Props) {
  const [limits, setLimits] = useState<BudgetLimits>(() => loadLimits(apartmentId));
  const [editing, setEditing] = useState<{ key: string; label: string } | null>(null);
  const [expandHogar, setExpandHogar] = useState(true);
  const [expandPersonal, setExpandPersonal] = useState(true);

  useEffect(() => { saveLimits(apartmentId, limits); }, [limits, apartmentId]);

  const monthStart = useMemo(() => getMonthStart(), []);

  // Current month expenses, converting USD → PEN
  const monthExpenses = useMemo(() => expenses.filter(e => {
    if (!e.date) return false;
    return new Date(e.date + 'T00:00:00') >= monthStart;
  }), [expenses, monthStart]);

  // Spending by category (all, not filtered by personal)
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthExpenses.forEach(e => {
      const rate = e.currency === 'USD' ? (e.exchangeRate || rentExchangeRate) : 1;
      const cat = e.category || 'otros';
      map[cat] = (map[cat] ?? 0) + e.amount * rate;
    });
    return map;
  }, [monthExpenses, rentExchangeRate]);

  // Totals by macro
  const spentHogar = useMemo(() =>
    monthExpenses.filter(e => e.macroCategory === 'hogar').reduce((s, e) => {
      const rate = e.currency === 'USD' ? (e.exchangeRate || rentExchangeRate) : 1;
      return s + e.amount * rate;
    }, 0), [monthExpenses, rentExchangeRate]);

  const spentPersonal = useMemo(() =>
    monthExpenses.filter(e => e.macroCategory === 'personal').reduce((s, e) => {
      const rate = e.currency === 'USD' ? (e.exchangeRate || rentExchangeRate) : 1;
      return s + e.amount * rate;
    }, 0), [monthExpenses, rentExchangeRate]);

  const hogarCats = hogarCategories;
  const personalCats = personalCategories;

  function updateLimit(key: string, value: number | undefined) {
    setLimits(prev => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  // Alert summary
  const alerts = useMemo(() => {
    const items: string[] = [];
    if (limits.global_hogar) {
      const p = pct(spentHogar, limits.global_hogar);
      if (p >= 80) items.push(`Total Hogar al ${Math.round(p)}%`);
    }
    if (limits.global_personal) {
      const p = pct(spentPersonal, limits.global_personal);
      if (p >= 80) items.push(`Total Personal al ${Math.round(p)}%`);
    }
    [...hogarCats, ...personalCats].forEach(cat => {
      if (limits[cat]) {
        const p = pct(spentByCategory[cat] ?? 0, limits[cat]!);
        if (p >= 80) items.push(`${getCategoryLabel(cat)} al ${Math.round(p)}%`);
      }
    });
    return items;
  }, [limits, spentHogar, spentPersonal, spentByCategory, hogarCats, personalCats]);

  const monthName = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5 pb-nav">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
          <Target size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100">Límites de gasto</h2>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 capitalize">{monthName}</p>
        </div>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-amber-800 dark:text-amber-300 mb-1">
                {alerts.length === 1 ? '1 categoría cerca del límite' : `${alerts.length} categorías cerca del límite`}
              </p>
              <ul className="space-y-0.5">
                {alerts.map((a, i) => (
                  <li key={i} className="text-[12px] text-amber-700 dark:text-amber-400">• {a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Hogar section */}
      <div>
        <button
          className="flex items-center justify-between w-full mb-3"
          onClick={() => setExpandHogar(v => !v)}
        >
          <span className="text-[13px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Hogar</span>
          {expandHogar ? <ChevronUp size={15} className="text-zinc-400" /> : <ChevronDown size={15} className="text-zinc-400" />}
        </button>

        {expandHogar && (
          <div className="space-y-3">
            <BarRow
              label="Total Hogar (global)"
              spent={spentHogar}
              limit={limits.global_hogar}
              onEdit={() => setEditing({ key: 'global_hogar', label: 'Total Hogar' })}
            />
            {hogarCats.map(cat => (
              <BarRow
                key={cat}
                label={getCategoryLabel(cat)}
                spent={spentByCategory[cat] ?? 0}
                limit={limits[cat]}
                onEdit={() => setEditing({ key: cat, label: getCategoryLabel(cat) })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Personal section */}
      <div>
        <button
          className="flex items-center justify-between w-full mb-3"
          onClick={() => setExpandPersonal(v => !v)}
        >
          <span className="text-[13px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Personal</span>
          {expandPersonal ? <ChevronUp size={15} className="text-zinc-400" /> : <ChevronDown size={15} className="text-zinc-400" />}
        </button>

        {expandPersonal && (
          <div className="space-y-3">
            <BarRow
              label="Total Personal (global)"
              spent={spentPersonal}
              limit={limits.global_personal}
              onEdit={() => setEditing({ key: 'global_personal', label: 'Total Personal' })}
            />
            {personalCats.map(cat => (
              <BarRow
                key={cat}
                label={getCategoryLabel(cat)}
                spent={spentByCategory[cat] ?? 0}
                limit={limits[cat]}
                onEdit={() => setEditing({ key: cat, label: getCategoryLabel(cat) })}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center pb-2">
        Los USD se convierten a soles usando el tipo de cambio configurado (S/ {rentExchangeRate.toFixed(2)})
      </p>

      {editing && (
        <EditModal
          label={editing.label}
          current={limits[editing.key]}
          onSave={v => updateLimit(editing.key, v)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
