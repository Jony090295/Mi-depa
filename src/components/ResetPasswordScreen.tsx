import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Home, Lock, Eye, EyeOff, ArrowRight, Loader, CheckCircle } from 'lucide-react';

const MIN_LENGTH = 12;

export default function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      const msg = err.message ?? '';
      // Supabase can require the previous password when "Require current password
      // when updating" is enabled. That setting makes recovery impossible, so say
      // so plainly instead of showing a cryptic API error.
      if (/current.?password/i.test(msg)) {
        setError(
          'Tu proyecto exige la contraseña anterior para cambiarla, así que el ' +
          'reseteo por correo no puede funcionar. Desactiva "Require current ' +
          'password when updating" en Supabase → Authentication → Email.'
        );
      } else if (/should be at least|password.*short|weak/i.test(msg)) {
        setError(`La contraseña es muy débil. Usa al menos ${MIN_LENGTH} caracteres con mayúsculas, números y símbolos.`);
      } else if (/same.?password|different from the old/i.test(msg)) {
        setError('La nueva contraseña debe ser distinta a la anterior.');
      } else if (/expired|invalid|session missing|not authenticated/i.test(msg)) {
        setError('Este link ya no es válido o expiró. Pide uno nuevo desde "Olvidé mi contraseña".');
      } else {
        setError(msg || 'No se pudo cambiar la contraseña. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-3xl flex items-center justify-center mx-auto">
            <CheckCircle size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Contraseña actualizada</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            Ya puedes seguir usando Mi Depa con tu nueva contraseña.
          </p>
          <button
            onClick={onDone}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Continuar
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200 dark:shadow-none">
            <Home size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Nueva contraseña</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Elige una contraseña para tu cuenta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={MIN_LENGTH}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={`Nueva contraseña (mín. ${MIN_LENGTH})`}
              className="w-full h-12 pl-10 pr-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPw(s => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={MIN_LENGTH}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="text-rose-500 text-sm font-medium text-center animate-fadeIn leading-relaxed">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={18} className="animate-spin" /> : <>Guardar contraseña <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
