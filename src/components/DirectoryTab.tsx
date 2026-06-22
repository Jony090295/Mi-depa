import React, { useState, useEffect } from 'react';
import { TrustedService } from '../types';
import { Phone, Star, Plus, ShieldCheck, Search, Users, Sparkles, Check, ChevronRight } from 'lucide-react';

interface DirectoryTabProps {
  onAddTrustedService: (service: TrustedService) => void;
}

export default function DirectoryTab({ onAddTrustedService }: DirectoryTabProps) {
  const [services, setServices] = useState<TrustedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [successMsg, setSuccessMsg] = useState('');
  
  // New service form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Instalación de Rollers');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState(5);
  const [recommendedBy, setRecommendedBy] = useState('');

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trusted-services');
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (e) {
      console.error('Error fetching trusted services:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category.trim() || !phone.trim() || !description.trim()) {
      alert("Por favor completa los campos requeridos.");
      return;
    }

    try {
      const response = await fetch('/api/trusted-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          phone: phone.trim(),
          rating: Number(rating),
          recommendedBy: recommendedBy.trim() || "Roommate de Mi Depa",
        }),
      });

      if (response.ok) {
        const newSer = await response.json();
        setServices((prev) => [...prev, newSer]);
        
        // Notify parent if needed
        onAddTrustedService(newSer);

        // Reset
        setName('');
        setDescription('');
        setPhone('');
        setRating(5);
        setRecommendedBy('');
        setShowAddForm(false);
        setSuccessMsg('✅ ¡Proveedor registrado con éxito en la base de datos!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error registering trusted provider:', err);
    }
  };

  const categoriesList = ['Todos', 'Instalación de Rollers', 'Electricista', 'Gasfitero / Plomero', 'Limpieza', 'Otros'];

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'Todos') return matchesSearch;
    return matchesSearch && service.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 md:px-0">
      
      {/* Toast banner */}
      {successMsg && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <ShieldCheck size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header and statistics */}
      <div className="bg-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 opacity-10 pointer-events-none">
          <ShieldCheck size={280} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <span className="bg-indigo-500/50 text-indigo-100 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">
            Recomendaciones Reales
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3">Directorio de Contactos de Confianza</h2>
          <p className="text-sm text-indigo-100 mt-2 leading-relaxed font-light">
            ¿Buscas personal confiable para tu depa compartido? No recurras a anuncios dudosos. Aquí recopilamos plomeros, electricistas, e instaladores probados por los mismos vecinos y roommates del edificio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Search, Filter and Providers list */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                id="search-directory-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar instaladores, rollers, don Lucho..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 text-base font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-400">
              <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
              <p className="text-sm font-medium">Buscando proveedores de confianza...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-8 text-center text-zinc-400 dark:text-zinc-650">
              <p className="text-sm font-semibold">No se encontraron proveedores para tu filtro.</p>
              <p className="text-xs mt-1">Sé el primero en agregar una sugerencia de confianza usando el formulario de la derecha.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 hover:border-zinc-200 dark:hover:border-zinc-700 transition shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded-md">
                          {service.category}
                        </span>
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-50 text-base mt-1.5 leading-tight">
                          {service.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-xs font-bold leading-none shrink-0">
                        <Star className="fill-amber-500 stroke-amber-500 shrink-0" size={13} />
                        <span>{service.rating.toFixed(1)}</span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2.5 font-light leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                      <Users size={11} className="text-zinc-400" />
                      Recomendado por: <strong className="text-zinc-600 dark:text-zinc-300 font-semibold">{service.recommendedBy}</strong>
                    </span>

                    <a
                      href={`tel:${service.phone}`}
                      className="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition text-nowrap cursor-pointer"
                    >
                      <Phone size={11} className="fill-emerald-800 dark:fill-emerald-300 stroke-none" />
                      Llamar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Suggest Trusted Provider Form */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm self-start">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Sparkles size={18} className="text-indigo-600" />
              Sugerir Proveedor
            </h3>
          </div>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            ¿Hicieron un excelente trabajo instalando persianas o solucionando una fuga? Registra sus datos para que tus compañeros puedan llamarlo.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Nombre de la Persona / Empresa *
              </label>
              <input
                id="service-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Juan Cortinas Royales"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Especialidad / Rubro *
              </label>
              <select
                id="service-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-semibold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="Instalación de Rollers">Instalación de Rollers</option>
                <option value="Electricista">Electricista</option>
                <option value="Gasfitero / Plomero">Gasfitero / Plomero</option>
                <option value="Limpieza">Limpieza</option>
                <option value="Otros">Otros</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Teléfono de Contacto (Celular) *
              </label>
              <input
                id="service-phone-input"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. +51 999 888 777"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Calificación (Estrellas)
              </label>
              <div className="flex gap-1.5 items-center bg-zinc-50 dark:bg-zinc-800 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-0.5 cursor-pointer"
                  >
                    <Star
                      className={`${
                        star <= rating
                          ? 'fill-amber-500 stroke-amber-500'
                          : 'fill-none stroke-zinc-300 dark:stroke-zinc-650'
                      }`}
                      size={18}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-2">
                  {rating || 5}.0 Estrellas
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                ¿Quién lo recomienda? (Tu nombre)
              </label>
              <input
                id="service-recommender-input"
                type="text"
                value={recommendedBy}
                onChange={(e) => setRecommendedBy(e.target.value)}
                placeholder="Ej. Esteban Dpto 42"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Reseña / Por qué es de confianza *
              </label>
              <textarea
                id="service-desc-input"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Súper puntual. Desarmó, desinfectó e instaló las persianas nuevas en solo 20 min. Cobra 50 soles por roller."
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-light focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            <button
              id="submit-service-button"
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition duration-200 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
            >
              <Plus size={14} /> Registrar en Directorio
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
interface RefreshCwProps {
  className?: string;
  size?: number | string;
}
function RefreshCw({ className, size = 16 }: RefreshCwProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
