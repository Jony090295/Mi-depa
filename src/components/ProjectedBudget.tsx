import React, { useState, useMemo } from 'react';
import { RecurrentBill, Roommate, Expense } from '../types';
import { ChevronRight, ChevronDown, Download, TrendingDown, Lightbulb } from 'lucide-react';

interface Props {
  bills: RecurrentBill[];
  roommates: Roommate[];
  expenses: Expense[];
  rentExchangeRate: number;
}

const CAT_META: Record<string, { label: string; color: string }> = {
  alquiler:  { label: 'Alquiler',          color: '#4F46E5' },
  servicio:  { label: 'Servicios',         color: '#EC4899' },
  comida:    { label: 'Comida',            color: '#F59E0B' },
  limpieza:  { label: 'Limpieza',          color: '#10B981' },
  membresia: { label: 'Membresías',        color: '#3B82F6' },
  auto:      { label: 'Auto / transporte', color: '#8B5CF6' },
  salud:     { label: 'Salud',             color: '#EF4444' },
  ropa:      { label: 'Ropa',              color: '#F97316' },
  deporte:   { label: 'Deporte',           color: '#06B6D4' },
  otros:     { label: 'Otros',             color: '#A1A1AA' },
};

function catMeta(key: string) {
  return CAT_META[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), color: '#A1A1AA' };
}

function toSoles(amount: number, currency?: string, rate?: number): number {
  return currency === 'USD' ? amount * (rate || 3.8) : amount;
}

