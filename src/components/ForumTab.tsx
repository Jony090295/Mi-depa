import React, { useState } from 'react';
import { ForumPost, ForumReply } from '../types';
import { MessageSquare, Plus, ArrowRight, HelpCircle, AlertTriangle, Lightbulb, Users, Check, Trash2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface ForumTabProps {
  posts: ForumPost[];
  onAddPost: (post: ForumPost) => void;
  onAddReply: (postId: string, reply: ForumReply) => void;
}

export default function ForumTab({
  posts,
  onAddPost,
  onAddReply,
}: ForumTabProps) {
  const [activeType, setActiveType] = useState<'Todos' | 'tip' | 'pregunta' | 'alerta'>('Todos');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newType, setNewType] = useState<'tip' | 'pregunta' | 'alerta'>('tip');
  const [successMsg, setSuccessMsg] = useState('');

  // Replies helper state
  const [replyInputMap, setReplyInputMap] = useState<Record<string, { author: string; content: string }>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  const toggleComments = (id: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newAuthor.trim()) {
      alert("Por favor rellene todos los campos del foro.");
      return;
    }

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      author: newAuthor.trim(),
      title: newTitle.trim(),
      content: newContent.trim(),
      type: newType,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    onAddPost(newPost);
    setNewTitle('');
    setNewContent('');
    setNewAuthor('');
    setNewType('tip');
    setSuccessMsg('📝 ¡Entrada publicada en el muro del depa!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleReplyChange = (postId: string, field: 'author' | 'content', value: string) => {
    setReplyInputMap((prev) => {
      const existing = prev[postId] || { author: '', content: '' };
      return {
        ...prev,
        [postId]: { ...existing, [field]: value },
      };
    });
  };

  const handleCreateReply = (postId: string) => {
    const inputs = replyInputMap[postId];
    if (!inputs || !inputs.author.trim() || !inputs.content.trim()) {
      alert("Por favor ingresa tu nombre y contenido antes de responder.");
      return;
    }

    const newReply: ForumReply = {
      id: `rep-${Date.now()}`,
      author: inputs.author.trim(),
      content: inputs.content.trim(),
      createdAt: new Date().toISOString(),
    };

    onAddReply(postId, newReply);
    
    // Clear reply input for that post
    setReplyInputMap((prev) => ({
      ...prev,
      [postId]: { author: '', content: '' },
    }));
  };

  const filteredPosts = posts.filter((post) => {
    if (activeType === 'Todos') return true;
    return post.type === activeType;
  });

  const getPostBadgeColor = (type: string) => {
    if (type === 'tip') return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30';
    if (type === 'pregunta') return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30';
    return 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30';
  };

  const getPostIcon = (type: string) => {
    if (type === 'tip') return <Lightbulb size={13} />;
    if (type === 'pregunta') return <HelpCircle size={13} />;
    return <AlertTriangle size={13} />;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 md:px-0">
      {successMsg && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid containing Forum Thread List & Post Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Forum threads listings */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Foro de Roommates & Q&A</h3>
              <p className="text-xs text-zinc-500">Deja avisos comunitarios, tips de ahorro o responde dudas del depa.</p>
            </div>
            
            <div className="flex flex-wrap gap-1.5 align-middle self-center">
              {(['Todos', 'tip', 'pregunta', 'alerta'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                    activeType === type
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {type === 'Todos' ? 'Todos' : type === 'tip' ? 'Tips' : type === 'pregunta' ? 'Preguntas (Q&A)' : 'Alertas'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5 max-h-[550px] overflow-y-auto pr-1">
            {filteredPosts.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-150 dark:border-zinc-800">
                <p className="text-sm font-semibold">Muro vacío en esta categoría.</p>
                <p className="text-xs mt-1">Comparte un tip, consulta, o publica tu primer aviso usando el formulario.</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getPostBadgeColor(post.type)}`}>
                          {getPostIcon(post.type)}
                          {post.type === 'tip' ? 'Tip de Ahorro' : post.type === 'pregunta' ? 'Duda / Q&A' : 'Aviso / Alerta'}
                        </span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Users size={11} /> {post.author}
                        </span>
                      </div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-50 text-base mt-2 flex items-center gap-1 hover:text-indigo-600 transition leading-tight">
                        {post.title}
                      </h4>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-700 dark:text-zinc-300 font-light leading-relaxed bg-zinc-50 dark:bg-zinc-850 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    {post.content}
                  </p>

                  {/* Collapsible Replies Segment */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleComments(post.id)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer py-1 transition"
                    >
                      {expandedComments[post.id] ? (
                        <>
                          <ChevronUp size={14} />
                          Ocultar respuestas ({post.replies.length})
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          Ver respuestas ({post.replies.length})
                        </>
                      )}
                    </button>
                    
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {post.replies.length === 0 ? "Sin respuestas" : "Discusión activa"}
                    </span>
                  </div>

                  {expandedComments[post.id] && (
                    <div className="space-y-3.5 pl-3 md:pl-6 border-l-2 border-zinc-150 dark:border-zinc-805 mt-2 animate-fadeIn">
                      {post.replies.length > 0 && (
                        <div className="space-y-2">
                          {post.replies.map((reply) => (
                            <div key={reply.id} className="p-3 bg-zinc-50/50 dark:bg-zinc-900/60 rounded-xl border border-zinc-100 dark:border-zinc-800/80 font-sans">
                              <div className="flex items-center justify-between gap-1 text-[9px] text-zinc-400">
                                <span className="font-bold text-zinc-650 dark:text-zinc-350">{reply.author}</span>
                                <span className="font-mono">
                                  {new Date(reply.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-700 dark:text-zinc-350 font-normal mt-1 leading-normal">
                                {reply.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Write comment inline form */}
                      <div className="pt-3 bg-zinc-50/30 dark:bg-zinc-950/20 rounded-xl p-3.5 border border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-500 mb-2 font-sans">Comentar esta publicación:</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Tu nombre"
                              value={replyInputMap[post.id]?.author || ''}
                              onChange={(e) => handleReplyChange(post.id, 'author', e.target.value)}
                              className="w-1/3 px-2.5 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-150 text-base font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <input
                              type="text"
                              placeholder="Escribe tu respuesta..."
                              value={replyInputMap[post.id]?.content || ''}
                              onChange={(e) => handleReplyChange(post.id, 'content', e.target.value)}
                              className="flex-1 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-base text-zinc-800 dark:text-zinc-150 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCreateReply(post.id)}
                            className="w-full min-h-[44px] bg-zinc-800 hover:bg-zinc-950 dark:bg-zinc-700 dark:hover:bg-zinc-650 text-white rounded-lg text-sm font-bold transition flex items-center justify-center cursor-pointer py-2.5"
                          >
                            Comentar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Compose Entry Form */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 shadow-sm self-start">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600">
              <MessageSquare size={18} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Nueva Publicación</h3>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                ¿Qué vas a subir?
              </label>
              <div className="grid grid-cols-3 gap-1 grid-flow-row">
                <button
                  type="button"
                  onClick={() => setNewType('tip')}
                  className={`py-1.5 px-0.5 text-center text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                    newType === 'tip'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-500'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  💡 Tip de Ahorro
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('pregunta')}
                  className={`py-1.5 px-0.5 text-center text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                    newType === 'pregunta'
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-500'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  ❓ Duda / Q&A
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('alerta')}
                  className={`py-1.5 px-0.5 text-center text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                    newType === 'alerta'
                      ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 border-pink-500'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  📢 Aviso / Alerta
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Tu nombre *
              </label>
              <input
                id="forum-author-input"
                type="text"
                required
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="Ej. Sofía, Carlos, Mateo..."
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Título / Pregunta Corta *
              </label>
              <input
                id="forum-title-input"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. ¿A quién le toca comprar lavavajillas?"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Cuerpo / Contenido del Mensaje *
              </label>
              <textarea
                id="forum-content-input"
                required
                rows={4}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Escribe el tip con lujo de detalles o haz tu pregunta aclaratoria..."
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-light focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            <button
              id="submit-forum-button"
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition duration-200 text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              Publicar en el Foro
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
