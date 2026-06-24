import React, { useState } from 'react';
import { RecurrentBill, RecurrentBillHistory, Roommate, ExpenseCategory } from '../types';
import { CATEGORY_LABELS } from '../utils';
import { Plus, Edit2, Trash2, X, ChevronRight } from 'lucide-react';

const SPLIT_OPTIONS = [
  { value: 'equitativo',   label: 'Equitativo' },
  { value: 'proporcional', label: 'Proporcional a ingresos' },
  { value: 'no_dividir',   label: 'No dividir' },
  { value: 'porcentaje',   label: '% personalizado' },
];

const CATEGORY_OPTIONS: ExpenseCategory[] = [
  'alquiler', 'membresia', 'auto', 'servicio', 'comida', 'limpieza', 'otros',
];

type SplitType = 'no_dividir' | 'equitativo' | 'proporcional' | 'porcentaje';

const EMPTY_EDIT = {
  name: '',
  amount: '' as number | '',
  notes: '',
  category: 'servicio' as ExpenseCategory,
  splitType: 'equitativo' as SplitType,
  currency: 'PEN' as 'PEN' | 'USD',
  customSplits: {} as Record<string, string>,
};

interface Props {
  roommates: Roommate[];
  allRoommates?: Roommate[];
  bills: RecurrentBill[];
  billHistory: RecurrentBillHistory[];
  onUpdateBillStatus: (id: string, status: 'pagado' | 'por pagar', config?: any) => void;
  onAddBill: (bill: RecurrentBill) => void;
  onRemoveBill: (id: string) => void;
  onSendBillAlert: (id: string, message: string) => void;
  onUpdateBill: (bill: RecurrentBill) => void;
  onRemoveHistoryEntry: (id: string) => void;
  onUpdateHistoryEntry: (entry: RecurrentBillHistory) => void;
  onNavigateTab?: (tab: string) => void;
  onPrefillBillInExpenses?: (billId: string) => void;
  onDiscardBillForMonth?: (billId: string, month: string) => void;
  variableReminders?: any[];
  onAddVariableReminder?: (r: any) => void;
  onRemoveVariableReminder?: (id: string) => void;
  onMarkVariableReminderDone?: (id: string) => void;
}

