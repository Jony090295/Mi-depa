import { useState } from 'react';
import { Copy, Check, Share2, X, PartyPopper } from 'lucide-react';

interface Props {
  inviteCode: string;
  apartmentName: string;
  onClose: () => void;
}

/**
 * Se muestra una sola vez, justo al entrar por primera vez después del setup.
 *
 * Antes el link vivía dentro del paso "¿Vives con roommates?", donde invitaba
 * a salirse del registro a medias. Aquí el setup ya terminó, así que compartir
 * el link no interrumpe nada.
 */
export default function InviteRoommatesModal({ inviteCode, apartmentName, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}?join=${inviteCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* el link está visible en pantalla, se puede copiar a mano */
    }
  }

  async function share() {
    const text = `Te invito a ${apartmentName} en Mi Depa para llevar las cuentas juntos: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mi Depa', text, url: link });
        return;
      } catch {
        /* el usuario canceló el diálogo del sistema */
      }
    }
    copy();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl animate-slide-up">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
        >
          <X size={14} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center mb-4">
          <PartyPopper size={24} className="text-indigo-600" />
        </div>

        <h2 className="text-[19px] font-black text-zinc-900 dark:text-zinc-100 leading-tight">
          ¡{apartmentName} está listo!
        </h2>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          Comparte este link con tus roommates para que se unan y vean los gastos.
        </p>

        <div className="mt-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3.5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Tu link</p>
          <p className="text-[12px] text-zinc-600 dark:text-zinc-300 break-all leading-snug">{link}</p>
        </div>

        <div className="flex gap-2.5 mt-4">
          <button
            onClick={copy}
            className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            {copied ? <><Check size={15} className="text-emerald-500" /> Copiado</> : <><Copy size={15} /> Copiar</>}
          </button>
          <button
            onClick={share}
            className="flex-1 h-11 rounded-2xl bg-indigo-600 text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/30 active:scale-[0.98] transition"
          >
            <Share2 size={15} /> Compartir
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 h-10 text-zinc-400 text-[13px] font-medium"
        >
          Lo hago después
        </button>

        <p className="text-[11px] text-zinc-400 text-center mt-1 leading-relaxed">
          Lo encuentras cuando quieras en Inicio → Configuración del depa.
        </p>
      </div>
    </div>
  );
}
