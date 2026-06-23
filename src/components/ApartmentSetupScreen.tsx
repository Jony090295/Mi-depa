import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Home, Users, ArrowRight, Loader, Copy, Check } from 'lucide-react';

interface Props {
  user: User;
  onReady: () => void;
  initialCode?: string;
}

type Step = 'choose' | 'create' | 'join';

export default function ApartmentSetupScreen({ user, onReady, initialCode }: Props) {
  const [step, setStep]           = useState<Step>(initialCode ? 'join' : 'choose');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Create form
  const [deptName, setDeptName]   = useState('');
  const [deptAddress, setDeptAddress] = useState('');
  const [myName, setMyName]       = useState('');
  const [created, setCreated]     = useState<{ code: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Join form
  const [inviteCode, setInviteCode] = useState(initialCode ?? '');
  const [joinName, setJoinName]     = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Create apartment
      const { data: apt, error: aptErr } = await supabase
        .from('apartments')
        .insert({ name: deptName.trim(), address: deptAddress.trim(), created_by: user.id })
        .select()
        .single();
      if (aptErr) throw aptErr;

      // 2. Add creator as owner member
      const { error: memErr } = await supabase
        .from('apartment_members')
        .insert({ apartment_id: apt.id, user_id: user.id, role: 'owner' });
      if (memErr) throw memErr;

      // 3. Add the creator as first roommate
      await supabase.from('roommates').insert({
        apartment_id: apt.id,
        name: myName.trim(),
        income: 0,
        color: '#6366f1',
        sort_order: 0,
      });

      setCreated({ code: apt.invite_code });
    } catch (err: any) {
      setError(err.message || 'Error al crear el depa.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Find apartment by invite code
      const { data: apt, error: aptErr } = await supabase
        .from('apartments')
        .select('id')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single();
      if (aptErr || !apt) throw new Error('Código inválido. Verifica con tu compañero.');

      // Check not already a member
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
        });
      }

      onReady();
    } catch (err: any) {
      setError(err.message || 'Error al unirse al depa.');
    } finally {
      setLoading(false);
    }
  };

  // ── Choose ──────────────────────────────────────────────────────
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

          <button
            onClick={() => setStep('create')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl font-bold text-sm flex items-center justify-between px-5 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <Home size={20} />
              <div className="text-left">
                <p className="font-bold">Crear mi depa</p>
                <p className="text-xs text-indigo-200">Soy el que organiza todo</p>
              </div>
            </div>
            <ArrowRight size={18} />
          </button>

          <button
            onClick={() => setStep('join')}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 h-14 rounded-2xl font-bold text-sm flex items-center justify-between px-5 active:scale-[0.98] transition-all text-zinc-800 dark:text-zinc-100"
          >
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

  // ── Create ──────────────────────────────────────────────────────
  if (step === 'create') {
    if (created) {
      return (
        <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">¡Depa creado!</h2>
              <p className="text-zinc-500 text-sm mt-1">Comparte este código con tus compañeros:</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 text-center">
              <p className="text-4xl font-black font-mono tracking-widest text-indigo-600">{created.code}</p>
              <button
                onClick={handleCopyCode}
                className="mt-3 flex items-center gap-1.5 mx-auto text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
              >
                {codeCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {codeCopied ? 'Copiado' : 'Copiar código'}
              </button>
            </div>

            <button
              onClick={onReady}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Entrar al depa <ArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Crear mi depa</h2>
            <p className="text-zinc-500 text-sm mt-1">Te generamos un código para invitar a tus compañeros.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">Nombre del depa</label>
              <input
                type="text" required
                value={deptName} onChange={e => setDeptName(e.target.value)}
                placeholder="Ej. Depa María y Carlos"
                className="mt-1 w-full h-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">Dirección</label>
              <input
                type="text"
                value={deptAddress} onChange={e => setDeptAddress(e.target.value)}
                placeholder="Ej. Av. Larco 123, Miraflores"
                className="mt-1 w-full h-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">Tu nombre en el depa</label>
              <input
                type="text" required
                value={myName} onChange={e => setMyName(e.target.value)}
                placeholder="Ej. Carlos"
                className="mt-1 w-full h-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <><Home size={16} /> Crear depa</>}
            </button>
            <button type="button" onClick={() => setStep('choose')} className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition">
              ← Volver
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Join ────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Unirme a un depa</h2>
          <p className="text-zinc-500 text-sm mt-1">Pídele el código de invitación a tu compañero.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">Código de invitación</label>
            <input
              type="text" required maxLength={8}
              value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Ej. AB12CD34"
              className="mt-1 w-full h-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm font-mono tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">Tu nombre en el depa</label>
            <input
              type="text" required
              value={joinName} onChange={e => setJoinName(e.target.value)}
              placeholder="Ej. Sofía"
              className="mt-1 w-full h-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
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
