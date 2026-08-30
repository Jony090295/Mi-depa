import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Home, Mail, Lock, Eye, EyeOff, ArrowRight, Loader } from 'lucide-react';

type Mode = 'login' | 'signup' | 'forgot';

const MIN_LENGTH = 12;

/**
 * Supabase devuelve los errores de auth en inglés, y el de requisitos de
 * contraseña vuelca los cuatro sets de caracteres completos. Traducirlos
 * a algo accionable, porque es lo primero que ve alguien que se registra.
 */
function friendlyAuthError(raw: string): string {
  const m = raw ?? '';

  if (/invalid login credentials/i.test(m))
    return 'Email o contraseña incorrectos.';
  if (/user already registered|already been registered/i.test(m))
    return 'Ya tienes una cuenta con este correo. Inicia sesión.';
  if (/should contain at least one character/i.test(m))
    return 'La contraseña necesita mayúsculas, minúsculas, un número y un símbolo.';
  if (/should be at least|password.*too short/i.test(m))
    return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
  if (/unable to validate email|invalid format/i.test(m))
    return 'Ese correo no parece válido.';
  if (/email not confirmed/i.test(m))
    return 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja.';
  if (/only request this after|rate limit|too many requests/i.test(m))
    return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (/weak password/i.test(m))
    return 'Esa contraseña es muy fácil de adivinar. Prueba con una más larga.';

  return m || 'Ocurrió un error. Intenta de nuevo.';
}

export default function AuthScreen({ joinCode }: { joinCode?: string }) {
  const [mode, setMode]         = useState<Mode>(joinCode ? 'signup' : 'login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setResetSent(true);
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is disabled in Supabase, session is returned immediately
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(friendlyAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  if (resetSent) {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-950/40 rounded-3xl flex items-center justify-center mx-auto">
            <Mail size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Revisa tu correo</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            Si <strong className="text-zinc-700 dark:text-zinc-200">{email}</strong> tiene una cuenta,
            te llegó un link para elegir una contraseña nueva.<br />
            Revisa también la carpeta de spam.
          </p>
          <button
            onClick={() => { setResetSent(false); setMode('login'); setPassword(''); }}
            className="text-indigo-600 font-semibold text-sm underline"
          >
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

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
        {mode === 'forgot' ? (
          <div className="mb-6 text-center">
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Escribe tu correo y te enviamos un link para elegir una contraseña nueva.
            </p>
          </div>
        ) : (
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
        )}

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
          {mode !== 'forgot' && (
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={mode === 'signup' ? MIN_LENGTH : 6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? `Contraseña (mín. ${MIN_LENGTH} caracteres)` : 'Contraseña'}
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
          )}

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
                {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar link'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Forgot password */}
        <div className="text-center mt-5">
          {mode === 'forgot' ? (
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="text-indigo-600 font-semibold text-[13px] underline"
            >
              Volver a iniciar sesión
            </button>
          ) : mode === 'login' ? (
            <button
              onClick={() => { setMode('forgot'); setError(''); setPassword(''); }}
              className="text-zinc-500 dark:text-zinc-400 font-medium text-[13px] underline"
            >
              Olvidé mi contraseña
            </button>
          ) : null}
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">
          Al continuar aceptas nuestros términos de uso.
        </p>
      </div>
    </div>
  );
}
