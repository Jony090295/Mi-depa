import type { Expense } from '../types';
import { getCategoryLabel } from '../utils';

export type Macro = 'hogar' | 'personal';

/** Límites mensuales en soles. Solo existen los que el usuario eligió. */
export interface MacroLimits {
  total?: number;
  categories: Record<string, number>;
}
export type BudgetLimits = Record<Macro, MacroLimits>;
export type MacroCategories = Record<Macro, string[]>;

export interface MacroSpending {
  total: number;
  byCategory: Record<string, number>;
}

// Guardado por dispositivo, como antes. La v1 era un objeto plano
// { global_hogar, global_personal, [categoría]: n } sin distinguir hogar de
// personal: "otros", "auto" y "comida" existen en las dos listas, así que un
// límite a "otros" personal se mostraba (y sumaba gastos) también en hogar.
const v1Key = (apartmentId: string) => `budget_limits_${apartmentId}`;
const v2Key = (apartmentId: string) => `budget_limits_v2_${apartmentId}`;
const CHANGE_EVENT = 'mi-depa:budget-limits';

const empty = (): BudgetLimits => ({ hogar: { categories: {} }, personal: { categories: {} } });
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Lee los límites. Si solo hay datos v1, los traduce en memoria (sin escribir:
 * la v2 se guarda recién con la primera edición). Una categoría v1 que está en
 * ambas listas queda en ambas, que es como se veía antes.
 */
export function loadLimits(apartmentId: string, cats: MacroCategories): BudgetLimits {
  try {
    const raw = localStorage.getItem(v2Key(apartmentId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const out = empty();
      for (const macro of ['hogar', 'personal'] as const) {
        const m = parsed?.[macro];
        if (valid(m?.total)) out[macro].total = m.total;
        for (const [cat, n] of Object.entries(m?.categories ?? {})) {
          if (valid(n)) out[macro].categories[cat] = n;
        }
      }
      return out;
    }

    const v1 = JSON.parse(localStorage.getItem(v1Key(apartmentId)) ?? '{}') ?? {};
    const out = empty();
    if (valid(v1.global_hogar)) out.hogar.total = v1.global_hogar;
    if (valid(v1.global_personal)) out.personal.total = v1.global_personal;
    for (const [cat, n] of Object.entries(v1)) {
      if (cat === 'global_hogar' || cat === 'global_personal' || !valid(n)) continue;
      if (cats.hogar.includes(cat)) out.hogar.categories[cat] = n;
      if (cats.personal.includes(cat)) out.personal.categories[cat] = n;
    }
    return out;
  } catch {
    return empty();
  }
}

/**
 * Lee, modifica y guarda en un paso, siempre sobre lo que hay en el
 * almacenamiento: así una pantalla abierta con datos viejos no pisa un cambio
 * hecho desde otra (p. ej. renombrar una categoría).
 */
export function updateLimits(apartmentId: string, cats: MacroCategories, fn: (l: BudgetLimits) => void) {
  const limits = loadLimits(apartmentId, cats);
  fn(limits);
  try {
    localStorage.setItem(v2Key(apartmentId), JSON.stringify(limits));
  } catch {
    // Sin almacenamiento (modo privado): el cambio no persiste, pero no rompe
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onLimitsChange(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

/** Al renombrar una categoría, su límite la sigue. */
export function renameLimitCategory(apartmentId: string, cats: MacroCategories, macro: Macro, from: string, to: string) {
  if (from === to || loadLimits(apartmentId, cats)[macro].categories[from] === undefined) return;
  updateLimits(apartmentId, cats, l => {
    l[macro].categories[to] = l[macro].categories[from];
    delete l[macro].categories[from];
  });
}

/** Al eliminar una categoría, su límite se va con ella. */
export function dropLimitCategory(apartmentId: string, cats: MacroCategories, macro: Macro, name: string) {
  if (loadLimits(apartmentId, cats)[macro].categories[name] === undefined) return;
  updateLimits(apartmentId, cats, l => { delete l[macro].categories[name]; });
}

/**
 * Gasto de un mes ('YYYY-MM') en soles, por macro y categoría. Los dólares
 * cuentan al tipo de cambio con que se registró cada gasto.
 */
export function monthSpending(expenses: Expense[], month: string, fallbackRate: number): Record<Macro, MacroSpending> {
  const out: Record<Macro, MacroSpending> = {
    hogar: { total: 0, byCategory: {} },
    personal: { total: 0, byCategory: {} },
  };
  for (const e of expenses) {
    if (!e.date?.startsWith(month)) continue;
    const macro: Macro = e.macroCategory === 'personal' ? 'personal' : 'hogar';
    const soles = e.amount * (e.currency === 'USD' ? (e.exchangeRate || fallbackRate) : 1);
    const cat = e.category || 'otros';
    out[macro].total += soles;
    out[macro].byCategory[cat] = (out[macro].byCategory[cat] ?? 0) + soles;
  }
  return out;
}

export const TOTAL_LABEL: Record<Macro, string> = { hogar: 'Total del hogar', personal: 'Total personal' };

/** Límites al 80% o más, para el aviso de la pestaña de gastos. */
export function limitAlerts(limits: BudgetLimits, spending: Record<Macro, MacroSpending>, cats: MacroCategories): string[] {
  const items: string[] = [];
  for (const macro of ['hogar', 'personal'] as const) {
    const { total, categories } = limits[macro];
    if (total && spending[macro].total / total >= 0.8) {
      items.push(`${TOTAL_LABEL[macro]} al ${Math.round((spending[macro].total / total) * 100)}%`);
    }
    // En el orden de la lista; las categorías que ya no existen no avisan
    for (const cat of cats[macro]) {
      const limit = categories[cat];
      const spent = spending[macro].byCategory[cat] ?? 0;
      if (!limit || spent / limit < 0.8) continue;
      // "Otros", "Auto" y "Comida" están en las dos listas: decir de cuál
      const inBoth = cats.hogar.includes(cat) && cats.personal.includes(cat);
      items.push(`${getCategoryLabel(cat)}${inBoth ? ` (${macro})` : ''} al ${Math.round((spent / limit) * 100)}%`);
    }
  }
  return items;
}
