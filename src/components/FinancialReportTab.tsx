import React, { useState } from 'react';
import { Roommate, Expense, ExpenseCategory } from '../types';
import { CATEGORY_LABELS } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Sparkles, HelpCircle, AlertCircle, DollarSign, Download, Check, RefreshCw, Lightbulb, PieChart, ShieldAlert } from 'lucide-react';

interface FinancialReportTabProps {
  roommates: Roommate[];
  expenses: Expense[];
  rentCost: number;
  rentCurrency?: 'PEN' | 'USD';
  rentExchangeRate?: number;
}

export default function FinancialReportTab({ roommates, expenses, rentCost, rentCurrency = 'PEN', rentExchangeRate = 3.80 }: FinancialReportTabProps) {
  const [reportText, setReportText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate totals by category
  const categoryTotals: Record<ExpenseCategory, number> = {
    alquiler: 0,
    membresia: 0,
    auto: 0,
    servicio: 0,
    comida: 0,
    limpieza: 0,
    otros: 0
  };

  let totalExpensesSum = 0;

  expenses.forEach((exp) => {
    const rate = exp.currency === 'USD' ? (exp.exchangeRate || 3.80) : 1;
    const amountInSoles = exp.amount * rate;
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amountInSoles;
    totalExpensesSum += amountInSoles;
  });

  const chartData = Object.entries(categoryTotals).map(([cat, total]) => {
    const info = CATEGORY_LABELS[cat as ExpenseCategory] || { label: cat };
    return {
      name: info.label,
      value: total,
      color: cat === 'alquiler' ? '#3b82f6' : cat === 'comida' ? '#10b981' : cat === 'servicio' ? '#06b6d4' : cat === 'membresia' ? '#a855f7' : cat === 'auto' ? '#f59e0b' : cat === 'limpieza' ? '#ec4899' : '#64748b'
    };
  }).filter(item => item.value > 0);

  // Generate AI Report from server Gemini endpoint
  const handleGenerateReport = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/expenses/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses,
          roommates,
          rentCost,
          rentCurrency,
          rentExchangeRate
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo establecer conexión con el servidor.');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setReportText(data.analysis || 'Ocurrió un error al procesar las respuestas.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('No se pudo generar el reporte con Inteligencia Artificial. Por favor verifica si tu GEMINI_API_KEY está configurada en la sección de Secrets de AI Studio.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to turn basic Markdown symbols (*, #, etc.) into styled JSX
  const renderStyledMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return (
          <h4 key={idx} className="text-sm font-bold text-zinc-900 dark:text-zinc-50 tracking-wide mt-4 mb-2 border-l-3 border-indigo-500 pl-2">
            {trimmed.replace('###', '').trim()}
          </h4>
        );
      }
      if (trimmed.startsWith('##')) {
        return (
          <h3 key={idx} className="text-base font-extrabold text-indigo-700 dark:text-indigo-400 mt-6 mb-3 border-b border-indigo-100 dark:border-indigo-900/50 pb-1">
            {trimmed.replace('##', '').trim()}
          </h3>
        );
      }
      if (trimmed.startsWith('#')) {
        return (
          <h2 key={idx} className="text-lg font-black text-indigo-950 dark:text-indigo-300 mt-6 mb-4 flex items-center gap-1.5">
            <Sparkles size={18} className="text-indigo-600" />
            {trimmed.replace('#', '').trim()}
          </h2>
        );
      }
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const cleaned = trimmed.replace(/^[\s*-]+/, '').trim();
        // Simple bold parsing inside bold tokens
        return (
          <li key={idx} className="text-xs text-zinc-600 dark:text-zinc-300 ml-4 list-disc marker:text-indigo-500 leading-relaxed mt-1.5">
            {parseInnerBold(cleaned)}
          </li>
        );
      }
      if (/^\d+\./.test(trimmed)) {
        return (
          <li key={idx} className="text-xs text-zinc-650 dark:text-zinc-300 ml-5 list-decimal leading-relaxed mt-1.5 font-light">
            {parseInnerBold(trimmed.replace(/^\d+\.\s*/, ''))}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-light mt-1 text-justify">
          {parseInnerBold(trimmed)}
        </p>
      );
    });
  };

  const parseInnerBold = (text: string) => {
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-zinc-900 dark:text-zinc-100 bg-indigo-50/50 dark:bg-indigo-950/20 px-1 py-0.2 rounded">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 md:px-0">
      
      {/* Visual Analytics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Category breakdown visual charts */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Distribución de Gastos</h2>
            <p className="text-xs text-zinc-500">¿En qué categoría se está yendo más dinero este mes?</p>
          </div>

          {expenses.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 dark:text-zinc-600 border border-dashed border-zinc-150 rounded-2xl">
              <PieChart className="mx-auto mb-2 opacity-40 text-indigo-500 animate-pulse" size={40} />
              <p className="text-sm font-semibold">Faltan gastos para graficar.</p>
              <p className="text-xs mt-1">Registra gastos en la pestaña de Split Money para ver la analítica.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Graphic container with Recharts */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} stroke="#888888" tickLine={false} axisLine={false} tickFormatter={(value) => `S/.${value}`} />
                    <Tooltip formatter={(value) => [`S/. ${Number(value).toFixed(2)}`, 'Monto Total']} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Progress bars items indicators */}
              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-850">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Progreso Porcentual por Categoría</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(categoryTotals).map(([cat, amount]) => {
                    if (amount <= 0) return null;
                    const pct = totalExpensesSum > 0 ? (amount / totalExpensesSum) * 100 : 0;
                    const catLabel = CATEGORY_LABELS[cat] || { label: cat, bg: "bg-slate-100", text: "text-slate-650" };

                    return (
                      <div key={cat} className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800/80">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-zinc-850 dark:text-zinc-200">{catLabel.label}</span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">S/. {amount.toFixed(2)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-750 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: cat === 'alquiler' ? '#3b82f6' : cat === 'comida' ? '#10b981' : cat === 'servicio' ? '#06b6d4' : cat === 'membresia' ? '#a855f7' : cat === 'auto' ? '#f59e0b' : cat === 'limpieza' ? '#ec4899' : '#64748b'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Virtual Report Board & savings recommendations */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Diagnostic initiator */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white border border-indigo-950 shadow-md">
            <span className="bg-indigo-500/50 text-indigo-100 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">
              Análisis Predictivo
            </span>
            <h3 className="text-xl font-bold mt-3">Diagnóstico Financiero Pro con IA</h3>
            <p className="text-xs text-indigo-100 font-light mt-1.5 leading-relaxed">
              Analizaremos el alquiler, las membresías de entretenimiento, el auto y tus compras súper. Gemini formulará un completo plan de ahorro mensual a la medida de tu dpto.
            </p>

            <button
              id="analyze-expenses-ai-button"
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 text-white font-extrabold text-xs tracking-wide uppercase rounded-xl transition duration-200 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin text-white" size={14} />
                  <span>Calculando Ahorro...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-white fill-white animate-pulse" />
                  <span>Obtener Tips de Ahorro IA</span>
                </>
              )}
            </button>
          </div>

          {/* Report Display Container */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex-1 min-h-[300px]">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 border-b border-zinc-100 dark:border-zinc-850 pb-2 mb-4 flex items-center gap-1">
              <Lightbulb size={16} className="text-amber-500" />
              Gurú Financiero de 'Mi depa'
            </h3>

            {errorMsg && (
              <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl text-xs text-rose-600 space-y-2">
                <p className="font-semibold flex items-center gap-1">
                  <ShieldAlert size={14} /> Faltan Credenciales de API
                </p>
                <p>{errorMsg}</p>
              </div>
            )}

            {!reportText && !loading && !errorMsg ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                <HelpCircle size={32} className="opacity-40 mb-2" />
                <p className="text-xs font-semibold text-zinc-500">¿Aún no has corrido el reporte virtual?</p>
                <p className="text-[10px] text-zinc-400 max-w-[200px] mt-1">Presiona el botón de arriba "Obtener Tips de Ahorro IA" para activar el diagnóstico de Gemini.</p>
              </div>
            ) : loading ? (
              <div className="py-12 text-center text-zinc-400 space-y-3">
                <div className="flex justify-center">
                  <span className="relative flex h-8 w-8">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-8 w-8 bg-indigo-505 bg-indigo-600 flex items-center justify-center text-white font-black text-xs">AI</span>
                  </span>
                </div>
                <p className="text-xs font-medium">Analizando tus números y elaborando consejos de ahorro...</p>
                <p className="text-[10px] text-zinc-500 italic max-w-xs mx-auto">Recomendando mercados mayoristas peruanos y control de suscripciones duplicadas.</p>
              </div>
            ) : reportText ? (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {renderStyledMarkdown(reportText)}
              </div>
            ) : null}
          </div>

        </div>

      </div>
    </div>
  );
}
