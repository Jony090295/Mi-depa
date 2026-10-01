import { useState } from 'react';
import { Plus, Check, Pencil, Loader } from 'lucide-react';
import { getCategoryLabel } from '../utils';

interface Props {
  /** Sugerencias marcadas al abrir. */
  suggestions: readonly string[];
  /** Selección actual. */
  value: string[];
  onChange: (list: string[]) => void;
  /** Categorías que no se pueden quitar porque hay gastos usándolas. */
  locked?: string[];
  /**
   * Si se pasa, aparece el modo "Editar" para renombrar. Debe arrastrar los
   * gastos existentes al nombre nuevo — ver renameCategory en useApartmentData.
   * En el onboarding no se pasa: ahí todavía no hay gastos que arrastrar.
   */
  onRename?: (oldName: string, newName: string) => Promise<void>;
}

/**
 * Chips de categorías: se activan y desactivan, se agregan nuevas y, si hay
 * onRename, se renombran.
 *
 * 'otros' nunca se puede quitar ni renombrar — es donde cae
 * inferCategoryFromName y todo gasto sin clasificar.
 */
export default function CategoryPicker({ suggestions, value, onChange, locked = [], onRename }: Props) {
  const [adding, setAdding]     = useState(false);
  const [draft, setDraft]       = useState('');
  const [editMode, setEditMode] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Las activas primero, en su orden guardado; después las sugerencias que no
  // estás usando. Así una categoría renombrada se queda en su lugar en vez de
  // saltar al final, y la sugerencia original queda atrás como opción
  // disponible — no al lado, donde parecería un duplicado.
  const all = [...value, ...suggestions.filter(c => !value.includes(c))];
  // En modo editar solo se muestran las activas: renombrar una que no usas no
  // tiene sentido.
  const shown = editMode ? all.filter(c => value.includes(c)) : all;

  function isLocked(cat: string) {
    return cat === 'otros' || locked.includes(cat);
  }

  function toggle(cat: string) {
    if (isLocked(cat)) return;
    onChange(value.includes(cat) ? value.filter(c => c !== cat) : [...value, cat]);
  }

  function commitDraft() {
    const name = draft.trim().toLowerCase();
    setDraft('');
    setAdding(false);
    if (!name || value.includes(name)) return;
    onChange([...value, name]);
  }

  function startRename(cat: string) {
    if (cat === 'otros') return;
    setError('');
    setRenaming(cat);
    setRenameDraft(getCategoryLabel(cat));
  }

  async function commitRename() {
    if (!renaming || !onRename) return;
    const from = renaming;
    const to = renameDraft.trim();

    // Sin cambios reales: salir sin tocar la base
    if (!to || to.toLowerCase() === getCategoryLabel(from).toLowerCase()) {
      setRenaming(null);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onRename(from, to);
      setRenaming(null);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo renombrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {onRename && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => { setEditMode(m => !m); setRenaming(null); setError(''); }}
            className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1"
          >
            {editMode ? <><Check size={12} /> Listo</> : <><Pencil size={11} /> Renombrar</>}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {shown.map(cat => {
          const on = value.includes(cat);
          const fixed = isLocked(cat);

          // Este chip se está renombrando: input en su lugar
          if (renaming === cat) {
            return (
              <div key={cat} className="relative">
                <input
                  autoFocus
                  // Todo seleccionado al abrir: escribir reemplaza el nombre
                  // en vez de pegarse al final (en el teléfono no hay ⌘A).
                  onFocus={e => e.currentTarget.select()}
                  value={renameDraft}
                  onChange={e => setRenameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                    if (e.key === 'Escape') { setRenaming(null); setError(''); }
                  }}
                  disabled={saving}
                  maxLength={24}
                  className="h-9 px-3 pr-8 w-40 rounded-xl text-[13px] bg-white dark:bg-zinc-900 border border-indigo-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {saving && <Loader size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-indigo-500" />}
              </div>
            );
          }

          if (editMode) {
            const renamable = cat !== 'otros';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => renamable && startRename(cat)}
                disabled={!renamable}
                className={`h-9 px-3 rounded-xl text-[13px] font-medium border inline-flex items-center gap-1.5 transition ${
                  renamable
                    ? 'bg-white dark:bg-zinc-900 border-indigo-300 dark:border-indigo-800 text-zinc-800 dark:text-zinc-100 active:scale-95'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60'
                }`}
              >
                {renamable && <Pencil size={11} className="text-indigo-500" />}
                {getCategoryLabel(cat)}
              </button>
            );
          }

          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggle(cat)}
              aria-pressed={on}
              className={`h-9 px-3 rounded-xl text-[13px] font-medium border transition inline-flex items-center gap-1.5 ${
                on
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'
              } ${fixed ? 'opacity-70' : 'active:scale-95'}`}
            >
              {on && <Check size={12} className="stroke-[3]" />}
              {getCategoryLabel(cat)}
            </button>
          );
        })}

        {!editMode && (adding ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
              if (e.key === 'Escape') { setDraft(''); setAdding(false); }
            }}
            placeholder="Ej. mascotas"
            maxLength={24}
            className="h-9 px-3 w-32 rounded-xl text-[13px] bg-white dark:bg-zinc-900 border border-indigo-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-9 px-3 rounded-xl text-[13px] font-medium border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 inline-flex items-center gap-1.5 hover:border-indigo-400 hover:text-indigo-500 transition"
          >
            <Plus size={13} /> Otra
          </button>
        ))}
      </div>

      {error && (
        <p className="text-[12px] text-rose-500 font-medium mt-2.5">{error}</p>
      )}

      {editMode && !error && (
        <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed">
          Toca una para cambiarle el nombre. Los gastos que ya tiene pasan al nombre nuevo.
        </p>
      )}

      {!editMode && value.length === 0 && (
        <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-2.5">
          Elige al menos una.
        </p>
      )}

      {!editMode && locked.some(c => value.includes(c)) && (
        <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed">
          Las que ya tienen gastos registrados no se pueden quitar.
        </p>
      )}
    </div>
  );
}
