import React, { useState, useMemo } from 'react';
import { BarChart, Bar, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { RecurrentBill, Roommate, Expense } from '../types';
import {
  Download, SlidersHorizontal, TrendingUp, TrendingDown, Minus,
  Home, Zap, ShoppingCart, Droplet, CreditCard, Car, Heart, Tag, Activity,
  MoreHorizontal, RefreshCw, AlertTriangle, ChevronRight, Lightbulb,
} from 'lucide-react';

interface Props {
  bills: RecurrentBill[];
  roommates: Roommate[];
  expenses: Expense[];
  rentExchangeRate: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const CAT_META: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  alquiler:  { label: 'Alquiler',          color: '#4F46E5', bg: '#EEF2FF', Icon: Home },
  servicio:  { label: 'Servicios',         color: '#EC4899', bg: '#FDF2F8', Icon: Zap },
  comida:    { label: 'Comida',            color: '#F59E0B', bg: '#FFFBEB', Icon: ShoppingCart },
  limpieza:  { label: 'Limpieza',          color: '#10B981', bg: '#ECFDF5', Icon: Droplet },
  membresia: { label: 'Membresías',        color: '#3B82F6', bg: '#EFF6FF', Icon: CreditCard },
  auto:      { label: 'Transporte',        color: '#8B5CF6', bg: '#F5F3FF', Icon: Car },
  salud:     { label: 'Salud',             color: '#EF4444', bg: '#FEF2F2', Icon: Heart },
  ropa:      { label: 'Ropa',              color: '#F97316', bg: '#FFF7ED', Icon: Tag },
  deporte:   { label: 'Deporte',           color: '#06B6D4', bg: '#ECFEFF', Icon: Activity },
  otros:     { label: 'Otros',             color: '#A1A1AA', bg: '#F4F4F5', Icon: MoreHorizontal },
};

function catMeta(key: string) {
  return CAT_META[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), color: '#A1A1AA', bg: '#F4F4F5', Icon: MoreHorizontal };
}

function toSoles(amount: number, currency?: string, rate?: number) {
  return currency === 'USD' ? amount * (rate || 3.8) : amount;
}

