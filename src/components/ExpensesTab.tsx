import React, { useState, useRef } from 'react';
import { Roommate, Expense, ExpenseCategory, SplitType, RecurrentBill, SettlementRecord, HOGAR_DEFAULT_CATEGORIES, PERSONAL_DEFAULT_CATEGORIES } from '../types';
import { CATEGORY_LABELS, getCategoryLabel, inferCategoryFromName } from '../utils';
import { calculateSettlements } from '../utils';
import { Plus, Trash2, Split, Calendar, ArrowRight, Info, Check, Pencil, X, AlertTriangle, Camera, FileText, ArrowLeft, ChevronDown, ChevronRight, Home, User, Zap, ShoppingCart, Droplet, CreditCard, Car, MoreHorizontal, Heart, Tag, Activity, RefreshCw } from 'lucide-react';

interface ExpensesTabProps {
  roommates: Roommate[];
  allRoommates?: Roommate[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onRemoveExpense: (id: string) => void;
  onUpdateExpense: (expense: Expense) => void;
  onNavigateTab?: (tab: string) => void;
  bills?: RecurrentBill[];
  onAddBill?: (bill: RecurrentBill) => void;
  customHogarCategories?: string[];
  customPersonalCategories?: string[];
  onAddHogarCategory?: (name: string) => void;
  onAddPersonalCategory?: (name: string) => void;
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
  onAddBill,
  customHogarCategories = [],
  customPersonalCategories = [],
  onAddHogarCategory,
  onAddPersonalCategory,
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [macroCategory, setMacroCategory] = useState<'hogar' | 'personal'>('hogar');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showSplitConfig, setShowSplitConfig] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showRecurringPicker, setShowRecurringPicker] = useState(false);
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const [filterMacro, setFilterMacro] = useState<'todos' | 'hogar' | 'personal'>('todos');
  const [filterMonth, setFilterMonth] = useState<'mes' | 'todo'>('mes');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    setMacroCategory(expense.macroCategory ?? 'hogar');
    setShowSplitConfig(false);
    setShowDatePicker(false);
    setShowAllCategories(false);
    setShowRecurringPicker(false);
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
        macroCategory,
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
        macroCategory,
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
      // If marked as recurring, create a bill entry too
      if (isRecurring && onAddBill) {
        const newBill: RecurrentBill = {
          id: crypto.randomUUID(),
          name: title.trim(),
          amount,
          currency: currency as 'PEN' | 'USD',
          exchangeRate: rate,
          dueDate: new Date().getDate().toString(),
          status: 'pagado',
          alertSent: false,
          splitType,
          splits: splitsRecord,
          paidBy,
          category,
          createdAt: new Date().toISOString().slice(0, 7),
        };
        onAddBill(newBill);
        newExpense.recurrentBillId = newBill.id;
        newExpense.recurrentBillMonth = recurrentBillMonth;
      }

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
    setIsRecurring(false);
    setMacroCategory('hogar');
    setShowNewCatInput(false);
    setNewCatName('');
    setShowSplitConfig(false);
    setShowDatePicker(false);
    setShowAllCategories(false);
    setShowRecurringPicker(false);
    setShowPayerDropdown(false);
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

  const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
    alquiler: Home, servicio: Zap, comida: ShoppingCart, limpieza: Droplet,
    membresia: CreditCard, auto: Car, otros: MoreHorizontal,
    salud: Heart, ropa: Tag, deporte: Activity,
  };

  const renderSplitSummary = () => {
    if (splitType === 'proporcional') return <span>Por ingresos</span>;
    const pairs = roommates.map((r, i) => {
      if (splitType === 'equitativo') {
        const base = parseFloat((100 / roommates.length).toFixed(1));
        return { r, pct: i === roommates.length - 1 ? +(100 - base * (roommates.length - 1)).toFixed(1) : base };
      }
      return { r, pct: parseFloat(customPercentages[r.id] || '0') };
    }).filter(({ pct }) => Number(pct) > 0);
    return (
      <>
        {pairs.map(({ r, pct }, i) => (
          <React.Fragment key={r.id}>
            {i > 0 && <span className="text-gray-400 dark:text-zinc-500"> / </span>}
            <span style={{ color: r.color }} className="font-semibold">{Number(pct) % 1 === 0 ? Number(pct) : Number(pct).toFixed(1)}%</span>
            {' '}{r.name}
          </React.Fragment>
        ))}
      </>
    );
  };

  // ── Filtros y agrupación por fecha para la lista ──
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const currentMonthPrefix = today.slice(0, 7);

  const visibleExpenses = filteredExpenses.filter(e => {
    if (filterMacro !== 'todos' && e.macroCategory !== filterMacro) return false;
    if (filterMonth === 'mes' && !(e.date || '').startsWith(currentMonthPrefix)) return false;
    return true;
  });

  const groupedByDate: { label: string; items: Expense[] }[] = [];
  visibleExpenses.forEach(e => {
    const d = e.date || '';
    const label = d === today ? 'Hoy' : d === yesterday ? 'Ayer' : d.slice(5).replace('-', ' ').toUpperCase();
    const existing = groupedByDate.find(g => g.label === label);
    if (existing) existing.items.push(e);
    else groupedByDate.push({ label, items: [e] });
  });

  const totalVisible = visibleExpenses.reduce((s, e) => {
    const r = e.currency === 'USD' ? (e.exchangeRate || 3.8) : 1;
    return s + e.amount * r;
  }, 0);

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const dailyAvg = dayOfMonth > 0 ? totalVisible / dayOfMonth : 0;

  return (
    <div className="max-w-xl mx-auto" style={{ background: '#F7F7FC', minHeight: '100vh', paddingBottom: 96 }}>
      {/* Toast */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 z-50 animate-fadeIn">
          <Check size={16} />
          <span className="text-[14px] font-medium">{successMsg}</span>
        </div>
      )}

      {/* Split notification */}
      {splitNotification && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-800 border border-indigo-200 px-4 py-3 rounded-2xl shadow-xl z-50 max-w-xs w-full animate-fadeIn">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[12px] font-semibold text-indigo-600">Recuerda avisar a:</span>
            <button onClick={() => setSplitNotification(null)} className="text-zinc-400"><X size={14} /></button>
          </div>
          <ul className="space-y-1">
            {splitNotification.names.map((n, i) => (
              <li key={i} className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 flex justify-between">
                <span>{n.name}</span>
                <span className="font-mono text-rose-500">{n.currency} {n.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Comprobante" className="max-w-full max-h-full rounded-2xl object-contain" />
          <button className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full" onClick={() => setLightboxImage(null)}><X size={20} /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-3 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-zinc-900 dark:text-zinc-100">Gastos</h2>
            <p className="text-[12px] text-zinc-400 mt-0.5">
              {filterMonth === 'mes' ? 'Este mes' : 'Todos los gastos'}
            </p>
          </div>
          <button type="button" onClick={() => setShowInfo(!showInfo)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-400">
            <Info size={18} />
          </button>
        </div>

        {/* Chips de filtro */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {([
            { id: 'todos', label: 'Todos' },
            { id: 'hogar', label: 'Hogar' },
            { id: 'personal', label: 'Personal' },
          ] as const).map(f => (
            <button key={f.id} type="button"
              onClick={() => setFilterMacro(f.id)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium shrink-0 transition active:scale-95 ${filterMacro === f.id ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
              {f.id === 'hogar' && <Home size={13} aria-hidden="true" />}
              {f.id === 'personal' && <User size={13} aria-hidden="true" />}
              {f.label}
            </button>
          ))}
          <button type="button"
            onClick={() => setFilterMonth(m => m === 'mes' ? 'todo' : 'mes')}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium shrink-0 transition active:scale-95 ml-auto ${filterMonth === 'mes' ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
            <Calendar size={13} aria-hidden="true" />
            {filterMonth === 'mes' ? 'Este mes' : 'Todo'}
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* ── Balance card ── */}
      <div className="px-4 pt-3">
        {settlements.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
              <Check size={15} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">¡Todo al día!</p>
              <p className="text-[11px] text-zinc-400">Sin deudas pendientes</p>
            </div>
            {filterMonth === 'mes' && (
              <div className="text-right">
                <p className="text-[11px] text-zinc-400">Promedio diario</p>
                <p className="text-[14px] font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">S/ {dailyAvg.toFixed(0)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
            {/* Balance summary row */}
            <div className="px-4 py-3 border-b border-zinc-50 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-zinc-400">Balances pendientes</p>
                {filterMonth === 'mes' && (
                  <p className="text-[12px] text-zinc-400">Prom. diario: <span className="font-semibold text-zinc-700 dark:text-zinc-300">S/ {dailyAvg.toFixed(0)}</span></p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {settlements.map((sett, idx) => {
                  const debtor = resolvedAllRoommates.find(r => r.id === sett.from);
                  const creditor = resolvedAllRoommates.find(r => r.id === sett.to);
                  return (
                    <div key={idx} className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl px-3 py-2">
                      <span className="text-[12px] font-semibold" style={{ color: debtor?.color }}>{debtor?.name}</span>
                      <ArrowRight size={10} className="text-zinc-400" />
                      <span className="text-[12px] font-semibold" style={{ color: creditor?.color }}>{creditor?.name}</span>
                      <span className="text-[13px] font-bold text-rose-600 dark:text-rose-400 tabular-nums ml-1">
                        {sett.currency === 'USD' ? '$' : 'S/'}{sett.amount.toFixed(2)}
                      </span>
                      <button type="button"
                        onClick={() => setSettlingIndex(settlingIndex === idx ? null : idx)}
                        className="ml-1 h-6 px-2 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold active:scale-95 transition">
                        Pagar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmar liquidación */}
            {settlingIndex !== null && (
              <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 animate-fadeIn">
                {(() => {
                  const sett = settlements[settlingIndex];
                  const debtor = resolvedAllRoommates.find(r => r.id === sett.from);
                  const creditor = resolvedAllRoommates.find(r => r.id === sett.to);
                  return (
                    <div className="space-y-2">
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-400">
                        ¿Confirmar que <strong style={{ color: debtor?.color }}>{debtor?.name}</strong> pagó <strong className="text-zinc-900 dark:text-zinc-100">{sett.currency === 'USD' ? '$' : 'S/'}{sett.amount.toFixed(2)}</strong> a <strong style={{ color: creditor?.color }}>{creditor?.name}</strong>?
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleSettle(sett)}
                          className="flex-1 h-9 bg-emerald-600 text-white font-semibold text-[13px] rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-1.5">
                          <Check size={13} /> Confirmar
                        </button>
                        <button type="button" onClick={() => setSettlingIndex(null)}
                          className="h-9 px-4 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[13px] font-medium rounded-xl">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {settlementHistory.length > 0 && (
              <button type="button" onClick={() => setShowSettlementHistory(!showSettlementHistory)}
                className="w-full px-4 py-2.5 flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-indigo-500 transition border-t border-zinc-50 dark:border-zinc-800">
                <Check size={12} className="text-emerald-500" />
                Liquidaciones anteriores ({settlementHistory.length})
                <ChevronDown size={12} className={`ml-auto transition-transform ${showSettlementHistory ? 'rotate-180' : ''}`} />
              </button>
            )}
            {showSettlementHistory && (
              <div className="px-4 pb-3 space-y-1.5 animate-fadeIn">
                {settlementHistory.map(rec => {
                  const fromName = resolvedAllRoommates.find(r => r.id === rec.fromId)?.name || rec.fromId;
                  const toName = resolvedAllRoommates.find(r => r.id === rec.toId)?.name || rec.toId;
                  return (
                    <div key={rec.id} className="flex items-center justify-between text-[12px] py-1.5 border-t border-zinc-50 dark:border-zinc-800">
                      <div className="flex items-center gap-1 text-zinc-500">
                        <span className="font-medium">{fromName}</span>
                        <ArrowRight size={10} />
                        <span className="font-medium">{toName}</span>
                        <span className="text-zinc-400">· {rec.date}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600">{rec.currency === 'USD' ? '$' : 'S/'}{rec.amount.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Lista de gastos agrupada por fecha ── */}
      <div className="px-4 pt-3 space-y-4">
        {groupedByDate.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[15px] font-medium text-zinc-400">Sin gastos registrados</p>
            <p className="text-[13px] text-zinc-300 dark:text-zinc-600 mt-1">Toca + para agregar uno</p>
          </div>
        ) : (
          groupedByDate.map(group => (
            <div key={group.label}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-1">{group.label}</p>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                {group.items.map((expense, i) => {
                  const CatIcon = CATEGORY_ICON_MAP[expense.category] || MoreHorizontal;
                  const catColor = {
                    alquiler: '#4F46E5', servicio: '#EC4899', comida: '#F59E0B',
                    limpieza: '#10B981', membresia: '#3B82F6', auto: '#8B5CF6',
                    salud: '#EF4444', ropa: '#F97316', deporte: '#06B6D4', otros: '#A1A1AA',
                  }[expense.category] || '#A1A1AA';
                  const payer = resolvedAllRoommates.find(r => r.id === expense.paidBy);
                  const isOpen = expandedExpenses[expense.id];
                  const isMenuOpen = openMenuExpenseId === expense.id;
                  const soles = expense.currency === 'USD' ? expense.amount * (expense.exchangeRate || 3.8) : expense.amount;

                  return (
                    <div key={expense.id} className={i > 0 ? 'border-t border-zinc-50 dark:border-zinc-800' : ''}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-50 dark:active:bg-zinc-800 transition"
                        onClick={() => toggleExpenseDetails(expense.id)}
                      >
                        {/* Category icon */}
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: catColor + '18' }}>
                          <CatIcon size={18} style={{ color: catColor }} aria-hidden="true" />
                        </div>

                        {/* Title + subtitle */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{expense.title}</p>
                          <p className="text-[12px] text-zinc-400 mt-0.5">
                            {expense.macroCategory === 'hogar' ? 'Hogar' : 'Personal'} · {getCategoryLabel(expense.category)}
                          </p>
                        </div>

                        {/* Amount + payer */}
                        <div className="text-right shrink-0">
                          <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            S/ {soles.toFixed(2)}
                          </p>
                          {payer && (
                            <p className="text-[11px] font-semibold mt-0.5" style={{ color: payer.color }}>
                              Pagó {payer.name}
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="px-4 pb-3 pt-1 border-t border-zinc-50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 animate-fadeIn">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Split breakdown */}
                            <div className="flex-1 min-w-0 space-y-1">
                              {roommates.map(r => {
                                const share = expense.calculatedShares?.[r.id] || 0;
                                if (share <= 0) return null;
                                const shareRate = expense.currency === 'USD' ? (expense.exchangeRate || 3.8) : 1;
                                return (
                                  <div key={r.id} className="flex items-center justify-between text-[12px]">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0" style={{ background: r.color }}>{r.name.charAt(0)}</div>
                                      <span className="text-zinc-600 dark:text-zinc-400">{r.name}</span>
                                    </div>
                                    <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">S/ {(share * shareRate).toFixed(2)}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Actions */}
                            <div className="flex gap-1.5 shrink-0">
                              {expense.receiptImage && (
                                <button type="button" onClick={() => setLightboxImage(expense.receiptImage!)}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500">
                                  <Camera size={13} />
                                </button>
                              )}
                              <button type="button" onClick={() => startEdit(expense)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-indigo-500">
                                <Pencil size={13} />
                              </button>
                              <button type="button" onClick={() => onRemoveExpense(expense.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-rose-500">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={handleOpenNewExpenseForm}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 flex items-center justify-center active:scale-90 transition z-40"
        aria-label="Nuevo gasto"
      >
        <Plus size={24} />
      </button>

      <div className="space-y-8">
        {/* Modal / Dialog for registering or editing expense */}
        {isModalOpen && (
          <div className="fixed inset-x-0 top-0 z-[100] flex flex-col justify-end" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom))', background: 'rgba(0,0,0,0.45)' }} onClick={cancelEdit}>
            <div className="w-full max-w-xl mx-auto flex flex-col rounded-t-3xl overflow-hidden" style={{ background: '#F7F7FC', maxHeight: 'calc(100dvh - 80px)' }} onClick={e => e.stopPropagation()}>

              {/* ── Drag handle ── */}
              <div className="shrink-0 flex justify-center pt-3 pb-1 bg-white/90">
                <div className="w-10 h-1 rounded-full" style={{ background: '#D1D5DB' }} />
              </div>

              {/* ── Header ── */}
              <div
                className="shrink-0 bg-white/90 backdrop-blur-sm border-b border-black/[0.05]"
              >
                <div className="flex items-center justify-between px-5 pb-3 pt-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    aria-label="Volver"
                    className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-indigo-50 transition active:scale-90"
                  >
                    <ArrowLeft size={20} className="text-indigo-600" />
                  </button>
                  <h2 className="text-[16px] font-semibold" style={{ color: '#242536' }}>
                    {editingExpenseId ? 'Editar gasto' : 'Nuevo gasto'}
                  </h2>
                  <div className="w-11" />
                </div>

                {/* Payer selector */}
                <div className="flex items-center justify-center gap-2 pb-3">
                  <span className="text-[13px]" style={{ color: '#8D90A5' }}>Pagó</span>
                  <div className="relative">
                    <button
                      type="button"
                      id="expense-payer-select"
                      aria-label="Seleccionar pagador"
                      onClick={() => setShowPayerDropdown(p => !p)}
                      className="flex items-center gap-2 h-9 pl-2 pr-3 rounded-full border transition active:scale-95"
                      style={{ background: '#EEF2FF', borderColor: '#C7D2FE' }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: roommates.find(r => r.id === paidBy)?.color || '#6366f1' }}
                      >
                        {roommates.find(r => r.id === paidBy)?.name.charAt(0) || '?'}
                      </div>
                      <span className="text-[13px] font-semibold text-indigo-700">
                        {roommates.find(r => r.id === paidBy)?.name || 'Seleccionar'}
                      </span>
                      <ChevronDown size={14} className="text-indigo-400" />
                    </button>
                    {showPayerDropdown && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-2xl shadow-lg overflow-hidden z-20 min-w-[150px]" style={{ border: '1px solid rgba(80,80,120,0.10)' }}>
                        {roommates.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setPaidBy(r.id);
                              if (macroCategory === 'personal') {
                                const percs: Record<string, string> = {};
                                roommates.forEach(rm => { percs[rm.id] = rm.id === r.id ? '100' : '0'; });
                                setCustomPercentages(percs);
                              }
                              setShowPayerDropdown(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-indigo-50 ${paidBy === r.id ? 'bg-indigo-50' : ''}`}
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ backgroundColor: r.color }}>{r.name.charAt(0)}</div>
                            <span className={`text-[14px] font-medium flex-1 text-left ${paidBy === r.id ? 'text-indigo-700' : 'text-gray-700'}`}>{r.name}</span>
                            {paidBy === r.id && <Check size={14} className="text-indigo-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Scrollable form ── */}
              <form
                id="expense-form"
                ref={formRef}
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                onClick={() => showPayerDropdown && setShowPayerDropdown(false)}
              >

                {/* Cargar desde recurrente */}
                {bills.length > 0 && !editingExpenseId && (
                  <div>
                    {!associatedBillId ? (
                      <button type="button" onClick={() => setShowRecurringPicker(p => !p)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-indigo-500 hover:text-indigo-700 transition">
                        <RefreshCw size={13} aria-hidden="true" />
                        Cargar desde recurrente
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                        <RefreshCw size={14} className="text-indigo-500 shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-[13px] font-medium text-indigo-700 truncate">{bills.find(b => b.id === associatedBillId)?.name}</span>
                        <button type="button" aria-label="Quitar recurrente" onClick={() => { setAssociatedBillId(''); if (title.startsWith('[Pago Recurrente]')) setTitle(''); setShowRecurringPicker(false); }} className="text-rose-400 hover:text-rose-600 transition p-1"><X size={13} /></button>
                      </div>
                    )}
                    {showRecurringPicker && !associatedBillId && (
                      <div id="expense-fixed-bill-picker" className="mt-2 bg-white rounded-2xl p-3 space-y-2 animate-fadeIn" style={{ border: '1px solid rgba(80,80,120,0.10)' }}>
                        <select
                          id="select-fixed-bill-dropdown"
                          value={associatedBillId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setAssociatedBillId(selectedId);
                            if (selectedId !== '') {
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
                                setShowRecurringPicker(false);
                              }
                            }
                          }}
                          className="w-full h-11 px-3 rounded-xl bg-gray-50 text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          style={{ border: '1px solid rgba(80,80,120,0.12)' }}
                        >
                          <option value="">— Elegir gasto recurrente —</option>
                          {bills.map(b => <option key={b.id} value={b.id}>{b.name} ({b.currency === 'USD' ? '$' : 'S/'} {b.amount})</option>)}
                        </select>
                      </div>
                    )}
                    {associatedBillId && (
                      <div className="mt-2">
                        <label className="text-[11px] font-medium" style={{ color: '#8D90A5' }}>Mes del pago</label>
                        <select id="select-fixed-bill-month-dropdown" value={recurrentBillMonth}
                          onChange={(e) => setRecurrentBillMonth(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-xl bg-gray-50 text-gray-900 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          style={{ border: '1px solid rgba(80,80,120,0.12)' }}>
                          {getSurroundingMonths().map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* 1. Monto — tarjeta protagonista */}
                <div className="bg-white rounded-3xl p-5" style={{ border: '1px solid rgba(80,80,120,0.08)', boxShadow: '0 2px 12px rgba(79,70,229,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Cambiar moneda"
                      onClick={() => { const n = currency === 'PEN' ? 'USD' : 'PEN'; setCurrency(n); setExchangeRateInput(n === 'USD' ? 3.80 : 1); }}
                      className="flex items-center gap-1 h-11 px-3 rounded-xl font-bold text-[14px] text-indigo-700 transition hover:opacity-80 shrink-0"
                      style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}
                    >
                      {currency === 'PEN' ? 'S/' : 'US$'}
                      <ChevronDown size={13} className="text-indigo-400" />
                    </button>
                    <input
                      id="expense-amount-input"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      required
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="flex-1 text-[32px] font-semibold bg-transparent border-none outline-none min-w-0"
                      style={{ color: '#242536', caretColor: '#4F46E5' }}
                    />
                  </div>
                  {currency === 'USD' && (
                    <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(80,80,120,0.08)' }}>
                      <label className="text-[11px] font-medium shrink-0" style={{ color: '#8D90A5' }}>Tipo de cambio S//$</label>
                      <input type="number" inputMode="decimal" step="0.001" value={exchangeRateInput}
                        onChange={(e) => setExchangeRateInput(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="3.80"
                        className="flex-1 h-9 px-3 rounded-xl bg-gray-50 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        style={{ border: '1px solid rgba(80,80,120,0.10)' }} />
                    </div>
                  )}
                  <p className="text-[12px] mt-2" style={{ color: '#8D90A5' }}>Ingresa el monto del gasto</p>
                </div>

                {/* 2. Tipo de gasto */}
                <div className="bg-white rounded-2xl p-1 flex" style={{ border: '1px solid rgba(80,80,120,0.08)', boxShadow: '0 2px 8px rgba(79,70,229,0.04)' }}>
                  {([
                    { value: 'hogar' as const, label: 'Hogar', Icon: Home },
                    { value: 'personal' as const, label: 'Personal', Icon: User },
                  ]).map(({ value: val, label, Icon }) => {
                    const active = macroCategory === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setMacroCategory(val);
                          setShowNewCatInput(false);
                          setNewCatName('');
                          if (val === 'personal') {
                            setCategory(PERSONAL_DEFAULT_CATEGORIES[0]);
                            setSplitType('porcentaje');
                            const percs: Record<string, string> = {};
                            roommates.forEach(r => { percs[r.id] = r.id === paidBy ? '100' : '0'; });
                            setCustomPercentages(percs);
                          } else {
                            setCategory(HOGAR_DEFAULT_CATEGORIES[0]);
                            setSplitType(defaultSplitType);
                            const dp = Object.keys(defaultSplitPercentages).length > 0
                              ? Object.fromEntries(Object.entries(defaultSplitPercentages).map(([k, v]) => [k, String(v)]))
                              : Object.fromEntries(roommates.map(r => [r.id, String(Math.round(100 / roommates.length))]));
                            setCustomPercentages(dp);
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-medium transition-all active:scale-[0.98] ${active ? 'text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                        style={active ? { background: '#EEF2FF', border: '1px solid #C7D2FE' } : {}}
                        aria-pressed={active}
                      >
                        <Icon size={16} aria-hidden="true" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 3. Descripción + cámara */}
                <div className="bg-white rounded-2xl flex items-center gap-3 px-4 h-[56px]" style={{ border: '1px solid rgba(80,80,120,0.08)', boxShadow: '0 2px 8px rgba(79,70,229,0.04)' }}>
                  <FileText size={18} className="shrink-0" style={{ color: '#C4C6D8' }} aria-hidden="true" />
                  <input
                    id="expense-title-input"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => { const v = e.target.value; setTitle(v); if (!associatedBillId) setCategory(inferCategoryFromName(v)); }}
                    placeholder="Ej. Mercado Wong, luz de junio..."
                    className="flex-1 text-[14px] bg-transparent border-none outline-none"
                    style={{ color: '#242536' }}
                  />
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {receiptImage ? (
                    <div className="relative shrink-0">
                      <img src={receiptImage} alt="Comprobante" className="w-9 h-9 object-cover rounded-xl cursor-pointer" style={{ border: '1px solid rgba(80,80,120,0.12)' }} onClick={() => setLightboxImage(receiptImage)} />
                      <button type="button" aria-label="Eliminar foto" onClick={() => setReceiptImage(undefined)} className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center"><X size={8} /></button>
                    </div>
                  ) : (
                    <button type="button" aria-label="Adjuntar recibo" onClick={() => imageInputRef.current?.click()} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl transition active:scale-90 hover:bg-indigo-50" style={{ color: '#8D90A5' }}>
                      <Camera size={18} />
                    </button>
                  )}
                </div>

                {/* 4. División — solo Hogar */}
                {macroCategory === 'hogar' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowSplitConfig(p => !p)}
                      className="w-full bg-white rounded-2xl flex items-center gap-3 px-4 h-[56px] transition hover:brightness-[0.98] active:scale-[0.99]"
                      style={{ border: '1px solid rgba(80,80,120,0.08)', boxShadow: '0 2px 8px rgba(79,70,229,0.04)' }}
                    >
                      <Split size={18} className="shrink-0" style={{ color: '#C4C6D8' }} aria-hidden="true" />
                      <span className="flex-1 text-left text-[14px]" style={{ color: '#242536' }}>
                        Se divide: {renderSplitSummary()}
                      </span>
                      <span className="text-[13px] font-medium text-indigo-600 shrink-0">Editar</span>
                      <ChevronRight size={16} className="text-indigo-400 shrink-0" />
                    </button>

                    {showSplitConfig && (
                      <div className="mt-2 bg-white rounded-2xl p-4 space-y-3 animate-fadeIn" style={{ border: '1px solid rgba(80,80,120,0.08)' }}>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { id: 'split-type-equitativo', value: 'equitativo' as SplitType, label: 'Equitativo' },
                            { id: 'split-type-proporcional', value: 'proporcional' as SplitType, label: 'Por ingresos' },
                            { id: 'split-type-porcentaje', value: 'porcentaje' as SplitType, label: '% personalizado' },
                          ]).map(opt => (
                            <button key={opt.value} id={opt.id} type="button" onClick={() => setSplitType(opt.value)}
                              className={`h-10 rounded-xl text-[12px] font-semibold transition active:scale-95 ${splitType === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {splitType === 'equitativo' && (
                          <div className="p-3 bg-gray-50 rounded-xl space-y-1.5">
                            {roommates.map((r, i) => {
                              const base = parseFloat((100 / roommates.length).toFixed(1));
                              const display = i === roommates.length - 1 ? +(100 - base * (roommates.length - 1)).toFixed(1) : base;
                              return (
                                <div key={r.id} className="flex items-center justify-between text-[13px]">
                                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} /><span className="font-medium" style={{ color: '#242536' }}>{r.name}</span></div>
                                  <span className="font-semibold" style={{ color: '#8D90A5' }}>{display}%</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {splitType === 'proporcional' && (totalIncome <= 0 ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800 space-y-2">
                            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> Faltan ingresos configurados</p>
                            <button type="button" onClick={() => { cancelEdit(); onNavigateTab?.('budget'); }} className="flex items-center gap-1 text-[12px] font-bold text-amber-700 underline">Ir a Depa <ArrowRight size={11} /></button>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 rounded-xl space-y-1.5">
                            {roommates.map(r => {
                              const pct = totalIncome > 0 ? (r.income / totalIncome * 100) : 0;
                              return (
                                <div key={r.id} className="flex items-center justify-between text-[13px]">
                                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} /><span className="font-medium" style={{ color: '#242536' }}>{r.name}</span></div>
                                  <span className="font-semibold" style={{ color: '#8D90A5' }}>{pct.toFixed(1)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                        {splitType === 'porcentaje' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-[12px] font-semibold ${Math.abs(roommates.reduce((a, r) => a + (parseFloat(customPercentages[r.id]) || 0), 0) - 100) < 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                Total: {roommates.reduce((a, r) => a + (parseFloat(customPercentages[r.id]) || 0), 0).toFixed(1)}%
                              </span>
                              <button type="button" onClick={() => { const s = Math.round((100 / roommates.length) * 100) / 100; const p: Record<string,string> = {}; roommates.forEach((r, i) => { p[r.id] = String(i === roommates.length - 1 ? Math.round((100 - s * (roommates.length - 1)) * 100) / 100 : s); }); setCustomPercentages(p); }} className="text-[12px] text-indigo-500 font-semibold">Restablecer equitativo</button>
                            </div>
                            {roommates.map(r => (
                              <div key={r.id} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ backgroundColor: r.color }}>{r.name.charAt(0)}</div>
                                <span className="flex-1 text-[14px] font-medium" style={{ color: '#242536' }}>{r.name}</span>
                                <div className="relative w-24">
                                  <input type="number" inputMode="decimal" min={0} max={100} value={customPercentages[r.id] ?? ''} onChange={(e) => handlePercentageChange(r.id, e.target.value)} className="w-full h-10 pr-7 pl-3 rounded-xl bg-gray-100 text-gray-900 text-[14px] font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[13px] pointer-events-none">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Categorías */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide px-1" style={{ color: '#8D90A5' }}>Categoría</label>
                  <div className="flex gap-2 flex-wrap">
                    {(() => {
                      const allCats = (macroCategory === 'hogar'
                        ? [...HOGAR_DEFAULT_CATEGORIES, ...customHogarCategories]
                        : [...PERSONAL_DEFAULT_CATEGORIES, ...customPersonalCategories]) as string[];
                      const selectedIdx = allCats.indexOf(category);
                      const VISIBLE = 4;
                      let visibleCats: string[];
                      if (showAllCategories) {
                        visibleCats = allCats;
                      } else if (selectedIdx >= VISIBLE) {
                        visibleCats = [...allCats.slice(0, VISIBLE - 1), category];
                      } else {
                        visibleCats = allCats.slice(0, VISIBLE);
                      }
                      const hasMore = !showAllCategories && allCats.length > VISIBLE;
                      return (
                        <>
                          {visibleCats.map(cat => {
                            const active = category === cat;
                            const CatIcon = CATEGORY_ICON_MAP[cat] || MoreHorizontal;
                            return (
                              <button key={cat} type="button" onClick={() => setCategory(cat)}
                                className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium transition active:scale-95 ${active ? 'text-indigo-700 bg-white' : 'bg-white text-gray-500 hover:text-gray-700'}`}
                                style={active ? { border: '1.5px solid #6366f1' } : { border: '1px solid rgba(80,80,120,0.10)' }}
                              >
                                <CatIcon size={14} className={active ? 'text-indigo-600' : 'text-gray-400'} aria-hidden="true" />
                                {getCategoryLabel(cat)}
                              </button>
                            );
                          })}
                          {hasMore && (
                            <button type="button" onClick={() => setShowAllCategories(true)}
                              className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium transition active:scale-95 bg-white text-gray-400 hover:text-gray-600"
                              style={{ border: '1px solid rgba(80,80,120,0.10)' }}>
                              <MoreHorizontal size={14} aria-hidden="true" /> Más
                            </button>
                          )}
                          {showAllCategories && !showNewCatInput && (
                            <button type="button" onClick={() => setShowNewCatInput(true)}
                              className="flex items-center gap-1 h-9 px-3 rounded-xl text-[12px] font-medium transition active:scale-95 text-gray-400 hover:text-indigo-500"
                              style={{ border: '1px dashed rgba(80,80,120,0.20)' }}>
                              + Crear
                            </button>
                          )}
                        </>
                      );
                    })()}
                    {!showAllCategories && !showNewCatInput && (
                      <button type="button" onClick={() => { setShowAllCategories(true); setShowNewCatInput(true); }}
                        className="h-9 px-3 rounded-xl text-[12px] font-medium text-gray-400 hover:text-indigo-500 transition active:scale-95"
                        style={{ border: '1px dashed rgba(80,80,120,0.20)' }}>
                        + Crear
                      </button>
                    )}
                  </div>
                  {showNewCatInput && (
                    <div className="flex items-center gap-1.5">
                      <input autoFocus type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                        placeholder="Nombre de categoría"
                        className="flex-1 h-9 px-3 rounded-xl bg-gray-100 text-[12px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); const n = newCatName.trim().toLowerCase(); if (!n) return; macroCategory === 'hogar' ? onAddHogarCategory?.(n) : onAddPersonalCategory?.(n); setCategory(n); setNewCatName(''); setShowNewCatInput(false); }
                          if (e.key === 'Escape') { setShowNewCatInput(false); setNewCatName(''); }
                        }} />
                      <button type="button" onClick={() => { const n = newCatName.trim().toLowerCase(); if (!n) return; macroCategory === 'hogar' ? onAddHogarCategory?.(n) : onAddPersonalCategory?.(n); setCategory(n); setNewCatName(''); setShowNewCatInput(false); }} className="h-9 px-3 rounded-xl bg-indigo-600 text-white text-[12px] font-semibold">OK</button>
                      <button type="button" onClick={() => { setShowNewCatInput(false); setNewCatName(''); }} className="h-9 px-2 rounded-xl bg-gray-200 text-gray-500 text-[12px]">✕</button>
                    </div>
                  )}
                </div>

                {/* 6. Fecha + Recurrente (misma fila) */}
                <div className="flex gap-2 items-stretch">
                  {/* Fecha */}
                  <div className="shrink-0" style={{ flexBasis: '30%', minWidth: '90px' }}>
                    {!showDatePicker ? (
                      <button type="button" onClick={() => setShowDatePicker(true)} aria-label="Cambiar fecha"
                        className="w-full h-[52px] flex items-center justify-center gap-1.5 rounded-2xl bg-white text-[13px] font-medium transition hover:brightness-[0.97] active:scale-[0.98]"
                        style={{ border: '1px solid rgba(80,80,120,0.08)', boxShadow: '0 2px 8px rgba(79,70,229,0.04)', color: '#242536' }}>
                        <Calendar size={15} className="text-indigo-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">{date === new Date().toISOString().split('T')[0] ? 'Hoy' : date.slice(5)}</span>
                        <ChevronDown size={13} style={{ color: '#8D90A5' }} />
                      </button>
                    ) : (
                      <input type="date" required value={date}
                        onChange={(e) => { setDate(e.target.value); setShowDatePicker(false); }}
                        onBlur={() => setShowDatePicker(false)}
                        autoFocus
                        className="w-full h-[52px] px-3 rounded-2xl bg-white text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        style={{ border: '1px solid #6366f1' }}
                      />
                    )}
                  </div>

                  {/* Recurrente */}
                  {!editingExpenseId && !associatedBillId ? (
                    <button type="button" onClick={() => setIsRecurring(r => !r)}
                      className="flex-1 flex items-center gap-2 h-[52px] px-3 rounded-2xl transition active:scale-[0.98]"
                      style={isRecurring
                        ? { background: '#EEF2FF', border: '1px solid #C7D2FE', boxShadow: '0 2px 8px rgba(79,70,229,0.06)' }
                        : { background: 'white', border: '1px solid rgba(80,80,120,0.08)', boxShadow: '0 2px 8px rgba(79,70,229,0.04)' }
                      }
                    >
                      <RefreshCw size={14} className={`shrink-0 ${isRecurring ? 'text-indigo-500' : 'text-gray-400'}`} aria-hidden="true" />
                      <span className={`flex-1 text-left leading-tight ${isRecurring ? 'text-indigo-700' : 'text-gray-500'}`} style={{ fontSize: 'clamp(10px, 2.5vw, 12px)' }}>
                        Guardar como gasto recurrente
                      </span>
                      <div className={`w-10 h-[22px] rounded-full flex items-center px-0.5 shrink-0 transition-colors ${isRecurring ? 'bg-indigo-600' : 'bg-gray-200'}`} style={{ minWidth: '40px' }}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isRecurring ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  ) : (
                    <div className="flex-1 h-[52px] rounded-2xl bg-white flex items-center px-3" style={{ border: '1px solid rgba(80,80,120,0.08)' }}>
                      <span className="text-[12px]" style={{ color: '#8D90A5' }}>Vinculado a recurrente</span>
                    </div>
                  )}
                </div>

              </form>

              {/* ── CTA ── */}
              <div className="shrink-0 px-4 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
                <button
                  id="submit-expense-button"
                  type="submit"
                  form="expense-form"
                  className="w-full h-[56px] text-white font-semibold text-[16px] rounded-2xl transition active:scale-[0.98] hover:opacity-90"
                  style={{ background: '#4338CA' }}
                >
                  {editingExpenseId ? 'Guardar cambios' : 'Registrar gasto'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
