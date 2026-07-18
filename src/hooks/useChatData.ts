import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatMessage } from '../types';

// ── Demo data (shown when table doesn't exist yet or is empty) ───────────────

const DEMO_APT = '__demo__';

function buildDemo(roommateNames: string[]): ChatMessage[] {
  const vale = roommateNames[1] ?? 'Vale';
  const jony = roommateNames[0] ?? 'Jony';
  const now = new Date();
  function ts(minutesAgo: number) {
    return new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();
  }

  const msgs: ChatMessage[] = [
    {
      id: 'demo-1',
      apartmentId: DEMO_APT,
      senderId: 'user-vale',
      senderName: vale,
      type: 'text',
      text: `Compras mercado jueves:\n- tomate 1 kg\n- 2 lechugas\n- cebolla\n- palta\n- papa`,
      isPinned: true,
      pinnedBy: 'user-jony',
      pinnedAt: ts(50),
      createdAt: ts(60),
    },
    {
      id: 'demo-2',
      apartmentId: DEMO_APT,
      senderId: 'user-jony',
      senderName: jony,
      type: 'text',
      text: `Compras Avinka:\n- pollo 2 kg\n- huevos\n- hamburguesas`,
      isPinned: true,
      pinnedBy: 'user-vale',
      pinnedAt: ts(40),
      createdAt: ts(45),
    },
    {
      id: 'demo-3',
      apartmentId: DEMO_APT,
      senderId: 'user-vale',
      senderName: vale,
      type: 'text',
      text: `Falta comprar:\n- jabón\n- papel higiénico\n- yogurt griego`,
      isPinned: false,
      createdAt: ts(30),
    },
    {
      id: 'demo-4',
      apartmentId: DEMO_APT,
      senderId: 'user-jony',
      senderName: jony,
      type: 'text',
      text: `Para el cumpleaños vienen:\n- Ana\n- Pedro\n- Lu\n- Carlos\n\nHay que comprar torta, piqueos y hielo.`,
      isPinned: false,
      createdAt: ts(20),
    },
    {
      id: 'demo-5',
      apartmentId: DEMO_APT,
      senderId: 'user-vale',
      senderName: vale,
      type: 'text',
      text: `Ya pagué el internet, te mando el comprobante`,
      isPinned: false,
      createdAt: ts(15),
    },
    {
      id: 'demo-6',
      apartmentId: DEMO_APT,
      senderId: 'user-vale',
      senderName: vale,
      type: 'image',
      imageUrl: 'https://placehold.co/300x200/e0e7ff/6366f1?text=Comprobante',
      text: 'Comprobante internet julio',
      isPinned: false,
      createdAt: ts(14),
    },
    {
      id: 'demo-7',
      apartmentId: DEMO_APT,
      senderId: 'user-jony',
      senderName: jony,
      type: 'text',
      text: `Perfecto, gracias! 👍`,
      isPinned: false,
      replyToId: 'demo-5',
      replyToPreview: { senderName: vale, text: 'Ya pagué el internet, te mando el comprobante' },
      createdAt: ts(12),
    },
    {
      id: 'demo-8',
      apartmentId: DEMO_APT,
      senderId: 'user-jony',
      senderName: jony,
      type: 'text',
      text: `Igual yo compro los piqueos y el hielo para el cumple`,
      isPinned: false,
      editedAt: ts(8),
      createdAt: ts(10),
    },
  ];
  return msgs;
}

// ── Row mapper ───────────────────────────────────────────────────────────────

