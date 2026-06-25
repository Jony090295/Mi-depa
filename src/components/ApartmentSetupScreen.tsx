import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  Home, Users, ArrowRight, Loader, Copy, Check,
  Link, UserPlus, Plus, Trash2, ChevronRight,
} from 'lucide-react';

interface Props {
  user: User;
  onReady: () => void;
  initialCode?: string;
  resumeAptId?: string;
  resumeInviteCode?: string;
}

type Step = 'choose' | 'create' | 'roommates' | 'costs' | 'split' | 'join';
type SplitType = 'equitativo' | 'proporcional' | 'porcentaje';

interface RoommateEntry {
  tempId: string;
  name: string;
  income: string;
  percent: string;
  dbId?: string;
}

const COLORS = ['#ec4899','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444','#14b8a6'];

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all ${i === current ? 'w-5 h-2 bg-indigo-600' : 'w-2 h-2 bg-zinc-200 dark:bg-zinc-700'}`} />
      ))}
    </div>
  );
}

const inputCls = 'mt-1 w-full h-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const labelCls = 'text-xs font-bold uppercase tracking-wide text-zinc-400';

export default function ApartmentSetupScreen({ user, onReady, initialCode, resumeAptId, resumeInviteCode }: Props) {
  const [step, setStep] = useState<Step>(resumeAptId ? 'roommates' : initialCode ? 'join' : 'choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create form
  const [deptName, setDeptName] = useState('');
  const [deptAddress, setDeptAddress] = useState('');
  const [myName, setMyName] = useState('');
  const [creatorIncome, setCreatorIncome] = useState('');
  const [creatorPercent, setCreatorPercent] = useState('');
  const [creatorDbId, setCreatorDbId] = useState('');

  // Apartment created state
  const [aptId, setAptId] = useState(resumeAptId ?? '');
  const [inviteLink, setInviteLink] = useState(resumeInviteCode ? `${window.location.origin}?join=${resumeInviteCode}` : '');
  const [linkCopied, setLinkCopied] = useState(false);

  // Roommates step
  const [hasRoommates, setHasRoommates] = useState<boolean | null>(null);
  const [roommates, setRoommates] = useState<RoommateEntry[]>([
    { tempId: crypto.randomUUID(), name: '', income: '', percent: '' },
  ]);
  const [roommatesLoaded, setRoommatesLoaded] = useState(false);

  // On resume: load all existing data and resume at the correct step
  useEffect(() => {
    if (!resumeAptId || roommatesLoaded) return;
    Promise.all([
      supabase.from('apartments').select('rent, maintenance, rent_currency, default_split_type, default_split_percentages').eq('id', resumeAptId).single(),
      supabase.from('roommates').select('id, name, income, color, user_id').eq('apartment_id', resumeAptId),
    ]).then(([{ data: apt }, { data: rms }]) => {
      let resumeStep: Step = 'roommates';

      // Pre-populate costs and split
      if (apt) {
        if (apt.rent) setRent(String(apt.rent));
        if (apt.maintenance) setMaintenance(String(apt.maintenance));
        if (apt.default_split_type) setSplitType(apt.default_split_type as SplitType);
        // If costs were already saved, resume at split
        if (apt.rent > 0 || apt.maintenance > 0) resumeStep = 'split';
      }

      // Pre-populate roommates
      if (rms) {
        const percs: Record<string, number> = apt?.default_split_percentages ?? {};
        const creator = rms.find(r => r.user_id === user.id);
        if (creator) {
          setMyName(creator.name);
          setCreatorDbId(creator.id);
          setCreatorIncome(creator.income ? String(creator.income) : '');
          setCreatorPercent(percs[creator.id] ? String(percs[creator.id]) : '');
        }
        const pending = rms.filter(r => !r.user_id);
        if (pending.length > 0) {
          setHasRoommates(true);
          setRoommates(pending.map(r => ({
            tempId: r.id, name: r.name, dbId: r.id,
            income: r.income ? String(r.income) : '',
            percent: percs[r.id] ? String(percs[r.id]) : '',
          })));
          if (resumeStep === 'roommates') resumeStep = 'costs';
        }
      }

      setStep(resumeStep);
      setRoommatesLoaded(true);
    });
  }, [resumeAptId, roommatesLoaded]);

  // Costs step
  const [rent, setRent] = useState('');
  const [maintenance, setMaintenance] = useState('');

  // Split step
  const [splitType, setSplitType] = useState<SplitType>('equitativo');

  // Join form
  const [inviteCode, setInviteCode] = useState(initialCode ?? '');
  const [joinName, setJoinName] = useState('');

  // ── Handlers ──────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: apt, error: aptErr } = await supabase
        .from('apartments')
        .insert({ name: deptName.trim(), address: deptAddress.trim(), created_by: user.id })
        .select()
        .single();
      if (aptErr) throw aptErr;

      const { error: memErr } = await supabase
        .from('apartment_members')
        .insert({ apartment_id: apt.id, user_id: user.id, role: 'owner' });
      if (memErr) throw memErr;

      const { data: rmRow } = await supabase.from('roommates').insert({
        apartment_id: apt.id,
        name: myName.trim(),
        income: 0,
        color: '#6366f1',
        sort_order: 0,
        user_id: user.id,
      }).select('id').single();

      setAptId(apt.id);
      setCreatorDbId(rmRow?.id ?? '');
      setInviteLink(`${window.location.origin}?join=${apt.invite_code}`);
      setStep('roommates');
    } catch (err: any) {
      setError(err.message || 'Error al crear el depa.');
    } finally {
      setLoading(false);
    }
  };

  const addRoommate = () => {
    setRoommates(prev => [...prev, { tempId: crypto.randomUUID(), name: '', income: '', percent: '' }]);
  };

  const removeRoommate = (tempId: string) => {
    setRoommates(prev => prev.filter(r => r.tempId !== tempId));
  };

  const updateRoommate = (tempId: string, field: keyof RoommateEntry, value: string) => {
    setRoommates(prev => prev.map(r => r.tempId === tempId ? { ...r, [field]: value } : r));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleSaveRoommates = async () => {
    const named = roommates.filter(r => r.name.trim());
    if (hasRoommates && named.length === 0) { setError('Agrega al menos un roommate o elige "Sin roommates".'); return; }
    setError('');
    setLoading(true);
    try {
      const toInsert = named.filter(r => !r.dbId);
      const toUpdate = named.filter(r => r.dbId);

      // Update existing rows (name may have changed)
      for (const r of toUpdate) {
        await supabase.from('roommates').update({ name: r.name.trim() }).eq('id', r.dbId!);
      }

      // Insert only truly new ones
      if (toInsert.length > 0) {
        const { data: inserted } = await supabase.from('roommates').insert(
          toInsert.map((r, i) => ({
            apartment_id: aptId,
            name: r.name.trim(),
            income: 0,
            color: COLORS[(toUpdate.length + i) % COLORS.length],
            sort_order: toUpdate.length + i + 1,
          }))
        ).select('id, name');
        if (inserted) {
          setRoommates(prev => prev.map(r => {
            const match = inserted.find(ins => ins.name === r.name.trim());
            return match ? { ...r, dbId: match.id } : r;
          }));
        }
      }
      setStep('costs');
    } catch (err: any) {
      setError(err.message || 'Error al guardar roommates.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCosts = async () => {
    setLoading(true);
    setError('');
    try {
      await supabase.from('apartments').update({
        rent: parseFloat(rent) || 0,
        rent_currency: 'USD',
        maintenance: parseFloat(maintenance) || 0,
      }).eq('id', aptId);
      setStep('split');
    } catch (err: any) {
      setError(err.message || 'Error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSplit = async () => {
    setLoading(true);
    setError('');
    try {
      const allPeople = [
        { id: creatorDbId, name: myName, income: creatorIncome, percent: creatorPercent },
        ...roommates.filter(r => r.name.trim() && r.dbId).map(r => ({ id: r.dbId!, name: r.name, income: r.income, percent: r.percent })),
      ];

      if (splitType === 'porcentaje') {
        const total = allPeople.reduce((s, p) => s + (parseFloat(p.percent) || 0), 0);
        if (Math.abs(total - 100) > 0.5) { setError(`Los porcentajes deben sumar 100% (suma actual: ${total.toFixed(0)}%)`); setLoading(false); return; }
        const percs: Record<string, number> = {};
        for (const p of allPeople) if (p.id) percs[p.id] = parseFloat(p.percent) || 0;
        await supabase.from('apartments').update({ default_split_type: 'porcentaje', default_split_percentages: percs }).eq('id', aptId);
      } else if (splitType === 'proporcional') {
        for (const p of allPeople) {
          if (p.id) await supabase.from('roommates').update({ income: parseFloat(p.income) || 0 }).eq('id', p.id);
        }
        await supabase.from('apartments').update({ default_split_type: 'proporcional' }).eq('id', aptId);
      } else {
        await supabase.from('apartments').update({ default_split_type: 'equitativo' }).eq('id', aptId);
      }

      await supabase.from('apartments').update({ onboarding_complete: true }).eq('id', aptId);
      onReady();
    } catch (err: any) {
      setError(err.message || 'Error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: apt, error: aptErr } = await supabase
        .from('apartments')
        .select('id')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single();
      if (aptErr || !apt) throw new Error('Código inválido. Verifica con tu compañero.');

      const { data: existing } = await supabase
        .from('apartment_members')
        .select('id').eq('apartment_id', apt.id).eq('user_id', user.id).maybeSingle();

      if (!existing) {
        const { error: memErr } = await supabase
          .from('apartment_members')
          .insert({ apartment_id: apt.id, user_id: user.id, role: 'member' });
        if (memErr) throw memErr;

        // Try to claim a pending roommate slot with the same name, else create new
        const { data: pending } = await supabase
          .from('roommates')
          .select('id')
          .eq('apartment_id', apt.id)
          .eq('name', joinName.trim())
          .is('user_id', null)
          .maybeSingle();

        if (pending) {
          await supabase.from('roommates').update({ user_id: user.id }).eq('id', pending.id);
        } else {
          await supabase.from('roommates').insert({
            apartment_id: apt.id, name: joinName.trim(),
            income: 0, color: '#ec4899', sort_order: 99, user_id: user.id,
          });
        }
      }

      sessionStorage.removeItem('pendingJoinCode');
      onReady();
    } catch (err: any) {
      setError(err.message || 'Error al unirse al depa.');
    } finally {
      setLoading(false);
    }
  };

  // ── Choose ────────────────────────────────────────────────────────
  if (step === 'choose') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200 dark:shadow-none">
              <Home size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">¿Tu depa o te invitaron?</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Solo la primera vez.</p>
          </div>
          <button onClick={() => setStep('create')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl font-bold text-sm flex items-center justify-between px-5 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-3">
              <Home size={20} />
              <div className="text-left">
                <p className="font-bold">Crear mi depa</p>
                <p className="text-xs text-indigo-200">Soy el que organiza todo</p>
              </div>
            </div>
            <ArrowRight size={18} />
          </button>
          <button onClick={() => setStep('join')}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 h-14 rounded-2xl font-bold text-sm flex items-center justify-between px-5 active:scale-[0.98] transition-all text-zinc-800 dark:text-zinc-100">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-zinc-500" />
              <div className="text-left">
                <p className="font-bold">Unirme a un depa</p>
                <p className="text-xs text-zinc-400">Tengo un código de invitación</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-zinc-400" />
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()}
            className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition pt-2">
            Usar otra cuenta
          </button>
        </div>
      </div>
    );
  }

  // ── Create ────────────────────────────────────────────────────────
  if (step === 'create') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <StepDots current={0} total={4} />
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Crear mi depa</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Cuéntanos un poco sobre tu depa.</p>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className={labelCls}>Nombre del depa</label>
              <input type="text" required value={deptName} onChange={e => setDeptName(e.target.value)}
                placeholder="Ej. Depa Miraflores" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dirección <span className="normal-case font-normal">(opcional)</span></label>
              <input type="text" value={deptAddress} onChange={e => setDeptAddress(e.target.value)}
                placeholder="Ej. Av. Larco 123" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tu nombre en el depa</label>
              <input type="text" required value={myName} onChange={e => setMyName(e.target.value)}
                placeholder="Ej. Carlos" className={inputCls} />
            </div>
            {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              {loading ? <Loader size={18} className="animate-spin" /> : <>Siguiente <ArrowRight size={16} /></>}
            </button>
            <button type="button" onClick={() => setStep('choose')} className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">← Volver</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Roommates ─────────────────────────────────────────────────────
  if (step === 'roommates') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-sm">
          <StepDots current={1} total={4} />
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-950/40 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <UserPlus size={24} className="text-indigo-600" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">¿Vives con roommates?</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Cuéntanos quiénes son para invitarlos.</p>
          </div>

          {/* Yes / No */}
          {hasRoommates === null && (
            <div className="flex gap-3 mb-4">
              <button onClick={() => setHasRoommates(true)}
                className="flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-sm active:scale-[0.98] transition">
                Sí, tengo roommates
              </button>
              <button onClick={() => { setHasRoommates(false); setRoommates([]); }}
                className="flex-1 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-sm active:scale-[0.98] transition">
                Solo yo
              </button>
            </div>
          )}

          {hasRoommates === true && (
            <div className="space-y-3 mb-4">
              {roommates.map((r, i) => (
                <div key={r.tempId} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {r.name.charAt(0) || '?'}
                  </div>
                  <input
                    type="text"
                    value={r.name}
                    onChange={e => updateRoommate(r.tempId, 'name', e.target.value)}
                    placeholder={`Roommate ${i + 1}`}
                    className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {roommates.length > 1 && (
                    <button type="button" onClick={() => removeRoommate(r.tempId)}
                      className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-rose-500 transition shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addRoommate}
                className="w-full h-10 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 text-sm font-medium flex items-center justify-center gap-2 hover:border-indigo-400 hover:text-indigo-500 transition">
                <Plus size={15} /> Agregar otro
              </button>
            </div>
          )}

          {/* Invite link */}
          {(hasRoommates === true || hasRoommates === false) && (
            <>
              {hasRoommates && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 mb-4">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Link de invitación</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Link size={13} className="text-zinc-400 shrink-0" />
                    <p className="text-[11px] text-zinc-400 truncate flex-1">{inviteLink}</p>
                  </div>
                  <button onClick={handleCopyLink}
                    className="w-full h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-sm font-semibold flex items-center justify-center gap-2 transition hover:bg-indigo-100">
                    {linkCopied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
                  </button>
                </div>
              )}

              {error && <p className="text-rose-500 text-sm font-medium mb-3">{error}</p>}

              <button onClick={handleSaveRoommates} disabled={loading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                {loading ? <Loader size={18} className="animate-spin" /> : <>Invitar después <ArrowRight size={16} /></>}
              </button>
              {!resumeAptId && (
                <button type="button" onClick={() => setStep('create')}
                  className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">← Volver</button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Costs ─────────────────────────────────────────────────────────
  if (step === 'costs') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <StepDots current={2} total={4} />
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Gastos del depa</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">¿Cuánto pagan de alquiler y mantenimiento?</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Alquiler mensual (USD)</label>
              <input type="number" inputMode="decimal" value={rent} onChange={e => setRent(e.target.value)}
                placeholder="Ej. 800" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mantenimiento mensual (S/)</label>
              <input type="number" inputMode="decimal" value={maintenance} onChange={e => setMaintenance(e.target.value)}
                placeholder="Ej. 300" className={inputCls} />
            </div>
            {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}
            <button onClick={handleSaveCosts} disabled={loading}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              {loading ? <Loader size={18} className="animate-spin" /> : <>Siguiente <ArrowRight size={16} /></>}
            </button>
            <button type="button" onClick={() => setStep('split')}
              className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">
              Completar después
            </button>
            <button type="button" onClick={() => setStep('roommates')}
              className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">← Volver</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Split ─────────────────────────────────────────────────────────
  if (step === 'split') {
    const allPeople = [
      { tempId: 'creator', name: myName, income: creatorIncome, percent: creatorPercent,
        setIncome: setCreatorIncome, setPercent: setCreatorPercent },
      ...roommates.filter(r => r.name.trim()).map(r => ({
        tempId: r.tempId, name: r.name,
        income: r.income, percent: r.percent,
        setIncome: (v: string) => updateRoommate(r.tempId, 'income', v),
        setPercent: (v: string) => updateRoommate(r.tempId, 'percent', v),
      })),
    ];

    const percentTotal = allPeople.reduce((s, p) => s + (parseFloat(p.percent) || 0), 0);

    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-start justify-center p-6 pt-10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-full max-w-sm">
          <StepDots current={3} total={4} />
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">¿Cómo dividen los gastos?</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Se aplica por defecto. Puedes cambiarlo después.</p>
          </div>

          {/* Option selector */}
          <div className="space-y-2 mb-5">
            {([
              { value: 'equitativo', label: 'Equitativo', desc: 'Cada uno paga lo mismo' },
              { value: 'proporcional', label: 'Por ingresos', desc: 'Según el sueldo de cada uno' },
              { value: 'porcentaje', label: '% Personalizado', desc: 'Tú defines el porcentaje de cada uno' },
            ] as { value: SplitType; label: string; desc: string }[]).map(opt => (
              <button key={opt.value} type="button" onClick={() => setSplitType(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
                  splitType === opt.value
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                }`}>
                <div className="text-left">
                  <p className={`text-sm font-bold ${splitType === opt.value ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-800 dark:text-zinc-100'}`}>{opt.label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{opt.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  splitType === opt.value ? 'border-indigo-600 bg-indigo-600' : 'border-zinc-300 dark:border-zinc-600'
                }`}>
                  {splitType === opt.value && <Check size={11} className="text-white stroke-[3]" />}
                </div>
              </button>
            ))}
          </div>

          {/* Per-person inputs */}
          {(splitType === 'proporcional' || splitType === 'porcentaje') && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 mb-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                {splitType === 'proporcional' ? 'Ingreso mensual por persona (S/)' : 'Porcentaje por persona (%)'}
              </p>
              {allPeople.map((p, i) => (
                <div key={p.tempId} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: i === 0 ? '#6366f1' : COLORS[(i - 1) % COLORS.length] }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{p.name}</span>
                  <input
                    type="number" inputMode="decimal"
                    value={splitType === 'proporcional' ? p.income : p.percent}
                    onChange={e => splitType === 'proporcional' ? p.setIncome(e.target.value) : p.setPercent(e.target.value)}
                    placeholder={splitType === 'proporcional' ? '0' : '0'}
                    className="w-24 h-9 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-right text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-zinc-400 shrink-0 w-4">{splitType === 'porcentaje' ? '%' : ''}</span>
                </div>
              ))}
              {splitType === 'porcentaje' && (
                <div className={`flex justify-between text-xs font-semibold pt-1 border-t border-zinc-100 dark:border-zinc-800 ${Math.abs(percentTotal - 100) < 0.5 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <span>Total</span>
                  <span>{percentTotal.toFixed(0)}%</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-rose-500 text-sm font-medium mb-3">{error}</p>}

          <button onClick={handleSaveSplit} disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? <Loader size={18} className="animate-spin" /> : <>Entrar al depa <ArrowRight size={16} /></>}
          </button>
          <button type="button" onClick={() => setStep('costs')}
            className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">← Volver</button>
        </div>
      </div>
    );
  }

  // ── Join ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Unirme a un depa</h2>
          <p className="text-zinc-500 text-sm mt-1">Pídele el código de invitación a tu compañero.</p>
        </div>
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className={labelCls}>Código de invitación</label>
            <input type="text" required maxLength={8}
              value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Ej. AB12CD34"
              className={`${inputCls} font-mono tracking-widest uppercase`} />
          </div>
          <div>
            <label className={labelCls}>Tu nombre en el depa</label>
            <input type="text" required value={joinName} onChange={e => setJoinName(e.target.value)}
              placeholder="Ej. Sofía" className={inputCls} />
          </div>
          {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? <Loader size={18} className="animate-spin" /> : <><Users size={16} /> Unirme</>}
          </button>
          <button type="button" onClick={() => setStep('choose')} className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">← Volver</button>
        </form>
      </div>
    </div>
  );
}
