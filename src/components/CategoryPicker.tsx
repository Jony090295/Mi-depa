import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { getCategoryLabel } from '../utils';

interface Props {
  /** Sugerencias marcadas al abrir. */
  suggestions: readonly string[];
  /** Selección actual. */
  value: string[];
  onChange: (list: string[]) => void;
  /** Categorías que no se pueden quitar porque hay gastos usándolas. */
  locked?: string[];
}

/**
 * Chips de categorías: se activan y desactivan, y se pueden agregar nuevas.
 *
 * 'otros' nunca se puede quitar — es donde cae inferCategoryFromName y todo
 * gasto sin clasificar, así que la lista tiene que poder recibirlos.
 */
export default function CategoryPicker({ suggestions, value, onChange, locked = [] }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  // Las sugerencias primero, en su orden; después las que el usuario creó
  const all = [...suggestions, ...value.filter(c => !suggestions.includes(c))];

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

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {all.map(cat => {
          const on = value.includes(cat);
          const fixed = isLocked(cat);
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

        {adding ? (
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
        )}
      </div>

      {value.length === 0 && (
        <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-2.5">
          Elige al menos una.
        </p>
      )}

      {locked.some(c => value.includes(c)) && (
        <p className="text-[11px] text-zinc-400 mt-2.5 leading-relaxed">
          Las que ya tienen gastos registrados no se pueden quitar.
        </p>
      )}
    </div>
  );
}
