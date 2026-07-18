import React, { useState, useRef, useCallback } from 'react';
import {
  Plus, Check, Trash2, X, ChevronRight, ChevronLeft,
  ShoppingCart, Star, Clock, RotateCcw, Pencil, List,
  PackagePlus, CheckCircle2, Circle, ArrowRight,
} from 'lucide-react';
import type { ShoppingItem, UsualList, UsualListItem, ShoppingTrip, ShoppingTripGroup, ShoppingTripItem } from '../types';
import { useShoppingStore } from '../hooks/useShoppingStore';
import { parseShoppingText, fmtQty } from '../utils/shoppingParser';

// ── Props (backward-compatible with existing Supabase shopping_items) ────────

interface ShoppingTabProps {
  items: ShoppingItem[];
  onAddItem: (item: Omit<ShoppingItem, 'id'>) => void;
  onToggleItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<ShoppingItem>) => void;
  onClearList: () => void;
  onChatResponse: (aiMsg: string, actions: any[]) => void;
  currentUserName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LIST_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16'];

function colorDot(color: string, size = 10) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

type Screen =
  | { type: 'hub' }
  | { type: 'falta' }
  | { type: 'usual-list'; listId: string }
  | { type: 'prepare-trip' }
  | { type: 'trip-build' }
  | { type: 'trip-shop' }
  | { type: 'history' };

// ── Main component ────────────────────────────────────────────────────────────

