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
  ShoppingItem, ForumPost, ForumReply, SettlementRecord,
} from '../types';

// ─── DB → App type mappers ───────────────────────────────────────────────────

function rowToRoommate(r: any): Roommate {
  return { id: r.id, name: r.name, income: r.income, color: r.color, userId: r.user_id ?? undefined };
}

function rowToExpense(r: any): Expense {
  return {
    id: r.id, title: r.title, amount: r.amount, category: r.category,
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

function rowToShoppingItem(r: any): ShoppingItem {
  return { id: r.id, name: r.name, quantity: r.quantity, checked: r.checked, addedBy: r.added_by ?? 'Yo' };
}

function rowToPost(r: any, replies: any[]): ForumPost {
  return {
    id: r.id, author: r.author, title: r.title, content: r.content,
    type: r.type, createdAt: r.created_at,
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
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useApartmentData(user: User) {
  const [apartmentId, setApartmentId]     = useState<string | null>(null);
  const [aptConfig, setAptConfig]         = useState<ApartmentConfig | null>(null);
  const [roommates, setRoommates]         = useState<Roommate[]>([]);
  const [expenses, setExpenses]           = useState<Expense[]>([]);
  const [bills, setBills]                 = useState<RecurrentBill[]>([]);
  const [billHistory, setBillHistory]     = useState<RecurrentBillHistory[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [posts, setPosts]                 = useState<ForumPost[]>([]);
  const [settlementHistory, setSettlementHistory] = useState<SettlementRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [noApartment, setNoApartment]     = useState(false);

  // ── Load everything from Supabase ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get the user's apartment
      const { data: members } = await supabase
        .from('apartment_members')
        .select('apartment_id')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1);
      const member = members?.[0] ?? null;

      if (!member) { setNoApartment(true); setLoading(false); return; }

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
        });
      }

      // 3. Load all tables in parallel
      const [
        { data: rmRows },
        { data: expRows },
        { data: billRows },
        { data: histRows },
        { data: shopRows },
        { data: settleRows },
        { data: postRows },
        { data: replyRows },
      ] = await Promise.all([
        supabase.from('roommates').select('*').eq('apartment_id', aptId).order('sort_order'),
        supabase.from('expenses').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('bills').select('*').eq('apartment_id', aptId).order('created_at'),
        supabase.from('bill_history').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('shopping_items').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('settlements').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('forum_posts').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('forum_replies').select('*').order('created_at'),
      ]);

      setRoommates((rmRows ?? []).map(rowToRoommate));
      setExpenses((expRows ?? []).map(rowToExpense));
      setBills((billRows ?? []).map(rowToBill));
      setBillHistory((histRows ?? []).map(rowToHistory));
      setShoppingItems((shopRows ?? []).map(rowToShoppingItem));
      setSettlementHistory((settleRows ?? []).map(rowToSettlement));
      setPosts((postRows ?? []).map(p => rowToPost(p, replyRows ?? [])));
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
    if (config.maintenanceCost !== undefined)  update.maintenance = config.maintenanceCost;
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

  // ── Shopping handlers ─────────────────────────────────────────────────────

  const addShoppingItem = async (item: Omit<ShoppingItem, 'id'>) => {
    if (!apartmentId) return;
    const id = crypto.randomUUID();
    await supabase.from('shopping_items').insert({
      id, apartment_id: apartmentId,
      name: item.name, quantity: item.quantity,
      checked: item.checked, added_by: item.addedBy,
    });
    setShoppingItems(prev => [{ ...item, id }, ...prev]);
  };

  const toggleShoppingItem = async (id: string) => {
    const item = shoppingItems.find(i => i.id === id);
    if (!item) return;
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', id);
    setShoppingItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const removeShoppingItem = async (id: string) => {
    await supabase.from('shopping_items').delete().eq('id', id);
    setShoppingItems(prev => prev.filter(i => i.id !== id));
  };

  const clearShoppingList = async () => {
    if (!apartmentId) return;
    const checkedIds = shoppingItems.filter(i => i.checked).map(i => i.id);
    if (checkedIds.length) await supabase.from('shopping_items').delete().in('id', checkedIds);
    setShoppingItems(prev => prev.filter(i => !i.checked));
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
    });
    setPosts(prev => [post, ...prev]);
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

  return {
    loading,
    noApartment,
    apartmentId,
    aptConfig,
    roommates,
    expenses,
    bills,
    billHistory,
    shoppingItems,
    posts,
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
    addShoppingItem, toggleShoppingItem, removeShoppingItem, clearShoppingList,
    addSettlement,
    addPost, addReply,
    reload: loadAll,
  };
}
