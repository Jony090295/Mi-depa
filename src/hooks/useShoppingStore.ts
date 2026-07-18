import { useState, useCallback } from 'react';
import type { UsualList, UsualListItem, ShoppingTrip, ShoppingTripGroup, ShoppingTripItem } from '../types';

const LISTS_KEY = 'midepa_usual_lists';
const TRIP_KEY = 'midepa_active_trip';
const HISTORY_KEY = 'midepa_trip_history';

const LIST_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16'];

const DEFAULT_LISTS: UsualList[] = [
  {
    id: 'list-mercado',
    name: 'Mercado',
    color: '#10B981',
    createdAt: new Date().toISOString(),
    items: [
      { id: 'mi-1', name: 'Tomate', quantity: 1, unit: 'kg', position: 0 },
      { id: 'mi-2', name: 'Lechuga', quantity: 2, unit: 'u', position: 1 },
      { id: 'mi-3', name: 'Papa', quantity: 3, unit: 'kg', position: 2 },
      { id: 'mi-4', name: 'Cebolla', quantity: 1, unit: 'kg', position: 3 },
      { id: 'mi-5', name: 'Palta', quantity: 4, unit: 'u', position: 4 },
      { id: 'mi-6', name: 'Limón', quantity: 1, unit: 'kg', position: 5 },
      { id: 'mi-7', name: 'Plátano', quantity: 6, unit: 'u', position: 6 },
      { id: 'mi-8', name: 'Zanahoria', quantity: 1, unit: 'kg', position: 7 },
    ],
  },
  {
    id: 'list-super',
    name: 'Supermercado',
    color: '#3B82F6',
    createdAt: new Date().toISOString(),
    items: [
      { id: 'si-1', name: 'Yogurt griego', quantity: 2, unit: 'u', position: 0 },
      { id: 'si-2', name: 'Papel higiénico', quantity: null, unit: null, position: 1 },
      { id: 'si-3', name: 'Jabón de manos', quantity: null, unit: null, position: 2 },
      { id: 'si-4', name: 'Leche', quantity: 2, unit: 'u', position: 3 },
    ],
  },
  {
    id: 'list-avinka',
    name: 'Avinka',
    color: '#F59E0B',
    createdAt: new Date().toISOString(),
    items: [
      { id: 'ai-1', name: 'Pechuga de pollo', quantity: 2, unit: 'kg', position: 0 },
      { id: 'ai-2', name: 'Huevos', quantity: 15, unit: 'u', position: 1 },
    ],
  },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function useShoppingStore() {
  const [usualLists, setListsRaw] = useState<UsualList[]>(() => load(LISTS_KEY, DEFAULT_LISTS));
  const [activeTrip, setTripRaw] = useState<ShoppingTrip | null>(() => load(TRIP_KEY, null));
  const [tripHistory, setHistoryRaw] = useState<ShoppingTrip[]>(() => load(HISTORY_KEY, []));

  const setUsualLists = useCallback((lists: UsualList[]) => {
    setListsRaw(lists);
    save(LISTS_KEY, lists);
  }, []);

  const setActiveTrip = useCallback((trip: ShoppingTrip | null) => {
    setTripRaw(trip);
    save(TRIP_KEY, trip);
  }, []);

  const setTripHistory = useCallback((history: ShoppingTrip[]) => {
    setHistoryRaw(history);
    save(HISTORY_KEY, history);
  }, []);

  // ── Usual lists ──────────────────────────────────────────────────────────────

  function addUsualList(name: string): UsualList {
    const color = LIST_COLORS[usualLists.length % LIST_COLORS.length];
    const list: UsualList = { id: crypto.randomUUID(), name, color, items: [], createdAt: new Date().toISOString() };
    setUsualLists([...usualLists, list]);
    return list;
  }

  function updateUsualList(id: string, patch: Partial<Pick<UsualList, 'name' | 'color'>>) {
    setUsualLists(usualLists.map(l => (l.id === id ? { ...l, ...patch } : l)));
  }

  function deleteUsualList(id: string) {
    setUsualLists(usualLists.filter(l => l.id !== id));
  }

  function addUsualListItems(listId: string, items: Omit<UsualListItem, 'id' | 'position'>[]) {
    setUsualLists(
      usualLists.map(l => {
        if (l.id !== listId) return l;
        const base = l.items.length;
        const newItems = items.map((item, i) => ({ ...item, id: crypto.randomUUID(), position: base + i }));
        return { ...l, items: [...l.items, ...newItems] };
      }),
    );
  }

  function updateUsualListItem(listId: string, itemId: string, patch: Partial<UsualListItem>) {
    setUsualLists(
      usualLists.map(l =>
        l.id !== listId ? l : { ...l, items: l.items.map(i => (i.id === itemId ? { ...i, ...patch } : i)) },
      ),
    );
  }

  function deleteUsualListItem(listId: string, itemId: string) {
    setUsualLists(
      usualLists.map(l =>
        l.id !== listId ? l : { ...l, items: l.items.filter(i => i.id !== itemId) },
      ),
    );
  }

  // ── Trips ────────────────────────────────────────────────────────────────────

  function createTrip(name: string): ShoppingTrip {
    const trip: ShoppingTrip = {
      id: crypto.randomUUID(),
      name,
      status: 'draft',
      groups: [],
      createdAt: new Date().toISOString(),
    };
    setActiveTrip(trip);
    return trip;
  }

  function updateTrip(trip: ShoppingTrip) {
    setActiveTrip(trip);
  }

  function addGroupToTrip(groupName: string, color: string): ShoppingTripGroup | undefined {
    if (!activeTrip) return;
    const group: ShoppingTripGroup = {
      id: crypto.randomUUID(),
      name: groupName,
      color,
      position: activeTrip.groups.length,
      items: [],
    };
    setActiveTrip({ ...activeTrip, groups: [...activeTrip.groups, group] });
    return group;
  }

  function addItemsToGroup(tripRef: ShoppingTrip, groupId: string, newItems: Omit<ShoppingTripItem, 'id' | 'position'>[]): ShoppingTrip {
    const updated: ShoppingTrip = {
      ...tripRef,
      groups: tripRef.groups.map(g => {
        if (g.id !== groupId) return g;
        const base = g.items.length;
        return {
          ...g,
          items: [
            ...g.items,
            ...newItems.map((item, i) => ({ ...item, id: crypto.randomUUID(), position: base + i })),
          ],
        };
      }),
    };
    setActiveTrip(updated);
    return updated;
  }

  function removeItemFromGroup(groupId: string, itemId: string) {
    if (!activeTrip) return;
    setActiveTrip({
      ...activeTrip,
      groups: activeTrip.groups.map(g =>
        g.id !== groupId ? g : { ...g, items: g.items.filter(i => i.id !== itemId) },
      ),
    });
  }

  function removeGroup(groupId: string) {
    if (!activeTrip) return;
    setActiveTrip({ ...activeTrip, groups: activeTrip.groups.filter(g => g.id !== groupId) });
  }

  function toggleTripItem(groupId: string, itemId: string) {
    if (!activeTrip) return;
    setActiveTrip({
      ...activeTrip,
      groups: activeTrip.groups.map(g =>
        g.id !== groupId
          ? g
          : {
              ...g,
              items: g.items.map(i =>
                i.id === itemId ? { ...i, status: i.status === 'pending' ? 'purchased' : 'pending' } : i,
              ),
            },
      ),
    });
  }

  function completeTrip(): ShoppingTrip | undefined {
    if (!activeTrip) return;
    const completed: ShoppingTrip = { ...activeTrip, status: 'completed', completedAt: new Date().toISOString() };
    const newHistory = [completed, ...tripHistory];
    setTripHistory(newHistory);
    setActiveTrip(null);
    return completed;
  }

  function cancelTrip() {
    setActiveTrip(null);
  }

  function repeatTrip(trip: ShoppingTrip): ShoppingTrip {
    const newTrip: ShoppingTrip = {
      id: crypto.randomUUID(),
      name: trip.name,
      status: 'draft',
      createdAt: new Date().toISOString(),
      groups: trip.groups.map(g => ({
        ...g,
        id: crypto.randomUUID(),
        items: g.items.map(i => ({ ...i, id: crypto.randomUUID(), status: 'pending' as const })),
      })),
    };
    setActiveTrip(newTrip);
    return newTrip;
  }

  return {
    usualLists,
    activeTrip,
    tripHistory,
    // lists
    addUsualList,
    updateUsualList,
    deleteUsualList,
    addUsualListItems,
    updateUsualListItem,
    deleteUsualListItem,
    // trips
    createTrip,
    updateTrip,
    addGroupToTrip,
    addItemsToGroup,
    removeItemFromGroup,
    removeGroup,
    toggleTripItem,
    completeTrip,
    cancelTrip,
    repeatTrip,
  };
}
