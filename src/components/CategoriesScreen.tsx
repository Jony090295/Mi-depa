import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Lock, Plus, Loader, Check } from 'lucide-react';
import { HOGAR_DEFAULT_CATEGORIES, PERSONAL_DEFAULT_CATEGORIES } from '../types';
import { getCategoryLabel } from '../utils';
import { categoryIcon } from '../lib/categoryIcons';

type Macro = 'hogar' | 'personal';

interface Props {
  initialTab?: Macro;
  hogarCategories: string[];
  personalCategories: string[];
  /** Cuántos gastos/recurrentes usan una categoría. */
  usage: (cat: string, macro: Macro) => number;
  onAdd: (name: string, macro: Macro) => Promise<void>;
  onRename: (from: string, to: string, macro: Macro) => Promise<void>;
  /** Si la categoría está en uso, `moveTo` es obligatorio. */
  onDelete: (name: string, macro: Macro, moveTo?: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Gestión de categorías: lista, crear, renombrar y eliminar.
 *
 * Reemplaza a los chips que vivían en "Configuración del depa". Una lista en
 * vez de chips encendidos/apagados: lo que está en la lista existe y lo que no,
 * no — un chip gris dejaba la duda de si estaba borrado, filtrado o sugerido.
 *
 * Se abre encima de lo que haya debajo (incluido el formulario de gasto), así
 * que cerrarla devuelve al usuario a donde estaba sin perder lo que escribió.
 */
export default function CategoriesScreen({
  initialTab = 'hogar', hogarCategories, personalCategories, usage, onAdd, onRename, onDelete, onClose,
}: Props) {
  const [tab, setTab]           = useState<Macro>(initialTab);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding]     = useState(false);
  const [draft, setDraft]       = useState('');
  const [addError, setAddError] = useState('');
  const [busy, setBusy]         = useState(false);
  const [toast, setToast]       = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const list = tab === 'hogar' ? hogarCategories : personalCategories;
  const defaults: readonly string[] = tab === 'hogar' ? HOGAR_DEFAULT_CATEGORIES : PERSONAL_DEFAULT_CATEGORIES;
  const suggestions = defaults.filter(c => !list.includes(c));

  // Escape cierra la hoja, o la pantalla si no hay hoja abierta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) setSelected(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onClose]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2200);
  }