export default function ShoppingTab({
  items,
  onAddItem,
  onToggleItem,
  onRemoveItem,
  onClearList,
  currentUserName = 'Yo',
}: ShoppingTabProps) {
  const store = useShoppingStore();
  const [screen, setScreen] = useState<Screen>({ type: 'hub' });
  const [showAddFalta, setShowAddFalta] = useState(false);
  const [showNewList, setShowNewList] = useState(false);

  function goBack() { setScreen({ type: 'hub' }); }

  // ── Hub ─────────────────────────────────────────────────────────────────────

  if (screen.type === 'hub') {
    const pending = items.filter(i => !i.checked);
    const hasTrip = !!store.activeTrip;
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-zinc-50">
        <div className="px-4 pt-5 pb-2">
          <h1 className="text-xl font-bold text-zinc-900">Compras</h1>
        </div>

        <div className="px-4 flex flex-col gap-3 pb-24">
          {/* Active trip banner */}
          {hasTrip && (
            <button
              onClick={() => setScreen({ type: 'trip-shop' })}
              className="rounded-2xl p-4 flex items-center gap-3 text-white"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ShoppingCart size={20} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-medium opacity-80">Compra activa</p>
                <p className="font-semibold">{store.activeTrip!.name}</p>
                <p className="text-xs opacity-70">
                  {store.activeTrip!.groups.reduce((a, g) => a + g.items.filter(i => i.status === 'pending').length, 0)} productos pendientes
                </p>
              </div>
              <ArrowRight size={18} />
            </button>
          )}

          {/* Falta comprar */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div>
                <h2 className="font-semibold text-zinc-900 text-[15px]">Falta comprar</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{pending.length} producto{pending.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddFalta(true)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: '#F3F4F6' }}
                >
                  <Plus size={16} className="text-zinc-600" />
                </button>
                {pending.length > 0 && (
                  <button
                    onClick={() => setScreen({ type: 'falta' })}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: '#F3F4F6' }}
                  >
                    <ChevronRight size={16} className="text-zinc-600" />
                  </button>
                )}
              </div>
            </div>

            {pending.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-zinc-400">Todo en orden 🎉</div>
            ) : (
              <div className="px-4 pb-4 flex flex-col gap-1.5">
                {pending.slice(0, 4).map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Circle size={14} className="text-zinc-300 shrink-0" />
                    <span className="text-[13px] text-zinc-700">{item.name}</span>
                    {item.quantity && <span className="text-[11px] text-zinc-400">{item.quantity}</span>}
                  </div>
                ))}
                {pending.length > 4 && (
                  <button onClick={() => setScreen({ type: 'falta' })} className="text-xs text-violet-500 font-medium mt-1 text-left">
                    +{pending.length - 4} más
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Listas habituales */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <h2 className="font-semibold text-zinc-900 text-[15px]">Listas habituales</h2>
              <button
                onClick={() => setShowNewList(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#F3F4F6' }}
              >
                <Plus size={16} className="text-zinc-600" />
              </button>
            </div>
            <div className="flex flex-col divide-y divide-zinc-50">
              {store.usualLists.map(list => (
                <button
                  key={list.id}
                  onClick={() => setScreen({ type: 'usual-list', listId: list.id })}
                  className="flex items-center gap-3 px-4 py-3 text-left active:bg-zinc-50"
                >
                  {colorDot(list.color, 10)}
                  <span className="flex-1 text-[14px] text-zinc-800 font-medium">{list.name}</span>
                  <span className="text-xs text-zinc-400 mr-1">{list.items.length} items</span>
                  <ChevronRight size={14} className="text-zinc-300" />
                </button>
              ))}
              {store.usualLists.length === 0 && (
                <p className="px-4 pb-4 text-sm text-zinc-400">Sin listas. Crea una para empezar.</p>
              )}
            </div>
          </div>

          {/* Nueva compra */}
          <button
            onClick={() => {
              if (store.activeTrip) {
                setScreen({ type: 'trip-shop' });
              } else {
                setScreen({ type: 'prepare-trip' });
              }
            }}
            className="rounded-2xl p-4 flex items-center gap-3 bg-violet-600 text-white active:bg-violet-700"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingCart size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold">{store.activeTrip ? 'Retomar compra activa' : 'Preparar nueva compra'}</p>
              <p className="text-xs opacity-70">Arma tu lista y ve al mercado</p>
            </div>
            <ArrowRight size={18} />
          </button>

          {/* Historial */}
          {store.tripHistory.length > 0 && (
            <button
              onClick={() => setScreen({ type: 'history' })}
              className="rounded-2xl p-4 flex items-center gap-3 bg-white"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F3F4F6' }}>
                <Clock size={20} className="text-zinc-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-zinc-800 text-[14px]">Historial de compras</p>
                <p className="text-xs text-zinc-400">{store.tripHistory.length} compra{store.tripHistory.length !== 1 ? 's' : ''} realizadas</p>
              </div>
              <ChevronRight size={14} className="text-zinc-300" />
            </button>
          )}
        </div>

        {/* Add falta bottom sheet */}
        {showAddFalta && (
          <AddFaltaSheet
            onClose={() => setShowAddFalta(false)}
            onAdd={(parsed) => {
              parsed.forEach(p => {
                onAddItem({
                  name: p.name,
                  quantity: fmtQty(p.quantity, p.unit),
                  checked: false,
                  addedBy: currentUserName,
                });
              });
              setShowAddFalta(false);
            }}
          />
        )}

        {/* New usual list sheet */}
        {showNewList && (
          <NewListSheet
            onClose={() => setShowNewList(false)}
            onCreate={(name) => {
              const list = store.addUsualList(name);
              setShowNewList(false);
              setScreen({ type: 'usual-list', listId: list.id });
            }}
          />
        )}
      </div>
    );
  }

  // ── Falta comprar detail ─────────────────────────────────────────────────────

  if (screen.type === 'falta') {
    const pending = items.filter(i => !i.checked);
    const purchased = items.filter(i => i.checked);
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-zinc-50">
        <NavBar title="Falta comprar" onBack={goBack}>
          <button onClick={() => setShowAddFalta(true)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
            <Plus size={16} className="text-zinc-600" />
          </button>
          {purchased.length > 0 && (
            <button
              onClick={() => { if (confirm('¿Eliminar los ya comprados?')) onClearList(); }}
              className="text-xs text-red-400 font-medium px-2"
            >
              Limpiar
            </button>
          )}
        </NavBar>

        <div className="px-4 flex flex-col gap-2 pb-24">
          {pending.length === 0 && purchased.length === 0 && (
            <p className="text-sm text-zinc-400 text-center mt-8">Lista vacía</p>
          )}
          {pending.map(item => (
            <FaltaItem
              key={item.id}
              item={item}
              onToggle={() => onToggleItem(item.id)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
          {purchased.length > 0 && (
            <>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mt-2 mb-1 px-1">Ya comprado</p>
              {purchased.map(item => (
                <FaltaItem
                  key={item.id}
                  item={item}
                  onToggle={() => onToggleItem(item.id)}
                  onRemove={() => onRemoveItem(item.id)}
                  dimmed
                />
              ))}
            </>
          )}
        </div>

        {showAddFalta && (
          <AddFaltaSheet
            onClose={() => setShowAddFalta(false)}
            onAdd={(parsed) => {
              parsed.forEach(p => {
                onAddItem({ name: p.name, quantity: fmtQty(p.quantity, p.unit), checked: false, addedBy: currentUserName });
              });
              setShowAddFalta(false);
            }}
          />
        )}
      </div>
    );
  }

  // ── Usual list detail ────────────────────────────────────────────────────────

  if (screen.type === 'usual-list') {
    const list = store.usualLists.find(l => l.id === screen.listId);
    if (!list) { setScreen({ type: 'hub' }); return null; }
    return (
      <UsualListScreen
        list={list}
        onBack={goBack}
        onAddItems={(items) => store.addUsualListItems(list.id, items)}
        onDeleteItem={(itemId) => store.deleteUsualListItem(list.id, itemId)}
        onDeleteList={() => { store.deleteUsualList(list.id); goBack(); }}
        onRenameList={(name) => store.updateUsualList(list.id, { name })}
      />
    );
  }

  // ── Prepare trip ─────────────────────────────────────────────────────────────

  if (screen.type === 'prepare-trip') {
    return (
      <PrepareTripScreen
        usualLists={store.usualLists}
        faltaItems={items.filter(i => !i.checked)}
        onBack={goBack}
        onCreate={(name, groups) => {
          const trip = store.createTrip(name);
          let current = trip;
          groups.forEach(({ groupName, color, items: groupItems }) => {
            const g: ShoppingTripGroup = {
              id: crypto.randomUUID(),
              name: groupName,
              color,
              position: current.groups.length,
              items: groupItems.map((item, i) => ({ ...item, id: crypto.randomUUID(), position: i })),
            };
            current = { ...current, groups: [...current.groups, g] };
          });
          store.updateTrip(current);
          setScreen({ type: 'trip-shop' });
        }}
      />
    );
  }

  // ── Trip shop ────────────────────────────────────────────────────────────────

  if (screen.type === 'trip-shop') {
    if (!store.activeTrip) { setScreen({ type: 'hub' }); return null; }
    return (
      <TripShopScreen
        trip={store.activeTrip}
        onToggleItem={(gid, iid) => store.toggleTripItem(gid, iid)}
        onComplete={() => { store.completeTrip(); setScreen({ type: 'hub' }); }}
        onCancel={() => { if (confirm('¿Abandonar esta compra?')) { store.cancelTrip(); setScreen({ type: 'hub' }); } }}
        onBack={goBack}
      />
    );
  }

  // ── History ──────────────────────────────────────────────────────────────────

  if (screen.type === 'history') {
    return (
      <HistoryScreen
        history={store.tripHistory}
        onBack={goBack}
        onRepeat={(trip) => { store.repeatTrip(trip); setScreen({ type: 'trip-shop' }); }}
      />
    );
  }

  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavBar({ title, onBack, children }: { title: string; onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 sticky top-0 z-10">
      <button onClick={onBack} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
        <ChevronLeft size={18} className="text-zinc-600" />
      </button>
      <h2 className="flex-1 font-semibold text-zinc-900 text-[15px]">{title}</h2>
      {children}
    </div>
  );
}

function FaltaItem({ item, onToggle, onRemove, dimmed = false }: {
  key?: string; item: ShoppingItem; onToggle: () => void; onRemove: () => void; dimmed?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 ${dimmed ? 'opacity-50' : ''}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <button onClick={onToggle} className="shrink-0">
        {item.checked
          ? <CheckCircle2 size={20} className="text-green-500" />
          : <Circle size={20} className="text-zinc-300" />}
      </button>
      <span className={`flex-1 text-[14px] ${item.checked ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>{item.name}</span>
      {item.quantity && <span className="text-xs text-zinc-400">{item.quantity}</span>}
      <button onClick={onRemove} className="w-6 h-6 flex items-center justify-center">
        <X size={14} className="text-zinc-300" />
      </button>
    </div>
  );
}

function AddFaltaSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (items: ReturnType<typeof parseShoppingText>) => void }) {
  const [text, setText] = useState('');
  const parsed = parseShoppingText(text);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 flex flex-col gap-4 max-h-[70dvh]">
        <div className="w-10 h-1 rounded-full bg-zinc-200 mx-auto mb-1" />
        <h3 className="font-semibold text-zinc-900">Agregar a falta comprar</h3>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"Tomate 1 kg\n2 lechugas\nYogurt griego\nLeche 2 litros"}
          rows={5}
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 resize-none focus:outline-none focus:border-violet-400"
        />
        {parsed.length > 0 && (
          <div className="flex flex-col gap-1 bg-zinc-50 rounded-2xl px-3 py-3">
            <p className="text-xs font-semibold text-zinc-400 mb-1">{parsed.length} producto{parsed.length !== 1 ? 's' : ''} detectado{parsed.length !== 1 ? 's' : ''}</p>
            {parsed.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-[13px] text-zinc-700">
                <Check size={12} className="text-green-500 shrink-0" />
                <span>{p.name}</span>
                {(p.quantity || p.unit) && <span className="text-zinc-400">{fmtQty(p.quantity, p.unit)}</span>}
              </div>
            ))}
          </div>
        )}
        <button
          disabled={parsed.length === 0}
          onClick={() => onAdd(parsed)}
          className="w-full h-12 rounded-2xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: '#7C3AED' }}
        >
          Agregar {parsed.length > 0 ? `${parsed.length} producto${parsed.length !== 1 ? 's' : ''}` : ''}
        </button>
      </div>
    </div>
  );
}

function NewListSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-10 flex flex-col gap-4">
        <div className="w-10 h-1 rounded-full bg-zinc-200 mx-auto mb-1" />
        <h3 className="font-semibold text-zinc-900">Nueva lista habitual</h3>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ej: Mercado, Supermercado..."
          className="w-full h-12 rounded-2xl border border-zinc-200 px-4 text-sm focus:outline-none focus:border-violet-400"
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()); }}
        />
        <button
          disabled={!name.trim()}
          onClick={() => onCreate(name.trim())}
          className="w-full h-12 rounded-2xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: '#7C3AED' }}
        >
          Crear lista
        </button>
      </div>
    </div>
  );
}

function UsualListScreen({ list, onBack, onAddItems, onDeleteItem, onDeleteList, onRenameList }: {
  list: UsualList;
  onBack: () => void;
  onAddItems: (items: Omit<UsualListItem, 'id' | 'position'>[]) => void;
  onDeleteItem: (id: string) => void;
  onDeleteList: () => void;
  onRenameList: (name: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-zinc-50">
      <NavBar title={list.name} onBack={onBack}>
        <button onClick={() => setShowAdd(true)} className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
          <Plus size={16} className="text-zinc-600" />
        </button>
        <button onClick={() => { if (confirm(`¿Eliminar lista "${list.name}"?`)) onDeleteList(); }}
          className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
          <Trash2 size={14} className="text-red-400" />
        </button>
      </NavBar>

      <div className="px-4 pb-24 flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-1 px-1">
          {colorDot(list.color, 8)}
          <span className="text-xs text-zinc-400">{list.items.length} producto{list.items.length !== 1 ? 's' : ''}</span>
        </div>

        {list.items.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-sm text-zinc-400">Lista vacía. Agrega productos.</p>
          </div>
        )}

        {list.items.sort((a, b) => a.position - b.position).map(item => (
          <div key={item.id} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {colorDot(list.color, 8)}
            <span className="flex-1 text-[14px] text-zinc-800">{item.name}</span>
            {(item.quantity || item.unit) && (
              <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-lg">
                {fmtQty(item.quantity, item.unit)}
              </span>
            )}
            <button onClick={() => onDeleteItem(item.id)} className="w-6 h-6 flex items-center justify-center">
              <X size={14} className="text-zinc-300" />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddFaltaSheet
          onClose={() => setShowAdd(false)}
          onAdd={(parsed) => {
            onAddItems(parsed.map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit })));
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function PrepareTripScreen({ usualLists, faltaItems, onBack, onCreate }: {
  usualLists: UsualList[];
  faltaItems: ShoppingItem[];
  onBack: () => void;
  onCreate: (name: string, groups: { groupName: string; color: string; items: Omit<ShoppingTripItem, 'id' | 'position'>[] }[]) => void;
}) {
  const [tripName, setTripName] = useState('');
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [includeFalta, setIncludeFalta] = useState(faltaItems.length > 0);
  const [manualText, setManualText] = useState('');
  const [step, setStep] = useState<'name' | 'sources'>('name');

  function toggleList(id: string) {
    const s = new Set(selectedLists);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedLists(s);
  }

  function handleCreate() {
    const groups: { groupName: string; color: string; items: Omit<ShoppingTripItem, 'id' | 'position'>[] }[] = [];

    // Groups from usual lists
    selectedLists.forEach(listId => {
      const list = usualLists.find(l => l.id === listId)!;
      groups.push({
        groupName: list.name,
        color: list.color,
        items: list.items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          status: 'pending',
          sourceType: 'usual',
          sourceId: i.id,
        })),
      });
    });

    // Falta comprar group
    if (includeFalta && faltaItems.length > 0) {
      groups.push({
        groupName: 'Falta comprar',
        color: '#6366F1',
        items: faltaItems.map(i => ({
          name: i.name,
          quantity: null,
          unit: i.quantity || null,
          status: 'pending',
          sourceType: 'reminder',
          sourceId: i.id,
        })),
      });
    }

    // Manual items
    const manual = parseShoppingText(manualText);
    if (manual.length > 0) {
      groups.push({
        groupName: 'Extras',
        color: '#94A3B8',
        items: manual.map(p => ({
          name: p.name,
          quantity: p.quantity,
          unit: p.unit,
          status: 'pending',
          sourceType: 'manual',
        })),
      });
    }

    if (groups.length === 0) {
      // Create with single empty manual group
      groups.push({ groupName: 'Mi lista', color: '#94A3B8', items: [] });
    }

    onCreate(tripName || 'Mi compra', groups);
  }

  if (step === 'name') {
    return (
      <div className="flex flex-col h-full bg-zinc-50">
        <NavBar title="Nueva compra" onBack={onBack} />
        <div className="px-4 pt-6 flex flex-col gap-5">
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-2">Nombre de la compra</label>
            <input
              autoFocus
              value={tripName}
              onChange={e => setTripName(e.target.value)}
              placeholder="Compra del jueves, Mercado semanal..."
              className="w-full h-12 rounded-2xl border border-zinc-200 px-4 text-sm focus:outline-none focus:border-violet-400 bg-white"
              onKeyDown={e => { if (e.key === 'Enter') setStep('sources'); }}
            />
          </div>
          <button
            onClick={() => setStep('sources')}
            className="w-full h-12 rounded-2xl text-sm font-semibold text-white"
            style={{ background: '#7C3AED' }}
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-zinc-50">
      <NavBar title={tripName || 'Nueva compra'} onBack={() => setStep('name')} />
      <div className="px-4 pb-32 flex flex-col gap-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">¿De dónde importamos?</p>

        {/* Falta comprar */}
        {faltaItems.length > 0 && (
          <SourceCard
            color="#6366F1"
            title="Falta comprar"
            subtitle={`${faltaItems.length} productos pendientes`}
            selected={includeFalta}
            onToggle={() => setIncludeFalta(!includeFalta)}
          />
        )}

        {/* Usual lists */}
        {usualLists.map(list => (
          <SourceCard
            key={list.id}
            color={list.color}
            title={list.name}
            subtitle={`${list.items.length} productos`}
            selected={selectedLists.has(list.id)}
            onToggle={() => toggleList(list.id)}
          />
        ))}

        {/* Manual */}
        <div className="bg-white rounded-2xl px-4 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p className="text-[13px] font-semibold text-zinc-700 mb-2">Agregar productos extras</p>
          <textarea
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            placeholder={"Tomate 1 kg\n2 lechugas\nYogurt griego"}
            rows={4}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 resize-none focus:outline-none focus:border-violet-400"
          />
          {manualText.trim() && (
            <p className="text-xs text-violet-500 mt-1">{parseShoppingText(manualText).length} detectados</p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-zinc-50/90 backdrop-blur-sm">
        <button
          onClick={handleCreate}
          className="w-full h-12 rounded-2xl text-sm font-semibold text-white"
          style={{ background: '#7C3AED' }}
        >
          Empezar compra →
        </button>
      </div>
    </div>
  );
}

function SourceCard({ color, title, subtitle, selected, onToggle }: {
  key?: string; color: string; title: string; subtitle: string; selected: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 text-left w-full"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: selected ? `2px solid ${color}` : '2px solid transparent' }}
    >
      {colorDot(color, 12)}
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-zinc-800">{title}</p>
        <p className="text-xs text-zinc-400">{subtitle}</p>
      </div>
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: selected ? color : '#F3F4F6' }}
      >
        {selected && <Check size={12} className="text-white" />}
      </div>
    </button>
  );
}

function TripShopScreen({ trip, onToggleItem, onComplete, onCancel, onBack }: {
  trip: ShoppingTrip;
  onToggleItem: (gid: string, iid: string) => void;
  onComplete: () => void;
  onCancel: () => void;
  onBack: () => void;
}) {
  const allItems = trip.groups.flatMap(g => g.items);
  const totalPurchased = allItems.filter(i => i.status === 'purchased').length;
  const totalItems = allItems.length;
  const allDone = totalItems > 0 && totalPurchased === totalItems;
  const progress = totalItems > 0 ? totalPurchased / totalItems : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      <NavBar title={trip.name} onBack={onBack}>
        <button onClick={onCancel} className="text-xs text-red-400 font-medium px-2">Cancelar</button>
      </NavBar>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">{totalPurchased} de {totalItems}</span>
          <span className="text-xs font-semibold" style={{ color: '#7C3AED' }}>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress * 100}%`, background: '#7C3AED' }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {trip.groups.map(group => {
          const pending = group.items.filter(i => i.status === 'pending');
          const purchased = group.items.filter(i => i.status === 'purchased');
          return (
            <div key={group.id} className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-1">
                {colorDot(group.color, 8)}
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{group.name}</span>
                <span className="text-xs text-zinc-300 ml-auto">{purchased.length}/{group.items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {pending.map(item => (
                  <TripItemRow key={item.id} item={item} groupColor={group.color} onToggle={() => onToggleItem(group.id, item.id)} />
                ))}
                {purchased.map(item => (
                  <TripItemRow key={item.id} item={item} groupColor={group.color} onToggle={() => onToggleItem(group.id, item.id)} dimmed />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-zinc-50/90 backdrop-blur-sm">
        <button
          onClick={onComplete}
          disabled={!allDone && totalItems > 0}
          className="w-full h-12 rounded-2xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: allDone ? '#10B981' : '#7C3AED' }}
        >
          {allDone ? '✓ Finalizar compra' : `Finalizar compra (${totalItems - totalPurchased} pendientes)`}
        </button>
      </div>
    </div>
  );
}

function TripItemRow({ item, groupColor, onToggle, dimmed = false }: {
  key?: string; item: ShoppingTripItem; groupColor: string; onToggle: () => void; dimmed?: boolean;
}) {
  const purchased = item.status === 'purchased';
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 w-full text-left transition-opacity ${dimmed ? 'opacity-40' : ''}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      <div
        className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
        style={{ borderColor: purchased ? groupColor : '#D1D5DB', background: purchased ? groupColor : 'transparent' }}
      >
        {purchased && <Check size={12} className="text-white" />}
      </div>
      <span className={`flex-1 text-[14px] ${purchased ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>{item.name}</span>
      {(item.quantity || item.unit) && (
        <span className="text-xs text-zinc-400">{fmtQty(item.quantity, item.unit)}</span>
      )}
    </button>
  );
}

function HistoryScreen({ history, onBack, onRepeat }: {
  history: ShoppingTrip[];
  onBack: () => void;
  onRepeat: (trip: ShoppingTrip) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-zinc-50">
      <NavBar title="Historial de compras" onBack={onBack} />
      <div className="px-4 pb-24 flex flex-col gap-3">
        {history.length === 0 && (
          <p className="text-sm text-zinc-400 text-center mt-8">Sin compras completadas aún</p>
        )}
        {history.map(trip => {
          const expanded = expandedId === trip.id;
          const total = trip.groups.reduce((s, g) => s + g.items.length, 0);
          return (
            <div key={trip.id} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <button
                className="flex items-center gap-3 px-4 py-4 w-full text-left"
                onClick={() => setExpandedId(expanded ? null : trip.id)}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F3F4F6' }}>
                  <ShoppingCart size={16} className="text-zinc-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-800 text-[14px]">{trip.name}</p>
                  <p className="text-xs text-zinc-400">{trip.completedAt ? fmtDate(trip.completedAt) : ''} · {total} productos</p>
                </div>
                <ChevronRight size={14} className={`text-zinc-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>

              {expanded && (
                <div className="px-4 pb-4 border-t border-zinc-50">
                  {trip.groups.map(g => (
                    <div key={g.id} className="mt-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {colorDot(g.color, 6)}
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{g.name}</span>
                      </div>
                      {g.items.map(i => (
                        <div key={i.id} className="flex items-center gap-2 py-1 pl-4">
                          <Check size={11} className="text-green-400 shrink-0" />
                          <span className="text-[13px] text-zinc-600">{i.name}</span>
                          {(i.quantity || i.unit) && <span className="text-xs text-zinc-400">{fmtQty(i.quantity, i.unit)}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={() => onRepeat(trip)}
                    className="flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-medium text-violet-600"
                    style={{ background: '#F5F3FF' }}
                  >
                    <RotateCcw size={14} />
                    Repetir esta compra
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
