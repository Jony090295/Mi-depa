import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Home, Mail, Lock, Eye, EyeOff, ArrowRight, Loader } from 'lucide-react';

type Mode = 'login' | 'signup';

export default function AuthScreen({ joinCode }: { joinCode?: string }) {
  const [mode, setMode]         = useState<Mode>(joinCode ? 'signup' : 'login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is disabled in Supabase, session is returned immediately
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos.'
          : err.message === 'User already registered'
          ? 'Ya tienes una cuenta. Inicia sesión.'
          : err.message || 'Ocurrió un error. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-950/40 rounded-3xl flex items-center justify-center mx-auto">
            <Mail size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Revisa tu correo</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            Te enviamos un link de confirmación a <strong className="text-zinc-700 dark:text-zinc-200">{email}</strong>.<br />
            Haz click en el link y luego vuelve aquí para iniciar sesión.
          </p>
          <button
            onClick={() => { setSent(false); setMode('login'); }}
            className="text-indigo-600 font-semibold text-sm underline"
          >
            Ya confirmé — iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200 dark:shadow-none">
            <Home size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Mi Depa</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Gastos compartidos, sin complicaciones.</p>
        </div>

        {joinCode && (
          <div className="mb-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl px-4 py-3 text-center">
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Te invitaron a un depa 🏠</p>
            <p className="text-xs text-indigo-500 mt-0.5">Crea tu cuenta para unirte automáticamente.</p>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-1 mb-6">
          {(['login', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña (mín. 6 caracteres)"
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

          {/* Error */}
          {error && (
            <p className="text-rose-500 text-sm font-medium text-center animate-fadeIn">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader size={18} className="animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-6">
          Al continuar aceptas nuestros términos de uso.
        </p>
      </div>
    </div>
  );
}
