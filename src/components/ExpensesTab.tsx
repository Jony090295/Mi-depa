import React, { useState, useRef } from 'react';
import { Roommate, Expense, ExpenseCategory, SplitType, RecurrentBill, SettlementRecord } from '../types';
import { CATEGORY_LABELS, inferCategoryFromName } from '../utils';
import { calculateSettlements } from '../utils';
import { Plus, Trash2, Split, Calendar, ArrowRight, Info, Check, Pencil, X, AlertTriangle, Camera, FileText } from 'lucide-react';

interface ExpensesTabProps {
  roommates: Roommate[];
  allRoommates?: Roommate[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onRemoveExpense: (id: string) => void;
  onUpdateExpense: (expense: Expense) => void;
  onNavigateTab?: (tab: string) => void;
  bills?: RecurrentBill[];
  prefilledBillId?: string;
  onClearPrefilledBillId?: () => void;
  settlementHistory?: SettlementRecord[];
  onAddSettlement?: (record: SettlementRecord) => void;
  defaultSplitType?: SplitType;
  defaultSplitPercentages?: Record<string, number>;
}

export default function ExpensesTab({
  roommates,
  allRoommates,
  expenses,
  onAddExpense,
  onRemoveExpense,
  onUpdateExpense,
  onNavigateTab,
  bills = [],
  prefilledBillId,
  onClearPrefilledBillId,
  settlementHistory = [],
  onAddSettlement,
  defaultSplitType = 'equitativo',
  defaultSplitPercentages = {},
}: ExpensesTabProps) {
  const resolvedAllRoommates = allRoommates || roommates;
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState<number | ''>('');
  const [category, setCategory] = useState<ExpenseCategory>('comida');
  const [paidBy, setPaidBy] = useState(roommates[0]?.id || '');
  const [splitType, setSplitType] = useState<SplitType>(defaultSplitType);
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(defaultSplitPercentages).map(([k, v]) => [k, String(v)]))
  );
  const [successMsg, setSuccessMsg] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [exchangeRateInput, setExchangeRateInput] = useState<number | ''>(1);
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});
  const [showInfo, setShowInfo] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [settlingIndex, setSettlingIndex] = useState<number | null>(null);
  const [showAllBreakdown, setShowAllBreakdown] = useState<Record<number, boolean>>({});
  const [associatedBillId, setAssociatedBillId] = useState('');
  const [recurrentBillMonth, setRecurrentBillMonth] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSettlementHistory, setShowSettlementHistory] = useState(false);
  const [splitNotification, setSplitNotification] = useState<{ names: { name: string; amount: number; currency: string }[] } | null>(null);
  const [openMenuExpenseId, setOpenMenuExpenseId] = useState<string | null>(null);
  const [showRecurringReport, setShowRecurringReport] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const getMonthYearStringFromDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return '';
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthNamesEsActual = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${monthNamesEsActual[monthIdx]} ${year}`;
    }
    return '';
  };

  const getSurroundingMonths = () => {
    const monthsNamesEs = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const result = [];
    const now = new Date();
    for (let i = -4; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push(`${monthsNamesEs[d.getMonth()]} ${d.getFullYear()}`);
    }
    return result.reverse();
  };

  const currentMonthYearString = () => {
    const monthNamesEsActual = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const d = new Date();
    return `${monthNamesEsActual[d.getMonth()]} ${d.getFullYear()}`;
  };

  const currentMonthName = currentMonthYearString();

  const handleSettle = (sett: any) => {
    if (!onAddSettlement) return;
    const record: SettlementRecord = {
      id: crypto.randomUUID(),
      fromId: sett.from,
      toId: sett.to,
      amount: parseFloat(sett.amount.toFixed(2)),
      currency: sett.currency,
      exchangeRate: sett.exchangeRate || 1,
      date: new Date().toISOString().split('T')[0],
    };
    onAddSettlement(record);
    setSettlingIndex(null);
    const debtorName = resolvedAllRoommates.find((r) => r.id === sett.from)?.name || 'Inquilino';
    const creditorName = resolvedAllRoommates.find((r) => r.id === sett.to)?.name || 'Inquilino';
    setSuccessMsg(`¡Liquidación de ${sett.currency === 'USD' ? '$' : 'S/.'} ${sett.amount.toFixed(2)} registrada (${debtorName} → ${creditorName})!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const toggleExpenseDetails = (id: string) => {
    setExpandedExpenses((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const startEdit = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setTitle(expense.title);
    setAmountInput(expense.amount);
    setCategory(expense.category);
    setPaidBy(expense.paidBy);
    setDate(expense.date || new Date().toISOString().split('T')[0]);
    setSplitType(expense.splitType);
    setCurrency(expense.currency || 'PEN');
    setExchangeRateInput(expense.exchangeRate || 1);
    setReceiptImage(expense.receiptImage);
    if (expense.splitType === 'porcentaje') {
      setCustomPercentages(Object.fromEntries(Object.entries(expense.splits).map(([k, v]) => [k, String(v)])));
    }
    setAssociatedBillId(expense.recurrentBillId || '');
    setRecurrentBillMonth(expense.recurrentBillMonth || getMonthYearStringFromDate(expense.date || new Date().toISOString().split('T')[0]));
    setIsModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setTitle('');
    setAmountInput('');
    setCategory('comida');
    setPaidBy(roommates[0]?.id || '');
    setDate(new Date().toISOString().split('T')[0]);
    setSplitType(defaultSplitType);
    setCurrency('PEN');
    setExchangeRateInput(1);
    setReceiptImage(undefined);
    setAssociatedBillId('');
    setRecurrentBillMonth(currentMonthName);
    const defaultPercs = Object.keys(defaultSplitPercentages).length > 0
      ? Object.fromEntries(Object.entries(defaultSplitPercentages).map(([k, v]) => [k, String(v)]))
      : (() => { const p: Record<string,string> = {}; const eq = Math.round((100/roommates.length)*100)/100; roommates.forEach(r => { p[r.id] = String(eq); }); return p; })();
    setCustomPercentages(defaultPercs);
    setIsModalOpen(false);
  };

  const handleOpenNewExpenseForm = () => {
    cancelEdit();
    setIsModalOpen(true);
  };

  // Synchronise recurrentBillMonth automatically when the date changes
  React.useEffect(() => {
    if (date) {
      setRecurrentBillMonth(getMonthYearStringFromDate(date));
    }
  }, [date]);

  // Prefill fixed bill details if requested from the other tab
  React.useEffect(() => {
    if (prefilledBillId && bills.length > 0) {
      const selectedBill = bills.find(b => b.id === prefilledBillId);
      if (selectedBill) {
        setAssociatedBillId(selectedBill.id);
        setTitle(`[Pago Recurrente] ${selectedBill.name}`);
        setCategory(selectedBill.category || 'servicio');
        setAmountInput(selectedBill.amount);
        if (selectedBill.currency) setCurrency(selectedBill.currency);
        if (selectedBill.exchangeRate) setExchangeRateInput(selectedBill.exchangeRate);
        if (selectedBill.paidBy) setPaidBy(selectedBill.paidBy);

        if (selectedBill.splitType && selectedBill.splitType !== 'no_dividir') {
          setSplitType(selectedBill.splitType as SplitType);
          if (selectedBill.splits) {
            setCustomPercentages(Object.fromEntries(Object.entries(selectedBill.splits).map(([k, v]) => [k, String(v)])));
          }
        }
        setIsModalOpen(true);
      }
      onClearPrefilledBillId?.();
    }
  }, [prefilledBillId, bills, onClearPrefilledBillId]);

  // Initialize custom percentages if they are empty
  React.useEffect(() => {
    if (roommates.length > 0) {
      const defaultPercent = Math.round((100 / roommates.length) * 100) / 100;
      const initialPerc: Record<string, string> = {};
      roommates.forEach((r) => {
        initialPerc[r.id] = String(defaultPercent);
      });
      setCustomPercentages(initialPerc);
    }
  }, [roommates]);

  const handlePercentageChange = (roommateId: string, value: string) => {
    setCustomPercentages((prev) => ({
      ...prev,
      [roommateId]: value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReceiptImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const totalIncome = roommates.reduce((sum, r) => sum + r.income, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amountInput || Number(amountInput) <= 0) {
      alert("Por favor ingrese un título válido y un monto mayor a cero.");
      return;
    }

    const amount = Number(amountInput);
    let splitsRecord: Record<string, number> = {};
    let calculatedShares: Record<string, number> = {};

    if (splitType === 'equitativo') {
      const share = amount / roommates.length;
      roommates.forEach((r) => {
        splitsRecord[r.id] = 100 / roommates.length;
        calculatedShares[r.id] = parseFloat(share.toFixed(2));
      });
    } else if (splitType === 'proporcional') {
      if (totalIncome <= 0) {
        alert("⚠️ Los ingresos totales de los roommates están en S/. 0. Por favor, completa los ingresos mensuales registrados para tus roommates en la pestaña 'Depa' primero.");
        return;
      }
      roommates.forEach((r) => {
        const pct = (r.income / totalIncome) * 100;
        const share = (r.income / totalIncome) * amount;
        splitsRecord[r.id] = parseFloat(pct.toFixed(2));
        calculatedShares[r.id] = parseFloat(share.toFixed(2));
      });
    } else if (splitType === 'porcentaje') {
      const sumOfPercentages = roommates.reduce((acc, r) => acc + (parseFloat(customPercentages[r.id]) || 0), 0);
      if (Math.abs(sumOfPercentages - 100) > 0.1) {
        alert(`La suma de porcentajes debe ser exactamente 100%. Actualmente es: ${sumOfPercentages.toFixed(1)}%`);
        return;
      }
      roommates.forEach((r) => {
        const pct = parseFloat(customPercentages[r.id]) || 0;
        const share = (pct / 100) * amount;
        splitsRecord[r.id] = pct;
        calculatedShares[r.id] = parseFloat(share.toFixed(2));
      });
    }

    // Fix small rounding differences in calculated shares
    const sumShares = roommates.reduce((acc, r) => acc + (calculatedShares[r.id] || 0), 0);
    const diff = amount - sumShares;
    if (Math.abs(diff) > 0.001 && roommates.length > 0) {
      const firstId = roommates[0].id;
      calculatedShares[firstId] = parseFloat((calculatedShares[firstId] + diff).toFixed(2));
    }

    const rate = currency === 'USD' ? Number(exchangeRateInput || 3.80) : 1;

    if (editingExpenseId) {
      const updatedExpense: Expense = {
        id: editingExpenseId,
        title: title.trim(),
        amount,
        category,
        paidBy,
        date: date || new Date().toISOString().split('T')[0],
        splitType,
        splits: splitsRecord,
        calculatedShares,
        currency,
        exchangeRate: rate,
        recurrentBillId: associatedBillId || undefined,
        recurrentBillMonth: associatedBillId ? recurrentBillMonth : undefined,
        receiptImage,
      };
      onUpdateExpense(updatedExpense);
      setEditingExpenseId(null);
      setSuccessMsg('¡Gasto actualizado con éxito!');
    } else {
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        title: title.trim(),
        amount,
        category,
        paidBy,
        date: date || new Date().toISOString().split('T')[0],
        splitType,
        splits: splitsRecord,
        calculatedShares,
        currency,
        exchangeRate: rate,
        recurrentBillId: associatedBillId || undefined,
        recurrentBillMonth: associatedBillId ? recurrentBillMonth : undefined,
        receiptImage,
      };
      onAddExpense(newExpense);
      setSuccessMsg('¡Gasto registrado con éxito!');

      // Show split notification
      const owingRoommates = roommates
        .filter((r) => r.id !== paidBy && (calculatedShares[r.id] || 0) > 0.01)
        .map((r) => ({
          name: r.name,
          amount: calculatedShares[r.id] || 0,
          currency: currency === 'USD' ? '$' : 'S/.',
        }));
      if (owingRoommates.length > 0) {
        setSplitNotification({ names: owingRoommates });
        setTimeout(() => setSplitNotification(null), 4000);
      }
    }

    setTitle('');
    setAmountInput('');
    setCategory('comida');
    setPaidBy(roommates[0]?.id || '');
    setDate(new Date().toISOString().split('T')[0]);
    setSplitType(defaultSplitType);
    setCurrency('PEN');
    setExchangeRateInput(1);
    setReceiptImage(undefined);
    setAssociatedBillId('');
    setRecurrentBillMonth(currentMonthName);
    const defaultPercs2 = Object.keys(defaultSplitPercentages).length > 0
      ? Object.fromEntries(Object.entries(defaultSplitPercentages).map(([k, v]) => [k, String(v)]))
      : (() => { const p: Record<string,string> = {}; const eq = Math.round((100/roommates.length)*100)/100; roommates.forEach(r => { p[r.id] = String(eq); }); return p; })();
    setCustomPercentages(defaultPercs2);
    setIsModalOpen(false);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Compile all available months from the expenses list
  const allAvailableMonths = Array.from(new Set(expenses.map(e => getMonthYearStringFromDate(e.date || ''))))
    .filter(m => m !== '')
    .sort((a, b) => {
      const parseMonthString = (ms: string) => {
        const parts = ms.split(' ');
        if (parts.length < 2) return 0;
        const year = parseInt(parts[1], 10);
        const monthNames = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const mIndex = monthNames.indexOf(parts[0]);
        return year * 12 + (mIndex !== -1 ? mIndex : 0);
      };
      return parseMonthString(b) - parseMonthString(a);
    });

  // Ensure current month is always present in available settlement months
  if (!allAvailableMonths.includes(currentMonthName)) {
    allAvailableMonths.unshift(currentMonthName);
  }

  // Group all expenses by month for the history view (skip fake settlement expenses)
  const filteredExpenses = expenses.filter(e => !e.title.startsWith('💵 Liquidación:'));
  const groupedExpenses: { month: string; items: Expense[] }[] = [];
  filteredExpenses.forEach((expense) => {
    const monthStr = getMonthYearStringFromDate(expense.date || '') || 'Sin periodo';
    let group = groupedExpenses.find(g => g.month === monthStr);
    if (!group) {
      group = { month: monthStr, items: [] };
      groupedExpenses.push(group);
    }
    group.items.push(expense);
  });

  // Sort groups chronologically descending
  groupedExpenses.sort((a, b) => {
    if (a.month === 'Sin periodo') return 1;
    if (b.month === 'Sin periodo') return -1;

    const parseMonthString = (ms: string) => {
      const parts = ms.split(' ');
      if (parts.length < 2) return 0;
      const year = parseInt(parts[1], 10);
      const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];
      const mIndex = monthNames.indexOf(parts[0]);
      return year * 12 + (mIndex !== -1 ? mIndex : 0);
    };
    return parseMonthString(b.month) - parseMonthString(a.month);
  });

  const settlements = calculateSettlements(expenses, roommates, settlementHistory);

  // Net balance per roommate
  const netBalances: Record<string, number> = {};
  roommates.forEach(r => { netBalances[r.id] = 0; });
  expenses.forEach(exp => {
    const rate = exp.currency === 'USD' ? (exp.exchangeRate || 3.80) : 1;
    const paid = exp.amount * rate;
    roommates.forEach(r => {
      const share = (exp.calculatedShares?.[r.id] || 0) * rate;
      if (r.id === exp.paidBy) {
        netBalances[r.id] = (netBalances[r.id] || 0) + (paid - share);
      } else {
        netBalances[r.id] = (netBalances[r.id] || 0) - share;
      }
    });
  });

  // Export PDF
  const handleExportPDF = () => {
    const currentMonthStr = currentMonthName;
    const currentMonthExpenses = filteredExpenses.filter(e => getMonthYearStringFromDate(e.date || '') === currentMonthStr);

    // Group by category
    const byCategory: Record<string, Expense[]> = {};
    currentMonthExpenses.forEach(e => {
      const cat = e.category || 'otros';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(e);
    });

    const settleRows = settlements.map(s => {
      const from = resolvedAllRoommates.find(r => r.id === s.from)?.name || s.from;
      const to = resolvedAllRoommates.find(r => r.id === s.to)?.name || s.to;
      return `<tr><td>${from}</td><td>→</td><td>${to}</td><td>${s.currency === 'USD' ? '$' : 'S/.'} ${s.amount.toFixed(2)}</td></tr>`;
    }).join('');

    const expRows = Object.entries(byCategory).map(([cat, items]) => {
      const catLabel = CATEGORY_LABELS[cat as ExpenseCategory]?.label || cat;
      const rows = items.map(e => {
        const payer = resolvedAllRoommates.find(r => r.id === e.paidBy)?.name || e.paidBy;
        return `<tr><td>${e.title}</td><td>${e.currency === 'USD' ? '$' : 'S/.'} ${e.amount.toFixed(2)}</td><td>${payer}</td><td>${e.date}</td></tr>`;
      }).join('');
      return `<tr><td colspan="4" style="background:#f0f0f0;font-weight:bold;padding:6px">${catLabel}</td></tr>${rows}`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte de Gastos — ${currentMonthStr}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1{font-size:22px}h2{font-size:16px;margin-top:24px;color:#4f46e5}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}th{background:#e0e0e0;font-weight:bold}</style></head>
    <body><h1>Reporte de Gastos — ${currentMonthStr}</h1>
    <h2>Resumen de Balances</h2><table><tr><th>De</th><th></th><th>A</th><th>Monto</th></tr>${settleRows || '<tr><td colspan="4">Sin deudas pendientes</td></tr>'}</table>
    <h2>Gastos del Mes</h2><table><tr><th>Descripción</th><th>Monto</th><th>Pagado por</th><th>Fecha</th></tr>${expRows || '<tr><td colspan="4">Sin gastos este mes</td></tr>'}</table>
    <script>window.print();</script></body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 md:px-0">
      {/* Toast */}
      {successMsg && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-fadeIn">
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Split notification toast */}
      {splitNotification && (
        <div className="fixed bottom-32 right-4 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-2xl shadow-xl z-50 max-w-xs animate-fadeIn">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">Gasto registrado — recuerda avisar a:</span>
            <button onClick={() => setSplitNotification(null)} className="text-zinc-400 hover:text-zinc-600 transition cursor-pointer shrink-0"><X size={14} /></button>
          </div>
          <ul className="space-y-1">
            {splitNotification.names.map((n, i) => (
              <li key={i} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>{n.name}</span>
                <span className="font-mono text-rose-500">{n.currency} {n.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Comprobante" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
          <button className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition cursor-pointer" onClick={() => setLightboxImage(null)}>
            <X size={20} />
          </button>
        </div>
      )}

      {/* 1. Balances */}
      <div className="space-y-2">
        {/* Header + balance chips en una sola fila */}
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100">Balances</h3>
          <button type="button" onClick={() => setShowInfo(!showInfo)}
            className="text-zinc-400 hover:text-zinc-600 transition cursor-pointer p-1">
            <Info size={14} />
          </button>
        </div>

        {showInfo && (
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed animate-fadeIn">
            Muestra quién le debe a quién según lo pagado vs. lo asignado. Se minimiza el número de transferencias.
          </p>
        )}


        {/* Deudas */}
        {settlements.length === 0 ? (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-center">
            <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">¡Todo al día! Sin deudas pendientes.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {settlements.map((sett, idx) => {
              const debtor = resolvedAllRoommates.find(r => r.id === sett.from);
              const creditor = resolvedAllRoommates.find(r => r.id === sett.to);
              const isSettling = settlingIndex === idx;

              const breakdownAll = allAvailableMonths.map(m => {
                const monthExpenses = expenses.filter(e => getMonthYearStringFromDate(e.date || '') === m);
                const monthSetts = calculateSettlements(monthExpenses, roommates);
                const direct = monthSetts.find(s => s.from === sett.from && s.to === sett.to && s.currency === sett.currency);
                if (direct && direct.amount > 0.01) return { month: m, type: 'owe' as const, amount: direct.amount };
                const opposite = monthSetts.find(s => s.from === sett.to && s.to === sett.from && s.currency === sett.currency);
                if (opposite && opposite.amount > 0.01) return { month: m, type: 'favor' as const, amount: opposite.amount };
                return null;
              }).filter(Boolean) as { month: string; type: 'owe' | 'favor'; amount: number }[];

              const breakdown = showAllBreakdown[idx] ? breakdownAll : breakdownAll.slice(0, 3);

              return (
                <div key={idx} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  <div className="px-3 py-3 flex items-center gap-2">
                    {/* Debtor → Creditor */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[13px] font-semibold px-2 py-1 rounded-lg text-white" style={{ backgroundColor: debtor?.color }}>
                        {debtor?.name}
                      </span>
                      <ArrowRight size={11} className="text-zinc-300 dark:text-zinc-600" />
                      <span className="text-[13px] font-semibold px-2 py-1 rounded-lg text-white" style={{ backgroundColor: creditor?.color }}>
                        {creditor?.name}
                      </span>
                    </div>
                    {/* Amount */}
                    <span className="flex-1 text-[15px] font-black text-rose-500 font-mono whitespace-nowrap text-center">
                      {sett.currency === 'USD' ? '$' : 'S/'}{sett.amount.toFixed(2)}
                    </span>
                    {/* Button */}
                    <button type="button" onClick={() => setSettlingIndex(isSettling ? null : idx)}
                      className={`h-8 px-4 rounded-lg text-[12px] font-semibold transition active:scale-95 cursor-pointer shrink-0 ${isSettling ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' : 'bg-indigo-600 text-white'}`}>
                      {isSettling ? 'Cancelar' : 'Pagar'}
                    </button>
                  </div>

                  {isSettling && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-3 space-y-2 animate-fadeIn">
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-400">
                        ¿Confirmar que <strong className="text-zinc-900 dark:text-zinc-100">{debtor?.name}</strong> pagó <strong className="text-zinc-900 dark:text-zinc-100">{sett.currency === 'USD' ? '$' : 'S/'}{sett.amount.toFixed(2)}</strong> a <strong className="text-zinc-900 dark:text-zinc-100">{creditor?.name}</strong>?
                      </p>
                      <button type="button" onClick={() => handleSettle(sett)}
                        className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold text-[13px] rounded-xl transition flex items-center justify-center gap-2 cursor-pointer">
                        <Check size={13} /> Confirmar liquidación
                      </button>
                    </div>
                  )}

                  {breakdownAll.length > 1 && (
                    <div className="border-t border-dashed border-zinc-100 dark:border-zinc-800">
                      <button type="button" onClick={() => setShowAllBreakdown(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="w-full px-3 py-1.5 text-[11px] text-zinc-400 hover:text-indigo-500 flex items-center justify-between transition cursor-pointer">
                        <span>Desglose por mes</span><span>{showAllBreakdown[idx] ? '▲' : '▼'}</span>
                      </button>
                      {showAllBreakdown[idx] && (
                        <div className="px-3 pb-2 space-y-1 animate-fadeIn">
                          {breakdown.map((item, bidx) => (
                            <div key={bidx} className="flex items-center justify-between text-[11px]">
                              <span className="text-zinc-500">{item.month}</span>
                              <span className={`font-mono font-semibold ${item.type === 'owe' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {item.type === 'owe' ? '' : '+'}{sett.currency === 'USD' ? '$' : 'S/'}{item.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {settlementHistory.length > 0 && (
          <div>
            <button type="button" onClick={() => setShowSettlementHistory(!showSettlementHistory)}
              className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer py-1">
              <Check size={12} className="text-emerald-500" />
              <span>Liquidaciones ({settlementHistory.length})</span>
              <span>{showSettlementHistory ? '▲' : '▼'}</span>
            </button>
            {showSettlementHistory && (
              <div className="space-y-1 mt-1 animate-fadeIn">
                {settlementHistory.map(rec => {
                  const fromName = resolvedAllRoommates.find(r => r.id === rec.fromId)?.name || rec.fromId;
                  const toName = resolvedAllRoommates.find(r => r.id === rec.toId)?.name || rec.toId;
                  return (
                    <div key={rec.id} className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{fromName}</span>
                        <ArrowRight size={11} className="text-zinc-400" />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{toName}</span>
                        <span className="text-zinc-400">· {rec.date}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {rec.currency === 'USD' ? '$' : 'S/'}{rec.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* Modal / Dialog for registering or editing expense */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center" style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)', paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
            <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '100%' }}>

              {/* Header — fijo */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600">
                    {editingExpenseId ? <Pencil size={16} /> : <Plus size={16} />}
                  </div>
                  <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">
                    {editingExpenseId ? 'Editar gasto' : 'Nuevo gasto'}
                  </h2>
                </div>
                <button type="button" onClick={cancelEdit}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 active:scale-90 transition-all">
                  <X size={16} className="text-zinc-500" />
                </button>
              </div>

              {/* Body — scrolleable */}
              <form
                id="expense-form"
                onSubmit={handleSubmit}
                className="overflow-y-auto flex-1 min-h-0 px-6 py-4 space-y-5"
                style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              >
                {/* Vincular a recurrente — al inicio para que el prefill tenga sentido */}
                {bills.length > 0 && (
                  <div id="expense-fixed-bill-picker" className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-4 space-y-3">
                    <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Gasto recurrente (opcional)
                    </label>
                    <select
                      id="select-fixed-bill-dropdown"
                      value={associatedBillId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        setAssociatedBillId(selectedId);
                        if (selectedId === '') {
                          if (title.startsWith('[Pago Recurrente]')) setTitle('');
                        } else {
                          const b = bills.find(b => b.id === selectedId);
                          if (b) {
                            setTitle(`[Pago Recurrente] ${b.name}`);
                            setCategory(b.category || 'servicio');
                            setAmountInput(b.amount);
                            if (b.currency) setCurrency(b.currency);
                            if (b.exchangeRate) setExchangeRateInput(b.exchangeRate);
                            if (b.paidBy) setPaidBy(b.paidBy);
                            if (b.splitType && b.splitType !== 'no_dividir') {
                              setSplitType(b.splitType as SplitType);
                              if (b.splits) setCustomPercentages(Object.fromEntries(Object.entries(b.splits).map(([k, v]) => [k, String(v)])));
                            }
                          }
                        }
                      }}
                      className="w-full h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Sin vincular —</option>
                      {bills.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.currency === 'USD' ? '$' : 'S/'} {b.amount})</option>
                      ))}
                    </select>
                    {associatedBillId && (
                      <div className="animate-fadeIn">
                        <label className="text-[11px] text-zinc-400 font-medium">Mes del pago</label>
                        <select id="select-fixed-bill-month-dropdown" value={recurrentBillMonth}
                          onChange={(e) => setRecurrentBillMonth(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {getSurroundingMonths().map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Descripción */}
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Descripción
                  </label>
                  <div className="mt-1 flex gap-2 items-center">
                    <input
                      id="expense-title-input"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTitle(val);
                        if (!associatedBillId) setCategory(inferCategoryFromName(val));
                      }}
                      placeholder="Ej. Mercado Wong, Luz junio..."
                      className="flex-1 h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {/* Foto comprobante inline */}
                    {receiptImage ? (
                      <div className="relative flex-shrink-0">
                        <img src={receiptImage} alt="Comprobante"
                          className="w-12 h-12 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                          onClick={() => setLightboxImage(receiptImage)} />
                        <button type="button" onClick={() => setReceiptImage(undefined)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center">
                          <X size={9} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => imageInputRef.current?.click()}
                        className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:border-indigo-400 hover:text-indigo-500 transition active:scale-95">
                        <Camera size={16} />
                      </button>
                    )}
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </div>
                </div>

                {/* Monto + Moneda */}
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Monto</label>
                  <div className="mt-1 flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium text-[15px]">
                        {currency === 'USD' ? '$' : 'S/'}
                      </span>
                      <input
                        id="expense-amount-input"
                        type="number" inputMode="decimal" step="0.01" required
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full h-12 pl-8 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold text-[16px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {/* Moneda toggle */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1 flex-shrink-0">
                      {(['PEN', 'USD'] as const).map(c => (
                        <button key={c} type="button"
                          onClick={() => { setCurrency(c); setExchangeRateInput(c === 'USD' ? 3.80 : 1); }}
                          className={`px-3 h-10 rounded-lg text-[12px] font-bold transition active:scale-95 ${currency === c ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          {c === 'PEN' ? 'S/.' : '$'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {currency === 'USD' && (
                    <div className="mt-2">
                      <label className="text-[11px] text-zinc-400 font-medium">Tipo de cambio (S/ por $)</label>
                      <input type="number" inputMode="decimal" step="0.001" value={exchangeRateInput}
                        onChange={(e) => setExchangeRateInput(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="3.80"
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  )}
                </div>

                {/* Quién pagó — chips */}
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">¿Quién pagó?</label>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {roommates.map(r => (
                      <button key={r.id} type="button" id={r.id === paidBy ? 'expense-payer-select' : undefined}
                        onClick={() => setPaidBy(r.id)}
                        className={`h-9 px-4 rounded-xl text-[14px] font-medium transition active:scale-95 ${paidBy === r.id ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* División */}
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">División</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { id: 'split-type-equitativo', value: 'equitativo' as SplitType, label: 'Equitativo' },
                      { id: 'split-type-proporcional', value: 'proporcional' as SplitType, label: 'Por ingresos' },
                      { id: 'split-type-porcentaje', value: 'porcentaje' as SplitType, label: '% personalizado' },
                    ].map(opt => (
                      <button key={opt.value} id={opt.id} type="button" onClick={() => setSplitType(opt.value)}
                        className={`h-10 rounded-xl text-[13px] font-semibold transition active:scale-95 ${splitType === opt.value ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Equitativo — preview de % */}
                  {splitType === 'equitativo' && (
                    <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-1 animate-fadeIn">
                      {roommates.map((r, i) => {
                        const base = parseFloat((100 / roommates.length).toFixed(1));
                        const display = i === roommates.length - 1 ? +(100 - base * (roommates.length - 1)).toFixed(1) : base;
                        return (
                          <div key={r.id} className="flex items-center justify-between text-[13px]">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                              <span className="text-zinc-700 dark:text-zinc-300 font-medium">{r.name}</span>
                            </div>
                            <span className="text-zinc-500 dark:text-zinc-400 font-semibold">{display}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Proporcional info */}
                  {splitType === 'proporcional' && (
                    totalIncome <= 0 ? (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-[13px] text-amber-800 dark:text-amber-300 space-y-2 animate-fadeIn">
                        <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> Faltan ingresos configurados</p>
                        <button type="button" onClick={() => { cancelEdit(); onNavigateTab?.('budget'); }}
                          className="flex items-center gap-1 text-[12px] font-bold text-amber-700 dark:text-amber-400 underline">
                          Ir a Depa <ArrowRight size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-1 animate-fadeIn">
                        {roommates.map(r => {
                          const pct = totalIncome > 0 ? (r.income / totalIncome * 100) : 0;
                          return (
                            <div key={r.id} className="flex items-center justify-between text-[13px]">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                                <span className="text-zinc-700 dark:text-zinc-300 font-medium">{r.name}</span>
                              </div>
                              <span className="text-zinc-500 dark:text-zinc-400 font-semibold">{pct.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* % personalizado */}
                  {splitType === 'porcentaje' && (
                    <div className="mt-3 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className={`text-[12px] font-semibold ${Math.abs(roommates.reduce((a, r) => a + (parseFloat(customPercentages[r.id]) || 0), 0) - 100) < 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          Total: {roommates.reduce((a, r) => a + (parseFloat(customPercentages[r.id]) || 0), 0).toFixed(1)}%
                        </span>
                        <button type="button"
                          onClick={() => { const s = Math.round((100 / roommates.length) * 100) / 100; const p: Record<string,string> = {}; roommates.forEach((r, i) => { p[r.id] = String(i === roommates.length - 1 ? Math.round((100 - s * (roommates.length - 1)) * 100) / 100 : s); }); setCustomPercentages(p); }}
                          className="text-[12px] text-indigo-500 font-semibold">
                          Resetear equitativo
                        </button>
                      </div>
                      {roommates.map(r => (
                        <div key={r.id} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                            style={{ backgroundColor: r.color }}>{r.name.charAt(0)}</div>
                          <span className="flex-1 text-[14px] text-zinc-800 dark:text-zinc-200 font-medium">{r.name}</span>
                          <div className="relative w-24">
                            <input type="number" inputMode="decimal" min={0} max={100}
                              value={customPercentages[r.id] ?? ''}
                              onChange={(e) => handlePercentageChange(r.id, e.target.value)}
                              className="w-full h-10 pr-7 pl-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px] pointer-events-none">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Categoría — chips */}
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Categoría</label>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {(['alquiler','membresia','auto','servicio','comida','limpieza','otros'] as ExpenseCategory[]).map(cat => {
                      const s = CATEGORY_LABELS[cat];
                      const active = category === cat;
                      return (
                        <button key={cat} type="button" onClick={() => setCategory(cat)}
                          className={`h-8 px-3 rounded-xl text-[12px] font-medium transition active:scale-95 ${active ? `${s.bg} ${s.text} ring-2 ring-indigo-500 ring-offset-1` : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fecha */}
                <div>
                  <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Fecha</label>
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

              </form>

              {/* Botón submit — fijo abajo */}
              <div className="px-6 pt-3 pb-4 flex-shrink-0 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  id="submit-expense-button"
                  type="submit"
                  form="expense-form"
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-[15px] rounded-2xl transition flex items-center justify-center gap-2"
                >
                  {editingExpenseId ? <Check size={16} /> : <Plus size={16} />}
                  {editingExpenseId ? 'Guardar cambios' : 'Registrar gasto'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 3. Historial de gastos */}
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[18px] font-bold text-zinc-900 dark:text-zinc-100">Gastos</h3>
            <div className="flex items-center gap-2">
              {bills.length > 0 && (
                <button type="button" onClick={() => setShowRecurringReport(!showRecurringReport)}
                  className={`h-9 px-3 flex items-center gap-1.5 rounded-xl text-[12px] font-semibold transition active:scale-90 cursor-pointer ${showRecurringReport ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                  Recurrentes
                </button>
              )}
              <button type="button" onClick={handleExportPDF}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition active:scale-90 cursor-pointer">
                <FileText size={15} />
              </button>
              <button type="button" onClick={handleOpenNewExpenseForm}
                className="h-9 px-4 flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[13px] font-semibold transition cursor-pointer">
                <Plus size={14} />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {/* Recurring expenses report */}
          {showRecurringReport && (() => {
            const recurringExpenses = filteredExpenses.filter(e => e.recurrentBillId);
            const byBill: Record<string, { bill: RecurrentBill | undefined; expenses: Expense[] }> = {};
            recurringExpenses.forEach(e => {
              const bid = e.recurrentBillId!;
              if (!byBill[bid]) byBill[bid] = { bill: bills.find(b => b.id === bid), expenses: [] };
              byBill[bid].expenses.push(e);
            });
            const billEntries = Object.entries(byBill);
            return (
              <div className="space-y-4 animate-fadeIn">
                {billEntries.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 dark:text-zinc-600">
                    <p className="text-[14px] font-medium">Sin gastos recurrentes registrados</p>
                    <p className="text-[12px] mt-1">Usa "Registrar →" desde la sección Recurrentes.</p>
                  </div>
                ) : billEntries.map(([billId, { bill, expenses: billExps }]) => {
                  const total = billExps.reduce((sum, e) => sum + e.amount * (e.currency === 'USD' ? (e.exchangeRate || 3.80) : 1), 0);
                  const byMonth: Record<string, Expense[]> = {};
                  billExps.forEach(e => {
                    const m = getMonthYearStringFromDate(e.date || '') || 'Sin periodo';
                    if (!byMonth[m]) byMonth[m] = [];
                    byMonth[m].push(e);
                  });
                  return (
                    <div key={billId} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">{bill?.name ?? 'Gasto recurrente'}</span>
                        <span className="text-[13px] font-mono font-bold text-indigo-600 dark:text-indigo-400">S/{total.toFixed(2)}</span>
                      </div>
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {Object.entries(byMonth).sort(([a], [b]) => {
                          const parse = (ms: string) => { const p = ms.split(' '); const mNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]; return parseInt(p[1]||'0')*12 + mNames.indexOf(p[0]); };
                          return parse(b) - parse(a);
                        }).map(([month, mexps]) => (
                          <div key={month} className="px-4 py-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{month}</span>
                              <span className="text-[12px] font-mono text-zinc-600 dark:text-zinc-400">
                                S/{mexps.reduce((s, e) => s + e.amount * (e.currency === 'USD' ? (e.exchangeRate || 3.80) : 1), 0).toFixed(2)}
                              </span>
                            </div>
                            {mexps.map(e => {
                              const payer = resolvedAllRoommates.find(r => r.id === e.paidBy);
                              return (
                                <div key={e.id} className="flex items-center justify-between mt-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: payer?.color || '#6366f1' }}>{payer?.name.charAt(0) || '?'}</div>
                                    <span className="text-[12px] text-zinc-700 dark:text-zinc-300">{e.title.replace('[Pago Recurrente] ', '')}</span>
                                  </div>
                                  <span className="text-[12px] font-mono text-zinc-700 dark:text-zinc-300">{e.currency === 'USD' ? '$' : 'S/'}{e.amount.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {!showRecurringReport && filteredExpenses.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-zinc-600">
              <p className="text-[15px] font-medium">Sin gastos registrados</p>
              <p className="text-[13px] mt-1">Toca "Agregar" para registrar el primero.</p>
            </div>
          ) : !showRecurringReport && (
            <div className="space-y-5">
              {groupedExpenses.map((group) => (
                <div key={group.month} className="space-y-2">
                  {/* Mes */}
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{group.month}</span>
                    <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold px-2 py-0.5 rounded-full">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((expense) => {
                      const payer = resolvedAllRoommates.find(r => r.id === expense.paidBy);
                      const isCustom = expense.splitType === 'porcentaje';
                      const isProp = expense.splitType === 'proporcional';
                      const catLabel = CATEGORY_LABELS[expense.category] || { label: 'Otros', bg: 'bg-slate-50', text: 'text-slate-600' };
                      const splitLabel = isProp ? 'Por ingresos' : isCustom ? 'Personalizado' : 'Equitativo';
                      const isMenuOpen = openMenuExpenseId === expense.id;

                      return (
                        <div key={expense.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            {/* Avatar pagador */}
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                              style={{ backgroundColor: payer?.color || '#6366f1' }}>
                              {payer?.name.charAt(0) || '?'}
                            </div>

                            {/* Título + meta */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2 leading-snug">{expense.title.replace('[Pago Recurrente] ', '')}</p>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <span className={`px-1.5 py-0 rounded text-[10px] font-bold uppercase ${catLabel.bg} ${catLabel.text}`}>{catLabel.label}</span>
                                <span className="text-[11px] text-zinc-400">· {expense.date} · {splitLabel}</span>
                                {expense.receiptImage && (
                                  <button type="button" onClick={() => setLightboxImage(expense.receiptImage!)}
                                    className="text-indigo-400 cursor-pointer active:scale-90"><Camera size={10} /></button>
                                )}
                              </div>
                            </div>

                            {/* Monto + ··· */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-50 font-mono">
                                {expense.currency === 'USD' ? '$' : 'S/'}{expense.amount.toFixed(2)}
                              </span>
                              <button type="button" onClick={() => setOpenMenuExpenseId(isMenuOpen ? null : expense.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 transition active:scale-90 cursor-pointer text-[13px] font-bold leading-none">
                                ···
                              </button>
                            </div>
                          </div>

                          {isMenuOpen && (
                            <div className="border-t border-zinc-100 dark:border-zinc-800 animate-fadeIn">
                              {/* Desglose por persona */}
                              <div className="flex flex-wrap gap-1 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                                {resolvedAllRoommates.map(r => {
                                  const amt = expense.calculatedShares?.[r.id] || 0;
                                  if (amt < 0.01) return null;
                                  return (
                                    <div key={r.id} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-md px-1.5 py-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{r.name}</span>
                                      <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 font-mono">S/{amt.toFixed(0)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex">
                                <button type="button" onClick={() => { startEdit(expense); setOpenMenuExpenseId(null); }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition cursor-pointer">
                                  <Pencil size={12} /> Editar
                                </button>
                                <div className="w-px bg-zinc-100 dark:bg-zinc-800" />
                                <button type="button" onClick={() => { if (!window.confirm('¿Eliminar este gasto?')) return; if (editingExpenseId === expense.id) cancelEdit(); onRemoveExpense(expense.id); setOpenMenuExpenseId(null); }}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer">
                                  <Trash2 size={12} /> Eliminar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
