import React, {
  useState, useRef, useEffect, useCallback, useLayoutEffect,
} from 'react';
import {
  Send, Pin, Search, X, Reply, Copy, Pencil, Trash2,
  Image, Plus, Check, ChevronDown, ArrowDown,
} from 'lucide-react';
import type { ChatMessage, Roommate } from '../types';
import { useChatData } from '../hooks/useChatData';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChatTabProps {
  apartmentId: string | null;
  apartmentName: string;
  roommates: Roommate[];
  currentUserId: string;
  currentUserName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function avatarColor(name: string) {
  const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

function groupByDate(messages: ChatMessage[]) {
  const groups: { label: string; messages: ChatMessage[] }[] = [];
  let currentLabel = '';
  messages.forEach(msg => {
    const label = fmtDate(msg.createdAt);
    if (label !== currentLabel) {
      groups.push({ label, messages: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].messages.push(msg);
  });
  return groups;
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(regex).map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 text-zinc-900 rounded px-0.5">{part}</mark> : part
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatTab({ apartmentId, apartmentName, roommates, currentUserId, currentUserName }: ChatTabProps) {
  const roommateNames = roommates.map(r => r.name);
  const { messages, loading, sendMessage, editMessage, deleteMessage, togglePin } = useChatData(apartmentId, currentUserId, roommateNames);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Listen for search toggle from parent header button
  useEffect(() => {
    const handler = () => setShowSearch(s => !s);
    window.addEventListener('chat:toggleSearch', handler);
    return () => window.removeEventListener('chat:toggleSearch', handler);
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pinnedMessages = React.useMemo(() => messages.filter(m => m.isPinned && !m.deletedAt), [messages]);
  const filteredMessages = searchQuery
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()) && !m.deletedAt)
    : null;

  // Subtitle: dynamic from roommates
  const subtitle = (() => {
    if (roommates.length === 0) return '';
    if (apartmentName) return `${apartmentName} · ${roommates.map(r => r.name).join(' y ')}`;
    if (roommates.length === 1) return roommates[0].name;
    if (roommates.length === 2) return `${roommates[0].name} y ${roommates[1].name}`;
    return `${roommates.slice(0, -1).map(r => r.name).join(', ')} y ${roommates[roommates.length - 1].name}`;
  })();

  // Auto-scroll to bottom on new message
  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useLayoutEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (atBottom) scrollToBottom(true);
    else setShowScrollDown(true);
  }, [messages.length]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollDown(!atBottom);
  }

  // Textarea auto-grow
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  function scrollToMessage(id: string) {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('bg-indigo-50');
    setTimeout(() => el.classList.remove('bg-indigo-50'), 1500);
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !editingId) return;

    if (editingId) {
      await editMessage(editingId, trimmed);
      setEditingId(null);
      setText('');
      return;
    }

    await sendMessage({
      text: trimmed,
      type: 'text',
      replyToId: replyTo?.id,
      senderName: currentUserName,
    });
    setText('');
    setReplyTo(null);
    setTimeout(() => scrollToBottom(true), 100);
  }

  function handleKeyDown(_e: React.KeyboardEvent) {
    // Enter always inserts a newline; send only via button
  }

  function startEdit(msg: ChatMessage) {
    setEditingId(msg.id);
    setText(msg.text ?? '');
    setContextMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setText('');
  }

  function startReply(msg: ChatMessage) {
    setReplyTo(msg);
    setContextMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function duplicateAndEdit(msg: ChatMessage) {
    setText(msg.text ?? '');
    setEditingId(null);
    setReplyTo(null);
    setContextMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function copyText(msg: ChatMessage) {
    const txt = msg.text ?? '';
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      // fallback for mobile browsers
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setContextMenu(null);
  }

  function handleLongPress(msg: ChatMessage) {
    setContextMenu({ msg, x: 0, y: 0 });
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await sendMessage({
        type: 'image',
        imageUrl: ev.target?.result as string,
        text: undefined,
        senderName: currentUserName,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
      setTimeout(() => scrollToBottom(true), 100);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 60px - env(safe-area-inset-bottom) - 56px)' }}>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          <Search size={15} className="text-zinc-400 shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar en el chat..."
            className="flex-1 text-sm bg-transparent outline-none text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
          />
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}><X size={16} className="text-zinc-400" /></button>
        </div>
      )}

      {/* Pinned banner */}
      {pinnedMessages.length > 0 && !showSearch && (
        <button
          onClick={() => setShowPinned(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/40 text-left"
        >
          <Pin size={13} className="text-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              {pinnedMessages.length} mensaje{pinnedMessages.length !== 1 ? 's' : ''} fijado{pinnedMessages.length !== 1 ? 's' : ''}
            </span>
            <p className="text-[11px] text-indigo-400 truncate">
              {pinnedMessages[pinnedMessages.length - 1].text?.split('\n')[0] ?? 'Imagen'}
            </p>
          </div>
          <ChevronDown size={13} className="text-indigo-400 shrink-0" />
        </button>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1 pb-nav"
      >
        {/* Search results mode */}
        {filteredMessages !== null ? (
          filteredMessages.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 mt-8">Sin resultados</p>
          ) : (
            filteredMessages.map(msg => (
              <button
                key={msg.id}
                onClick={() => { setShowSearch(false); setSearchQuery(''); setTimeout(() => scrollToMessage(msg.id), 100); }}
                className="w-full text-left bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 mb-2 border border-zinc-100 dark:border-zinc-800"
              >
                <p className="text-xs font-semibold text-indigo-500">{msg.senderName}</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5">
                  {highlight(msg.text ?? '', searchQuery)}
                </p>
                <p className="text-xs text-zinc-400 mt-1">{fmt(msg.createdAt)}</p>
              </button>
            ))
          )
        ) : (
          /* Normal chat view */
          messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                <Send size={24} className="text-indigo-300" />
              </div>
              <p className="text-[15px] font-semibold text-zinc-700 dark:text-zinc-300">Aún no hay mensajes</p>
              <p className="text-sm text-zinc-400 text-center max-w-[220px]">Empiecen a coordinar las cosas del depa aquí.</p>
            </div>
          ) : (
            groupByDate(messages).map(group => (
              <div key={group.label}>
                {/* Date separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                  <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 px-2">{group.label}</span>
                  <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                </div>
                {group.messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMine={msg.senderId === currentUserId}
                    msgRef={el => { msgRefs.current[msg.id] = el; }}
                    onLongPress={(msg) => handleLongPress(msg)}
                    onScrollToReply={scrollToMessage}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            ))
          )
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollDown && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 right-4 w-10 h-10 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center border border-zinc-100 dark:border-zinc-700 z-10"
        >
          <ArrowDown size={16} className="text-zinc-600 dark:text-zinc-300" />
        </button>
      )}

      {/* Composer */}
      <div className="bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 px-3 pt-2" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {/* Editing banner */}
        {editingId && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl">
            <Pencil size={12} className="text-indigo-500 shrink-0" />
            <p className="flex-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">Editando mensaje</p>
            <button onClick={cancelEdit}><X size={14} className="text-indigo-400" /></button>
          </div>
        )}
        {/* Reply preview */}
        {replyTo && !editingId && (
          <div className="flex items-start gap-2 mb-2 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl border-l-2 border-indigo-400">
            <Reply size={12} className="text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-indigo-500">{replyTo.senderName}</p>
              <p className="text-xs text-zinc-500 truncate">{replyTo.text?.split('\n')[0] ?? 'Imagen'}</p>
            </div>
            <button onClick={() => setReplyTo(null)}><X size={14} className="text-zinc-400" /></button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-100 dark:bg-zinc-800 active:bg-zinc-200"
          >
            <Image size={18} className="text-zinc-500" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-600 overflow-y-auto"
            style={{ maxHeight: 120 }}
          />

          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
            style={{ background: text.trim() ? '#4F46E5' : '#E5E7EB' }}
          >
            <Send size={16} className={text.trim() ? 'text-white' : 'text-zinc-400'} />
          </button>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          msg={contextMenu.msg}
          isMine={contextMenu.msg.senderId === currentUserId}
          onClose={() => setContextMenu(null)}
          onReply={() => startReply(contextMenu.msg)}
          onDuplicate={() => duplicateAndEdit(contextMenu.msg)}
          onCopy={() => copyText(contextMenu.msg)}
          onPin={() => { togglePin(contextMenu.msg.id); setContextMenu(null); }}
          onEdit={() => startEdit(contextMenu.msg)}
          onDelete={() => { deleteMessage(contextMenu.msg.id); setContextMenu(null); }}
        />
      )}

      {/* Pinned messages panel */}
      {showPinned && (
        <PinnedPanel
          messages={pinnedMessages}
          onClose={() => setShowPinned(false)}
          onGoTo={(id) => { setShowPinned(false); setTimeout(() => scrollToMessage(id), 200); }}
          onUnpin={(id) => togglePin(id)}
        />
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine, msgRef, onLongPress, onScrollToReply, searchQuery }: {
  key?: string;
  msg: ChatMessage;
  isMine: boolean;
  msgRef: (el: HTMLDivElement | null) => void;
  onLongPress: (msg: ChatMessage) => void;
  onScrollToReply: (id: string) => void;
  searchQuery: string;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onTouchStart() {
    longPressTimer.current = setTimeout(() => onLongPress(msg), 500);
  }
  function onTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  if (msg.deletedAt) {
    return (
      <div ref={msgRef} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
        <p className="text-xs text-zinc-400 italic px-3 py-1">Este mensaje fue eliminado</p>
      </div>
    );
  }

  const bubbleBg = isMine
    ? 'bg-indigo-600 text-white'
    : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-700';

  return (
    <div
      ref={msgRef}
      className={`flex items-end gap-2 mb-2 transition-colors duration-500 rounded-2xl ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onTouchMove={onTouchEnd}
      onContextMenu={e => { e.preventDefault(); onLongPress(msg); }}
    >
      {/* Avatar */}
      {!isMine && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mb-1"
          style={{ background: avatarColor(msg.senderName) }}
        >
          {getInitial(msg.senderName)}
        </div>
      )}

      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender name for others */}
        {!isMine && (
          <p className="text-[11px] font-semibold mb-1 px-1" style={{ color: avatarColor(msg.senderName) }}>
            {msg.senderName}
          </p>
        )}

        <div className={`rounded-2xl px-3 py-2 ${bubbleBg} ${isMine ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.07)' }}>

          {/* Reply reference */}
          {msg.replyToId && msg.replyToPreview && (
            <button
              onClick={() => onScrollToReply(msg.replyToId!)}
              className={`block w-full text-left mb-2 px-2 py-1 rounded-xl border-l-2 ${isMine ? 'bg-indigo-500/40 border-white/60' : 'bg-zinc-50 dark:bg-zinc-700 border-indigo-400'}`}
            >
              <p className={`text-[10px] font-semibold ${isMine ? 'text-white/80' : 'text-indigo-500'}`}>
                {msg.replyToPreview.senderName}
              </p>
              <p className={`text-[11px] truncate ${isMine ? 'text-white/70' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {msg.replyToPreview.text?.split('\n')[0] ?? 'Imagen'}
              </p>
            </button>
          )}

          {/* Image */}
          {msg.type === 'image' && msg.imageUrl && (
            <img
              src={msg.imageUrl}
              alt="imagen"
              className="rounded-xl max-w-full mb-1 max-h-48 object-cover"
              onClick={() => window.open(msg.imageUrl, '_blank')}
            />
          )}

          {/* Text */}
          {msg.text && (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
              {searchQuery ? highlight(msg.text, searchQuery) : msg.text}
            </p>
          )}

          {/* Meta row */}
          <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {msg.editedAt && (
              <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-zinc-400'}`}>editado</span>
            )}
            <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-zinc-400'}`}>{fmt(msg.createdAt)}</span>
            {isMine && <Check size={10} className="text-white/70" />}
          </div>
        </div>

        {/* Pin indicator */}
        {msg.isPinned && (
          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <Pin size={9} className="text-indigo-400" />
            <span className="text-[9px] text-indigo-400">Fijado</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────────

function ContextMenu({ msg, isMine, onClose, onReply, onDuplicate, onCopy, onPin, onEdit, onDelete }: {
  msg: ChatMessage; isMine: boolean;
  onClose: () => void; onReply: () => void; onDuplicate: () => void;
  onCopy: () => void; onPin: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const actions = [
    { label: 'Responder', icon: <Reply size={16} />, action: onReply },
    { label: 'Duplicar y editar', icon: <Copy size={16} />, action: onDuplicate },
    { label: 'Copiar', icon: <Copy size={16} />, action: onCopy },
    { label: msg.isPinned ? 'Desfijar' : 'Fijar', icon: <Pin size={16} />, action: onPin },
    ...(isMine && !msg.deletedAt ? [{ label: 'Editar', icon: <Pencil size={16} />, action: onEdit }] : []),
    ...(isMine ? [{ label: 'Eliminar', icon: <Trash2 size={16} />, action: onDelete, danger: true }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full bg-white dark:bg-zinc-900 rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.12)' }}
      >
        <div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 mx-auto mt-3 mb-2" />
        {/* Message preview */}
        <div className="px-4 py-2 mb-1 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-400 truncate">{msg.text?.split('\n')[0] ?? 'Imagen'}</p>
        </div>
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.action}
            className={`w-full flex items-center gap-4 px-5 py-4 text-left text-[15px] font-medium active:bg-zinc-50 dark:active:bg-zinc-800 transition-colors ${'danger' in a && a.danger ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-200'}`}
          >
            <span className={'danger' in a && a.danger ? 'text-red-400' : 'text-zinc-400'}>{a.icon}</span>
            {a.label}
          </button>
        ))}
        <button
          onClick={onClose}
          className="w-full py-4 text-center text-[15px] font-semibold text-indigo-600 border-t border-zinc-100 dark:border-zinc-800 active:bg-zinc-50"
        >
          Cancelar
        </button>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  );
}

// ── Pinned panel ──────────────────────────────────────────────────────────────

function PinnedPanel({ messages, onClose, onGoTo, onUnpin }: {
  messages: ChatMessage[];
  onClose: () => void;
  onGoTo: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <X size={16} className="text-zinc-600 dark:text-zinc-300" />
        </button>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Mensajes fijados</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className="bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-500 mb-1">{msg.senderName}</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap line-clamp-3">{msg.text}</p>
                {msg.imageUrl && <img src={msg.imageUrl} alt="" className="rounded-xl mt-2 max-h-24 object-cover" />}
                <p className="text-xs text-zinc-400 mt-2">{new Date(msg.createdAt).toLocaleDateString('es-PE')}</p>
              </div>
              <button onClick={() => onUnpin(msg.id)} className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                <Pin size={12} className="text-zinc-500" />
              </button>
            </div>
            <button
              onClick={() => onGoTo(msg.id)}
              className="mt-3 text-xs font-semibold text-indigo-500 flex items-center gap-1"
            >
              Ir al mensaje →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
