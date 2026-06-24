import React, { useState } from 'react';
import { RecurrentBill, Roommate, Expense, ExpenseCategory } from '../types';
import { Wallet, TrendingDown, TrendingUp, Coins, Home, Zap, Tv, Heart, ShoppingBag, HelpCircle, ChevronRight } from 'lucide-react';

interface ProjectedBudgetProps {
  bills: RecurrentBill[];
  roommates: Roommate[];
  expenses: Expense[];
  rentExchangeRate: number;
}

// ---- Categories ----
const CATEGORIES = [
  { key: 'Hogar',         label: 'Hogar y Alquiler',     color: '#6366f1', icon: Home,        bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' },
  { key: 'Servicios',     label: 'Servicios Básicos',     color: '#ec4899', icon: Zap,         bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' },
  { key: 'Suscripciones', label: 'Suscripciones',         color: '#10b981', icon: Tv,          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' },
  { key: 'Salud',         label: 'Salud y Seguros',       color: '#3b82f6', icon: Heart,       bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' },
  { key: 'Consumos',      label: 'Consumos',              color: '#f59e0b', icon: ShoppingBag, bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' },
  { key: 'Otros',         label: 'Otros',                 color: '#a1a1aa', icon: HelpCircle,  bg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' },
] as const;

type CatKey = typeof CATEGORIES[number]['key'];

function inferCategory(name: string, expCat?: ExpenseCategory): CatKey {
  if (expCat) {
    if (expCat === 'alquiler') return 'Hogar';
    if (expCat === 'servicio') return 'Servicios';
    if (expCat === 'membresia') return 'Suscripciones';
    if (expCat === 'auto') return 'Consumos';
    if (expCat === 'comida') return 'Consumos';
    if (expCat === 'limpieza') return 'Otros';
  }
  const l = name.toLowerCase();
  if (/alquiler|cochera|depa|cclp/.test(l)) return 'Hogar';
  if (/agua|luz|gas|internet|cel|calidda|servicio/.test(l)) return 'Servicios';
  if (/spotify|netflix|combo|disney|prime|hbo|apple|suscrip/.test(l)) return 'Suscripciones';
  if (/seguro|onco|salud|colágeno|colage|médico|medico|clínica|clinica/.test(l)) return 'Salud';
  if (/comida|super|mercado|gasolina|restaurante|delivery/.test(l)) return 'Consumos';
  return 'Otros';
}

function getCurrentMonthYear() {
  const now = new Date();
  return `${now.getMonth() + 1}-${now.getFullYear()}`;
}

function toSoles(amount: number, currency: 'PEN' | 'USD' | undefined, rate: number) {
  return currency === 'USD' ? amount * rate : amount;
}

const EXP_CATEGORY_LABELS: Record<string, string> = {
  alquiler: 'Alquiler',
  membresia: 'Membresía',
  auto: 'Auto / Transporte',
  servicio: 'Servicios',
  comida: 'Comida / Supermercado',
  limpieza: 'Limpieza / Hogar',
  otros: 'Otros gastos',
};

interface LineItem {
  id: string;
  name: string;
  amount: number;
  category: CatKey;
  source: 'fijo' | 'gasto';
  count?: number;
}

export default function ProjectedBudget({ bills, roommates, expenses, rentExchangeRate }: ProjectedBudgetProps) {
  const [hoveredCat, setHoveredCat] = useState<CatKey | null>(null);
  const [openCat, setOpenCat] = useState<CatKey | null>(null);

  const rate = rentExchangeRate || 3.80;

  // ---- Ingresos ----
  const totalIncome = roommates.reduce((s, r) => s + r.income, 0);

  // ---- Gastos fijos (bills) ----
  const fixedItems: LineItem[] = bills.map(b => ({
    id: `bill-${b.id}`,
    name: b.name,
    amount: toSoles(b.amount, b.currency, rate),
    category: inferCategory(b.name, b.category),
    source: 'fijo',
  }));

  // ---- Gastos variables del mes actual (expenses) ----
  const currentMY = getCurrentMonthYear();
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return `${d.getMonth() + 1}-${d.getFullYear()}` === currentMY;
  });

  // De-duplicate: si un gasto ya viene de un bill (associatedExpenseId), no lo contar dos veces
  const billLinkedIds = new Set(bills.map(b => b.associatedExpenseId).filter(Boolean));
  // Group variable expenses by their expense category → one line per group
  const expGroupMap = new Map<string, { amount: number; cat: CatKey; count: number }>();
  monthExpenses
    .filter(e => !billLinkedIds.has(e.id))
    .forEach(e => {
      const key = e.category || 'otros';
      const soles = toSoles(e.amount, e.currency, e.exchangeRate || rate);
      const cat = inferCategory(e.title, e.category);
      const prev = expGroupMap.get(key);
      if (prev) { prev.amount += soles; prev.count++; }
      else expGroupMap.set(key, { amount: soles, cat, count: 1 });
    });
  const variableItems: LineItem[] = Array.from(expGroupMap.entries()).map(([key, val]) => ({
    id: `exp-group-${key}`,
    name: EXP_CATEGORY_LABELS[key] || 'Otros gastos',
    amount: val.amount,
    category: val.cat,
    source: 'gasto',
    count: val.count,
  }));

  const allItems = [...fixedItems, ...variableItems];
  const totalGastos = allItems.reduce((s, i) => s + i.amount, 0);
  const saldo = totalIncome - totalGastos;

  // ---- Por categoría ----
  const catTotals = CATEGORIES.map(cat => {
    const items = allItems.filter(i => i.category === cat.key);
    const amount = items.reduce((s, i) => s + i.amount, 0);
    return { ...cat, items, amount };
  }).filter(c => c.amount > 0 || openCat === c.key);

  const totalForChart = catTotals.reduce((s, c) => s + c.amount, 0);

  // Donut slices
  let acc = 0;
  const slices = catTotals.map(cat => {
    const pct = totalForChart > 0 ? (cat.amount / totalForChart) * 100 : 0;
    const start = acc;
    acc += pct;
    return { ...cat, pct, start };
  });

  const displayCat = hoveredCat ? catTotals.find(c => c.key === hoveredCat) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div>
        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Presupuesto</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Basado en tus gastos reales registrados este mes</p>
      </div>

      {/* KPI rows */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-50 dark:divide-zinc-800">

        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
            <Coins size={14} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide">Ingresos</p>
            <p className="text-[11px] text-zinc-400">{roommates.length} roommates</p>
          </div>
          <p className="text-[18px] font-black font-mono text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
            S/{totalIncome.toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <TrendingDown size={14} className="text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide">Gastos</p>
            <p className="text-[11px] text-zinc-400">{fixedItems.length} fijos · {variableItems.length} variables</p>
          </div>
          <p className="text-[18px] font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
            S/{totalGastos.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className={`flex items-center gap-3 px-4 py-3.5 ${saldo >= 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : 'bg-rose-50/50 dark:bg-rose-950/10'}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${saldo >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-rose-100 dark:bg-rose-950/40'}`}>
            <TrendingUp size={14} className={saldo >= 0 ? 'text-emerald-600' : 'text-rose-500'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide">Saldo</p>
            <p className="text-[11px] text-zinc-400">{saldo >= 0 ? 'disponible este mes' : 'en déficit'}</p>
          </div>
          <p className={`text-[18px] font-black font-mono tabular-nums shrink-0 ${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {saldo >= 0 ? '+' : ''}S/{saldo.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>

      </div>

      {/* Barra de consumo */}
      {totalIncome > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-[11px] font-bold text-zinc-500">
            <span>{((totalGastos / totalIncome) * 100).toFixed(0)}% del ingreso usado</span>
            <span>{(100 - (totalGastos / totalIncome) * 100).toFixed(0)}% libre</span>
          </div>
          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalGastos / totalIncome > 0.9 ? 'bg-rose-500' :
                totalGastos / totalIncome > 0.75 ? 'bg-amber-400' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, (totalGastos / totalIncome) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Donut + breakdown */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Distribución por categoría</span>

        {allItems.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-sm">
            <p className="font-medium">Sin datos todavía.</p>
            <p className="text-xs mt-1">Registra gastos fijos o gastos en "Dividir" para ver la distribución.</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut */}
            <div className="relative w-40 h-40 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                {slices.map(slice => {
                  const R = 36, C = 2 * Math.PI * R;
                  const dash = (slice.pct / 100) * C;
                  const rot = (slice.start / 100) * 360 - 90;
                  const isHovered = hoveredCat === slice.key;
                  return (
                    <circle
                      key={slice.key}
                      cx="50" cy="50" r={R}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={isHovered ? 11 : 8}
                      strokeDasharray={`${dash} ${C}`}
                      strokeDashoffset={0}
                      transform={`rotate(${rot} 50 50)`}
                      strokeLinecap="butt"
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => setHoveredCat(slice.key as CatKey)}
                      onMouseLeave={() => setHoveredCat(null)}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                {displayCat ? (
                  <>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase leading-tight max-w-[70px] truncate">{displayCat.label}</span>
                    <span className="text-sm font-black font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
                      S/{displayCat.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-bold mt-0.5">{totalForChart > 0 ? ((displayCat.amount / totalForChart) * 100).toFixed(0) : 0}%</span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Total</span>
                    <span className="text-sm font-black font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
                      S/{totalForChart.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Legend + breakdown */}
            <div className="flex-1 w-full space-y-1">
              {catTotals.map(cat => {
                const Icon = cat.icon;
                const pct = totalForChart > 0 ? (cat.amount / totalForChart) * 100 : 0;
                const isOpen = openCat === cat.key;
                return (
                  <div key={cat.key}>
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer text-left ${
                        hoveredCat === cat.key ? 'bg-zinc-50 dark:bg-zinc-800/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                      }`}
                      onMouseEnter={() => setHoveredCat(cat.key as CatKey)}
                      onMouseLeave={() => setHoveredCat(null)}
                      onClick={() => setOpenCat(isOpen ? null : cat.key as CatKey)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{cat.label}</span>
                        <span className="text-[10px] text-zinc-400">({cat.items.length})</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black font-mono text-zinc-800 dark:text-zinc-100">
                          S/{cat.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] text-zinc-400 w-7 text-right">{pct.toFixed(0)}%</span>
                        <ChevronRight size={12} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="ml-5 mb-1 space-y-0.5">
                        {cat.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                item.source === 'fijo'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500'
                                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600'
                              }`}>{item.source === 'fijo' ? 'Recurrente' : 'Gasto'}</span>
                              <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{item.name}</span>
                              {item.count && item.count > 1 && (
                                <span className="text-[9px] text-zinc-400 shrink-0">({item.count} gastos)</span>
                              )}
                            </div>
                            <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 shrink-0 ml-2">
                              S/{item.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ingresos por roommate */}
      {roommates.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Ingresos por roommate</span>
          <div className="space-y-2">
            {roommates.map(r => {
              const pct = totalIncome > 0 ? (r.income / totalIncome) * 100 : 0;
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ backgroundColor: r.color }}>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      <span className="truncate">{r.name}</span>
                      <span className="font-mono shrink-0 ml-2">S/{r.income.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.color }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 w-8 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Monthly History Section */}
      {(() => {
        const monthNames = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];

        const getMonthKey = (dateStr: string) => {
          const parts = dateStr.split('-');
          if (parts.length < 2) return null;
          return `${parts[0]}-${parts[1]}`;
        };

        const getMonthLabel = (key: string) => {
          const parts = key.split('-');
          if (parts.length < 2) return key;
          const mIdx = parseInt(parts[1], 10) - 1;
          return `${monthNames[mIdx]} ${parts[0]}`;
        };

        // Build last 6 months from expense data
        const monthKeys = Array.from(new Set(expenses.map(e => getMonthKey(e.date)).filter(Boolean) as string[]))
          .sort((a, b) => b.localeCompare(a))
          .slice(0, 6);

        if (monthKeys.length === 0) return null;

        const monthData = monthKeys.map(key => {
          const monthExpenses = expenses.filter(e => getMonthKey(e.date) === key);
          const total = monthExpenses.reduce((sum, e) => sum + toSoles(e.amount, e.currency, rate), 0);

          // Top category
          const catTotals: Record<string, number> = {};
          monthExpenses.forEach(e => {
            const cat = e.category || 'otros';
            catTotals[cat] = (catTotals[cat] || 0) + toSoles(e.amount, e.currency, rate);
          });
          const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

          return { key, label: getMonthLabel(key), total, count: monthExpenses.length, topCat };
        });

        return (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50 mb-4 tracking-tight">Historial de Meses</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {monthData.map((m, i) => {
                const prev = monthData[i + 1];
                const pctChange = prev && prev.total > 0 ? ((m.total - prev.total) / prev.total) * 100 : null;
                const topCatLabel = m.topCat ? EXP_CATEGORY_LABELS[m.topCat] || m.topCat : null;
                return (
                  <div key={m.key} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-3.5 space-y-1.5">
                    <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">{m.label}</div>
                    <div className="text-lg font-black font-mono text-zinc-900 dark:text-zinc-100">
                      S/ {m.total.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {m.count} {m.count === 1 ? 'gasto' : 'gastos'}
                    </div>
                    {topCatLabel && (
                      <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate">{topCatLabel}</div>
                    )}
                    {pctChange !== null && (
                      <div className={`flex items-center gap-0.5 text-[10px] font-black ${pctChange > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {pctChange > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        <span>{pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}% vs anterior</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