function fmtS(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function downloadCSV(expenses: Expense[], rate: number, monthKey: string, roommates: Roommate[]) {
  const rows = expenses.map(e => {
    const who = roommates.find(r => r.id === e.paidBy)?.name || e.paidBy || '';
    const soles = toSoles(e.amount, e.currency, e.exchangeRate || rate);
    return [e.date, e.title, e.category || 'otros', e.currency || 'PEN', e.amount.toFixed(2), soles.toFixed(2), who].join(',');
  });
  const header = 'Fecha,Descripción,Categoría,Moneda,Monto original,Monto (S/),Pagó';
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gastos-${monthKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reportes({ roommates, expenses, rentExchangeRate }: Props) {
  const rate = rentExchangeRate || 3.80;
  const [activeTab, setActiveTab] = useState<'mes' | 'analisis'>('mes');
  const [openCat, setOpenCat] = useState<string | null>(null);

  // ── Month navigation ──
  const allMonthKeys = useMemo(() => {
    const keys = Array.from(new Set(expenses.map(e => getMonthKey(e.date)))).sort((a, b) => b.localeCompare(a));
    if (keys.length === 0) {
      const now = new Date();
      keys.push(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
  }, [expenses]);

  const [monthIdx, setMonthIdx] = useState(0);
  const selectedMonth = allMonthKeys[monthIdx];

  // ── Month expenses ──
  const monthExpenses = useMemo(
    () => expenses.filter(e => getMonthKey(e.date) === selectedMonth),
    [expenses, selectedMonth]
  );

  const totalGastos = useMemo(
    () => monthExpenses.reduce((s, e) => s + toSoles(e.amount, e.currency, e.exchangeRate || rate), 0),
    [monthExpenses, rate]
  );

  // ── By category ──
  const byCategory = useMemo(() => {
    const map = new Map<string, Expense[]>();
    monthExpenses.forEach(e => {
      const key = e.category || 'otros';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries())
      .map(([key, exps]) => ({
        key,
        meta: catMeta(key),
        exps,
        total: exps.reduce((s, e) => s + toSoles(e.amount, e.currency, e.exchangeRate || rate), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [monthExpenses, rate]);

  // ── Análisis: gastos hormiga (se repiten ≥ 2 veces en todo el historial) ──
  const hormigaItems = useMemo(() => {
    const titleCount = new Map<string, { total: number; count: number; months: Set<string> }>();
    expenses.forEach(e => {
      const key = e.title.toLowerCase().trim();
      if (!titleCount.has(key)) titleCount.set(key, { total: 0, count: 0, months: new Set() });
      const r = titleCount.get(key)!;
      r.total += toSoles(e.amount, e.currency, e.exchangeRate || rate);
      r.count++;
      r.months.add(getMonthKey(e.date));
    });
    return Array.from(titleCount.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([title, v]) => ({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        avgPerMonth: v.total / Math.max(v.months.size, 1),
        yearlyEst: (v.total / Math.max(v.months.size, 1)) * 12,
        freq: `${v.count}× en ${v.months.size} ${v.months.size === 1 ? 'mes' : 'meses'}`,
      }))
      .sort((a, b) => b.yearlyEst - a.yearlyEst)
      .slice(0, 5);
  }, [expenses, rate]);

  // ── Análisis: gastos más fuertes ──
  const topExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => toSoles(b.amount, b.currency, b.exchangeRate || rate) - toSoles(a.amount, a.currency, a.exchangeRate || rate))
      .slice(0, 5)
      .map(e => ({
        ...e,
        soles: toSoles(e.amount, e.currency, e.exchangeRate || rate),
        color: catMeta(e.category || 'otros').color,
      }));
  }, [expenses, rate]);

  const maxTop = topExpenses[0]?.soles || 1;

  // ── Insight: el hormiga con mayor impacto ──
  const topHormiga = hormigaItems[0];

  return (
    <div className="max-w-2xl mx-auto" style={{ background: '#F7F7FC', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[18px] font-semibold text-zinc-900 dark:text-zinc-100">Reportes</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4">
        {(['mes', 'analisis'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            {t === 'mes' ? 'Por mes' : 'Análisis'}
          </button>
        ))}
      </div>

      {/* ── TAB: POR MES ── */}
      {activeTab === 'mes' && (
        <div className="px-4 pt-3 space-y-3">

          {/* Navegación de mes */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={monthIdx >= allMonthKeys.length - 1}
              onClick={() => setMonthIdx(i => i + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 disabled:opacity-30 transition"
            >
              ‹
            </button>
            <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
              {monthLabel(selectedMonth)}
            </span>
            <button
              type="button"
              disabled={monthIdx === 0}
              onClick={() => setMonthIdx(i => i - 1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 disabled:opacity-30 transition"
            >
              ›
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Total gastado</p>
              <p className="text-[22px] font-semibold text-rose-600 dark:text-rose-400 mt-1 font-mono tabular-nums">{fmtS(totalGastos)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Gastos</p>
              <p className="text-[22px] font-semibold text-zinc-900 dark:text-zinc-100 mt-1">{monthExpenses.length}</p>
            </div>
          </div>

          {/* Exportar */}
          {monthExpenses.length > 0 && (
            <button
              type="button"
              onClick={() => downloadCSV(monthExpenses, rate, selectedMonth, roommates)}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[13px] font-medium transition hover:bg-indigo-100 active:scale-[0.98]"
            >
              <Download size={15} aria-hidden="true" />
              Exportar a CSV
            </button>
          )}

          {/* Por categoría */}
          {byCategory.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <TrendingDown size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Sin gastos en {monthLabel(selectedMonth)}</p>
            </div>
          ) : (
            <div className="space-y-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">Por categoría</p>

              {/* Barra proporcional */}
              <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mb-3">
                {byCategory.map(c => (
                  <div
                    key={c.key}
                    style={{ flex: c.total, background: c.meta.color }}
                  />
                ))}
              </div>

              <div className="space-y-2">
                {byCategory.map(c => {
                  const isOpen = openCat === c.key;
                  const pct = totalGastos > 0 ? (c.total / totalGastos * 100).toFixed(0) : '0';
                  return (
                    <div key={c.key}>
                      <button
                        type="button"
                        onClick={() => setOpenCat(isOpen ? null : c.key)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3 transition hover:border-zinc-200 active:scale-[0.99]"
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.meta.color }} />
                        <span className="flex-1 text-left text-[14px] text-zinc-800 dark:text-zinc-200">{c.meta.label}</span>
                        <span className="text-[12px] text-zinc-400">{c.exps.length} gasto{c.exps.length !== 1 ? 's' : ''}</span>
                        <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{fmtS(c.total)}</span>
                        <span className="text-[12px] text-zinc-400 w-8 text-right">{pct}%</span>
                        {isOpen
                          ? <ChevronDown size={14} className="text-zinc-400 shrink-0" />
                          : <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                        }
                      </button>

                      {isOpen && (
                        <div className="ml-4 mt-1 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                          {c.exps.map((e, i) => {
                            const who = roommates.find(r => r.id === e.paidBy);
                            const soles = toSoles(e.amount, e.currency, e.exchangeRate || rate);
                            return (
                              <div
                                key={e.id}
                                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-zinc-50 dark:border-zinc-800' : ''}`}
                              >
                                <span className="text-[12px] text-zinc-400 w-12 shrink-0">{e.date.slice(5).replace('-', '/')}</span>
                                <span className="flex-1 text-[13px] text-zinc-600 dark:text-zinc-400 truncate">{e.title}</span>
                                {who && (
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                    style={{ background: who.color }}
                                  >
                                    {who.name.charAt(0)}
                                  </div>
                                )}
                                <span className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200 tabular-nums shrink-0">{fmtS(soles)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ANÁLISIS ── */}
      {activeTab === 'analisis' && (
        <div className="px-4 pt-3 space-y-3">
          <p className="text-[13px] text-zinc-400">Basado en todos tus gastos registrados</p>

          {expenses.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <p className="text-sm font-medium">Aún no hay gastos registrados</p>
            </div>
          ) : (
            <>
              {/* Gastos hormiga */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px]" style={{ background: '#FEF3C7' }}>
                    🐜
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Gastos hormiga</p>
                    <p className="text-[12px] text-zinc-400">Pequeños gastos que se repiten y suman</p>
                  </div>
                </div>

                {hormigaItems.length === 0 ? (
                  <p className="text-[13px] text-zinc-400 py-2">No se detectaron gastos repetidos aún.</p>
                ) : (
                  <>
                    <div className="space-y-0 divide-y divide-zinc-50 dark:divide-zinc-800">
                      {hormigaItems.map(h => (
                        <div key={h.title} className="flex items-center gap-2 py-2.5">
                          <span className="flex-1 text-[13px] text-zinc-600 dark:text-zinc-400 truncate">{h.title}</span>
                          <span className="text-[11px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5 shrink-0">{h.freq}</span>
                          <span className="text-[13px] font-medium text-amber-600 dark:text-amber-400 tabular-nums shrink-0">{fmtS(h.yearlyEst)}/año</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="text-[12px] text-zinc-400">Total anualizado estimado</span>
                      <span className="text-[16px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {fmtS(hormigaItems.reduce((s, h) => s + h.yearlyEst, 0))}/año
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Gastos más fuertes */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px]" style={{ background: '#EDE9FE' }}>
                    ⚡
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Gastos más fuertes</p>
                    <p className="text-[12px] text-zinc-400">Los que más pesan en tu historial</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {topExpenses.map(e => (
                    <div key={e.id}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-[13px] text-zinc-600 dark:text-zinc-400 truncate flex-1 mr-2">{e.title}</span>
                        <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">{fmtS(e.soles)}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(e.soles / maxTop) * 100}%`, background: e.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insight */}
              {topHormiga && (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex gap-3">
                  <Lightbulb size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-medium text-indigo-800 dark:text-indigo-200 mb-1">Tu mayor oportunidad</p>
                    <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{topHormiga.title}</span> te cuesta aproximadamente{' '}
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{fmtS(topHormiga.avgPerMonth)}/mes</span>.
                      En un año serían{' '}
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtS(topHormiga.yearlyEst)}</span>.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