export default function RecurrentBillsTab({
  roommates,
  allRoommates,
  bills,
  onAddBill,
  onRemoveBill,
  onUpdateBill,
  onPrefillBillInExpenses,
}: Props) {
  const resolved = allRoommates || roommates;

  const [editBill, setEditBill] = useState<RecurrentBill | 'new' | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editSplit, setEditSplit] = useState<SplitType>('equitativo');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openAdd = () => {
    const equal = Math.round((100 / roommates.length) * 100) / 100;
    const initSplits: Record<string, string> = {};
    roommates.forEach((r, i) => {
      initSplits[r.id] = String(i === roommates.length - 1
        ? Math.round((100 - equal * (roommates.length - 1)) * 100) / 100
        : equal);
    });
    setEditForm({ ...EMPTY_EDIT, customSplits: initSplits });
    setEditSplit('equitativo');
    setEditBill('new');
  };

  const openEdit = (bill: RecurrentBill) => {
    const equal = Math.round((100 / roommates.length) * 100) / 100;
    const initSplits: Record<string, string> = {};
    roommates.forEach((r, i) => {
      const val = bill.splits?.[r.id] ?? (i === roommates.length - 1
        ? Math.round((100 - equal * (roommates.length - 1)) * 100) / 100
        : equal);
      initSplits[r.id] = String(val);
    });
    setEditForm({
      name: bill.name,
      amount: bill.amount,
      notes: bill.notes || '',
      category: bill.category || 'servicio',
      splitType: (bill.splitType as SplitType) || 'equitativo',
      currency: bill.currency || 'PEN',
      customSplits: initSplits,
    });
    setEditSplit((bill.splitType as SplitType) || 'equitativo');
    setEditBill(bill);
  };

  const confirmEdit = () => {
    if (!editBill || !editForm.name || !editForm.amount) return;
    const amount = typeof editForm.amount === 'number'
      ? editForm.amount
      : parseFloat(String(editForm.amount));
    const splits = editSplit === 'porcentaje'
      ? Object.fromEntries(Object.entries(editForm.customSplits).map(([k, v]) => [k, parseFloat(v as string) || 0]))
      : undefined;

    if (editBill === 'new') {
      onAddBill({
        id: crypto.randomUUID(),
        name: editForm.name,
        amount,
        dueDate: '',
        notes: editForm.notes || undefined,
        category: editForm.category,
        isAutoDebit: false,
        splitType: editSplit,
        splits,
        currency: editForm.currency,
        exchangeRate: 1,
        status: 'por pagar',
        alertSent: false,
      });
    } else {
      onUpdateBill({
        ...(editBill as RecurrentBill),
        name: editForm.name,
        amount,
        notes: editForm.notes || undefined,
        category: editForm.category,
        splitType: editSplit,
        splits,
        currency: editForm.currency,
      });
    }
    setEditBill(null);
  };

  const splitsTotal = (Object.values(editForm.customSplits) as string[]).reduce((s: number, v: string) => s + (parseFloat(v) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Gastos Recurrentes</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Plantillas para registrar gastos rápido</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-3 h-9 rounded-xl transition-all active:scale-95"
        >
          <Plus size={16} /> Agregar
        </button>
      </div>

      {/* List */}
      {bills.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="font-semibold text-sm">Sin gastos recurrentes</p>
          <p className="text-xs mt-1">Agrega plantillas para registrar gastos más rápido</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map(bill => (
            <div key={bill.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-medium">
                      {CATEGORY_LABELS[bill.category || 'otros']?.label || bill.category}
                    </span>
                    {bill.currency === 'USD' && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-2 py-0.5 rounded-full font-medium">USD</span>
                    )}
                  </div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-1">{bill.name}</p>
                  <p className="text-sm text-zinc-500">
                    {bill.currency === 'USD' ? '$' : 'S/'}{bill.amount.toFixed(2)}
                    {' · '}<span className="whitespace-nowrap">{SPLIT_OPTIONS.find(s => s.value === bill.splitType)?.label || 'Equitativo'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {onPrefillBillInExpenses && (
                    <button
                      onClick={() => onPrefillBillInExpenses(bill.id)}
                      className="h-9 px-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                    >
                      Registrar <ChevronRight size={14} />
                    </button>
                  )}
                  <button onClick={() => openEdit(bill)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => setConfirmDelete(bill.id)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-rose-500 transition">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm space-y-4">
            <p className="font-bold text-zinc-900 dark:text-zinc-100 text-center">¿Eliminar este gasto recurrente?</p>
            <p className="text-sm text-zinc-500 text-center">Los gastos ya registrados no se eliminarán.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-sm">Cancelar</button>
              <button onClick={() => { onRemoveBill(confirmDelete); setConfirmDelete(null); }} className="flex-1 h-11 rounded-2xl bg-rose-500 text-white font-bold text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit sheet */}
      {editBill !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-lg p-6 pb-32 space-y-4 max-h-[90vh] overflow-y-auto" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-zinc-900 dark:text-zinc-100">
                {editBill === 'new' ? 'Nuevo gasto recurrente' : 'Editar gasto recurrente'}
              </h3>
              <button onClick={() => setEditBill(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Nombre</label>
              <input
                type="text" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Luz Enel"
                className="mt-1 w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Monto</label>
                <div className="mt-1 flex gap-1">
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5 shrink-0">
                    {(['PEN', 'USD'] as const).map(c => (
                      <button key={c} type="button" onClick={() => setEditForm(f => ({ ...f, currency: c }))}
                        className={`px-2 h-8 rounded-lg text-[10px] font-bold transition ${editForm.currency === c ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
                        {c === 'PEN' ? 'S/' : '$'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" inputMode="decimal" value={editForm.amount}
                    onChange={e => setEditForm(f => ({ ...f, amount: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                    className="flex-1 h-9 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Categoría</label>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]?.label || c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">División</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {SPLIT_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setEditSplit(o.value as SplitType)}
                    className={`px-3 h-8 rounded-xl text-xs font-semibold transition ${editSplit === o.value ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {editSplit === 'porcentaje' && (
                <div className="mt-3 space-y-2">
                  {resolved.map(r => (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{r.name}</span>
                      <input
                        type="number" inputMode="decimal"
                        value={editForm.customSplits[r.id] ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, customSplits: { ...f.customSplits, [r.id]: e.target.value } }))}
                        className="w-20 h-8 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-zinc-400">%</span>
                    </div>
                  ))}
                  <p className={`text-xs font-semibold ${Math.abs(splitsTotal - 100) < 0.1 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Total: {splitsTotal.toFixed(1)}% {Math.abs(splitsTotal - 100) < 0.1 ? '✓' : '(debe ser 100%)'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Notas (opcional)</label>
              <input
                type="text" value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ej. Vence el 15 de cada mes"
                className="mt-1 w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={confirmEdit}
              disabled={!editForm.name || !editForm.amount || (editSplit === 'porcentaje' && Math.abs(splitsTotal - 100) >= 0.1)}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              {editBill === 'new' ? 'Agregar' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
