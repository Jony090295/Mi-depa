import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Roommate, Expense, RecurrentBill, RecurrentBillHistory, ShoppingItem, ForumPost, ForumReply, SettlementRecord, VariableReminder } from './types';
import { calculateSettlements } from './utils';

// Auth + Supabase
import { useAuth } from './hooks/useAuth';
import { useApartmentData } from './hooks/useApartmentData';
import AuthScreen from './components/AuthScreen';
import ApartmentSetupScreen from './components/ApartmentSetupScreen';

// Components
import ExpensesTab from './components/ExpensesTab';
import RecurrentBillsTab from './components/RecurrentBillsTab';
import ShoppingTab from './components/ShoppingTab';
import CommunityTab from './components/CommunityTab';
import ProjectedBudget from './components/ProjectedBudget';

// Icons
import {
  Home, Split, Clock, ShoppingCart, Users, BellRing, ChevronRight,
  Moon, Sun, Settings, Check, ArrowRight, Plus, Pencil, Trash2, TrendingUp, Loader, Copy, LogOut,
} from 'lucide-react';

// ─── Auth shell ──────────────────────────────────────────────────────────────

export default function AppShell() {
  const { session, user, loading } = useAuth();

  // Persist join code across auth redirects
  const urlJoinCode = new URLSearchParams(window.location.search).get('join');
  if (urlJoinCode) sessionStorage.setItem('pendingJoinCode', urlJoinCode);
  const joinCode = urlJoinCode ?? sessionStorage.getItem('pendingJoinCode') ?? undefined;

  if (loading) {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader size={28} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!session || !user) return <AuthScreen joinCode={joinCode || undefined} />;

  return <AppMain user={user} joinCode={joinCode || undefined} />;
}

// ─── Main app ────────────────────────────────────────────────────────────────

