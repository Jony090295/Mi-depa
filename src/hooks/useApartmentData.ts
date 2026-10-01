/**
 * useApartmentData
 * Reemplaza el localStorage de App.tsx con Supabase.
 * Expone exactamente la misma forma de estado que el App original.
 */

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getCategoryLabel } from '../utils';
import {
  Roommate, Expense, RecurrentBill, RecurrentBillHistory,
  ForumPost, ForumReply, SettlementRecord, TrustedService,
  HOGAR_DEFAULT_CATEGORIES, PERSONAL_DEFAULT_CATEGORIES,
} from '../types';

function requireApartmentId(apartmentId: string | null): string {
  if (!apartmentId) throw new Error('No se encontró el depa activo. Recarga e intenta de nuevo.');
  return apartmentId;
}

function throwIfSupabaseError(error: { message?: string } | null, fallback: string): void {
  if (!error) return;
  console.error(fallback, error);
  throw new Error(fallback);
}

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
  const [loadError, setLoadError]         = useState<string | null>(null);
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
    setLoadError(null);
    try {
      // 1. Get the user's apartment
      const { data: members, error: memberErr } = await supabase
        .from('apartment_members')
        .select('apartment_id')
        .eq('user_id', user.id)
        .limit(1);
      throwIfSupabaseError(memberErr, 'No se pudo comprobar a qué depa perteneces.');
      const member = members?.[0] ?? null;

      if (!member) { setNoApartment(true); setLoading(false); return; }
      setNoApartment(false);

      const aptId = member.apartment_id;
      setApartmentId(aptId);

      // 2. Load apartment config
      const { data: apt, error: aptErr } = await supabase
        .from('apartments')
        .select('*')
        .eq('id', aptId)
        .single();
      throwIfSupabaseError(aptErr, 'No se pudo cargar la configuración del depa.');

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
      const results = await Promise.all([
        supabase.from('roommates').select('*').eq('apartment_id', aptId).order('sort_order'),
        supabase.from('expenses').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('bills').select('*').eq('apartment_id', aptId).order('created_at'),
        supabase.from('bill_history').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('settlements').select('*').eq('apartment_id', aptId).order('created_at', { ascending: false }),
        supabase.from('forum_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('forum_replies').select('*').order('created_at'),
        supabase.from('trusted_services').select('*').order('created_at', { ascending: false }),
      ]);

      const loadLabels = [
        'roommates', 'gastos', 'recurrentes', 'historial de recurrentes',
        'liquidaciones', 'foro', 'respuestas', 'directorio',
      ];
      results.forEach((result, index) => {
        throwIfSupabaseError(result.error, `No se pudo cargar ${loadLabels[index]}.`);
      });

      const [rmResult, expResult, billResult, histResult, settleResult, postResult, replyResult, svcResult] = results;
      const rmRows = rmResult.data;
      const expRows = expResult.data;
      const billRows = billResult.data;
      const histRows = histResult.data;
      const settleRows = settleResult.data;
      const postRows = postResult.data;
      const replyRows = replyResult.data;
      const svcRows = svcResult.data;

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
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la información del depa.');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Apartment config handlers ─────────────────────────────────────────────

  const updateApartmentConfig = async (config: Partial<ApartmentConfig>) => {
    const aptId = requireApartmentId(apartmentId);
    const update: any = {};
    if (config.name !== undefined)             update.name = config.name;
    if (config.address !== undefined)          update.address = config.address;
    if (config.rentCost !== undefined)         update.rent = config.rentCost;
    if (config.rentCurrency !== undefined)     update.rent_currency = config.rentCurrency;
    if (config.rentExchangeRate !== undefined) update.rent_exchange_rate = config.rentExchangeRate;
    if (config.maintenanceCost !== undefined)        update.maintenance = config.maintenanceCost;
    if (config.defaultSplitType !== undefined)       update.default_split_type = config.defaultSplitType;
    if (config.defaultSplitPercentages !== undefined) update.default_split_percentages = config.defaultSplitPercentages;
    const { error } = await supabase.from('apartments').update(update).eq('id', aptId).select('id').single();
    throwIfSupabaseError(error, 'No se pudo guardar la configuración del depa.');
    setAptConfig(prev => prev ? { ...prev, ...config } : prev);
  };

  // ── Roommate handlers ─────────────────────────────────────────────────────

  const updateRoommates = async (updated: Roommate[]) => {
    const aptId = requireApartmentId(apartmentId);
    // Upsert all roommates
    const rows = updated.map((r, i) => ({
      id: r.id, apartment_id: aptId,
      name: r.name, income: r.income, color: r.color, sort_order: i,
      user_id: r.userId ?? null,
    }));
    if (rows.length > 0) {
      const { data, error } = await supabase.from('roommates').upsert(rows).select('id');
      throwIfSupabaseError(error, 'No se pudieron guardar los roommates.');
      if ((data?.length ?? 0) !== rows.length) throw new Error('No se pudieron confirmar todos los roommates guardados.');
    }

    // Delete removed roommates
    const updatedIds = updated.map(r => r.id);
    const removedIds = roommates.filter(r => !updatedIds.includes(r.id)).map(r => r.id);
    if (removedIds.length) {
      const { data, error } = await supabase.from('roommates').delete().in('id', removedIds).select('id');
      throwIfSupabaseError(error, 'No se pudieron eliminar los roommates seleccionados.');
      if ((data?.length ?? 0) !== removedIds.length) throw new Error('No se pudieron confirmar todos los roommates eliminados.');
    }

    setRoommates(updated);
  };

  // ── Expense handlers ──────────────────────────────────────────────────────

  const addExpense = async (exp: Expense) => {
    const aptId = requireApartmentId(apartmentId);
    const { error } = await supabase.from('expenses').insert({
      id: exp.id, apartment_id: aptId,
      title: exp.title, amount: exp.amount, category: exp.category,
      macro_category: exp.macroCategory ?? 'hogar',
      paid_by: exp.paidBy, date: exp.date, split_type: exp.splitType,
      splits: exp.splits, calculated_shares: exp.calculatedShares,
      currency: exp.currency ?? 'PEN', exchange_rate: exp.exchangeRate ?? 1,
      recurrent_bill_id: exp.recurrentBillId ?? null,
      recurrent_bill_month: exp.recurrentBillMonth ?? null,
      receipt_image: exp.receiptImage ?? null,
    }).select('id').single();
    throwIfSupabaseError(error, 'No se pudo registrar el gasto.');
    setExpenses(prev => [exp, ...prev]);
  };

  const updateExpense = async (exp: Expense) => {
    requireApartmentId(apartmentId);
    const { error } = await supabase.from('expenses').update({
      title: exp.title, amount: exp.amount, category: exp.category,
      macro_category: exp.macroCategory ?? 'hogar',
      paid_by: exp.paidBy, date: exp.date, split_type: exp.splitType,
      splits: exp.splits, calculated_shares: exp.calculatedShares,
      currency: exp.currency ?? 'PEN', exchange_rate: exp.exchangeRate ?? 1,
      recurrent_bill_id: exp.recurrentBillId ?? null,
      recurrent_bill_month: exp.recurrentBillMonth ?? null,
      receipt_image: exp.receiptImage ?? null,
    }).eq('id', exp.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo actualizar el gasto.');
    setExpenses(prev => prev.map(e => e.id === exp.id ? exp : e));
  };

  const removeExpense = async (id: string) => {
    requireApartmentId(apartmentId);
    const { error } = await supabase.from('expenses').delete().eq('id', id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo eliminar el gasto.');
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // ── Bill handlers ─────────────────────────────────────────────────────────

  const addBill = async (bill: RecurrentBill) => {
    const aptId = requireApartmentId(apartmentId);
    const { error } = await supabase.from('bills').insert({
      id: bill.id, apartment_id: aptId,
      name: bill.name, amount: bill.amount, due_date: bill.dueDate,
      status: bill.status, alert_sent: bill.alertSent, notes: bill.notes ?? null,
      paid_by: bill.paidBy ?? null, split_type: bill.splitType ?? null,
      splits: bill.splits ?? null, associated_expense_id: bill.associatedExpenseId ?? null,
      currency: bill.currency ?? 'PEN', exchange_rate: bill.exchangeRate ?? 1,
      category: bill.category ?? 'servicio', is_auto_debit: bill.isAutoDebit ?? false,
    }).select('id').single();
    throwIfSupabaseError(error, 'No se pudo guardar la plantilla recurrente.');
    setBills(prev => [...prev, bill]);
  };

  const updateBill = async (bill: RecurrentBill) => {
    requireApartmentId(apartmentId);
    const { error } = await supabase.from('bills').update({
      name: bill.name, amount: bill.amount, due_date: bill.dueDate,
      status: bill.status, alert_sent: bill.alertSent, notes: bill.notes ?? null,
      paid_by: bill.paidBy ?? null, split_type: bill.splitType ?? null,
      splits: bill.splits ?? null, associated_expense_id: bill.associatedExpenseId ?? null,
      currency: bill.currency ?? 'PEN', exchange_rate: bill.exchangeRate ?? 1,
      category: bill.category ?? 'servicio', is_auto_debit: bill.isAutoDebit ?? false,
      deleted_at: bill.deletedAt ?? null,
    }).eq('id', bill.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo actualizar la plantilla recurrente.');
    setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
  };

  const removeBill = async (id: string) => {
    // Soft-delete: mark as deleted rather than hard-delete (preserve history)
    requireApartmentId(apartmentId);
    const { error } = await supabase.from('bills').delete().eq('id', id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo eliminar la plantilla recurrente.');
    setBills(prev => prev.filter(b => b.id !== id));
  };

  // ── Bill history handlers ─────────────────────────────────────────────────

  const addBillHistory = async (entry: RecurrentBillHistory) => {
    const aptId = requireApartmentId(apartmentId);
    const { error } = await supabase.from('bill_history').insert({
      id: entry.id, apartment_id: aptId,
      bill_id: entry.billId, name: entry.name, amount: entry.amount,
      due_date: entry.dueDate, notes: entry.notes ?? null,
      paid_by: entry.paidBy, split_type: entry.splitType,
      splits: entry.splits ?? null, currency: entry.currency ?? 'PEN',
      exchange_rate: entry.exchangeRate ?? 1, month_paid_for: entry.monthPaidFor,
      date_paid: entry.datePaid, status: entry.status ?? 'pagado',
      category: entry.category ?? null, is_auto_debit: entry.isAutoDebit ?? null,
    }).select('id').single();
    throwIfSupabaseError(error, 'No se pudo guardar el historial recurrente.');
    setBillHistory(prev => [entry, ...prev]);
  };

  const removeBillHistory = async (id: string) => {
    requireApartmentId(apartmentId);
    const { error } = await supabase.from('bill_history').delete().eq('id', id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo actualizar el historial recurrente.');
    setBillHistory(prev => prev.filter(h => h.id !== id));
  };

  const updateBillHistoryEntry = async (entry: RecurrentBillHistory) => {
    requireApartmentId(apartmentId);
    const { error } = await supabase.from('bill_history').update({
      name: entry.name, amount: entry.amount, paid_by: entry.paidBy,
      split_type: entry.splitType, splits: entry.splits ?? null,
      currency: entry.currency ?? 'PEN', exchange_rate: entry.exchangeRate ?? 1,
      month_paid_for: entry.monthPaidFor, date_paid: entry.datePaid,
      status: entry.status ?? 'pagado',
    }).eq('id', entry.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo actualizar el historial recurrente.');
    setBillHistory(prev => prev.map(h => h.id === entry.id ? entry : h));
  };

  // ── Settlement handlers ───────────────────────────────────────────────────

  const addSettlement = async (record: SettlementRecord) => {
    const aptId = requireApartmentId(apartmentId);
    const { error } = await supabase.from('settlements').insert({
      id: record.id, apartment_id: aptId,
      from_id: record.fromId, to_id: record.toId, amount: record.amount,
      currency: record.currency, exchange_rate: record.exchangeRate ?? 1, date: record.date,
    }).select('id').single();
    throwIfSupabaseError(error, 'No se pudo registrar la liquidación.');
    setSettlementHistory(prev => [record, ...prev]);
  };

  // ── Forum handlers ────────────────────────────────────────────────────────

  const addPost = async (post: ForumPost) => {
    const aptId = requireApartmentId(apartmentId);
    const { error } = await supabase.from('forum_posts').insert({
      id: post.id, apartment_id: aptId,
      author: post.author, title: post.title,
      content: post.content, type: post.type, created_at: post.createdAt,
      user_id: user.id,
    }).select('id').single();
    throwIfSupabaseError(error, 'No se pudo publicar en el foro.');
    setPosts(prev => [{ ...post, userId: user.id }, ...prev]);
  };

  const updatePost = async (id: string, updates: { title: string; content: string }) => {
    const { error } = await supabase.from('forum_posts').update(updates).eq('id', id).eq('user_id', user.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo actualizar la publicación.');
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from('forum_posts').delete().eq('id', id).eq('user_id', user.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo eliminar la publicación.');
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const addTrustedService = async (svc: TrustedService) => {
    const aptId = requireApartmentId(apartmentId);
    const newId = crypto.randomUUID();
    const { error } = await supabase.from('trusted_services').insert({
      id: newId, apartment_id: aptId,
      name: svc.name, category: svc.category, phone: svc.phone,
      rating: svc.rating, description: svc.description, recommended_by: svc.recommendedBy,
      user_id: user.id,
    });
    throwIfSupabaseError(error, 'No se pudo agregar el contacto.');
    setTrustedServices(prev => [{ ...svc, id: newId, userId: user.id }, ...prev]);
  };

  const updateTrustedService = async (id: string, updates: Partial<TrustedService>) => {
    const { error } = await supabase.from('trusted_services').update({
      name: updates.name, category: updates.category, phone: updates.phone,
      rating: updates.rating, description: updates.description, recommended_by: updates.recommendedBy,
    }).eq('id', id).eq('user_id', user.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo actualizar el contacto.');
    setTrustedServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteTrustedService = async (id: string) => {
    const { error } = await supabase.from('trusted_services').delete().eq('id', id).eq('user_id', user.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudo eliminar el contacto.');
    setTrustedServices(prev => prev.filter(s => s.id !== id));
  };

  const addReply = async (postId: string, reply: ForumReply) => {
    const { error } = await supabase.from('forum_replies').insert({
      id: reply.id, post_id: postId,
      author: reply.author, content: reply.content, created_at: reply.createdAt,
    }).select('id').single();
    throwIfSupabaseError(error, 'No se pudo publicar la respuesta.');
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
    const aptId = requireApartmentId(apartmentId);
    // 'otros' es el destino de inferCategoryFromName y el fallback de todo
    // gasto sin clasificar, así que no puede faltar.
    const safe = list.includes('otros') ? list : [...list, 'otros'];
    const { error } = await supabase.from('apartments').update({ hogar_categories: safe }).eq('id', aptId).select('id').single();
    throwIfSupabaseError(error, 'No se pudieron guardar las categorías del hogar.');
    setManagedHogarCategories(safe);
  };

  /** Guarda la lista completa de categorías personales del usuario actual. */
  const setPersonalCategories = async (list: string[]) => {
    requireApartmentId(apartmentId);
    const safe = list.includes('otros') ? list : [...list, 'otros'];
    const myRoommate = roommates.find(r => r.userId === user.id);
    if (!myRoommate) throw new Error('Tu perfil de roommate no está vinculado. Recarga e intenta de nuevo.');
    const { error } = await supabase.from('roommates').update({ personal_categories: safe }).eq('id', myRoommate.id).select('id').single();
    throwIfSupabaseError(error, 'No se pudieron guardar tus categorías personales.');
    setManagedPersonalCategories(safe);
  };

  /**
   * Renombra una categoría y arrastra todo lo que la usa.
   *
   * La categoría se guarda como texto dentro de cada gasto, no como un id, así
   * que cambiarla solo en la lista dejaría el historial apuntando al nombre
   * viejo. Por eso esto actualiza las filas antes que la lista: si el UPDATE
   * falla, la lista queda intacta y se puede reintentar.
   */
  const renameCategory = async (oldName: string, newName: string, macro: 'hogar' | 'personal') => {
    const aptId = requireApartmentId(apartmentId);
    const from = oldName.trim();
    const to   = newName.trim().toLowerCase();

    if (!to) throw new Error('El nombre no puede estar vacío.');
    if (to === from) return;
    if (from === 'otros') throw new Error('"Otros" no se puede renombrar: es donde caen los gastos sin clasificar.');

    const list = macro === 'hogar' ? hogarCategories : personalCategories;
    if (list.includes(to)) {
      throw new Error(`Ya tienes una categoría llamada "${getCategoryLabel(to)}".`);
    }

    const expenseQuery = supabase
      .from('expenses')
      .update({ category: to })
      .eq('apartment_id', aptId)
      .eq('category', from);

    // En personal se filtra por quien pagó de forma EXPLÍCITA. La política de
    // UPDATE de expenses es solo is_member(); que no toque los personales de
    // otro roommate dependería de que Postgres aplique también la de SELECT
    // por tener WHERE. Mejor no apostar la privacidad a esa sutileza: si
    // fallara, renombrar tu "salud" renombraría también la de tu roommate.
    let expErr;
    if (macro === 'personal') {
      const me = roommates.find(r => r.userId === user.id);
      if (!me) throw new Error('Tu perfil de roommate no está vinculado. Recarga e intenta de nuevo.');
      ({ error: expErr } = await expenseQuery.eq('macro_category', 'personal').eq('paid_by', me.id));
    } else {
      // Hogar = todo lo que no es personal, INCLUIDO macro_category NULL: los
      // gastos anteriores a esa columna lo tienen nulo y la app los trata como
      // hogar. Un .neq() solo los saltaría, porque en SQL NULL <> 'personal'
      // da NULL, no verdadero — quedarían con el nombre viejo.
      ({ error: expErr } = await expenseQuery.or('macro_category.is.null,macro_category.neq.personal'));
    }
    throwIfSupabaseError(expErr, 'No se pudieron actualizar los gastos de esa categoría.');

    // Los recurrentes y su historial son del depa, así que solo aplican a hogar.
    if (macro === 'hogar') {
      const { error: billErr } = await supabase
        .from('bills').update({ category: to }).eq('apartment_id', aptId).eq('category', from);
      throwIfSupabaseError(billErr, 'No se pudieron actualizar los gastos recurrentes.');

      const { error: histErr } = await supabase
        .from('bill_history').update({ category: to }).eq('apartment_id', aptId).eq('category', from);
      throwIfSupabaseError(histErr, 'No se pudo actualizar el historial de recurrentes.');
    }

    // Recién ahora la lista
    const renamed = list.map(c => (c === from ? to : c));
    if (macro === 'hogar') await setHogarCategories(renamed);
    else                   await setPersonalCategories(renamed);

    // Reflejar el cambio en memoria para no tener que recargar
    // Mismo alcance que el UPDATE: en personal, solo los que pagué yo
    const myId = roommates.find(r => r.userId === user.id)?.id;
    setExpenses(prev => prev.map(e => {
      if (e.category !== from) return e;
      const isPersonal = e.macroCategory === 'personal';
      if (macro === 'personal' ? (isPersonal && e.paidBy === myId) : !isPersonal) {
        return { ...e, category: to };
      }
      return e;
    }));
    if (macro === 'hogar') {
      setBills(prev => prev.map(b => b.category === from ? { ...b, category: to } : b));
      setBillHistory(prev => prev.map(h => h.category === from ? { ...h, category: to } : h));
    }
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
    loadError,
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
    hogarCategories, personalCategories, setHogarCategories, setPersonalCategories, renameCategory,
    addPost, updatePost, deletePost, addReply,
    addTrustedService, updateTrustedService, deleteTrustedService,
    reload: loadAll,
  };
}