function fmtS(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function shortMonth(key: string) {
  const m = parseInt(key.split('-')[1]) - 1;
  return SHORT_MONTHS[m];
}

function cutoffDate(periodo: string): Date {
  const now = new Date();
  if (periodo === '1m') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (periodo === '3m') return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  if (periodo === '6m') return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return new Date(2000, 0, 1);
}

function periodoLabel(p: string) {
  if (p === '1m') return 'Este mes';
  if (p === '3m') return 'Últimos 3 meses';
  if (p === '6m') return 'Últimos 6 meses';
  return 'Todo el historial';
}

function downloadCSV(expenses: Expense[], rate: number, roommates: Roommate[]) {
  const rows = expenses.map(e => {
    const who = roommates.find(r => r.id === e.paidBy)?.name || '';
    const soles = toSoles(e.amount, e.currency, e.exchangeRate || rate);
    return [e.date, e.title, e.category || 'otros', e.macroCategory || 'hogar', e.currency || 'PEN', e.amount.toFixed(2), soles.toFixed(2), who].join(',');
  });
  const header = 'Fecha,Descripción,Categoría,Tipo,Moneda,Monto original,Monto (S/),Pagó';
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gastos-mi-depa.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StableCategoryCard({ meta, avgMensual }: { meta: { label: string; color: string; bg: string; Icon: React.ElementType }; avgMensual: number }) {
  const { Icon } = meta;
  return (
    <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{ border: '1px solid #F0F0F5' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
        <Icon size={16} color={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: '#1A1A2E' }}>{meta.label} se mantiene estable</p>
        <p className="text-[12px]" style={{ color: '#6B7280' }}>Tu gasto promedio es {fmtS(avgMensual)} al mes.</p>
      </div>
      <button type="button" className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition hover:bg-indigo-50" style={{ color: '#4F46E5', border: '1px solid #E0E7FF' }}>
        Ver detalle
      </button>
      <ChevronRight size={14} color="#9CA3AF" />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Reportes({ bills, roommates, expenses, rentExchangeRate }: Props) {
  const rate = rentExchangeRate || 3.80;
  const [activeTab, setActiveTab] = useState<'resumen' | 'insights'>('resumen');
  const [periodo, setPeriodo] = useState<'1m' | '3m' | '6m' | 'todo'>('3m');
  const [filterType, setFilterType] = useState<'hogar' | 'pagado' | null>(null);
  const [showPeriodoMenu, setShowPeriodoMenu] = useState(false);

  // ── Filtered expenses ──
  const cutoff = useMemo(() => cutoffDate(periodo), [periodo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      if (d < cutoff) return false;
      if (filterType === 'hogar' && e.macroCategory !== 'hogar') return false;
      if (filterType === 'pagado') {
        // "Pagado por mí" — first roommate as proxy (no auth in this view)
        const me = roommates[0];
        if (!me || e.paidBy !== me.id) return false;
      }
      return true;
    });
  }, [expenses, cutoff, filterType, roommates]);

  // ── Previous period expenses (for trend) ──
  const prevExpenses = useMemo(() => {
    if (periodo === 'todo') return [];
    const months = periodo === '1m' ? 1 : periodo === '3m' ? 3 : 6;
    const prevEnd = new Date(cutoff);
    const prevStart = new Date(cutoff.getFullYear(), cutoff.getMonth() - months, 1);
    return expenses.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= prevStart && d < prevEnd;
    });
  }, [expenses, cutoff, periodo]);

  const totalGastos = useMemo(
    () => filteredExpenses.reduce((s, e) => s + toSoles(e.amount, e.currency, e.exchangeRate || rate), 0),
    [filteredExpenses, rate]
  );

  const prevTotal = useMemo(
    () => prevExpenses.reduce((s, e) => s + toSoles(e.amount, e.currency, e.exchangeRate || rate), 0),
    [prevExpenses, rate]
  );

  const trendPct = prevTotal > 0 ? Math.round(((totalGastos - prevTotal) / prevTotal) * 100) : null;

  const months = periodo === '1m' ? 1 : periodo === '3m' ? 3 : periodo === '6m' ? 6 : Math.max(1, new Set(filteredExpenses.map(e => getMonthKey(e.date))).size);
  const avgMensual = totalGastos / months;

  // ── By category ──
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const key = e.category || 'otros';
      map.set(key, (map.get(key) || 0) + toSoles(e.amount, e.currency, e.exchangeRate || rate));
    });

    // prev period by category for trend
    const prevMap = new Map<string, number>();
    prevExpenses.forEach(e => {
      const key = e.category || 'otros';
      prevMap.set(key, (prevMap.get(key) || 0) + toSoles(e.amount, e.currency, e.exchangeRate || rate));
    });

    return Array.from(map.entries())
      .map(([key, total]) => {
        const prev = prevMap.get(key) || 0;
        const trend = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;
        return { key, meta: catMeta(key), total, trend };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses, prevExpenses, rate]);

  // ── Monthly chart data ──
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const k = getMonthKey(e.date);
      map.set(k, (map.get(k) || 0) + toSoles(e.amount, e.currency, e.exchangeRate || rate));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ month: shortMonth(k), total: Math.round(v) }));
  }, [filteredExpenses, rate]);

  const chartAvg = chartData.length > 0 ? Math.round(chartData.reduce((s, d) => s + d.total, 0) / chartData.length) : 0;

  // ── Insights: hormiga ──
  const hormigaItems = useMemo(() => {
    const map = new Map<string, { total: number; count: number; months: Set<string> }>();
    filteredExpenses.forEach(e => {
      const k = e.title.toLowerCase().trim();
      if (!map.has(k)) map.set(k, { total: 0, count: 0, months: new Set() });
      const r = map.get(k)!;
      r.total += toSoles(e.amount, e.currency, e.exchangeRate || rate);
      r.count++;
      r.months.add(getMonthKey(e.date));
    });
    return Array.from(map.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([title, v]) => ({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        avgPerMonth: v.total / Math.max(v.months.size, 1),
        yearlyEst: (v.total / Math.max(v.months.size, 1)) * 12,
        freq: v.count,
      }))
      .sort((a, b) => b.yearlyEst - a.yearlyEst)
      .slice(0, 4);
  }, [filteredExpenses, rate]);

  // ── Insights: duplicate detection ──
  const duplicates = useMemo(() => {
    const byDay = new Map<string, Expense[]>();
    filteredExpenses.forEach(e => {
      const k = `${e.date}-${e.title.toLowerCase().trim()}`;
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    });
    return Array.from(byDay.values()).filter(g => g.length >= 2);
  }, [filteredExpenses]);

  // ── Insight: top category trend ──
  const topTrendCat = byCategory.find(c => c.trend !== null && Math.abs(c.trend) >= 10);

  // ── Oportunidad: top 2 categories = 60%+ ──
  const top2Total = byCategory.slice(0, 2).reduce((s, c) => s + c.total, 0);
  const savingOpp = totalGastos > 0 ? Math.round((top2Total / totalGastos) * 0.1 * totalGastos) : 0;

  const FILTER_CHIPS = [
    { id: 'hogar' as const, label: 'Del hogar' },
    { id: 'pagado' as const, label: 'Pagado por mí' },
  ];

  return (
    <div className="max-w-xl mx-auto" style={{ background: '#F7F7FC', minHeight: '100vh', paddingBottom: 96 }}>

      {/* ── Header ── */}
      <div className="bg-white px-5 pt-5 pb-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#4F46E5' }}>
            <Home size={18} color="white" />
          </div>
          <div className="flex-1">
            <h1 className="text-[18px] font-bold" style={{ color: '#1A1A2E' }}>Reportes</h1>
            <p className="text-[12px]" style={{ color: '#8D90A5' }}>Análisis de gastos</p>
          </div>
          <button
            type="button"
            onClick={() => downloadCSV(filteredExpenses, rate, roommates)}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition hover:bg-zinc-100 active:scale-90"
            style={{ border: '1px solid #E5E7EB' }}
            aria-label="Exportar CSV"
          >
            <Download size={16} style={{ color: '#6B7280' }} />
          </button>
          <button
            type="button"
            className="w-9 h-9 flex items-center justify-center rounded-xl transition hover:bg-zinc-100 active:scale-90"
            style={{ border: '1px solid #E5E7EB' }}
            aria-label="Filtros"
          >
            <SlidersHorizontal size={16} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(['resumen', 'insights'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className="px-5 py-2.5 text-[14px] font-medium transition relative"
              style={{
                color: activeTab === t ? '#4F46E5' : '#9CA3AF',
                borderBottom: activeTab === t ? '2px solid #4F46E5' : '2px solid transparent',
              }}
            >
              {t === 'resumen' ? 'Resumen' : 'Insights'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter chips ── */}
      <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Periodo */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowPeriodoMenu(p => !p)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition"
            style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}
          >
            <span style={{ color: '#6B7280', fontSize: 11 }}>Periodo</span>
            <span style={{ color: '#4F46E5', fontWeight: 600 }}>{periodoLabel(periodo)}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          {showPeriodoMenu && (
            <div
              className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-lg z-20 overflow-hidden"
              style={{ border: '1px solid #E5E7EB', minWidth: 180 }}
            >
              {(['1m', '3m', '6m', 'todo'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPeriodo(p); setShowPeriodoMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-[13px] transition hover:bg-indigo-50"
                  style={{ color: periodo === p ? '#4F46E5' : '#374151', fontWeight: periodo === p ? 600 : 400 }}
                >
                  {periodoLabel(p)}
                </button>
              ))}
            </div>
          )}
        </div>

        {FILTER_CHIPS.map(chip => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilterType(filterType === chip.id ? null : chip.id)}
            className="shrink-0 h-8 px-3 rounded-full text-[12px] font-medium transition"
            style={filterType === chip.id
              ? { background: '#4F46E5', color: 'white', border: '1px solid #4F46E5' }
              : { background: 'white', color: '#374151', border: '1px solid #E5E7EB' }
            }
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ── */}
      {activeTab === 'resumen' && (
        <div className="px-4 space-y-4">

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F0F0F5' }}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Total gastado</p>
              <p className="text-[24px] font-bold mt-1 tabular-nums" style={{ color: '#EF4444' }}>
                {fmtS(totalGastos)}
              </p>
              {trendPct !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {trendPct > 0
                    ? <TrendingUp size={12} color="#EF4444" />
                    : trendPct < 0
                    ? <TrendingDown size={12} color="#10B981" />
                    : <Minus size={12} color="#9CA3AF" />
                  }
                  <span className="text-[11px] font-medium" style={{ color: trendPct > 0 ? '#EF4444' : trendPct < 0 ? '#10B981' : '#9CA3AF' }}>
                    {trendPct > 0 ? '+' : ''}{trendPct}% vs. periodo anterior
                  </span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F0F0F5' }}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Promedio mensual</p>
              <p className="text-[24px] font-bold mt-1 tabular-nums" style={{ color: '#1A1A2E' }}>
                {fmtS(avgMensual)}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F0F0F5' }}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Movimientos</p>
              <p className="text-[24px] font-bold mt-1" style={{ color: '#1A1A2E' }}>{filteredExpenses.length}</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>en total</p>
            </div>

            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F0F0F5' }}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Categorías</p>
              <p className="text-[24px] font-bold mt-1" style={{ color: '#1A1A2E' }}>{byCategory.length}</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>distintas</p>
            </div>
          </div>

          {/* Evolución de gastos */}
          {chartData.length > 1 && (
            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F0F0F5' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[15px] font-semibold" style={{ color: '#1A1A2E' }}>Evolución de gastos</p>
                <span className="text-[12px] font-medium px-2 py-1 rounded-lg" style={{ background: '#F3F4F6', color: '#374151' }}>
                  Mensual
                </span>
              </div>

              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="30%">
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => [`S/ ${v.toLocaleString('es-PE')}`, 'Gastos']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
                      cursor={{ fill: 'rgba(79,70,229,0.06)' }}
                    />
                    <ReferenceLine
                      y={chartAvg}
                      stroke="#4F46E5"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      label={{ value: `Promedio S/ ${chartAvg.toLocaleString('es-PE')}`, position: 'right', fill: '#4F46E5', fontSize: 10 }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#C7D2FE"
                      activeBar={{ fill: '#4F46E5' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {trendPct !== null && (
                <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: '#EEF2FF' }}>
                  <TrendingUp size={14} color="#4F46E5" className="mt-0.5 shrink-0" />
                  <p className="text-[12px] leading-relaxed" style={{ color: '#4338CA' }}>
                    Tus gastos {trendPct > 0 ? 'aumentaron' : 'bajaron'} {Math.abs(trendPct)}% frente al periodo anterior
                    {topTrendCat ? `, principalmente por ${topTrendCat.meta.label}.` : '.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Por categoría */}
          {byCategory.length > 0 && (
            <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #F0F0F5' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[15px] font-semibold" style={{ color: '#1A1A2E' }}>Por categoría</p>
              </div>

              <div className="space-y-3">
                {byCategory.map(c => {
                  const { Icon } = c.meta;
                  const pct = totalGastos > 0 ? Math.round((c.total / totalGastos) * 100) : 0;
                  return (
                    <div key={c.key}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.meta.bg }}>
                          <Icon size={16} color={c.meta.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium truncate" style={{ color: '#1A1A2E' }}>{c.meta.label}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[14px] font-semibold tabular-nums" style={{ color: '#1A1A2E' }}>{fmtS(c.total)}</span>
                              <span className="text-[12px] w-8 text-right" style={{ color: '#9CA3AF' }}>{pct}%</span>
                              {c.trend !== null && (
                                <div className="flex items-center gap-0.5 w-12 justify-end">
                                  {c.trend > 0
                                    ? <TrendingUp size={11} color="#EF4444" />
                                    : c.trend < 0
                                    ? <TrendingDown size={11} color="#10B981" />
                                    : <Minus size={11} color="#9CA3AF" />
                                  }
                                  <span className="text-[11px] font-medium" style={{ color: c.trend > 0 ? '#EF4444' : c.trend < 0 ? '#10B981' : '#9CA3AF' }}>
                                    {c.trend > 0 ? '+' : ''}{c.trend}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.meta.color }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredExpenses.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[14px]" style={{ color: '#9CA3AF' }}>Sin gastos en este periodo</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: INSIGHTS ── */}
      {activeTab === 'insights' && (
        <div className="px-4 pt-2 space-y-4">

          {/* Lo más importante */}
          <div>
            <p className="text-[16px] font-semibold mb-1" style={{ color: '#1A1A2E' }}>Lo más importante de tus gastos</p>
            <p className="text-[12px] mb-3" style={{ color: '#9CA3AF' }}>Basado en tus gastos de los {periodoLabel(periodo).toLowerCase()}</p>

            <div className="space-y-2">

              {/* Trend alert */}
              {topTrendCat && (
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{ border: '1px solid #F0F0F5' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: topTrendCat.meta.bg }}>
                    <TrendingUp size={16} color={topTrendCat.meta.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: '#1A1A2E' }}>
                      {topTrendCat.meta.label} {topTrendCat.trend! > 0 ? 'aumentó' : 'bajó'} {Math.abs(topTrendCat.trend!)}%
                    </p>
                    <p className="text-[12px]" style={{ color: '#6B7280' }}>
                      {topTrendCat.trend! > 0 ? 'Gastaste' : 'Ahorraste'} vs. el periodo anterior.
                    </p>
                  </div>
                  <button type="button" className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition hover:bg-indigo-50" style={{ color: '#4F46E5', border: '1px solid #E0E7FF' }}>
                    Ver detalle
                  </button>
                  <ChevronRight size={14} color="#9CA3AF" />
                </div>
              )}

              {/* Top hormiga */}
              {hormigaItems[0] && (
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{ border: '1px solid #F0F0F5' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFFBEB' }}>
                    <RefreshCw size={16} color="#F59E0B" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: '#1A1A2E' }}>{hormigaItems[0].title}</p>
                    <p className="text-[12px]" style={{ color: '#6B7280' }}>
                      Tu gasto recurrente más alto.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: '#1A1A2E' }}>{fmtS(hormigaItems[0].avgPerMonth)}</p>
                    <p className="text-[11px]" style={{ color: '#9CA3AF' }}>por mes</p>
                  </div>
                  <ChevronRight size={14} color="#9CA3AF" />
                </div>
              )}

              {/* Categoría estable */}
              {byCategory[0] && !topTrendCat && (
                <StableCategoryCard meta={byCategory[0].meta} avgMensual={avgMensual} />
              )}

              {/* Posible duplicado */}
              {duplicates.length > 0 && (
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{ border: '1px solid #F0F0F5' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FEF9C3' }}>
                    <AlertTriangle size={16} color="#D97706" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: '#1A1A2E' }}>Posible gasto duplicado</p>
                    <p className="text-[12px]" style={{ color: '#6B7280' }}>
                      Registraste {duplicates.length} movimiento{duplicates.length > 1 ? 's' : ''} similares el mismo día.
                    </p>
                  </div>
                  <button type="button" className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition hover:bg-amber-50" style={{ color: '#D97706', border: '1px solid #FDE68A' }}>
                    Revisar
                  </button>
                  <ChevronRight size={14} color="#9CA3AF" />
                </div>
              )}

              {filteredExpenses.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-[14px]" style={{ color: '#9CA3AF' }}>Sin datos en este periodo</p>
                </div>
              )}
            </div>
          </div>

          {/* Gastos recurrentes */}
          {hormigaItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[15px] font-semibold" style={{ color: '#1A1A2E' }}>Gastos recurrentes</p>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #F0F0F5' }}>
                {hormigaItems.map((h, i) => (
                  <div
                    key={h.title}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderTop: i > 0 ? '1px solid #F3F4F6' : undefined }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#EEF2FF' }}>
                      <RefreshCw size={15} color="#4F46E5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: '#1A1A2E' }}>{h.title}</p>
                      <p className="text-[11px]" style={{ color: '#9CA3AF' }}>{h.freq}× en el periodo</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums" style={{ color: '#1A1A2E' }}>{fmtS(h.avgPerMonth)}</p>
                      <p className="text-[11px]" style={{ color: '#9CA3AF' }}>por mes</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Oportunidad de control */}
          {savingOpp > 0 && byCategory.length >= 2 && (
            <div className="rounded-2xl px-4 py-4" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb size={15} color="#16A34A" />
                    <p className="text-[13px] font-semibold" style={{ color: '#15803D' }}>Oportunidad de control</p>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: '#166534' }}>
                    Si reduces 10% los gastos de {byCategory[0]?.meta.label} y {byCategory[1]?.meta.label}, podrías ahorrar aproximadamente:
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[22px] font-bold tabular-nums" style={{ color: '#16A34A' }}>{fmtS(savingOpp)}</p>
                  <p className="text-[11px]" style={{ color: '#4ADE80' }}>al mes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
