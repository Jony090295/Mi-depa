import React, { useState, useMemo, useEffect } from 'react';
import { RecurrentBill, RecurrentBillHistory, Roommate, ExpenseCategory, VariableReminder } from '../types';
import { CATEGORY_LABELS } from '../utils';
import { ChevronLeft, ChevronRight, Check, Plus, Edit2, Trash2, X, Clock, Info } from 'lucide-react';

// ─── Month helpers ────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function currentMonthLabel() {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function offsetMonth(label: string, delta: number): string {
  const parts = label.split(' ');
  if (parts.length !== 2) return label;
  let m = MONTH_NAMES.indexOf(parts[0]);
  let y = parseInt(parts[1]);
  if (m === -1 || isNaN(y)) return label;
  m += delta;
  while (m < 0) { m += 12; y--; }
  while (m > 11) { m -= 12; y++; }
  return `${MONTH_NAMES[m]} ${y}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPLIT_OPTIONS = [
  { value: 'equitativo',  label: 'Equitativo' },
  { value: 'proporcional', label: 'Proporcional a ingresos' },
  { value: 'no_dividir',  label: 'No dividir' },
  { value: 'porcentaje',  label: '% personalizado' },
];

const CATEGORY_OPTIONS: ExpenseCategory[] = [
  'alquiler', 'membresia', 'auto', 'servicio', 'comida', 'limpieza', 'otros',
];

type SplitType = 'no_dividir' | 'equitativo' | 'proporcional' | 'porcentaje';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecurrentBillsTabProps {
  roommates: Roommate[];
  allRoommates?: Roommate[];
  bills: RecurrentBill[];
  billHistory: RecurrentBillHistory[];
  onUpdateBillStatus: (
    id: string,
    status: 'pagado' | 'por pagar',
    customSplitConfig?: {
      paidBy: string;
      splitType: 'no_dividir' | 'equitativo' | 'proporcional' | 'porcentaje';
      splits?: Record<string, number>;
      monthPaidFor?: string;
      datePaid?: string;
      amount?: number;
    }
  ) => void;
  onAddBill: (bill: RecurrentBill) => void;
  onRemoveBill: (id: string) => void;
  onSendBillAlert: (id: string, message: string) => void;
  onUpdateBill: (bill: RecurrentBill) => void;
  onRemoveHistoryEntry: (id: string) => void;
  onUpdateHistoryEntry: (entry: RecurrentBillHistory) => void;
  onNavigateTab?: (tab: string) => void;
  onPrefillBillInExpenses?: (billId: string) => void;
  onDiscardBillForMonth?: (billId: string, month: string) => void;
  variableReminders?: VariableReminder[];
  onAddVariableReminder?: (reminder: VariableReminder) => void;
  onRemoveVariableReminder?: (id: string) => void;
  onMarkVariableReminderDone?: (id: string) => void;
}

// ─── Edit form shape ──────────────────────────────────────────────────────────

const EMPTY_EDIT = {
  name: '',
  amount: '' as number | '',
  dueDate: '',
  notes: '',
  category: 'servicio' as ExpenseCategory,
  isAutoDebit: false,
  splitType: 'equitativo' as SplitType,
  currency: 'PEN' as 'PEN' | 'USD',
  customSplits: {} as Record<string, string>,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecurrentBillsTab({
  roommates,
  allRoommates,
  bills,
  billHistory = [],
  onUpdateBillStatus,
  onAddBill,
  onRemoveBill,
  onUpdateBill,
  onRemoveHistoryEntry,
  onPrefillBillInExpenses,
  // kept in props for API compatibility, not used in this view:
  onSendBillAlert: _onSendBillAlert,
  onUpdateHistoryEntry: _onUpdateHistoryEntry,
  onNavigateTab: _onNavigateTab,
  onDiscardBillForMonth: _onDiscardBillForMonth,
  variableReminders = [],
  onAddVariableReminder: _onAddVariableReminder,
  onRemoveVariableReminder,
  onMarkVariableReminderDone,
}: RecurrentBillsTabProps) {
  const resolved = allRoommates || roommates;

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(currentMonthLabel);
  const isCurrentMonth = selectedMonth === currentMonthLabel();

  // ── Derived: what's paid/pending this month ─────────────────────────────────
  const paidHistoryForMonth = useMemo(
    () => billHistory.filter(h => h.monthPaidFor === selectedMonth),
    [billHistory, selectedMonth],
  );

  const isPaid = (billId: string) =>
    paidHistoryForMonth.some(h => h.billId === billId);

  const pendingBills = bills.filter(b => !isPaid(b.id));
  const paidBills   = bills.filter(b =>  isPaid(b.id));
  const pendingAmount = pendingBills.reduce((s, b) => {
    const rate = b.currency === 'USD' ? (b.exchangeRate || 3.80) : 1;
    return s + b.amount * rate;
  }, 0);
  const progressPct   = bills.length > 0
    ? Math.round((paidBills.length / bills.length) * 100)
    : 0;

  // ── Payment sheet ───────────────────────────────────────────────────────────
  const [paymentBill, setPaymentBill] = useState<RecurrentBill | null>(null);
  const [payPaidBy,   setPayPaidBy]   = useState('');
  const [payAmount,   setPayAmount]   = useState('');
  const [payDate,     setPayDate]     = useState('');
  const [paySplitType, setPaySplitType] = useState<SplitType>('equitativo');
  const [paySplits, setPaySplits] = useState<Record<string, string>>({});

  const openPayment = (bill: RecurrentBill) => {
    setPaymentBill(bill);
    setPayPaidBy(bill.paidBy || roommates[0]?.id || '');
    setPayAmount(String(bill.amount));
    setPayDate(new Date().toISOString().split('T')[0]);
    setPaySplitType((bill.splitType as SplitType) || 'equitativo');
    // Init % splits: use saved splits or equal distribution
    const initSplits: Record<string, string> = {};
    const equal = Math.round(100 / roommates.length);
    roommates.forEach((r, i) => {
      const val = bill.splits?.[r.id] ?? (i === roommates.length - 1
        ? 100 - equal * (roommates.length - 1)
        : equal);
      initSplits[r.id] = String(val);
    });
    setPaySplits(initSplits);
  };

  const closePayment = () => setPaymentBill(null);

  const confirmPayment = () => {
    if (!paymentBill || !payPaidBy) return;
    onUpdateBillStatus(paymentBill.id, 'pagado', {
      paidBy: payPaidBy,
      splitType: paySplitType,
      splits: paySplitType === 'porcentaje' ? Object.fromEntries(Object.entries(paySplits).map(([k, v]) => [k, parseFloat(v) || 0])) : undefined,
      amount: parseFloat(payAmount) || paymentBill.amount,
      datePaid: payDate,
      monthPaidFor: selectedMonth,
    });
    setPaymentBill(null);
  };

  const paySplitsTotal = Object.values(paySplits).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const markUnpaid = (bill: RecurrentBill) => {
    const hist = paidHistoryForMonth.find(h => h.billId === bill.id);
    if (hist) onRemoveHistoryEntry(hist.id);
    onUpdateBillStatus(bill.id, 'por pagar', { monthPaidFor: selectedMonth, paidBy: '', splitType: 'equitativo' });
  };

  // ── Add / Edit template sheet ───────────────────────────────────────────────
  const [editBill, setEditBill]   = useState<RecurrentBill | 'new' | null>(null);
  const [editForm, setEditForm]   = useState(EMPTY_EDIT);
  const [editSplit, setEditSplit] = useState<SplitType>('equitativo');

  const openAdd = () => {
    setEditBill('new');
    const equal = Math.round((100 / roommates.length) * 100) / 100;
    const initSplits: Record<string, string> = {};
    roommates.forEach((r, i) => {
      initSplits[r.id] = String(i === roommates.length - 1 ? Math.round((100 - equal * (roommates.length - 1)) * 100) / 100 : equal);
    });
    setEditForm({ ...EMPTY_EDIT, customSplits: initSplits });
    setEditSplit('equitativo');
  };

  const openEdit = (bill: RecurrentBill) => {
    setEditBill(bill);
    const initSplits: Record<string, string> = {};
    const equal = Math.round((100 / roommates.length) * 100) / 100;
    roommates.forEach((r, i) => {
      const val = bill.splits?.[r.id] ?? (i === roommates.length - 1 ? Math.round((100 - equal * (roommates.length - 1)) * 100) / 100 : equal);
      initSplits[r.id] = String(val);
    });
    setEditForm({
      name:         bill.name,
      amount:       bill.amount,
      dueDate:      bill.dueDate,
      notes:        bill.notes || '',
      category:     bill.category || 'servicio',
      isAutoDebit:  bill.isAutoDebit || false,
      splitType:    (bill.splitType as SplitType) || 'equitativo',
      currency:     bill.currency || 'PEN',
      customSplits: initSplits,
    });
    setEditSplit((bill.splitType as SplitType) || 'equitativo');
  };

  const closeEdit = () => setEditBill(null);

  const confirmEdit = () => {
    if (!editBill || !editForm.name || !editForm.amount) return;
    const amount = typeof editForm.amount === 'number'
      ? editForm.amount
      : parseFloat(String(editForm.amount));

    const customSplitsNumeric = editSplit === 'porcentaje'
      ? Object.fromEntries(Object.entries(editForm.customSplits).map(([k, v]) => [k, parseFloat(v) || 0]))
      : undefined;

    if (editBill === 'new') {
      onAddBill({
        id:          crypto.randomUUID(),
        name:        editForm.name,
        amount,
        dueDate:     editForm.dueDate,
        notes:       editForm.notes || undefined,
        category:    editForm.category,
        isAutoDebit: editForm.isAutoDebit,
        splitType:   editSplit,
        splits:      customSplitsNumeric,
        status:      'por pagar',
        alertSent:   false,
        currency:    editForm.currency,
      });
    } else {
      onUpdateBill({
        ...editBill,
        name:        editForm.name,
        amount,
        dueDate:     editForm.dueDate,
        notes:       editForm.notes || undefined,
        category:    editForm.category,
        isAutoDebit: editForm.isAutoDebit,
        splitType:   editSplit,
        splits:      customSplitsNumeric,
        currency:    editForm.currency,
      });
    }
    setEditBill(null);
  };

  // ── Confirm delete ──────────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // ── Lock body scroll when any sheet is open ─────────────────────────────────
  const anySheetOpen = !!paymentBill || editBill !== null || !!confirmDeleteId;
  useEffect(() => {
    if (anySheetOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [anySheetOpen]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const catStyle = (cat?: ExpenseCategory) => CATEGORY_LABELS[cat || 'otros'];

  const roommateName = (id: string) =>
    resolved.find(r => r.id === id)?.name || id;

  const formatDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const histEntry = (billId: string) =>
    paidHistoryForMonth.find(h => h.billId === billId);

  const freqLabel = (days: number) => {
    if (days === 7)  return 'Semanal';
    if (days === 14) return 'Quincenal';
    if (days === 30) return 'Mensual';
    return `Cada ${days} días`;
  };

  const daysSince = (dateStr?: string) => {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="pb-nav">

      {/* ── Month nav + progress ── */}
      <div className="sticky top-14 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSelectedMonth(m => offsetMonth(m, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-transform"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-[15px]">{selectedMonth}</p>
            {isCurrentMonth && (
              <p className="text-[11px] text-indigo-500 font-medium">Mes actual</p>
            )}
          </div>

          <button
            onClick={() => setSelectedMonth(m => offsetMonth(m, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-transform"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {bills.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {paidBills.length} de {bills.length} pagados
              </span>
              {pendingAmount > 0 ? (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  S/ {pendingAmount.toLocaleString('es-PE')} pendiente
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Todo al día ✓
                </span>
              )}
            </div>
            <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-6">

        {/* ── Add button (top) ── */}
        <button
          onClick={openAdd}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[14px] font-medium active:scale-[0.98] transition-all hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        >
          <Plus size={16} />
          Agregar gasto recurrente
        </button>

        {/* ── Por pagar ── */}
        {pendingBills.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 px-1">
              Por pagar
            </h3>
            <div className="space-y-2">
              {pendingBills.map(bill => {
                const cat = catStyle(bill.category);
                return (
                  <div
                    key={bill.id}
                    className="bg-white dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}`}>
                          <span className={`text-xs font-bold ${cat.text}`}>
                            {bill.name.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-[15px]">
                              {bill.name}
                            </p>
                            {bill.isAutoDebit && (
                              <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                                Auto
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0">
                            <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                              {bill.currency === 'USD' ? '$' : 'S/'} {bill.amount.toLocaleString('es-PE')}
                            </span>
                            {bill.dueDate && (
                              <span className="text-[12px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                                Vence {bill.dueDate}
                              </span>
                            )}
                          </div>
                          {bill.notes && (
                            <button
                              type="button"
                              onClick={() => setExpandedNoteId(expandedNoteId === bill.id ? null : bill.id)}
                              className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer select-none"
                            >
                              <Info size={11} />
                              <span>{expandedNoteId === bill.id ? 'Ocultar nota' : 'Ver nota'}</span>
                            </button>
                          )}
                          {bill.notes && expandedNoteId === bill.id && (
                            <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed animate-fadeIn">
                              {bill.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 flex-shrink-0 -mr-1">
                          <button
                            onClick={() => openEdit(bill)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 active:scale-90 transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(bill.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 active:scale-90 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => openPayment(bill)}
                        className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[14px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check size={15} />
                        Registrar pago
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── All-paid celebration ── */}
        {pendingBills.length === 0 && paidBills.length > 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-3">
              <Check size={28} className="text-emerald-500" />
            </div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Todo pagado</p>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">{selectedMonth} está al día</p>
          </div>
        )}

        {/* ── Pagado ── */}
        {paidBills.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 px-1">
              Pagado ✓
            </h3>
            <div className="space-y-2">
              {paidBills.map(bill => {
                const hist = histEntry(bill.id);
                return (
                  <div
                    key={bill.id}
                    className="bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/40 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <Check size={16} className="text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-500 dark:text-zinc-400 text-[15px] truncate">{bill.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
                            {bill.currency === 'USD' ? '$' : 'S/'} {(hist?.amount ?? bill.amount).toLocaleString('es-PE')}
                          </span>
                          {hist?.paidBy && (
                            <span className="text-[12px] text-zinc-400">· {roommateName(hist.paidBy)}</span>
                          )}
                          {hist?.datePaid && (
                            <span className="text-[12px] text-zinc-400">· {formatDate(hist.datePaid)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => markUnpaid(bill)}
                        className="text-[12px] text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 active:scale-90 transition-all px-2 py-1 flex-shrink-0"
                      >
                        Deshacer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {bills.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              <Clock size={28} className="text-zinc-400" />
            </div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Sin gastos recurrentes</p>
            <p className="text-[13px] text-zinc-400 mt-1 max-w-[220px]">
              Agregá tus servicios y pagos fijos para hacer seguimiento cada mes.
            </p>
            <button
              onClick={openAdd}
              className="mt-4 h-10 px-5 bg-indigo-600 text-white text-[14px] font-semibold rounded-xl active:scale-95 transition-all"
            >
              Agregar gasto recurrente
            </button>
          </div>
        )}

        {/* ── Variable reminders ── */}
        {variableReminders.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 px-1">
              Recordatorios periódicos
            </h3>
            <div className="space-y-2">
              {variableReminders.map(rem => {
                const days = daysSince(rem.lastDone);
                const overdue = days !== null && days >= rem.frequencyDays;
                return (
                  <div
                    key={rem.id}
                    className="bg-white dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 p-4 flex items-center gap-3"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                      <Clock size={16} className={overdue ? 'text-amber-500' : 'text-zinc-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-[14px] truncate">{rem.name}</p>
                      <p className="text-[12px] text-zinc-400 mt-0.5">
                        {freqLabel(rem.frequencyDays)}
                        {days !== null ? ` · hace ${days}d` : ' · nunca hecho'}
                      </p>
                    </div>
                    <button
                      onClick={() => onMarkVariableReminderDone?.(rem.id)}
                      className={`h-8 px-3 rounded-xl text-[13px] font-medium active:scale-95 transition-all ${overdue ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                    >
                      Hecho
                    </button>
                    <button
                      onClick={() => onRemoveVariableReminder?.(rem.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-300 hover:text-red-400 active:scale-90 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Payment bottom sheet
      ═══════════════════════════════════════════════════════════════════════ */}
      {paymentBill && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closePayment} />
          <div className="relative w-full bg-white dark:bg-zinc-900 rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '92dvh' }}>

            {/* Header — fixed inside sheet */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-[17px]">Registrar pago</p>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">{paymentBill.name} · {selectedMonth}</p>
              </div>
              <button
                onClick={closePayment}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 active:scale-90 transition-all"
              >
                <X size={16} className="text-zinc-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-2 space-y-4" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

              {/* Monto */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Monto</label>
                <div className="mt-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[15px] font-medium">S/</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full h-12 pl-9 pr-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold text-[16px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Quién pagó */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">¿Quién pagó?</label>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {roommates.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setPayPaidBy(r.id)}
                      className={`h-9 px-4 rounded-xl text-[14px] font-medium transition-all active:scale-95 ${payPaidBy === r.id ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* División */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">División</label>
                <select
                  value={paySplitType}
                  onChange={e => setPaySplitType(e.target.value as SplitType)}
                  className="mt-1 w-full h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SPLIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* % personalizado — only shown when porcentaje */}
              {paySplitType === 'porcentaje' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">% por persona</label>
                    <span className={`text-[12px] font-semibold ${paySplitsTotal === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      Total: {paySplitsTotal}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {roommates.map(r => (
                      <div key={r.id} className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                          style={{ backgroundColor: r.color }}
                        >
                          {r.name.charAt(0)}
                        </div>
                        <span className="flex-1 text-[14px] text-zinc-800 dark:text-zinc-200 font-medium">{r.name}</span>
                        <div className="relative w-24">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            value={paySplits[r.id] ?? '0'}
                            onChange={e => setPaySplits(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full h-10 pr-7 pl-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {Math.abs(paySplitsTotal - 100) > 0.1 && (
                    <p className="mt-2 text-[12px] text-amber-500">Los porcentajes deben sumar 100%</p>
                  )}
                </div>
              )}

              {/* Fecha */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Fecha de pago</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="mt-1 w-full h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Confirm button — fixed at bottom, clears nav bar */}
            <div className="px-6 pt-3 flex-shrink-0" style={{ paddingBottom: 'calc(16px + 56px + env(safe-area-inset-bottom))' }}>
              <button
                onClick={confirmPayment}
                disabled={!payPaidBy || (paySplitType === 'porcentaje' && Math.abs(paySplitsTotal - 100) > 0.1)}
                className="w-full h-12 bg-indigo-600 disabled:opacity-40 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-[15px] rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Check size={17} />
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Add / Edit template bottom sheet
      ═══════════════════════════════════════════════════════════════════════ */}
      {editBill !== null && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEdit} />
          <div
            className="relative w-full bg-white dark:bg-zinc-900 rounded-t-3xl animate-slide-up flex flex-col"
            style={{ maxHeight: '92dvh' }}
          >
            {/* Header — fixed */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <p className="font-bold text-zinc-900 dark:text-zinc-100 text-[17px]">
                {editBill === 'new' ? 'Nuevo recurrente' : 'Editar recurrente'}
              </p>
              <button
                onClick={closeEdit}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 active:scale-90 transition-all"
              >
                <X size={16} className="text-zinc-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-2 space-y-4" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

              {/* Nombre */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Nombre</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Luz Enel, Netflix, Gas..."
                  className="mt-1 w-full h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Monto */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Monto estimado</label>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[15px] font-medium">
                      {editForm.currency === 'USD' ? '$' : 'S/'}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={editForm.amount}
                      onChange={e => setEditForm(f => ({ ...f, amount: e.target.value ? parseFloat(e.target.value) : '' }))}
                      className="w-full h-12 pl-9 pr-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold text-[16px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 gap-1 flex-shrink-0">
                    {(['PEN', 'USD'] as const).map(c => (
                      <button key={c} type="button"
                        onClick={() => setEditForm(f => ({ ...f, currency: c }))}
                        className={`px-3 h-10 rounded-lg text-[12px] font-bold transition active:scale-95 ${editForm.currency === c ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {c === 'PEN' ? 'S/.' : '$'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vencimiento */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Vencimiento</label>
                <input
                  type="text"
                  value={editForm.dueDate}
                  onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
                  placeholder="Ej: 15 de cada mes"
                  className="mt-1 w-full h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Categoría</label>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {CATEGORY_OPTIONS.map(cat => {
                    const s = catStyle(cat);
                    const active = editForm.category === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setEditForm(f => ({ ...f, category: cat }))}
                        className={`h-8 px-3 rounded-xl text-[12px] font-medium transition-all active:scale-95 ${active ? `${s.bg} ${s.text} ring-2 ring-indigo-500 ring-offset-1` : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* División por defecto */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">División por defecto</label>
                <select
                  value={editSplit}
                  onChange={e => setEditSplit(e.target.value as SplitType)}
                  className="mt-1 w-full h-12 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SPLIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* Equitativo preview */}
                {editSplit === 'equitativo' && roommates.length > 0 && (
                  <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-1">
                    {roommates.map((r, i) => {
                      const base = parseFloat((100 / roommates.length).toFixed(1));
                      const pct = i === roommates.length - 1 ? +(100 - base * (roommates.length - 1)).toFixed(1) : base;
                      return (
                        <div key={r.id} className="flex items-center justify-between text-[13px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">{r.name}</span>
                          </div>
                          <span className="text-zinc-500 font-semibold">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Proporcional preview */}
                {editSplit === 'proporcional' && roommates.length > 0 && (() => {
                  const total = roommates.reduce((s, r) => s + r.income, 0);
                  return total > 0 ? (
                    <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-1">
                      {roommates.map(r => (
                        <div key={r.id} className="flex items-center justify-between text-[13px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">{r.name}</span>
                          </div>
                          <span className="text-zinc-500 font-semibold">{(r.income / total * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] text-amber-500">Configura los ingresos de cada roommate primero.</p>
                  );
                })()}

                {/* % personalizado inputs */}
                {editSplit === 'porcentaje' && roommates.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[12px] font-semibold ${Math.abs(roommates.reduce((a, r) => a + (parseFloat(editForm.customSplits[r.id]) || 0), 0) - 100) < 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        Total: {roommates.reduce((a, r) => a + (parseFloat(editForm.customSplits[r.id]) || 0), 0).toFixed(1)}%
                      </span>
                      <button type="button"
                        onClick={() => {
                          const eq = Math.round((100 / roommates.length) * 100) / 100;
                          const p: Record<string, string> = {};
                          roommates.forEach((r, i) => { p[r.id] = String(i === roommates.length - 1 ? Math.round((100 - eq * (roommates.length - 1)) * 100) / 100 : eq); });
                          setEditForm(f => ({ ...f, customSplits: p }));
                        }}
                        className="text-[12px] text-indigo-500 font-semibold">
                        Resetear equitativo
                      </button>
                    </div>
                    {roommates.map(r => (
                      <div key={r.id} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ backgroundColor: r.color }}>{r.name.charAt(0)}</div>
                        <span className="flex-1 text-[14px] text-zinc-800 dark:text-zinc-200 font-medium">{r.name}</span>
                        <div className="relative w-24">
                          <input type="number" inputMode="decimal" min={0} max={100}
                            value={editForm.customSplits[r.id] ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, customSplits: { ...f.customSplits, [r.id]: e.target.value } }))}
                            className="w-full h-10 pr-7 pl-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px] pointer-events-none">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Débito automático */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Débito automático</p>
                  <p className="text-[12px] text-zinc-400 mt-0.5">Se cobra sin acción manual</p>
                </div>
                <button
                  onClick={() => setEditForm(f => ({ ...f, isAutoDebit: !f.isAutoDebit }))}
                  className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${editForm.isAutoDebit ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${editForm.isAutoDebit ? 'left-[calc(100%-26px)]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Notas */}
              <div>
                <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Notas (opcional)</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ej: Tarjeta de Sofía afiliada..."
                  rows={2}
                  className="mt-1 w-full px-3 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Confirm button — fixed at bottom, clears nav bar */}
            <div className="px-6 pt-3 flex-shrink-0" style={{ paddingBottom: 'calc(16px + 56px + env(safe-area-inset-bottom))' }}>
              <button
                onClick={confirmEdit}
                disabled={!editForm.name || !editForm.amount}
                className="w-full h-12 bg-indigo-600 disabled:opacity-40 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-[15px] rounded-2xl transition-all"
              >
                {editBill === 'new' ? 'Agregar recurrente' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Confirm delete dialog
      ═══════════════════════════════════════════════════════════════════════ */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-xs animate-slide-up text-center">
            <p className="font-bold text-zinc-900 dark:text-zinc-100 text-[17px]">¿Eliminar recurrente?</p>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              No aparecerá más en meses futuros. El historial de pagos se mantiene.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-[14px] active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => { onRemoveBill(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white font-semibold text-[14px] active:scale-95 transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
