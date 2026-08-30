/**
 * useApartmentData
 * Reemplaza el localStorage de App.tsx con Supabase.
 * Expone exactamente la misma forma de estado que el App original.
 */

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  Roommate, Expense, RecurrentBill, RecurrentBillHistory,
  ForumPost, ForumReply, SettlementRecord, TrustedService,
  HOGAR_DEFAULT_CATEGORIES, PERSONAL_DEFAULT_CATEGORIES,
} from '../types';

// ─── DB → App type mappers ───────────────────────────────────────────────────

function rowToRoommate(r: any): Roommate {
  return { id: r.id, name: r.name, income: r.income, color: r.color, userId: r.user_id ?? undefined };
}

function rowToExpense(r: any): Expense {
  return {
    id: r.id, title: r.title, amount: r.amount, category: r.category,
    macroCategory: r.macro_category ?? 'hogar',
    paidBy: r.paid_by, date: r.date, splitType: r.split_type,
    splits: r.splits ?? {}, calculatedShares: r.calculated_shares ?? {},
    currency: r.currency, exchangeRate: r.exchange_rate,
    recurrentBillId: r.recurrent_bill_id ?? undefined,
    recurrentBillMonth: r.recurrent_bill_month ?? undefined,
    receiptImage: r.receipt_image ?? undefined,
  };
}

function rowToBill(r: any): RecurrentBill {
  return {
    id: r.id, name: r.name, amount: r.amount, dueDate: r.due_date ?? '',
    status: r.status, alertSent: r.alert_sent, notes: r.notes ?? undefined,
    paidBy: r.paid_by ?? undefined, splitType: r.split_type ?? undefined,
    splits: r.splits ?? undefined, associatedExpenseId: r.associated_expense_id ?? undefined,
    currency: r.currency ?? 'PEN', exchangeRate: r.exchange_rate ?? 1,
    category: r.category ?? 'servicio', isAutoDebit: r.is_auto_debit ?? false,
    deletedAt: r.deleted_at ?? undefined,
  };
}

function rowToHistory(r: any): RecurrentBillHistory {
  return {
    id: r.id, billId: r.bill_id, name: r.name, amount: r.amount,
    dueDate: r.due_date ?? '', notes: r.notes ?? undefined,
    paidBy: r.paid_by, splitType: r.split_type,
    splits: r.splits ?? undefined, currency: r.currency ?? 'PEN',
    exchangeRate: r.exchange_rate ?? 1, monthPaidFor: r.month_paid_for,
    datePaid: r.date_paid, status: r.status ?? 'pagado',
    category: r.category ?? undefined, isAutoDebit: r.is_auto_debit ?? undefined,
  };
}

function rowToPost(r: any, replies: any[]): ForumPost {
  return {
    id: r.id, author: r.author, title: r.title, content: r.content,
    type: r.type, createdAt: r.created_at, userId: r.user_id ?? undefined,
    replies: replies
      .filter(rep => rep.post_id === r.id)
      .map(rep => ({ id: rep.id, author: rep.author, content: rep.content, createdAt: rep.created_at })),
  };
}

function rowToSettlement(r: any): SettlementRecord {
  return {
    id: r.id, fromId: r.from_id, toId: r.to_id, amount: r.amount,
    currency: r.currency, exchangeRate: r.exchange_rate ?? 1, date: r.date,
  };
}

// ─── Apartment config shape ──────────────────────────────────────────────────

