import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Home, Users, ArrowRight, Loader, Copy, Check, Link, UserPlus, ChevronRight } from 'lucide-react';

interface Props {
  user: User;
  onReady: () => void;
  initialCode?: string;
}

type Step = 'choose' | 'create' | 'invite' | 'costs' | 'split' | 'join';

const SPLIT_OPTIONS = [
  { value: 'equitativo', label: 'Equitativo', desc: 'Cada uno paga lo mismo' },
  { value: 'proporcional', label: 'Proporcional', desc: 'Según el ingreso de cada uno' },
] as const;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all ${i === current ? 'w-5 h-2 bg-indigo-600' : 'w-2 h-2 bg-zinc-200 dark:bg-zinc-700'}`} />
      ))}
    </div>
  );
}

export default function ApartmentSetupScreen({ user, onReady, initialCode }: Props) {
  const [step, setStep] = useState<Step>(initialCode ? 'join' : 'choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create form
  const [deptName, setDeptName] = useState('');
  const [deptAddress, setDeptAddress] = useState('');
  const [myName, setMyName] = useState('');

  // Created apartment state (persists across steps)
  const [aptId, setAptId] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Costs step
  const [rent, setRent] = useState('');
  const [maintenance, setMaintenance] = useState('');

  // Split step
  const [splitType, setSplitType] = useState<'equitativo' | 'proporcional'>('equitativo');

  // Join form
  const [inviteCode, setInviteCode] = useState(initialCode ?? '');
  const [joinName, setJoinName] = useState('');

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

      await supabase.from('roommates').insert({
        apartment_id: apt.id,
        name: myName.trim(),
        income: 0,
        color: '#6366f1',
        sort_order: 0,
        user_id: user.id,
      });

      setAptId(apt.id);
      setInviteLink(`${window.location.origin}?join=${apt.invite_code}`);
      setStep('invite');
    } catch (err: any) {
      setError(err.message || 'Error al crear el depa.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleSaveCosts = async () => {
    setLoading(true);
    try {
      await supabase.from('apartments').update({
        rent: parseFloat(rent) || 0,
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
    try {
      await supabase.from('apartments').update({
        default_split_type: splitType,
      }).eq('id', aptId);
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
        .select('id')
        .eq('apartment_id', apt.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        const { error: memErr } = await supabase
          .from('apartment_members')
          .insert({ apartment_id: apt.id, user_id: user.id, role: 'member' });
        if (memErr) throw memErr;

        await supabase.from('roommates').insert({
          apartment_id: apt.id,
          name: joinName.trim(),
          income: 0,
          color: '#ec4899',
          sort_order: 99,
          user_id: user.id,
        });
      }

      sessionStorage.removeItem('pendingJoinCode');
      onReady();
    } catch (err: any) {
      setError(err.message || 'Error al unirse al depa.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'mt-1 w-full h-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'text-xs font-bold uppercase tracking-wide text-zinc-400';

  // ── Choose ───────────────────────────────────────────────────────
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
        </div>
      </div>
    );
  }

  // ── Create ───────────────────────────────────────────────────────
  if (step === 'create') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <StepDots current={0} total={3} />
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
            <button type="button" onClick={() => setStep('choose')} className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">
              ← Volver
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Invite ───────────────────────────────────────────────────────
  if (step === 'invite') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <StepDots current={0} total={3} />
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-950/40 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <UserPlus size={24} className="text-indigo-600" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Invita a tus compañeros</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Comparte el link para que se unan al depa.</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Link size={14} className="text-zinc-400 shrink-0" />
              <p className="text-[12px] text-zinc-400 truncate flex-1">{inviteLink}</p>
            </div>
            <button onClick={handleCopyLink}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.98]">
              {linkCopied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar link de invitación</>}
            </button>
          </div>

          <button onClick={() => setStep('costs')}
            className="w-full h-12 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            Invitar después <ChevronRight size={16} />
          </button>

          {linkCopied && (
            <button onClick={() => setStep('costs')}
              className="w-full mt-3 text-indigo-600 font-semibold text-sm text-center">
              Continuar →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Costs ────────────────────────────────────────────────────────
  if (step === 'costs') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <StepDots current={1} total={3} />
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Gastos del depa</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">¿Cuánto pagan de alquiler y mantenimiento?</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Alquiler mensual (S/)</label>
              <input type="number" inputMode="decimal" value={rent} onChange={e => setRent(e.target.value)}
                placeholder="Ej. 2500" className={inputCls} />
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
            <button type="button" onClick={() => { setRent(''); setMaintenance(''); setStep('split'); }}
              className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">
              Completar después
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Split ────────────────────────────────────────────────────────
  if (step === 'split') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <StepDots current={2} total={3} />
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">¿Cómo dividen los gastos?</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Esto se aplica por defecto a cada gasto nuevo. Puedes cambiarlo después.</p>
          </div>

          <div className="space-y-3 mb-6">
            {SPLIT_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setSplitType(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all ${
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

          {error && <p className="text-rose-500 text-sm font-medium mb-3">{error}</p>}

          <button onClick={handleSaveSplit} disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? <Loader size={18} className="animate-spin" /> : <>Entrar al depa <ArrowRight size={16} /></>}
          </button>
        </div>
      </div>
    );
  }

  // ── Join ─────────────────────────────────────────────────────────
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
          <button type="button" onClick={() => setStep('choose')} className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">
            ← Volver
          </button>
        </form>
      </div>
    </div>
  );
}