function AppMain({ user, joinCode }: { user: User; joinCode?: string }) {
  const data = useApartmentData(user);

  const {
    loading: dataLoading, noApartment, onboardingComplete, reload,
    aptConfig, roommates, expenses, bills, billHistory,
    shoppingItems, posts, trustedServices, settlementHistory,
    setExpenses, setBills, setBillHistory,
    updateApartmentConfig, updateRoommates,
    addExpense, updateExpense, removeExpense,
    addBill, updateBill, removeBill,
    addBillHistory, removeBillHistory, updateBillHistoryEntry,
    addShoppingItem, toggleShoppingItem, removeShoppingItem, updateShoppingItem, clearShoppingList,
    addSettlement, addPost, updatePost, deletePost, addReply,
    addTrustedService, updateTrustedService, deleteTrustedService,
  } = data;

  // ── Derived config values ─────────────────────────────────────────────────
  const apartmentName   = aptConfig?.name            ?? '';
  const rentCost        = aptConfig?.rentCost        ?? 0;
  const rentCurrency    = aptConfig?.rentCurrency    ?? 'PEN';
  const rentExchangeRate = aptConfig?.rentExchangeRate ?? 3.80;
  const maintenanceCost = aptConfig?.maintenanceCost ?? 0;

  // ── UI-only state ─────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('depa_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('depa_dark_mode', String(darkMode));
  }, [darkMode]);

  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'expenses' | 'bills' | 'shopping' | 'directory' | 'forum' | 'projected_budget'>('budget');
  const [environment, setEnvironment] = useState<'depa' | 'comunidad'>('depa');
  const [globalAlert, setGlobalAlert] = useState<string | null>(null);
  const [prefilledBillId, setPrefilledBillId] = useState<string>('');

  // Home config form state (synced from aptConfig when it loads)
  const [homeConfigOpen, setHomeConfigOpen]       = useState(false);
  const [codeCopied, setCodeCopied]               = useState(false);
  const [homeApartmentName, setHomeApartmentName] = useState('');
  const [homeAddress, setHomeAddress]             = useState('');
  const [homeRentCost, setHomeRentCost]           = useState(0);
  const [homeRentCurrency, setHomeRentCurrency]   = useState<'PEN'|'USD'>('PEN');
  const [homeRentExRate, setHomeRentExRate]        = useState(3.80);
  const [homeMaintenanceCost, setHomeMaintenanceCost] = useState(0);
  const [homeDefaultSplit, setHomeDefaultSplit] = useState<'equitativo'|'proporcional'|'porcentaje'>('equitativo');
  const [homeDefaultPercs, setHomeDefaultPercs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (aptConfig) {
      setHomeApartmentName(aptConfig.name);
      setHomeAddress(aptConfig.address ?? '');
      setHomeRentCost(aptConfig.rentCost);
      setHomeRentCurrency(aptConfig.rentCurrency);
      setHomeRentExRate(aptConfig.rentExchangeRate);
      setHomeMaintenanceCost(aptConfig.maintenanceCost);
      setHomeDefaultSplit(aptConfig.defaultSplitType ?? 'equitativo');
      setHomeDefaultPercs(Object.fromEntries(Object.entries(aptConfig.defaultSplitPercentages ?? {}).map(([k,v]) => [k, String(v)])));
    }
  }, [aptConfig?.id]);

  // Roommate form state
  const [editingRoommateId, setEditingRoommateId] = useState<string | null>(null);
  const [newRoommateName, setNewRoommateName]     = useState('');
  const [newRoommateIncome, setNewRoommateIncome] = useState<number | ''>('');

  // Deleted roommates tracked locally for history display
  const [deletedRoommates, setDeletedRoommates]   = useState<Roommate[]>([]);

  // Variable reminders — not yet in schema, keep in localStorage
  const [variableReminders, setVariableReminders] = useState<VariableReminder[]>(() => {
    const saved = localStorage.getItem('depa_variable_reminders');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => {
    localStorage.setItem('depa_variable_reminders', JSON.stringify(variableReminders));
  }, [variableReminders]);

  useEffect(() => {
    if (environment === 'depa' && !['projected_budget', 'budget', 'expenses', 'bills', 'shopping'].includes(activeTab)) {
      setActiveTab('budget');
    } else if (environment === 'comunidad' && !['directory', 'forum'].includes(activeTab)) {
      setActiveTab('forum');
    }
  }, [environment]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentMonthYearString = () => {
    const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getMonthYearStringFromDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return '';
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return monthIdx >= 0 && monthIdx < 12 ? `${months[monthIdx]} ${year}` : '';
  };

  const calculateSharesForBill = (
    amount: number,
    splitType: 'porcentaje' | 'proporcional' | 'equitativo',
    paidBy: string,
    splitsSetting: Record<string, number> | undefined,
    currentRoommates: Roommate[]
  ) => {
    let splitsRecord: Record<string, number> = {};
    let calculatedShares: Record<string, number> = {};
    const totalIncome = currentRoommates.reduce((sum, r) => sum + r.income, 0);

    if (splitType === 'equitativo') {
      const share = amount / currentRoommates.length;
      currentRoommates.forEach(r => {
        splitsRecord[r.id] = 100 / currentRoommates.length;
        calculatedShares[r.id] = parseFloat(share.toFixed(2));
      });
    } else if (splitType === 'proporcional') {
      if (totalIncome > 0) {
        currentRoommates.forEach(r => {
          const pct = (r.income / totalIncome) * 100;
          splitsRecord[r.id] = parseFloat(pct.toFixed(2));
          calculatedShares[r.id] = parseFloat(((r.income / totalIncome) * amount).toFixed(2));
        });
      } else {
        const share = amount / currentRoommates.length;
        currentRoommates.forEach(r => {
          splitsRecord[r.id] = 100 / currentRoommates.length;
          calculatedShares[r.id] = parseFloat(share.toFixed(2));
        });
      }
    } else if (splitType === 'porcentaje') {
      const percentagesMap = splitsSetting || {};
      currentRoommates.forEach(r => {
        const pct = percentagesMap[r.id] || 0;
        splitsRecord[r.id] = pct;
        calculatedShares[r.id] = parseFloat(((pct / 100) * amount).toFixed(2));
      });
    }

    const sumShares = currentRoommates.reduce((acc, r) => acc + (calculatedShares[r.id] || 0), 0);
    const diff = amount - sumShares;
    if (Math.abs(diff) > 0.001 && currentRoommates.length > 0) {
      const firstId = currentRoommates[0].id;
      calculatedShares[firstId] = parseFloat((calculatedShares[firstId] + diff).toFixed(2));
    }

    return { splitsRecord, calculatedShares };
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUpdateApartmentNameAndRent = async (
    name: string, rent: number, currency: 'PEN' | 'USD' = 'PEN',
    exchangeRate: number = 3.80, maintenance: number = 0, address: string = ''
  ) => {
    const defaultSplitPercentages = Object.fromEntries(Object.entries(homeDefaultPercs).map(([k,v]) => [k, parseFloat(v as string)||0]));
    await updateApartmentConfig({ name, address, rentCost: rent, rentCurrency: currency, rentExchangeRate: exchangeRate, maintenanceCost: maintenance, defaultSplitType: homeDefaultSplit, defaultSplitPercentages });

    // Sync matching bills
    const rentBill = bills.find(b => b.name.toLowerCase().includes('alquiler'));
    if (rentBill) {
      await updateBill({ ...rentBill, amount: rent, currency, exchangeRate: currency === 'USD' ? exchangeRate : 1 });
    }
    const maintBill = bills.find(b => b.name.toLowerCase().includes('mantenimiento'));
    if (maintBill) {
      await updateBill({ ...maintBill, amount: maintenance, currency: 'PEN', exchangeRate: 1 });
    }
  };

  const handleUpdateRoommates = async (updated: Roommate[]) => {
    const removed = roommates.filter(r => !updated.some(u => u.id === r.id));
    if (removed.length) {
      setDeletedRoommates(prev => {
        const next = [...prev];
        removed.forEach(r => { if (!next.some(d => d.id === r.id)) next.push(r); });
        return next;
      });
    }
    await updateRoommates(updated);
  };

  const handleAddExpense = async (exp: Expense) => {
    await addExpense(exp);

    if (exp.recurrentBillId) {
      const monthPaidFor = exp.recurrentBillMonth || getMonthYearStringFromDate(exp.date) || getCurrentMonthYearString();
      const bill = bills.find(b => b.id === exp.recurrentBillId);
      if (bill) {
        const historyId = `hist-${exp.id}`;
        const newEntry: RecurrentBillHistory = {
          id: historyId, billId: bill.id, name: bill.name, amount: exp.amount,
          dueDate: bill.dueDate, notes: bill.notes, paidBy: exp.paidBy,
          splitType: exp.splitType || 'no_dividir', splits: exp.splits,
          currency: exp.currency || 'PEN', exchangeRate: exp.exchangeRate || 1,
          monthPaidFor, datePaid: exp.date, status: 'pagado',
        };
        // Remove conflicting history for same bill+month
        const conflict = billHistory.find(h => h.billId === bill.id && h.monthPaidFor === monthPaidFor && h.id !== historyId);
        if (conflict) await removeBillHistory(conflict.id);
        await addBillHistory(newEntry);

        if (monthPaidFor === getCurrentMonthYearString()) {
          await updateBill({ ...bill, status: 'pagado', associatedExpenseId: exp.id });
        }
      }
    }
  };

  const handleUpdateExpense = async (updated: Expense) => {
    const oldExp = expenses.find(e => e.id === updated.id);
    if (oldExp && oldExp.recurrentBillId && oldExp.recurrentBillId !== updated.recurrentBillId) {
      const historyId = `hist-${oldExp.id}`;
      const oldMonth = oldExp.recurrentBillMonth || getMonthYearStringFromDate(oldExp.date) || getCurrentMonthYearString();
      await removeBillHistory(historyId);
      if (oldMonth === getCurrentMonthYearString()) {
        const oldBill = bills.find(b => b.id === oldExp.recurrentBillId);
        if (oldBill) await updateBill({ ...oldBill, status: 'por pagar', associatedExpenseId: undefined });
      }
    }

    await updateExpense(updated);

    if (updated.recurrentBillId) {
      const monthPaidFor = updated.recurrentBillMonth || getMonthYearStringFromDate(updated.date) || getCurrentMonthYearString();
      const bill = bills.find(b => b.id === updated.recurrentBillId);
      if (bill) {
        const historyId = `hist-${updated.id}`;
        const newEntry: RecurrentBillHistory = {
          id: historyId, billId: bill.id, name: bill.name, amount: updated.amount,
          dueDate: bill.dueDate, notes: bill.notes, paidBy: updated.paidBy,
          splitType: updated.splitType || 'no_dividir', splits: updated.splits,
          currency: updated.currency || 'PEN', exchangeRate: updated.exchangeRate || 1,
          monthPaidFor, datePaid: updated.date, status: 'pagado',
        };
        const conflict = billHistory.find(h => h.billId === bill.id && h.monthPaidFor === monthPaidFor && h.id !== historyId);
        if (conflict) await removeBillHistory(conflict.id);
        await addBillHistory(newEntry);
        if (monthPaidFor === getCurrentMonthYearString()) {
          await updateBill({ ...bill, status: 'pagado', associatedExpenseId: updated.id });
        }
      }
    }
  };

  const handleRemoveExpense = async (id: string) => {
    const oldExp = expenses.find(e => e.id === id);
    if (oldExp && oldExp.recurrentBillId) {
      const historyId = `hist-${oldExp.id}`;
      const monthPaidFor = oldExp.recurrentBillMonth || getMonthYearStringFromDate(oldExp.date) || getCurrentMonthYearString();
      await removeBillHistory(historyId);
      if (monthPaidFor === getCurrentMonthYearString()) {
        const bill = bills.find(b => b.id === oldExp.recurrentBillId);
        if (bill) await updateBill({ ...bill, status: 'por pagar', associatedExpenseId: undefined });
      }
    }
    await removeExpense(id);
  };

  const handleUpdateBillStatus = async (
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
  ) => {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;

    let updatedBill = { ...bill, status, alertSent: false };
    if (customSplitConfig) {
      updatedBill.paidBy = customSplitConfig.paidBy;
      updatedBill.splitType = customSplitConfig.splitType;
      updatedBill.splits = customSplitConfig.splits;
    }

    if (status === 'pagado') {
      const splitTypeToUse = customSplitConfig ? customSplitConfig.splitType : (bill.splitType || 'no_dividir');
      const paidByToUse    = customSplitConfig ? customSplitConfig.paidBy    : (bill.paidBy || roommates[0]?.id || '');
      const splitsToUse    = customSplitConfig ? customSplitConfig.splits    : bill.splits;
      const monthPaidFor   = customSplitConfig?.monthPaidFor || getCurrentMonthYearString();
      const datePaid       = customSplitConfig?.datePaid || new Date().toISOString().split('T')[0];
      const amountToUse    = (customSplitConfig && customSplitConfig.amount !== undefined) ? customSplitConfig.amount : bill.amount;

      const historyId = `hist-${bill.id}-${Date.now()}`;
      const newEntry: RecurrentBillHistory = {
        id: historyId, billId: bill.id, name: bill.name, amount: amountToUse,
        dueDate: bill.dueDate, notes: bill.notes, paidBy: paidByToUse,
        splitType: splitTypeToUse, splits: splitsToUse,
        currency: bill.currency || 'PEN', exchangeRate: bill.exchangeRate || 1,
        monthPaidFor, datePaid, status: 'pagado',
        category: bill.category || 'servicio', isAutoDebit: bill.isAutoDebit,
      };
      await addBillHistory(newEntry);

      const mustSplit = splitTypeToUse && splitTypeToUse !== 'no_dividir' && paidByToUse;
      if (mustSplit) {
        const expenseId = bill.associatedExpenseId || `expense-bill-${bill.id}`;
        const { splitsRecord, calculatedShares } = calculateSharesForBill(
          amountToUse, splitTypeToUse as 'porcentaje' | 'proporcional' | 'equitativo',
          paidByToUse!, splitsToUse, roommates
        );
        const billCurrency     = bill.currency || 'PEN';
        const billExchangeRate = bill.currency === 'USD' ? (bill.exchangeRate || 3.80) : 1;
        const newExpense: Expense = {
          id: expenseId, title: `[Pago Recurrente] ${bill.name} (${monthPaidFor})`,
          amount: amountToUse, category: bill.category || 'servicio',
          paidBy: paidByToUse!, date: datePaid,
          splitType: splitTypeToUse as 'porcentaje' | 'proporcional' | 'equitativo',
          splits: splitsRecord, calculatedShares, currency: billCurrency, exchangeRate: billExchangeRate,
        };
        if (expenses.some(e => e.id === expenseId)) {
          await updateExpense(newExpense);
        } else {
          await addExpense(newExpense);
        }
        updatedBill.associatedExpenseId = expenseId;
      } else {
        if (bill.associatedExpenseId) {
          await removeExpense(bill.associatedExpenseId);
          updatedBill.associatedExpenseId = undefined;
        }
      }
    } else {
      const targetMonth = customSplitConfig?.monthPaidFor || getCurrentMonthYearString();
      const expToRemove = expenses.find(e =>
        e.id === bill.associatedExpenseId ||
        (e.recurrentBillId === id && (e.recurrentBillMonth === targetMonth || getMonthYearStringFromDate(e.date) === targetMonth))
      );
      if (expToRemove) await removeExpense(expToRemove.id);
      updatedBill.associatedExpenseId = undefined;
      const histToRemove = billHistory.find(h => h.billId === id && h.monthPaidFor === targetMonth);
      if (histToRemove) await removeBillHistory(histToRemove.id);
    }

    await updateBill(updatedBill);
  };

  const handleResetBillsForNewMonth = async () => {
    for (const b of bills) {
      await updateBill({ ...b, status: 'por pagar', alertSent: false, associatedExpenseId: undefined });
    }
  };

  useEffect(() => {
    if (!data.loading && bills.length > 0) {
      const currentMonthYear = getCurrentMonthYearString();
      const lastCycleMonth = localStorage.getItem('depa_last_cycle_month');
      if (!lastCycleMonth) {
        localStorage.setItem('depa_last_cycle_month', currentMonthYear);
      } else if (lastCycleMonth !== currentMonthYear) {
        handleResetBillsForNewMonth();
        localStorage.setItem('depa_last_cycle_month', currentMonthYear);
      }
    }
  }, [data.loading]);

  const handleRemoveHistoryEntry = async (historyId: string) => {
    const entry = billHistory.find(h => h.id === historyId);
    if (entry) {
      const expToRemove = expenses.find(e =>
        e.id === `expense-bill-${entry.billId}` ||
        e.id === historyId.replace('hist-', '') ||
        (e.recurrentBillId === entry.billId && (e.recurrentBillMonth === entry.monthPaidFor || getMonthYearStringFromDate(e.date) === entry.monthPaidFor))
      );
      if (expToRemove) await removeExpense(expToRemove.id);
      if (entry.monthPaidFor === getCurrentMonthYearString()) {
        const bill = bills.find(b => b.id === entry.billId);
        if (bill) await updateBill({ ...bill, status: 'por pagar', associatedExpenseId: undefined });
      }
    }
    await removeBillHistory(historyId);
  };

  const handleUpdateHistoryEntry = async (updatedEntry: RecurrentBillHistory) => {
    await updateBillHistoryEntry(updatedEntry);

    const expenseId = `expense-bill-${updatedEntry.billId}`;
    const entryStatus = updatedEntry.status || 'pagado';
    if (updatedEntry.splitType !== 'no_dividir' && entryStatus === 'pagado') {
      const { splitsRecord, calculatedShares } = calculateSharesForBill(
        updatedEntry.amount, updatedEntry.splitType as 'porcentaje' | 'proporcional' | 'equitativo',
        updatedEntry.paidBy, updatedEntry.splits, roommates
      );
      const billCurrency     = updatedEntry.currency || 'PEN';
      const billExchangeRate = updatedEntry.currency === 'USD' ? (updatedEntry.exchangeRate || 3.80) : 1;
      const updatedExpense: Expense = {
        id: expenseId, title: `[Pago Recurrente] ${updatedEntry.name} (${updatedEntry.monthPaidFor})`,
        amount: updatedEntry.amount, category: 'servicio', paidBy: updatedEntry.paidBy,
        date: updatedEntry.datePaid, splitType: updatedEntry.splitType as 'porcentaje' | 'proporcional' | 'equitativo',
        splits: splitsRecord, calculatedShares, currency: billCurrency, exchangeRate: billExchangeRate,
      };
      if (expenses.some(e => e.id === expenseId)) {
        await updateExpense(updatedExpense);
      } else {
        await addExpense(updatedExpense);
      }
    } else {
      if (expenses.some(e => e.id === expenseId)) await removeExpense(expenseId);
    }
  };

  const handleAddBill = async (bill: RecurrentBill) => {
    await addBill(bill);
  };

  const handleUpdateBill = async (updatedBill: RecurrentBill) => {
    await updateBill(updatedBill);

    const isRent = updatedBill.name.toLowerCase().includes('alquiler');
    const isMaint = updatedBill.name.toLowerCase().includes('mantenimiento');
    if (isRent) {
      await updateApartmentConfig({
        rentCost: updatedBill.amount,
        rentCurrency: updatedBill.currency as 'PEN'|'USD' ?? 'PEN',
        rentExchangeRate: updatedBill.exchangeRate ?? 3.80,
      });
    } else if (isMaint) {
      await updateApartmentConfig({ maintenanceCost: updatedBill.amount });
    }

    if (updatedBill.status === 'pagado' && updatedBill.associatedExpenseId) {
      const expenseId    = updatedBill.associatedExpenseId;
      const splitTypeToUse = updatedBill.splitType;
      const paidByToUse  = updatedBill.paidBy;
      const splitsToUse  = updatedBill.splits;
      const mustSplit    = splitTypeToUse && splitTypeToUse !== 'no_dividir' && paidByToUse;
      if (mustSplit) {
        const { splitsRecord, calculatedShares } = calculateSharesForBill(
          updatedBill.amount, splitTypeToUse as 'porcentaje' | 'proporcional' | 'equitativo',
          paidByToUse!, splitsToUse, roommates
        );
        const billCurrency     = updatedBill.currency || 'PEN';
        const billExchangeRate = updatedBill.currency === 'USD' ? (updatedBill.exchangeRate || 3.80) : 1;
        const updatedExpense: Expense = {
          id: expenseId, title: `[Pago Recurrente] ${updatedBill.name}`,
          amount: updatedBill.amount, category: updatedBill.category || 'servicio',
          paidBy: paidByToUse!, date: new Date().toISOString().split('T')[0],
          splitType: splitTypeToUse as 'porcentaje' | 'proporcional' | 'equitativo',
          splits: splitsRecord, calculatedShares, currency: billCurrency, exchangeRate: billExchangeRate,
        };
        if (expenses.some(e => e.id === expenseId)) await updateExpense(updatedExpense);
      } else {
        if (expenses.some(e => e.id === expenseId)) await removeExpense(expenseId);
      }
    }
  };

  const handleRemoveBill = async (id: string) => {
    const hasHistory = billHistory.some(h => h.billId === id);
    const bill = bills.find(b => b.id === id);
    if (bill) {
      const isRent = bill.name.toLowerCase().includes('alquiler');
      const isMaint = bill.name.toLowerCase().includes('mantenimiento');
      if (isRent) await updateApartmentConfig({ rentCost: 0 });
      else if (isMaint) await updateApartmentConfig({ maintenanceCost: 0 });
    }
    if (hasHistory) {
      await updateBill({ ...bill!, deletedAt: getCurrentMonthYearString() });
    } else {
      await removeBill(id);
    }
  };

  const handleDiscardBillForMonth = async (billId: string, month: string) => {
    const expToRemove = expenses.find(e =>
      e.recurrentBillId === billId && (e.recurrentBillMonth === month || getMonthYearStringFromDate(e.date) === month)
    );
    if (expToRemove) await removeExpense(expToRemove.id);

    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    const historyId = `hist-discarded-${billId}-${month.replace(' ', '-')}`;
    const discardedEntry: RecurrentBillHistory = {
      id: historyId, billId, name: bill.name, amount: bill.amount,
      dueDate: bill.dueDate, paidBy: bill.paidBy || roommates[0]?.id || '',
      splitType: bill.splitType || 'no_dividir', monthPaidFor: month,
      datePaid: new Date().toISOString().split('T')[0], status: 'descartado',
      category: bill.category || 'servicio', isAutoDebit: bill.isAutoDebit,
    };
    const oldEntry = billHistory.find(h => h.billId === billId && h.monthPaidFor === month);
    if (oldEntry) await removeBillHistory(oldEntry.id);
    await addBillHistory(discardedEntry);
  };

  const handleSendBillAlert = async (id: string, message: string) => {
    const bill = bills.find(b => b.id === id);
    if (bill) await updateBill({ ...bill, alertSent: true });
    setGlobalAlert(message);
    setTimeout(() => setGlobalAlert(null), 8000);
  };

  const handleAddShoppingItem = async (item: Omit<ShoppingItem, 'id'>) => {
    await addShoppingItem(item);
  };

  const handleToggleShoppingItem = async (id: string) => {
    await toggleShoppingItem(id);
  };

  const handleRemoveShoppingItem = async (id: string) => {
    await removeShoppingItem(id);
  };

  const handleClearShoppingList = async () => {
    await clearShoppingList();
  };

  const handleUpdateShoppingItem = async (id: string, updates: Partial<ShoppingItem>) => {
    await updateShoppingItem(id, updates);
  };

  const handleAddSettlement = async (record: SettlementRecord) => {
    await addSettlement(record);
  };

  const handleAddVariableReminder = (reminder: VariableReminder) => {
    setVariableReminders(prev => [reminder, ...prev]);
  };

  const handleRemoveVariableReminder = (id: string) => {
    setVariableReminders(prev => prev.filter(r => r.id !== id));
  };

  const handleMarkVariableReminderDone = (id: string) => {
    setVariableReminders(prev => prev.map(r => r.id === id ? { ...r, lastDone: new Date().toISOString().split('T')[0] } : r));
  };

  const handleAddPost = async (p: ForumPost) => {
    await addPost(p);
  };

  const handleAddReply = async (postId: string, reply: ForumReply) => {
    await addReply(postId, reply);
  };

  // ── Loading / setup screens ───────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader size={28} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (noApartment) {
    return <ApartmentSetupScreen user={user} onReady={reload} initialCode={joinCode} />;
  }

  if (!onboardingComplete && aptConfig) {
    return <ApartmentSetupScreen user={user} onReady={reload} resumeAptId={aptConfig.id} resumeInviteCode={aptConfig.inviteCode} />;
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const getCurrentMonthStr = () => {
    const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  const currentMonthStr = getCurrentMonthStr();

  const totalSharedSpentThisMonth = expenses
    .filter(e => getMonthYearStringFromDate(e.date) === currentMonthStr)
    .reduce((sum, e) => {
      const rate = e.currency === 'USD' ? (e.exchangeRate || 3.80) : 1;
      return sum + (e.amount * rate);
    }, 0);
  const pendingBillsCount  = bills.filter(b => b.status === 'por pagar').length;
  const paidBillsCount     = bills.filter(b => b.status === 'pagado').length;
  const pendingBillsAmount = bills.filter(b => b.status === 'por pagar').reduce((sum, b) => {
    const rate = b.currency === 'USD' ? (b.exchangeRate || 3.80) : 1;
    return sum + b.amount * rate;
  }, 0);
  const itemsMissingCount  = shoppingItems.filter(i => !i.checked).length;
  const homeSettlements    = calculateSettlements(expenses, roommates, settlementHistory);
  const pendingDebtsCount  = homeSettlements.length;

  const tabMeta: Record<string, { label: string; sub?: string }> = {
    budget:           { label: apartmentName,    sub: `${roommates.length} roommates` },
    bills:            { label: 'Recurrentes',   sub: `${pendingBillsCount} por pagar` },
    expenses:         { label: 'Gastos',          sub: 'Gastos compartidos' },
    projected_budget: { label: 'Presupuesto',    sub: 'Proyección mensual' },
    shopping:         { label: 'Compras',         sub: `${itemsMissingCount} pendientes` },
    forum:            { label: 'Comunidad',       sub: 'Red Vecinal' },
    directory:        { label: 'Directorio',      sub: 'Servicios de confianza' },
  };
  const currentMeta = tabMeta[activeTab] ?? { label: apartmentName, sub: '' };

  const navTabs = [
    { id: 'budget',   icon: <Home size={20} />,        label: 'Inicio',    env: 'depa' as const },
    { id: 'bills',    icon: <Clock size={20} />,        label: 'Recurrentes', env: 'depa' as const },
    { id: 'expenses', icon: <Plus size={24} />,         label: 'Gastos', env: 'depa' as const, primary: true },
    { id: 'shopping', icon: <ShoppingCart size={20} />, label: 'Compras',   env: 'depa' as const },
    { id: 'forum',    icon: <Users size={20} />,        label: 'Comunidad', env: 'comunidad' as const },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col transition-colors duration-200 overflow-x-hidden">

      {globalAlert && (
        <div className="bg-amber-500 text-white text-[13px] font-semibold px-4 py-3 flex items-center gap-2 z-50 sticky top-0">
          <BellRing size={15} className="shrink-0" />
          <span>{globalAlert}</span>
        </div>
      )}

      <header
        className="sticky top-0 z-40 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 h-14 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${
              environment === 'comunidad' ? 'bg-amber-500' : 'bg-indigo-600'
            }`}>
              {environment === 'comunidad' ? <Users size={17} /> : <Home size={17} />}
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                {currentMeta.label}
              </h1>
              <p className="text-[12px] text-zinc-400 dark:text-zinc-500 font-medium leading-none mt-0.5 truncate">
                {currentMeta.sub}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {activeTab === 'projected_budget' && (
              <button
                onClick={() => setActiveTab('budget')}
                className="h-9 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[12px] font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <ChevronRight size={14} className="rotate-180" />
                <span>Inicio</span>
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
              aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => { import('./lib/supabase').then(({ supabase }) => supabase.auth.signOut()); }}
              className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 pt-5 pb-nav animate-slide-up">

        {activeTab === 'projected_budget' && (
          <ProjectedBudget bills={bills} roommates={roommates} expenses={expenses} rentExchangeRate={rentExchangeRate} />
        )}

        {activeTab === 'budget' && (() => {
          const totalIncome = roommates.reduce((s, r) => s + r.income, 0);

          return (
            <div className="space-y-4">

              {/* Hero */}
              <button
                onClick={() => setActiveTab('expenses')}
                className="w-full relative overflow-hidden bg-indigo-600 dark:bg-indigo-700 rounded-3xl p-5 text-left active:scale-[0.98] transition-transform shadow-lg shadow-indigo-600/20"
              >
                <div className="absolute -top-6 -right-6 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
                <div className="relative">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-200">{currentMonthStr}</p>
                  <p className="text-[36px] font-extrabold text-white leading-none mt-0.5 tabular-nums">
                    S/ {totalSharedSpentThisMonth.toFixed(0)}
                  </p>
                  <p className="text-[12px] text-indigo-200 mt-1">gastado este mes</p>
                  <p className="mt-4 text-[12px] font-semibold text-white/70 flex items-center gap-1">
                    Ver gastos registrados <ArrowRight size={12} />
                  </p>
                </div>
              </button>

              {/* Pendientes */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">Pendiente</p>

                {itemsMissingCount > 0 && (
                  <button onClick={() => setActiveTab('shopping')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 active:scale-[0.98] transition text-left shadow-sm">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                      <ShoppingCart size={15} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{itemsMissingCount} {itemsMissingCount === 1 ? 'item' : 'items'} en lista de compras</p>
                      <p className="text-[11px] text-zinc-400">Lista pendiente de completar</p>
                    </div>
                    <ArrowRight size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                  </button>
                )}

                {pendingDebtsCount > 0 && (
                  <button onClick={() => setActiveTab('expenses')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 active:scale-[0.98] transition text-left shadow-sm">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                      <Split size={15} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{pendingDebtsCount} {pendingDebtsCount === 1 ? 'deuda' : 'deudas'} sin liquidar</p>
                      <p className="text-[11px] text-zinc-400">Ver balances en Dividir</p>
                    </div>
                    <ArrowRight size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                  </button>
                )}
              </div>

              {/* Análisis */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">Análisis</p>
                <button onClick={() => setActiveTab('projected_budget')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 active:scale-[0.98] transition text-left shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                    <TrendingUp size={15} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Presupuesto mensual</p>
                    <p className="text-[11px] text-zinc-400">Proyección de gastos del mes</p>
                  </div>
                  <ArrowRight size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                </button>
              </div>

              {/* Roommates */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">Roommates</p>
                <div className="space-y-1.5">
                  {roommates.map(r => {
                    const pct = totalIncome > 0 ? (r.income / totalIncome * 100) : 0;
                    const isEditing = editingRoommateId === r.id;
                    return (
                      <div key={r.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                            style={{ backgroundColor: r.color }}>
                            {r.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{r.name}</p>
                            <p className="text-[11px] text-zinc-400">S/ {r.income.toLocaleString()} · {pct.toFixed(0)}% del ingreso total</p>
                          </div>
                          {r.userId ? (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full shrink-0">Activo</span>
                          ) : (
                            <button type="button" onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}?join=${aptConfig!.inviteCode}`);
                              setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
                            }} className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 shrink-0">
                              {codeCopied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                              {codeCopied ? 'Copiado' : 'Invitar'}
                            </button>
                          )}
                          <button type="button" onClick={() => setEditingRoommateId(isEditing ? null : r.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-indigo-500 transition active:scale-90 cursor-pointer">
                            <Pencil size={12} />
                          </button>
                          <button type="button" onClick={() => {
                            if (roommates.length <= 1) return;
                            handleUpdateRoommates(roommates.filter(x => x.id !== r.id));
                          }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-rose-500 transition active:scale-90 cursor-pointer">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {isEditing && (
                          <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 flex gap-2 animate-fadeIn">
                            <div className="flex-1 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]">S/</span>
                              <input type="number" inputMode="decimal" defaultValue={r.income}
                                onBlur={e => {
                                  handleUpdateRoommates(roommates.map(x => x.id === r.id ? { ...x, income: Number(e.target.value) } : x));
                                  setEditingRoommateId(null);
                                }}
                                autoFocus
                                className="w-full pl-7 pr-3 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <button type="button" onClick={() => setEditingRoommateId(null)}
                              className="h-9 px-3 rounded-xl bg-indigo-600 text-white text-[12px] font-semibold cursor-pointer">
                              OK
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Agregar roommate */}
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                    {newRoommateName === '' && newRoommateIncome === '' ? (
                      <button type="button" onClick={() => setNewRoommateName(' ')}
                        className="w-full flex items-center gap-2 px-4 py-3 text-zinc-400 hover:text-indigo-500 transition active:scale-[0.98] cursor-pointer">
                        <Plus size={14} />
                        <span className="text-[13px] font-medium">Agregar roommate</span>
                      </button>
                    ) : (
                      <div className="flex gap-2 px-3 py-3">
                        <input type="text" value={newRoommateName.trim()} placeholder="Nombre"
                          onChange={e => setNewRoommateName(e.target.value)}
                          autoFocus
                          className="flex-1 h-9 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]">S/</span>
                          <input type="number" inputMode="decimal" value={newRoommateIncome} placeholder="Ingreso"
                            onChange={e => setNewRoommateIncome(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full pl-7 pr-2 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <button type="button" onClick={() => {
                          if (!newRoommateName.trim()) return;
                          const colors = ['#6366f1','#ec4899','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444'];
                          const newR: Roommate = {
                            id: `r-${Date.now()}`, name: newRoommateName.trim(),
                            income: Number(newRoommateIncome) || 0,
                            color: colors[roommates.length % colors.length],
                          };
                          handleUpdateRoommates([...roommates, newR]);
                          setNewRoommateName('');
                          setNewRoommateIncome('');
                        }}
                          className="h-9 px-3 rounded-xl bg-indigo-600 text-white text-[12px] font-semibold cursor-pointer shrink-0">
                          <Check size={13} />
                        </button>
                        <button type="button" onClick={() => { setNewRoommateName(''); setNewRoommateIncome(''); }}
                          className="h-9 px-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-pointer">
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Configuración del depa */}
              <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                <button type="button" onClick={() => setHomeConfigOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-800 transition">
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <Settings size={14} />
                    <span className="text-[13px] font-medium">Configuración del depa</span>
                  </div>
                  <ChevronRight size={14} className={`text-zinc-400 transition-transform ${homeConfigOpen ? 'rotate-90' : ''}`} />
                </button>

                {homeConfigOpen && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-4 space-y-3 animate-fadeIn">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Nombre del depa</label>
                      <input type="text" value={homeApartmentName} onChange={e => setHomeApartmentName(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Dirección</label>
                      <input type="text" value={homeAddress} onChange={e => setHomeAddress(e.target.value)}
                        placeholder="Ej. Av. Larco 123, Miraflores"
                        className="mt-1 w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Alquiler</label>
                        <div className="mt-1 flex gap-1">
                          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5 gap-0.5 shrink-0">
                            {(['PEN','USD'] as const).map(c => (
                              <button key={c} type="button" onClick={() => setHomeRentCurrency(c)}
                                className={`px-2 h-8 rounded-lg text-[10px] font-bold transition cursor-pointer ${homeRentCurrency === c ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500'}`}>
                                {c === 'PEN' ? 'S/' : '$'}
                              </button>
                            ))}
                          </div>
                          <input type="number" inputMode="decimal" value={homeRentCost} onChange={e => setHomeRentCost(Number(e.target.value))}
                            className="flex-1 h-9 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        {homeRentCurrency === 'USD' && (
                          <div className="mt-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]">TC</span>
                            <input type="number" inputMode="decimal" value={homeRentExRate} onChange={e => setHomeRentExRate(Number(e.target.value))}
                              className="w-full pl-7 pr-3 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Mantenimiento</label>
                        <div className="mt-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]">S/</span>
                          <input type="number" inputMode="decimal" value={homeMaintenanceCost} onChange={e => setHomeMaintenanceCost(Number(e.target.value))}
                            className="w-full pl-7 pr-3 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                    </div>
                    {aptConfig?.inviteCode && (
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Link de invitación</label>
                        <div className="mt-1 flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2">
                          <span className="flex-1 text-[12px] text-zinc-500 truncate">{window.location.origin}?join={aptConfig.inviteCode}</span>
                          <button type="button" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}?join=${aptConfig!.inviteCode}`);
                            setCodeCopied(true);
                            setTimeout(() => setCodeCopied(false), 2000);
                          }} className="shrink-0 flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 transition">
                            {codeCopied ? <><Check size={13} className="text-emerald-500" /> Copiado</> : <><Copy size={13} /> Copiar link</>}
                          </button>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">Tu roommate abre el link, crea su cuenta y queda unido al depa.</p>
                      </div>
                    )}
                    {/* Default split */}
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Cómo dividen los gastos por defecto</label>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {(['equitativo','proporcional','porcentaje'] as const).map(opt => (
                          <button key={opt} type="button" onClick={() => setHomeDefaultSplit(opt)}
                            className={`h-8 px-3 rounded-xl text-[12px] font-semibold transition active:scale-95 cursor-pointer ${homeDefaultSplit === opt ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
                            {opt === 'equitativo' ? 'Equitativo' : opt === 'proporcional' ? 'Por ingresos' : '% personalizado'}
                          </button>
                        ))}
                      </div>
                      {homeDefaultSplit === 'porcentaje' && (
                        <div className="mt-3 space-y-2">
                          {roommates.map(r => (
                            <div key={r.id} className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: r.color }}>{r.name.charAt(0)}</div>
                              <span className="flex-1 text-[13px] text-zinc-700 dark:text-zinc-300">{r.name}</span>
                              <div className="relative w-20">
                                <input type="number" inputMode="decimal" min={0} max={100}
                                  value={homeDefaultPercs[r.id] ?? ''}
                                  onChange={e => setHomeDefaultPercs(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  className="w-full h-9 pr-7 pl-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[13px] font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px] pointer-events-none">%</span>
                              </div>
                            </div>
                          ))}
                          <p className={`text-[11px] font-semibold ${Math.abs(roommates.reduce((s,r) => s+(parseFloat(homeDefaultPercs[r.id])||0),0)-100)<0.1?'text-emerald-500':'text-rose-500'}`}>
                            Total: {roommates.reduce((s,r) => s+(parseFloat(homeDefaultPercs[r.id])||0),0).toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>

                    <button type="button" onClick={() => {
                      handleUpdateApartmentNameAndRent(homeApartmentName, homeRentCost, homeRentCurrency, homeRentExRate, homeMaintenanceCost, homeAddress);
                      setHomeConfigOpen(false);
                    }}
                      className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-[13px] rounded-xl transition flex items-center justify-center gap-2 cursor-pointer">
                      <Check size={13} /> Guardar configuración
                    </button>
                  </div>
                )}
              </div>

            </div>
          );
        })()}

        {activeTab === 'expenses' && (
          <ExpensesTab
            roommates={roommates}
            allRoommates={[...roommates, ...deletedRoommates]}
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onRemoveExpense={handleRemoveExpense}
            onUpdateExpense={handleUpdateExpense}
            onNavigateTab={setActiveTab}
            bills={bills}
            prefilledBillId={prefilledBillId}
            onClearPrefilledBillId={() => setPrefilledBillId('')}
            settlementHistory={settlementHistory}
            onAddSettlement={handleAddSettlement}
            defaultSplitType={aptConfig?.defaultSplitType ?? 'equitativo'}
            defaultSplitPercentages={aptConfig?.defaultSplitPercentages ?? {}}
          />
        )}

        {activeTab === 'bills' && (
          <RecurrentBillsTab
            roommates={roommates}
            allRoommates={[...roommates, ...deletedRoommates]}
            bills={bills}
            billHistory={billHistory}
            onUpdateBillStatus={handleUpdateBillStatus}
            onAddBill={handleAddBill}
            onRemoveBill={handleRemoveBill}
            onSendBillAlert={handleSendBillAlert}
            onUpdateBill={handleUpdateBill}
            onRemoveHistoryEntry={handleRemoveHistoryEntry}
            onUpdateHistoryEntry={handleUpdateHistoryEntry}
            onDiscardBillForMonth={handleDiscardBillForMonth}
            onNavigateTab={setActiveTab}
            onPrefillBillInExpenses={(billId) => {
              setPrefilledBillId(billId);
              setActiveTab('expenses');
            }}
            variableReminders={variableReminders}
            onAddVariableReminder={handleAddVariableReminder}
            onRemoveVariableReminder={handleRemoveVariableReminder}
            onMarkVariableReminderDone={handleMarkVariableReminderDone}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingTab
            items={shoppingItems}
            onAddItem={handleAddShoppingItem}
            onToggleItem={handleToggleShoppingItem}
            onRemoveItem={handleRemoveShoppingItem}
            onUpdateItem={handleUpdateShoppingItem}
            onClearList={handleClearShoppingList}
            onChatResponse={() => {}}
            currentUserName={roommates.find(r => r.userId === user.id)?.name ?? 'Yo'}
          />
        )}

        {activeTab === 'forum' && (
          <CommunityTab
            posts={posts}
            onAddPost={handleAddPost}
            onAddReply={handleAddReply}
            onUpdatePost={updatePost}
            onDeletePost={deletePost}
            trustedServices={trustedServices}
            onAddTrustedService={addTrustedService}
            onUpdateTrustedService={updateTrustedService}
            onDeleteTrustedService={deleteTrustedService}
            currentUserId={user.id}
          />
        )}

      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-zinc-900/92 backdrop-blur-xl border-t border-zinc-200/60 dark:border-zinc-800/60"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-end h-[56px]">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id || (tab.id === 'forum' && activeTab === 'directory');
            const isPrimary = tab.primary;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setEnvironment(tab.env);
                  setActiveTab(tab.id as typeof activeTab);
                }}
                className="flex-1 flex flex-col items-center justify-end pb-2 min-h-[56px] active:opacity-70 transition-opacity"
                aria-label={tab.label}
              >
                {isPrimary ? (
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md -mt-5 transition-all duration-200 ${
                    isActive ? 'bg-indigo-600 shadow-indigo-500/40 scale-105' : 'bg-indigo-600 shadow-indigo-500/25'
                  }`}>
                    <span className="text-white">{tab.icon}</span>
                  </div>
                ) : (
                  <div className={`w-7 h-7 flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? tab.env === 'comunidad' ? 'text-amber-500' : 'text-indigo-600'
                      : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {tab.icon}
                  </div>
                )}
                <span className={`text-[10px] font-semibold mt-0.5 leading-none transition-colors duration-200 ${
                  isActive
                    ? tab.env === 'comunidad'
                      ? 'text-amber-500'
                      : isPrimary ? 'text-indigo-500' : 'text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