function rowToMessage(r: any, allRows?: any[]): ChatMessage {
  let replyToPreview: ChatMessage['replyToPreview'] | undefined;
  if (r.reply_to_id && allRows) {
    const parent = allRows.find((m: any) => m.id === r.reply_to_id);
    if (parent) replyToPreview = { senderName: parent.sender_name, text: parent.text ?? undefined };
  }
  return {
    id: r.id,
    apartmentId: r.apartment_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    type: r.type ?? 'text',
    text: r.text ?? undefined,
    imageUrl: r.image_url ?? undefined,
    replyToId: r.reply_to_id ?? undefined,
    replyToPreview,
    isPinned: r.is_pinned ?? false,
    pinnedBy: r.pinned_by ?? undefined,
    pinnedAt: r.pinned_at ?? undefined,
    editedAt: r.edited_at ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
    createdAt: r.created_at,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChatData(apartmentId: string | null, currentUserId: string, roommateNames: string[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!apartmentId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        // Table doesn't exist yet → show demo
        setMessages(buildDemo(roommateNames));
        setIsDemo(true);
      } else {
        const rows = data ?? [];
        const mapped = rows.map(r => rowToMessage(r, rows));
        if (mapped.length === 0) {
          setMessages(buildDemo(roommateNames));
          setIsDemo(true);
        } else {
          setMessages(mapped);
          setIsDemo(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);

  // Realtime subscription
  useEffect(() => {
    if (!apartmentId) return;
    load();

    const ch = supabase
      .channel(`chat:${apartmentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `apartment_id=eq.${apartmentId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => {
              const row = payload.new;
              const preview = prev.find(m => m.id === row.reply_to_id);
              const msg = rowToMessage(row);
              if (preview) msg.replyToPreview = { senderName: preview.senderName, text: preview.text };
              // avoid duplicate (optimistic already inserted)
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
          if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? rowToMessage(payload.new) : m));
          }
        })
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [apartmentId, load]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function sendMessage(opts: {
    text?: string;
    imageUrl?: string;
    type?: 'text' | 'image';
    replyToId?: string;
    senderName: string;
  }) {
    if (!apartmentId) return;
    if (isDemo) {
      // In demo mode just append locally
      const replyTo = opts.replyToId ? messages.find(m => m.id === opts.replyToId) : undefined;
      const msg: ChatMessage = {
        id: `local-${Date.now()}`,
        apartmentId,
        senderId: currentUserId,
        senderName: opts.senderName,
        type: opts.type ?? 'text',
        text: opts.text,
        imageUrl: opts.imageUrl,
        replyToId: opts.replyToId,
        replyToPreview: replyTo ? { senderName: replyTo.senderName, text: replyTo.text } : undefined,
        isPinned: false,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, msg]);
      return;
    }

    const optimisticId = `opt-${Date.now()}`;
    const replyTo = opts.replyToId ? messages.find(m => m.id === opts.replyToId) : undefined;
    const optimistic: ChatMessage = {
      id: optimisticId,
      apartmentId,
      senderId: currentUserId,
      senderName: opts.senderName,
      type: opts.type ?? 'text',
      text: opts.text,
      imageUrl: opts.imageUrl,
      replyToId: opts.replyToId,
      replyToPreview: replyTo ? { senderName: replyTo.senderName, text: replyTo.text } : undefined,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    const { data, error } = await supabase.from('chat_messages').insert({
      apartment_id: apartmentId,
      sender_id: currentUserId,
      sender_name: opts.senderName,
      type: opts.type ?? 'text',
      text: opts.text ?? null,
      image_url: opts.imageUrl ?? null,
      reply_to_id: opts.replyToId ?? null,
    }).select().single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } else {
      setMessages(prev => prev.map(m => m.id === optimisticId ? rowToMessage(data) : m));
    }
  }

  async function editMessage(id: string, newText: string) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, text: newText, editedAt: new Date().toISOString() } : m));
    if (!isDemo) {
      await supabase.from('chat_messages').update({ text: newText, edited_at: new Date().toISOString() }).eq('id', id);
    }
  }

  async function deleteMessage(id: string) {
    const ts = new Date().toISOString();
    setMessages(prev => prev.map(m => m.id === id ? { ...m, deletedAt: ts, text: undefined, imageUrl: undefined } : m));
    if (!isDemo) {
      await supabase.from('chat_messages').update({ deleted_at: ts, text: null }).eq('id', id);
    }
  }

  async function togglePin(id: string) {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    const nowPinned = !msg.isPinned;
    const ts = nowPinned ? new Date().toISOString() : null;
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isPinned: nowPinned, pinnedAt: ts ?? undefined, pinnedBy: nowPinned ? currentUserId : undefined } : m));
    if (!isDemo) {
      await supabase.from('chat_messages').update({ is_pinned: nowPinned, pinned_by: nowPinned ? currentUserId : null, pinned_at: ts }).eq('id', id);
    }
  }

  return { messages, loading, isDemo, sendMessage, editMessage, deleteMessage, togglePin };
}
