import React, { useState, useRef } from 'react';
import { ShoppingItem } from '../types';
import { Plus, Check, Trash2, Mic, MicOff } from 'lucide-react';

interface ShoppingTabProps {
  items: ShoppingItem[];
  onAddItem: (item: Omit<ShoppingItem, 'id'>) => void;
  onToggleItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearList: () => void;
  onChatResponse: (aiMsg: string, actions: any[]) => void;
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const speechSupported = !!SpeechRecognition;

interface ShoppingAction {
  type: 'add' | 'check' | 'remove' | 'clear';
  name: string;
  quantity?: string;
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const WORD_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, media: 0.5, medio: 0.5,
};

const UNITS = 'kilo[s]?|kg|gramo[s]?|gr?|litro[s]?|lt?|unidad(?:es)?|caja[s]?|bolsa[s]?|paquete[s]?|rollo[s]?|mano[s]?|docena[s]?|tarro[s]?|frasco[s]?|lata[s]?|barra[s]?';
const FILLER_WORDS = /^(un|una|el|la|los|las|algo de|un poco de|unas|unos)\s+/i;

function extractSingleItem(raw: string): { name: string; quantity: string } {
  const s = raw.trim();
  const digitMatch = s.match(new RegExp(`^(\\d+[\\d.,]*\\s*(?:${UNITS})?)\\s*(?:de\\s+)?`, 'i'));
  if (digitMatch) {
    const qty = digitMatch[1].trim();
    const name = s.slice(digitMatch[0].length).replace(FILLER_WORDS, '').trim();
    return { quantity: qty || '1', name: cap(name) };
  }
  const wordNumMatch = s.match(new RegExp(`^(${Object.keys(WORD_NUMBERS).join('|')})\\s+(${UNITS})?\\s*(?:de\\s+)?(.+)`, 'i'));
  if (wordNumMatch) {
    const num = WORD_NUMBERS[wordNumMatch[1].toLowerCase()];
    const unit = wordNumMatch[2] ? wordNumMatch[2].trim() : 'u';
    const name = wordNumMatch[3].replace(FILLER_WORDS, '').trim();
    return { quantity: `${num} ${unit}`, name: cap(name) };
  }
  const name = s.replace(FILLER_WORDS, '').trim();
  return { quantity: '1 u', name: cap(name) };
}

const INTENT_CHECK = /^(ya compré|ya compre|compré|compre|tachar|marcar|conseguí|consegui|ya tenemos|ya tiene)/i;
const INTENT_REMOVE = /^(quitar|eliminar|borrar|quita|elimina|borra|sacar|saca|ya no necesitamos|ya no falta)/i;
const INTENT_CLEAR = /^(limpiar|borrar todo|vaciar|limpiar lista)/i;
const INTENT_ADD = /^(falta|faltan|agrega[r]?|añadi[r]?|agrégame|necesito|compra[r]?|pon(?:er)?|añade|hay que comprar|me falta|nos falta|consigue|trae[r]?|trae)/i;
const FILLER_SENTENCE = /^(podría ser|puede ser|también podría ser|y también|creo que falta|me parece que falta|para esta semana|para el desayuno|para la semana|para mañana|ponle|ponme|agrega también|también agrega|quizás|capaz)\s*/i;

function parseFallback(text: string): ShoppingAction[] {
  const lower = text.toLowerCase().trim();
  if (INTENT_CLEAR.test(lower)) return [{ type: 'clear', name: '' }];
  if (INTENT_CHECK.test(lower)) {
    const rest = lower.replace(INTENT_CHECK, '').trim();
    return splitItems(rest).map(s => ({ type: 'check' as const, name: cap(s) }));
  }
  if (INTENT_REMOVE.test(lower)) {
    const rest = lower.replace(INTENT_REMOVE, '').trim();
    return splitItems(rest).map(s => ({ type: 'remove' as const, name: cap(s) }));
  }
  let raw = lower.replace(FILLER_SENTENCE, '').replace(INTENT_ADD, '').trim();
  return splitItems(raw).map(part => {
    const { name, quantity } = extractSingleItem(part);
    return { type: 'add' as const, name, quantity };
  });
}

function splitItems(text: string): string[] {
  return text
    .split(/\s*,\s*|\s+y\s+|\s+e\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 1);
}

const ROOMMATE_COLORS: Record<string, string> = {};
const COLOR_PALETTE = ['#6366f1','#ec4899','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444'];
let colorIdx = 0;
function getRoommateColor(name: string) {
  if (!ROOMMATE_COLORS[name]) {
    ROOMMATE_COLORS[name] = COLOR_PALETTE[colorIdx++ % COLOR_PALETTE.length];
  }
  return ROOMMATE_COLORS[name];
}

export default function ShoppingTab({
  items,
  onAddItem,
  onToggleItem,
  onRemoveItem,
  onClearList,
}: ShoppingTabProps) {
  const [inputValue, setInputValue] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (msg: string, isError = false) => {
    setFeedback(msg);
    setFeedbackError(isError);
    setTimeout(() => setFeedback(''), 3000);
  };

  const applyActions = (actions: ShoppingAction[]) => {
    const added: string[] = [], checked: string[] = [], removed: string[] = [];
    for (const a of actions) {
      if (a.type === 'clear') { onClearList(); showFeedback('Lista limpiada.'); return; }
      if (!a.name) continue;
      if (a.type === 'add') {
        onAddItem({ name: a.name, quantity: a.quantity || '1 u', checked: false, addedBy: 'Voz' });
        added.push(a.name);
      } else if (a.type === 'check') {
        const nl = a.name.toLowerCase();
        items.filter(i => i.name.toLowerCase().includes(nl) || nl.includes(i.name.toLowerCase()))
          .forEach(i => { if (!i.checked) onToggleItem(i.id); checked.push(a.name); });
      } else if (a.type === 'remove') {
        const nl = a.name.toLowerCase();
        items.filter(i => i.name.toLowerCase().includes(nl) || nl.includes(i.name.toLowerCase()))
          .forEach(i => { onRemoveItem(i.id); removed.push(a.name); });
      }
    }
    const parts = [
      added.length && `Agregado: ${added.join(', ')}`,
      checked.length && `Marcado: ${checked.join(', ')}`,
      removed.length && `Eliminado: ${removed.join(', ')}`,
    ].filter(Boolean);
    if (parts.length) showFeedback(parts.join(' · '));
    else showFeedback('No entendí. Inténtalo de nuevo.', true);
  };

  const applyCommand = async (text: string) => {
    try {
      const res = await fetch('/api/shopping/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, previousItems: items }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.actions?.length) { applyActions(data.actions); return; }
      }
    } catch { /* offline */ }
    applyActions(parseFallback(text));
  };

  const toggleMic = () => {
    if (!speechSupported) { showFeedback('Tu navegador no soporta voz. Prueba Chrome.', true); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SpeechRecognition();
    r.lang = 'es-PE';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = (e: any) => {
      setIsListening(false);
      if (e.error === 'no-speech') showFeedback('No se detectó voz.', true);
      else if (e.error === 'not-allowed') showFeedback('Permiso de micrófono denegado.', true);
      else showFeedback(`Error: ${e.error}`, true);
    };
    r.onresult = (e: any) => applyCommand(e.results[0][0].transcript);
    recognitionRef.current = r;
    r.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputValue.trim();
    if (!val) return;
    const { name, quantity } = extractSingleItem(val);
    onAddItem({ name, quantity, checked: false, addedBy: 'Yo' });
    setInputValue('');
    inputRef.current?.focus();
  };

  const pending = items.filter(i => !i.checked);
  const completed = items.filter(i => i.checked);

  return (
    <div className="space-y-3" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* ── Toast feedback ── */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-medium ${feedbackError ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-100 dark:border-rose-900/30' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30'}`}>
          {feedbackError ? '✕' : '✓'} {feedback}
        </div>
      )}

      {/* ── Lista pendiente ── */}
      {pending.length === 0 && completed.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-600">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-1">
            <span className="text-2xl">🛒</span>
          </div>
          <p className="text-[14px] font-semibold">Lista vacía</p>
          <p className="text-[12px]">Escribe abajo o usa el micrófono</p>
        </div>
      ) : (
        <>
          {pending.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <Check size={14} className="text-emerald-500 shrink-0" />
              <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">¡Todo comprado!</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              {pending.map((item, i) => (
                <div key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < pending.length - 1 ? 'border-b border-zinc-50 dark:border-zinc-800/60' : ''}`}>
                  <button type="button" onClick={() => onToggleItem(item.id)}
                    className="w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center transition shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.name}</p>
                    <p className="text-[11px] text-zinc-400">{item.quantity}</p>
                  </div>
                  {item.addedBy && item.addedBy !== 'Yo' && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: getRoommateColor(item.addedBy) }}
                      title={item.addedBy}>
                      {item.addedBy.charAt(0)}
                    </div>
                  )}
                  <button type="button" onClick={() => onRemoveItem(item.id)}
                    className="w-7 h-7 flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-rose-500 transition shrink-0 cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Comprados ── */}
          {completed.length > 0 && (
            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
              <div role="button" onClick={() => setShowCompleted(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-800 transition select-none">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-white stroke-[3]" />
                  </div>
                  <span className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">Comprados · {completed.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  {showCompleted && (
                    <button type="button" onClick={e => { e.stopPropagation(); onClearList(); }}
                      className="text-[11px] font-semibold text-rose-400 hover:text-rose-600 transition cursor-pointer">
                      Limpiar
                    </button>
                  )}
                  <span className="text-[11px] text-zinc-400">{showCompleted ? '▲' : '▼'}</span>
                </div>
              </div>

              {showCompleted && (
                <div className="border-t border-zinc-50 dark:border-zinc-800/60">
                  {completed.map((item, i) => (
                    <div key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 opacity-50 ${i < completed.length - 1 ? 'border-b border-zinc-50 dark:border-zinc-800/60' : ''}`}>
                      <button type="button" onClick={() => onToggleItem(item.id)}
                        className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 cursor-pointer">
                        <Check size={11} className="text-white stroke-[3]" />
                      </button>
                      <p className="flex-1 text-[14px] line-through text-zinc-400 truncate">{item.name}</p>
                      <button type="button" onClick={() => onRemoveItem(item.id)}
                        className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-rose-500 transition shrink-0 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Barra de agregar (fixed sobre el nav) ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-zinc-100 dark:border-zinc-800 px-4 py-3"
        style={{ paddingBottom: 'calc(12px + 56px + env(safe-area-inset-bottom))' }}>

        {isListening && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/20">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[12px] font-medium text-red-500">Escuchando…</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Agregar producto…"
            className="flex-1 h-10 px-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[14px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="button" onClick={toggleMic}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-emerald-500'}`}>
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button type="submit"
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition shrink-0 cursor-pointer shadow-sm">
            <Plus size={18} />
          </button>
        </form>

        {!isListening && !feedback && (
          <p className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
            Di <span className="italic">"falta leche"</span> · <span className="italic">"ya compré el arroz"</span> · <span className="italic">"quita las paltas"</span>
          </p>
        )}
      </div>

    </div>
  );
}