export interface ApartmentConfig {
  id: string;
  name: string;
  address: string;
  rentCost: number;
  rentCurrency: 'PEN' | 'USD';
  rentExchangeRate: number;
  maintenanceCost: number;
  inviteCode: string;
  defaultSplitType: 'equitativo' | 'proporcional' | 'porcentaje';
  defaultSplitPercentages: Record<string, number>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useApartmentData(user: User) {
  const [apartmentId, setApartmentId]     = useState<string | null>(null);
  const [aptConfig, setAptConfig]         = useState<ApartmentConfig | null>(null);
  const [roommates, setRoommates]         = useState<Roommate[]>([]);
  const [expenses, setExpenses]           = useState<Expense[]>([]);
  const [bills, setBills]                 = useState<RecurrentBill[]>([]);
  const [billHistory, setBillHistory]     = useState<RecurrentBillHistory[]>([]);
  const [posts, setPosts]                 = useState<ForumPost[]>([]);
  const [trustedServices, setTrustedServices] = useState<TrustedService[]>([]);
  const [settlementHistory, setSettlementHistory] = useState<SettlementRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [noApartment, setNoApartment]     = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  // null = este depa nunca editó sus categorías; se usan los defaults
  // más los extras de la columna vieja. Ver supabase/editable_categories.sql
  const [managedHogarCategories, setManagedHogarCategories] = useState<string[] | null>(null);
  const [managedPersonalCategories, setManagedPersonalCategories] = useState<string[] | null>(null);
  const [customHogarCategories, setCustomHogarCategories] = useState<string[]>([]);
  const [customPersonalCategories, setCustomPersonalCategories] = useState<string[]>([]);

  // ── Load everything from Supabase ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get the user's apartment
      const { data: members, error: memberErr } = await supabase
        .from('apartment_members')
        .select('apartment_id')
        .eq('user_id', user.id)
        .limit(1);
      if (memberErr) console.error('apartment_members query error:', memberErr);
      const member = members?.[0] ?? null;

      if (!member) { setNoApartment(true); setLoading(false); return; }
      setNoApartment(false);

      const aptId = member.apartment_id;
      setApartmentId(aptId);

      // 2. Load apartment config
      const { data: apt } = await supabase
        .from('apartments')
        .select('*')
        .eq('id', aptId)
        .single();

      if (apt) {
        setAptConfig({
          id: apt.id, name: apt.name, address: apt.address ?? '',
          rentCost: apt.rent, rentCurrency: apt.rent_currency,
          rentExchangeRate: apt.rent_exchange_rate,
          maintenanceCost: apt.maintenance,
          inviteCode: apt.invite_code ?? '',
          defaultSplitType: apt.default_split_type ?? 'equitativo',
          defaultSplitPercentages: apt.default_split_percentages ?? {},
        });
        setOnboardingComplete(apt.onboarding_complete === true);
        setCustomHogarCategories(apt.custom_hogar_categories ?? []);
        setManagedHogarCategories(apt.hogar_categories ?? null);
      }

      // 3. Load all tables in parallel
      const [
        { data: rmRows },
        { data: expRows },
        { data: billRows },
        { data: histRows },
        { data: settleRows },
        { data: postRows },
        { data: replyRows },
        { data: svcRows },
      ] = await Promise.all([
        supabase.from('roommates').select('*').eq('apartment_id', aptId).order('sort_order'),
        supabase.from('expenses').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('bills').select('*').eq('apartment_id', aptId).order('created_at'),
        supabase.from('bill_history').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('settlements').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('forum_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('forum_replies').select('*').order('created_at'),
        supabase.from('trusted_services').select('*').order('created_at', { ascending: false }),
      ]);

      setRoommates((rmRows ?? []).map(rowToRoommate));
      const myRmRow = (rmRows ?? []).find((r: any) => r.user_id === user.id);
      setCustomPersonalCategories(myRmRow?.custom_personal_categories ?? []);
      setManagedPersonalCategories(myRmRow?.personal_categories ?? null);
      setExpenses((expRows ?? []).map(rowToExpense));
      setBills((billRows ?? []).map(rowToBill));
      setBillHistory((histRows ?? []).map(rowToHistory));
      setSettlementHistory((settleRows ?? []).map(rowToSettlement));
      setPosts((postRows ?? []).map(p => rowToPost(p, replyRows ?? [])));
      setTrustedServices((svcRows ?? []).map((r: any) => ({
        id: r.id, name: r.name, category: r.category, phone: r.phone,
        rating: r.rating, description: r.description, recommendedBy: r.recommended_by,
        userId: r.user_id ?? undefined,
      })));
    } catch (err) {
      console.error('Error loading apartment data:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Apartment config handlers ─────────────────────────────────────────────

  const updateApartmentConfig = async (config: Partial<ApartmentConfig>) => {
    if (!apartmentId) return;
    const update: any = {};
    if (config.name !== undefined)             update.name = config.name;
    if (config.address !== undefined)          update.address = config.address;
    if (config.rentCost !== undefined)         update.rent = config.rentCost;
    if (config.rentCurrency !== undefined)     update.rent_currency = config.rentCurrency;
    if (config.rentExchangeRate !== undefined) update.rent_exchange_rate = config.rentExchangeRate;
    if (config.maintenanceCost !== undefined)        update.maintenance = config.maintenanceCost;
    if (config.defaultSplitType !== undefined)       update.default_split_type = config.defaultSplitType;
    if (config.defaultSplitPercentages !== undefined) update.default_split_percentages = config.defaultSplitPercentages;
    await supabase.from('apartments').update(update).eq('id', apartmentId);
    setAptConfig(prev => prev ? { ...prev, ...config } : prev);
  };

  // ── Roommate handlers ─────────────────────────────────────────────────────

  const updateRoommates = async (updated: Roommate[]) => {
    if (!apartmentId) return;
    // Upsert all roommates
    const rows = updated.map((r, i) => ({
      id: r.id, apartment_id: apartmentId,
      name: r.name, income: r.income, color: r.color, sort_order: i,
      user_id: r.userId ?? null,
    }));
    await supabase.from('roommates').upsert(rows);

    // Delete removed roommates
    const updatedIds = updated.map(r => r.id);
    const removedIds = roommates.filter(r => !updatedIds.includes(r.id)).map(r => r.id);
    if (removedIds.length) await supabase.from('roommates').delete().in('id', removedIds);

    setRoommates(updated);
  };

  // ── Expense handlers ──────────────────────────────────────────────────────

  const addExpense = async (exp: Expense) => {
    if (!apartmentId) return;
    await supabase.from('expenses').insert({
      id: exp.id, apartment_id: apartmentId,
      title: exp.title, amount: exp.amount, category: exp.category,
      macro_category: exp.macroCategory ?? 'hogar',
      paid_by: exp.paidBy, date: exp.date, split_type: exp.splitType,
      splits: exp.splits, calculated_shares: exp.calculatedShares,
      currency: exp.currency ?? 'PEN', exchange_rate: exp.exchangeRate ?? 1,
      recurrent_bill_id: exp.recurrentBillId ?? null,
      recurrent_bill_month: exp.recurrentBillMonth ?? null,
      receipt_image: exp.receiptImage ?? null,
    });
    setExpenses(prev => [exp, ...prev]);
  };

  const updateExpense = async (exp: Expense) => {
    if (!apartmentId) return;
    await supabase.from('expenses').update({
      title: exp.title, amount: exp.amount, category: exp.category,
      macro_category: exp.macroCategory ?? 'hogar',
      paid_by: exp.paidBy, date: exp.date, split_type: exp.splitType,
      splits: exp.splits, calculated_shares: exp.calculatedShares,
      currency: exp.currency ?? 'PEN', exchange_rate: exp.exchangeRate ?? 1,
      recurrent_bill_id: exp.recurrentBillId ?? null,
      recurrent_bill_month: exp.recurrentBillMonth ?? null,
      receipt_image: exp.receiptImage ?? null,
    }).eq('id', exp.id);
    setExpenses(prev => prev.map(e => e.id === exp.id ? exp : e));
  };

  const removeExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // ── Bill handlers ─────────────────────────────────────────────────────────

  const addBill = async (bill: RecurrentBill) => {
    if (!apartmentId) return;
    await supabase.from('bills').insert({
      id: bill.id, apartment_id: apartmentId,
      name: bill.name, amount: bill.amount, due_date: bill.dueDate,
      status: bill.status, alert_sent: bill.alertSent, notes: bill.notes ?? null,
      paid_by: bill.paidBy ?? null, split_type: bill.splitType ?? null,
      splits: bill.splits ?? null, associated_expense_id: bill.associatedExpenseId ?? null,
      currency: bill.currency ?? 'PEN', exchange_rate: bill.exchangeRate ?? 1,
      category: bill.category ?? 'servicio', is_auto_debit: bill.isAutoDebit ?? false,
    });
    setBills(prev => [...prev, bill]);
  };

  const updateBill = async (bill: RecurrentBill) => {
    await supabase.from('bills').update({
      name: bill.name, amount: bill.amount, due_date: bill.dueDate,
      status: bill.status, alert_sent: bill.alertSent, notes: bill.notes ?? null,
      paid_by: bill.paidBy ?? null, split_type: bill.splitType ?? null,
      splits: bill.splits ?? null, associated_expense_id: bill.associatedExpenseId ?? null,
      currency: bill.currency ?? 'PEN', exchange_rate: bill.exchangeRate ?? 1,
      category: bill.category ?? 'servicio', is_auto_debit: bill.isAutoDebit ?? false,
      deleted_at: bill.deletedAt ?? null,
    }).eq('id', bill.id);
    setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
  };

  const removeBill = async (id: string) => {
    // Soft-delete: mark as deleted rather than hard-delete (preserve history)
    setBills(prev => prev.filter(b => b.id !== id));
    await supabase.from('bills').delete().eq('id', id);
  };

  // ── Bill history handlers ─────────────────────────────────────────────────

  const addBillHistory = async (entry: RecurrentBillHistory) => {
    if (!apartmentId) return;
    await supabase.from('bill_history').insert({
      id: entry.id, apartment_id: apartmentId,
      bill_id: entry.billId, name: entry.name, amount: entry.amount,
      due_date: entry.dueDate, notes: entry.notes ?? null,
      paid_by: entry.paidBy, split_type: entry.splitType,
      splits: entry.splits ?? null, currency: entry.currency ?? 'PEN',
      exchange_rate: entry.exchangeRate ?? 1, month_paid_for: entry.monthPaidFor,
      date_paid: entry.datePaid, status: entry.status ?? 'pagado',
      category: entry.category ?? null, is_auto_debit: entry.isAutoDebit ?? null,
    });
    setBillHistory(prev => [entry, ...prev]);
  };

  const removeBillHistory = async (id: string) => {
    await supabase.from('bill_history').delete().eq('id', id);
    setBillHistory(prev => prev.filter(h => h.id !== id));
  };

  const updateBillHistoryEntry = async (entry: RecurrentBillHistory) => {
    await supabase.from('bill_history').update({
      name: entry.name, amount: entry.amount, paid_by: entry.paidBy,
      split_type: entry.splitType, splits: entry.splits ?? null,
      currency: entry.currency ?? 'PEN', exchange_rate: entry.exchangeRate ?? 1,
      month_paid_for: entry.monthPaidFor, date_paid: entry.datePaid,
      status: entry.status ?? 'pagado',
    }).eq('id', entry.id);
    setBillHistory(prev => prev.map(h => h.id === entry.id ? entry : h));
  };

  // ── Settlement handlers ───────────────────────────────────────────────────

  const addSettlement = async (record: SettlementRecord) => {
    if (!apartmentId) return;
    await supabase.from('settlements').insert({
      id: record.id, apartment_id: apartmentId,
      from_id: record.fromId, to_id: record.toId, amount: record.amount,
      currency: record.currency, exchange_rate: record.exchangeRate ?? 1, date: record.date,
    });
    setSettlementHistory(prev => [record, ...prev]);
  };

  // ── Forum handlers ────────────────────────────────────────────────────────

  const addPost = async (post: ForumPost) => {
    if (!apartmentId) return;
    await supabase.from('forum_posts').insert({
      id: post.id, apartment_id: apartmentId,
      author: post.author, title: post.title,
      content: post.content, type: post.type, created_at: post.createdAt,
      user_id: user.id,
    });
    setPosts(prev => [{ ...post, userId: user.id }, ...prev]);
  };

  const updatePost = async (id: string, updates: { title: string; content: string }) => {
    await supabase.from('forum_posts').update(updates).eq('id', id).eq('user_id', user.id);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePost = async (id: string) => {
    await supabase.from('forum_posts').delete().eq('id', id).eq('user_id', user.id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const addTrustedService = async (svc: TrustedService) => {
    if (!apartmentId) return;
    const newId = crypto.randomUUID();
    const { error } = await supabase.from('trusted_services').insert({
      id: newId, apartment_id: apartmentId,
      name: svc.name, category: svc.category, phone: svc.phone,
      rating: svc.rating, description: svc.description, recommended_by: svc.recommendedBy,
      user_id: user.id,
    });
    if (!error) setTrustedServices(prev => [{ ...svc, id: newId, userId: user.id }, ...prev]);
  };

  const updateTrustedService = async (id: string, updates: Partial<TrustedService>) => {
    await supabase.from('trusted_services').update({
      name: updates.name, category: updates.category, phone: updates.phone,
      rating: updates.rating, description: updates.description, recommended_by: updates.recommendedBy,
    }).eq('id', id).eq('user_id', user.id);
    setTrustedServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteTrustedService = async (id: string) => {
    await supabase.from('trusted_services').delete().eq('id', id).eq('user_id', user.id);
    setTrustedServices(prev => prev.filter(s => s.id !== id));
  };

  const addReply = async (postId: string, reply: ForumReply) => {
    await supabase.from('forum_replies').insert({
      id: reply.id, post_id: postId,
      author: reply.author, content: reply.content, created_at: reply.createdAt,
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, replies: [...p.replies, reply] } : p
    ));
  };

  // Lista efectiva: la gestionada si existe, si no los defaults + extras
  // de la columna vieja. Así el código funciona igual antes y después de
  // que alguien edite sus categorías por primera vez.
  const hogarCategories = managedHogarCategories
    ?? [...HOGAR_DEFAULT_CATEGORIES, ...customHogarCategories.filter(c => !HOGAR_DEFAULT_CATEGORIES.includes(c as any))];

  const personalCategories = managedPersonalCategories
    ?? [...PERSONAL_DEFAULT_CATEGORIES, ...customPersonalCategories.filter(c => !PERSONAL_DEFAULT_CATEGORIES.includes(c as any))];

  /** Guarda la lista completa de categorías de hogar del depa. */
  const setHogarCategories = async (list: string[]) => {
    if (!apartmentId) return;
    // 'otros' es el destino de inferCategoryFromName y el fallback de todo
    // gasto sin clasificar, así que no puede faltar.
    const safe = list.includes('otros') ? list : [...list, 'otros'];
    await supabase.from('apartments').update({ hogar_categories: safe }).eq('id', apartmentId);
    setManagedHogarCategories(safe);
  };

  /** Guarda la lista completa de categorías personales del usuario actual. */
  const setPersonalCategories = async (list: string[]) => {
    if (!apartmentId) return;
    const safe = list.includes('otros') ? list : [...list, 'otros'];
    const myRoommate = roommates.find(r => r.userId === user.id);
    if (myRoommate) {
      await supabase.from('roommates').update({ personal_categories: safe }).eq('id', myRoommate.id);
    }
    setManagedPersonalCategories(safe);
  };

  const addHogarCategory = async (name: string) => {
    if (hogarCategories.includes(name)) return;
    await setHogarCategories([...hogarCategories, name]);
  };

  const addPersonalCategory = async (name: string) => {
    if (personalCategories.includes(name)) return;
    await setPersonalCategories([...personalCategories, name]);
  };

  return {
    loading,
    noApartment,
    onboardingComplete,
    apartmentId,
    aptConfig,
    roommates,
    expenses,
    bills,
    billHistory,
    posts,
    trustedServices,
    settlementHistory,
    // setters needed by App.tsx handlers that do their own logic
    setExpenses,
    setBills,
    setBillHistory,
    // actions
    updateApartmentConfig,
    updateRoommates,
    addExpense, updateExpense, removeExpense,
    addBill, updateBill, removeBill,
    addBillHistory, removeBillHistory, updateBillHistoryEntry,
    addSettlement,
    customHogarCategories, customPersonalCategories,
    addHogarCategory, addPersonalCategory,
    hogarCategories, personalCategories, setHogarCategories, setPersonalCategories,
    addPost, updatePost, deletePost, addReply,
    addTrustedService, updateTrustedService, deleteTrustedService,
    reload: loadAll,
  };
}
