import React, { useState, useEffect, useRef } from 'react';
import { TrustedService, ForumPost, ForumReply } from '../types';
import { Phone, Star, Plus, Search, MessageSquare, ChevronDown, ChevronUp, Lightbulb, HelpCircle, X } from 'lucide-react';

interface CommunityTabProps {
  posts: ForumPost[];
  onAddPost: (post: ForumPost) => void;
  onAddReply: (postId: string, reply: ForumReply) => void;
  trustedServices: TrustedService[];
  onAddTrustedService: (svc: TrustedService) => void;
}

// ── helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_LIST = ['Todos', 'Instalación de rollers', 'Electricista', 'Gasfitero / Plomero', 'Limpieza', 'Otros'];

const AVATAR_COLORS = ['#6366f1','#ec4899','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444'];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const TYPE_META = {
  tip:      { label: 'Tip',      icon: <Lightbulb size={11} />,  bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' },
  pregunta: { label: 'Pregunta', icon: <HelpCircle size={11} />, bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30' },
  alerta:   { label: 'Alerta',   icon: <HelpCircle size={11} />, bg: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border border-zinc-100 dark:border-zinc-700' },
};

// ── main component ───────────────────────────────────────────────────────────

export default function CommunityTab({ posts, onAddPost, onAddReply, trustedServices: services, onAddTrustedService }: CommunityTabProps) {
  const [section, setSection] = useState<'directory' | 'forum'>('directory');

  // ── Directory state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedCat, setSelectedCat]     = useState('Todos');
  const [showAddService, setShowAddService] = useState(false);
  // new service form
  const [svcName, setSvcName]           = useState('');
  const [svcCategory, setSvcCategory]   = useState('Instalación de rollers');
  const [svcPhone, setSvcPhone]         = useState('');
  const [svcRating, setSvcRating]       = useState(5);
  const [svcReview, setSvcReview]       = useState('');
  const [svcRecommendedBy, setSvcRecommendedBy] = useState('');

  // ── Forum state ──────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter]     = useState<'Todos' | 'tip' | 'pregunta'>('Todos');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [showAddPost, setShowAddPost]   = useState(false);
  const [replyText, setReplyText]       = useState<Record<string, string>>({});
  const [replyAuthor, setReplyAuthor]   = useState<Record<string, string>>({});
  // new post form
  const [postTitle, setPostTitle]       = useState('');
  const [postContent, setPostContent]   = useState('');
  const [postAuthor, setPostAuthor]     = useState('');
  const [postType, setPostType]         = useState<'tip' | 'pregunta'>('tip');


  // ── Body scroll lock for sheets ──────────────────────────────────────────
  useEffect(() => {
    const open = showAddService || showAddPost;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showAddService, showAddPost]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!svcName.trim() || !svcPhone.trim() || !svcReview.trim()) return;
    const local: TrustedService = {
      id: crypto.randomUUID(), name: svcName.trim(), category: svcCategory,
      phone: svcPhone.trim(), rating: svcRating, description: svcReview.trim(),
      recommendedBy: svcRecommendedBy.trim() || 'Vecino de Mi Depa',
    };
    onAddTrustedService(local);
    setSvcName(''); setSvcPhone(''); setSvcReview(''); setSvcRecommendedBy(''); setSvcRating(5);
    setShowAddService(false);
  };

  const handleAddPostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim() || !postAuthor.trim()) return;
    onAddPost({
      id: crypto.randomUUID(), author: postAuthor.trim(), title: postTitle.trim(),
      content: postContent.trim(), type: postType,
      createdAt: new Date().toISOString(), replies: [],
    });
    setPostTitle(''); setPostContent(''); setPostAuthor(''); setPostType('tip');
    setShowAddPost(false);
  };

  const handleReply = (postId: string) => {
    const text = replyText[postId]?.trim();
    const author = replyAuthor[postId]?.trim();
    if (!text || !author) return;
    onAddReply(postId, {
      id: crypto.randomUUID(), author, content: text, createdAt: new Date().toISOString(),
    });
    setReplyText(p => ({ ...p, [postId]: '' }));
    setReplyAuthor(p => ({ ...p, [postId]: '' }));
  };

  // ── Filtered lists ───────────────────────────────────────────────────────
  const filteredServices = services.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    const matchCat = selectedCat === 'Todos' || s.category.toLowerCase() === selectedCat.toLowerCase();
    return matchSearch && matchCat;
  });

  const filteredPosts = typeFilter === 'Todos' ? posts : posts.filter(p => p.type === typeFilter);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Sub-tabs */}
      <div className="flex p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
        {(['directory', 'forum'] as const).map(s => (
          <button key={s} type="button" onClick={() => setSection(s)}
            className={`flex-1 h-9 rounded-[14px] text-[13px] font-semibold transition-all cursor-pointer ${section === s ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
            {s === 'directory' ? 'Directorio' : 'Foro'}
          </button>
        ))}
      </div>

      {/* ══ DIRECTORIO ══════════════════════════════════════════════════════ */}
      {section === 'directory' && (
        <div className="space-y-3">

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar proveedor, rubro…"
              className="w-full pl-9 pr-4 h-10 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORY_LIST.map(cat => (
              <button key={cat} type="button" onClick={() => setSelectedCat(cat)}
                className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold transition cursor-pointer ${selectedCat === cat ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Cards */}
          {filteredServices.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-zinc-400">
              <span className="text-3xl">🔍</span>
              <p className="text-[13px] font-semibold">Sin resultados</p>
              <p className="text-[12px]">Sé el primero en agregar un contacto</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredServices.map(s => (
                <div key={s.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                          {s.category}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={11} className={i <= s.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200 dark:text-zinc-700'} />
                          ))}
                          <span className="text-[11px] text-zinc-400 ml-1">{s.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 mt-1.5">{s.name}</p>
                      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">{s.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-400 truncate">
                      Recomendado por <span className="font-semibold text-zinc-600 dark:text-zinc-300">{s.recommendedBy || 'la comunidad'}</span>
                    </p>
                    <a href={`tel:${s.phone}`}
                      className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[12px] font-semibold hover:bg-emerald-100 transition">
                      <Phone size={12} className="fill-emerald-700 dark:fill-emerald-400 stroke-none" />
                      Llamar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add CTA */}
          <button type="button" onClick={() => setShowAddService(true)}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 hover:border-indigo-300 transition cursor-pointer">
            <Plus size={15} /> Agregar contacto de confianza
          </button>

        </div>
      )}

      {/* ══ FORO ════════════════════════════════════════════════════════════ */}
      {section === 'forum' && (
        <div className="space-y-3">

          {/* Type filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(['Todos', 'tip', 'pregunta'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTypeFilter(t)}
                className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold transition cursor-pointer ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                {t === 'Todos' ? 'Todos' : TYPE_META[t].label}
              </button>
            ))}
          </div>

          {/* Posts */}
          {filteredPosts.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-zinc-400">
              <span className="text-3xl">💬</span>
              <p className="text-[13px] font-semibold">Sin publicaciones aún</p>
              <p className="text-[12px]">Sé el primero en compartir un tip</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPosts.map(post => {
                const meta = TYPE_META[post.type];
                const expanded = expandedId === post.id;
                return (
                  <div key={post.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                    {/* Post header — always visible */}
                    <button type="button" onClick={() => setExpandedId(expanded ? null : post.id)}
                      className="w-full text-left p-4 cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-800 transition">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                          style={{ backgroundColor: avatarColor(post.author) }}>
                          {post.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.bg}`}>
                              {meta.icon} {meta.label}
                            </span>
                            <span className="text-[11px] text-zinc-400">{post.author} · {timeAgo(post.createdAt)}</span>
                          </div>
                          <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 mt-1 leading-snug">{post.title}</p>
                          {!expanded && (
                            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">{post.content}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-zinc-300 dark:text-zinc-600">
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {!expanded && post.replies.length > 0 && (
                        <div className="mt-2 ml-11 flex items-center gap-1 text-[11px] text-zinc-400">
                          <MessageSquare size={11} />
                          <span>{post.replies.length} {post.replies.length === 1 ? 'respuesta' : 'respuestas'}</span>
                        </div>
                      )}
                    </button>

                    {/* Expanded: full content + replies + reply form */}
                    {expanded && (
                      <div className="border-t border-zinc-50 dark:border-zinc-800">
                        {/* Full content */}
                        <div className="px-4 py-3">
                          <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">{post.content}</p>
                        </div>

                        {/* Replies */}
                        {post.replies.length > 0 && (
                          <div className="border-t border-zinc-50 dark:border-zinc-800 divide-y divide-zinc-50 dark:divide-zinc-800">
                            {post.replies.map(r => (
                              <div key={r.id} className="flex gap-3 px-4 py-3">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                                  style={{ backgroundColor: avatarColor(r.author) }}>
                                  {r.author.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{r.author} <span className="font-normal text-zinc-400">· {timeAgo(r.createdAt)}</span></p>
                                  <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mt-0.5 leading-relaxed">{r.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply form */}
                        <div className="border-t border-zinc-50 dark:border-zinc-800 px-4 py-3 space-y-2">
                          <input type="text" placeholder="Tu nombre"
                            value={replyAuthor[post.id] || ''}
                            onChange={e => setReplyAuthor(p => ({ ...p, [post.id]: e.target.value }))}
                            className="w-full h-8 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[12px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          <div className="flex gap-2">
                            <input type="text" placeholder="Escribe una respuesta…"
                              value={replyText[post.id] || ''}
                              onChange={e => setReplyText(p => ({ ...p, [post.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && handleReply(post.id)}
                              className="flex-1 h-8 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[12px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <button type="button" onClick={() => handleReply(post.id)}
                              className="h-8 px-3 rounded-xl bg-indigo-600 text-white text-[12px] font-semibold cursor-pointer active:scale-95 transition">
                              Enviar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Publish CTA */}
          <button type="button" onClick={() => setShowAddPost(true)}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 hover:border-indigo-300 transition cursor-pointer">
            <Plus size={15} /> Publicar en el foro
          </button>

        </div>
      )}

      {/* ══ SHEET: Agregar contacto ══════════════════════════════════════════ */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)', paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddService(false); }}>
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '100%' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">Agregar contacto</h2>
              <button type="button" onClick={() => setShowAddService(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer active:scale-90 transition">
                <X size={15} />
              </button>
            </div>
            {/* Form */}
            <form id="add-service-form" onSubmit={handleAddService} className="overflow-y-auto flex-1 min-h-0 px-6 py-4 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Nombre del proveedor *</label>
                <input type="text" required value={svcName} onChange={e => setSvcName(e.target.value)}
                  placeholder="Ej. Juan Cortinas Royales"
                  className="mt-1 w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Especialidad / Rubro *</label>
                <select value={svcCategory} onChange={e => setSvcCategory(e.target.value)}
                  className="mt-1 w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                  {CATEGORY_LIST.filter(c => c !== 'Todos').map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Teléfono *</label>
                <input type="tel" required value={svcPhone} onChange={e => setSvcPhone(e.target.value)}
                  placeholder="+51 999 888 777"
                  className="mt-1 w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Calificación</label>
                <div className="mt-2 flex items-center gap-1">
                  {[1,2,3,4,5].map(i => (
                    <button key={i} type="button" onClick={() => setSvcRating(i)} className="cursor-pointer p-0.5 active:scale-110 transition">
                      <Star size={24} className={i <= svcRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200 dark:text-zinc-700'} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">¿Quién lo recomienda?</label>
                <input type="text" value={svcRecommendedBy} onChange={e => setSvcRecommendedBy(e.target.value)}
                  placeholder="Tu nombre o depa"
                  className="mt-1 w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Reseña *</label>
                <textarea required rows={3} value={svcReview} onChange={e => setSvcReview(e.target.value)}
                  placeholder="¿Por qué lo recomendarías? Precio, puntualidad, calidad…"
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </form>
            {/* Footer */}
            <div className="px-6 pt-3 pb-4 flex-shrink-0 border-t border-zinc-100 dark:border-zinc-800">
              <button type="submit" form="add-service-form"
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-[15px] rounded-2xl transition cursor-pointer">
                Agregar al directorio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SHEET: Nueva publicación ═════════════════════════════════════════ */}
      {showAddPost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 52px)', paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddPost(false); }}>
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '100%' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">Nueva publicación</h2>
              <button type="button" onClick={() => setShowAddPost(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer active:scale-90 transition">
                <X size={15} />
              </button>
            </div>
            {/* Form */}
            <form id="add-post-form" onSubmit={handleAddPostSubmit} className="overflow-y-auto flex-1 min-h-0 px-6 py-4 space-y-4">
              {/* Type chips */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Tipo</label>
                <div className="mt-2 flex gap-2">
                  {(['tip', 'pregunta'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setPostType(t)}
                      className={`flex-1 h-9 rounded-2xl text-[12px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 border ${postType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>
                      {TYPE_META[t].icon} {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Tu nombre *</label>
                <input type="text" required value={postAuthor} onChange={e => setPostAuthor(e.target.value)}
                  placeholder="Ej. Camila Dpto 5B"
                  className="mt-1 w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Título *</label>
                <input type="text" required value={postTitle} onChange={e => setPostTitle(e.target.value)}
                  placeholder="Ej. Cómo bajar la factura de luz…"
                  className="mt-1 w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Contenido *</label>
                <textarea required rows={4} value={postContent} onChange={e => setPostContent(e.target.value)}
                  placeholder="Comparte el tip, haz tu pregunta o describe la alerta…"
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </form>
            {/* Footer */}
            <div className="px-6 pt-3 pb-4 flex-shrink-0 border-t border-zinc-100 dark:border-zinc-800">
              <button type="submit" form="add-post-form"
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-[15px] rounded-2xl transition cursor-pointer">
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