  async function add(raw: string) {
    const name = raw.trim().toLowerCase();
    setAddError('');
    if (!name) { setAdding(false); return; }
    if (list.includes(name)) {
      setAddError(`Ya tienes "${getCategoryLabel(name)}".`);
      // Dejar el texto seleccionado: lo siguiente que escribas lo reemplaza,
      // en vez de tener que borrarlo letra por letra en el teléfono.
      addInputRef.current?.select();
      return;
    }
    setBusy(true);
    try {
      await onAdd(name, tab);
      setDraft('');
      setAdding(false);
      flash(`"${getCategoryLabel(name)}" agregada`);
    } catch (err: any) {
      setAddError(err?.message ?? 'No se pudo agregar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] bg-zinc-50 dark:bg-zinc-950 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Categorías"
    >
      <div
        className="max-w-md mx-auto px-4 pb-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 h-12">
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver"
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300 active:bg-zinc-200/60 dark:active:bg-zinc-800"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">Categorías</h1>
        </div>

        {/* Hogar / Personales */}
        <div className="flex bg-zinc-200/60 dark:bg-zinc-800 rounded-2xl p-1 mt-2" role="tablist">
          {(['hogar', 'personal'] as const).map(m => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={tab === m}
              onClick={() => { setTab(m); setAdding(false); setAddError(''); }}
              className={`flex-1 h-9 rounded-xl text-[13px] font-semibold transition ${
                tab === m
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {m === 'hogar' ? 'Hogar' : 'Personales'}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2.5 px-1">
          {tab === 'hogar'
            ? 'Compartidas con todo el depa. Si cambias una, cambia para todos.'
            : 'Solo tú las ves. Cada roommate tiene las suyas.'}
        </p>

        {/* Lista */}
        <div className="mt-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          {list.map((cat, i) => {
            const Icon = categoryIcon(cat);
            const n = usage(cat, tab);
            const fixed = cat === 'otros';
            const rowCls = `w-full flex items-center gap-3 px-4 py-3 text-left ${i > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''}`;
            const content = (
              <>
                <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                  <Icon size={17} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium text-zinc-900 dark:text-zinc-100 truncate">{getCategoryLabel(cat)}</span>
                  <span className="block text-[12px] text-zinc-400 dark:text-zinc-500">
                    {fixed ? 'Aquí caen los gastos sin clasificar' : n === 0 ? 'Sin gastos' : n === 1 ? '1 gasto' : `${n} gastos`}
                  </span>
                </span>
                {fixed
                  ? <Lock size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" aria-label="No editable" />
                  : <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" />}
              </>
            );
            return fixed
              ? <div key={cat} className={rowCls}>{content}</div>
              : (
                <button key={cat} type="button" onClick={() => setSelected(cat)}
                  className={`${rowCls} active:bg-zinc-50 dark:active:bg-zinc-800/60 transition`}>
                  {content}
                </button>
              );
          })}

          {/* Nueva categoría */}
          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {adding ? (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={addInputRef}
                    autoFocus
                    value={draft}
                    onChange={e => { setDraft(e.target.value); setAddError(''); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); add(draft); }
                      if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setDraft(''); setAddError(''); }
                    }}
                    placeholder={tab === 'hogar' ? 'Mascotas' : 'Cursos'}
                    maxLength={24}
                    disabled={busy}
                    className="flex-1 h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => add(draft)}
                    disabled={busy}
                    className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold disabled:opacity-60"
                  >
                    {busy ? <Loader size={15} className="animate-spin" /> : 'Agregar'}
                  </button>
                </div>
                {addError && <p className="text-[12px] text-rose-500 font-medium mt-2">{addError}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-indigo-600 dark:text-indigo-400 active:bg-zinc-50 dark:active:bg-zinc-800/60 transition"
              >
                <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                  <Plus size={17} />
                </span>
                <span className="text-[14px] font-semibold">Nueva categoría</span>
              </button>
            )}
          </div>
        </div>

        {/* Sugerencias */}
        {suggestions.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1 mb-2">Sugerencias</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => add(cat)}
                  disabled={busy}
                  className="h-9 px-3 rounded-xl text-[13px] font-medium border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60"
                >
                  <Plus size={13} /> {getCategoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <CategorySheet
          key={selected}
          cat={selected}
          macro={tab}
          others={list.filter(c => c !== selected)}
          used={usage(selected, tab)}
          onClose={() => setSelected(null)}
          onRename={async to => {
            await onRename(selected, to, tab);
            setSelected(null);
            flash('Nombre actualizado');
          }}
          onDelete={async moveTo => {
            await onDelete(selected, tab, moveTo);
            setSelected(null);
            flash(moveTo ? `Gastos movidos a "${getCategoryLabel(moveTo)}"` : 'Categoría eliminada');
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-[320] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-medium px-4 py-2.5 rounded-full shadow-lg inline-flex items-center gap-2 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        >
          <Check size={14} /> {toast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

interface SheetProps {
  // React's JSX `key` is not available in this project without the optional
  // @types/react package, so declare it for type-checking only.
  key?: string;
  cat: string;
  macro: Macro;
  /** Las demás categorías de la lista: destinos posibles al eliminar. */
  others: string[];
  used: number;
  onClose: () => void;
  onRename: (to: string) => Promise<void>;
  onDelete: (moveTo?: string) => Promise<void>;
}

function CategorySheet({ cat, others, used, onClose, onRename, onDelete }: SheetProps) {
  const [step, setStep]     = useState<'edit' | 'delete'>('edit');
  const [name, setName]     = useState(getCategoryLabel(cat));
  const [moveTo, setMoveTo] = useState<string>(others.includes('otros') ? 'otros' : (others[0] ?? ''));
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = categoryIcon(cat);
  const unchanged = !name.trim() || name.trim().toLowerCase() === getCategoryLabel(cat).toLowerCase();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message ?? 'Algo falló. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[310] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl px-5 pt-3 shadow-2xl animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="w-9 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 mx-auto mb-4" />

        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
            <Icon size={18} />
          </span>
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100">
            {step === 'edit' ? getCategoryLabel(cat) : `Eliminar ${getCategoryLabel(cat)}`}
          </h2>
        </div>

        {step === 'edit' ? (
          <>
            <label htmlFor="cat-name" className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Nombre</label>
            <input
              id="cat-name"
              ref={inputRef}
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onFocus={e => e.currentTarget.select()}
              onKeyDown={e => {
                if (e.key === 'Enter' && !unchanged) { e.preventDefault(); run(() => onRename(name)); }
              }}
              maxLength={24}
              disabled={busy}
              className="mt-1 w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              {used === 0
                ? 'Ningún gasto usa esta categoría todavía.'
                : `${used === 1 ? '1 gasto usa' : `${used} gastos usan`} esta categoría. Si la renombras, pasan al nombre nuevo.`}
            </p>

            {error && <p className="text-[12px] text-rose-500 font-medium mt-2">{error}</p>}

            <button
              type="button"
              onClick={() => (unchanged ? onClose() : run(() => onRename(name)))}
              disabled={busy}
              className="mt-4 w-full h-12 rounded-2xl bg-indigo-600 text-white text-[14px] font-semibold flex items-center justify-center disabled:opacity-60"
            >
              {busy ? <Loader size={17} className="animate-spin" /> : unchanged ? 'Listo' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => { setError(''); setStep('delete'); }}
              disabled={busy}
              className="mt-2 w-full h-11 rounded-2xl text-rose-600 dark:text-rose-400 text-[14px] font-semibold"
            >
              Eliminar categoría
            </button>
          </>
        ) : used === 0 ? (
          <>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Ningún gasto la usa, así que no se pierde nada.
            </p>
            {error && <p className="text-[12px] text-rose-500 font-medium mt-2">{error}</p>}
            <button
              type="button"
              onClick={() => run(() => onDelete())}
              disabled={busy}
              className="mt-4 w-full h-12 rounded-2xl bg-rose-600 text-white text-[14px] font-semibold flex items-center justify-center disabled:opacity-60"
            >
              {busy ? <Loader size={17} className="animate-spin" /> : 'Eliminar'}
            </button>
            <button type="button" onClick={() => setStep('edit')} disabled={busy}
              className="mt-2 w-full h-11 rounded-2xl text-zinc-500 text-[14px] font-medium">
              Cancelar
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {used === 1 ? 'Tiene 1 gasto.' : `Tiene ${used} gastos.`} ¿A qué categoría los movemos?
            </p>
            <div className="flex flex-wrap gap-2 mt-3" role="radiogroup" aria-label="Mover a">
              {others.map(c => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={moveTo === c}
                  onClick={() => setMoveTo(c)}
                  disabled={busy}
                  className={`h-9 px-3 rounded-xl text-[13px] font-medium border transition inline-flex items-center gap-1.5 ${
                    moveTo === c
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {moveTo === c && <Check size={12} className="stroke-[3]" />}
                  {getCategoryLabel(c)}
                </button>
              ))}
            </div>
            {error && <p className="text-[12px] text-rose-500 font-medium mt-3">{error}</p>}
            <button
              type="button"
              onClick={() => run(() => onDelete(moveTo))}
              disabled={busy || !moveTo}
              className="mt-4 w-full h-12 rounded-2xl bg-rose-600 text-white text-[14px] font-semibold flex items-center justify-center disabled:opacity-60"
            >
              {busy
                ? <Loader size={17} className="animate-spin" />
                : `Mover ${used} a ${getCategoryLabel(moveTo)} y eliminar`}
            </button>
            <button type="button" onClick={() => setStep('edit')} disabled={busy}
              className="mt-2 w-full h-11 rounded-2xl text-zinc-500 text-[14px] font-medium">
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
