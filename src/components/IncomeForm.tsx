import React, { useState } from 'react';
import { Roommate } from '../types';
import { DollarSign, Home, Users, Plus, Trash2, Check } from 'lucide-react';

interface IncomeFormProps {
  apartmentName: string;
  rentCost: number;
  maintenanceCost: number;
  rentCurrency?: 'PEN' | 'USD';
  rentExchangeRate?: number;
  roommates: Roommate[];
  onUpdateApartment: (name: string, rent: number, currency: 'PEN' | 'USD', exchangeRate: number, maintenance: number) => void;
  onUpdateRoommates: (roommates: Roommate[]) => void;
}

export default function IncomeForm({
  apartmentName,
  rentCost,
  maintenanceCost,
  rentCurrency: rentCurrencyProp = 'PEN',
  rentExchangeRate: rentExchangeRateProp = 3.80,
  roommates,
  onUpdateApartment,
  onUpdateRoommates,
}: IncomeFormProps) {
  const [nameInput, setNameInput] = useState(apartmentName);
  const [rentInput, setRentInput] = useState(rentCost);
  const [maintenanceInput, setMaintenanceInput] = useState(maintenanceCost);
  const [rentCurrency, setRentCurrency] = useState<'PEN' | 'USD'>(rentCurrencyProp);
  const [exchangeRateInput, setExchangeRateInput] = useState<number>(rentExchangeRateProp);
  const [successMsg, setSuccessMsg] = useState('');

  // Editable states for roommates
  const [localRoommates, setLocalRoommates] = useState<Roommate[]>([...roommates]);
  const [newRoommateName, setNewRoommateName] = useState('');
  const [newRoommateIncome, setNewRoommateIncome] = useState<number | ''>('');

  const handleSaveApartment = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateApartment(
      nameInput,
      Number(rentInput) || 0,
      rentCurrency,
      Number(exchangeRateInput) || 3.80,
      Number(maintenanceInput) || 0
    );
    triggerSuccess('¡Datos del departamento actualizados!');
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleUpdateIncome = (id: string, value: number) => {
    const updated = localRoommates.map((r) =>
      r.id === id ? { ...r, income: value } : r
    );
    setLocalRoommates(updated);
    onUpdateRoommates(updated);
  };

  const handleAddRoommate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoommateName.trim()) return;

    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];
    const randomColor = colors[localRoommates.length % colors.length];

    const newR: Roommate = {
      id: crypto.randomUUID(),
      name: newRoommateName.trim(),
      income: Number(newRoommateIncome) || 0,
      color: randomColor,
    };

    const updated = [...localRoommates, newR];
    setLocalRoommates(updated);
    onUpdateRoommates(updated);
    setNewRoommateName('');
    setNewRoommateIncome('');
    triggerSuccess(`¡Roommate ${newR.name} agregado!`);
  };

  const handleRemoveRoommate = (id: string) => {
    if (localRoommates.length <= 1) {
      alert("Debe haber al menos un roommate registrado.");
      return;
    }
    const updated = localRoommates.filter((r) => r.id !== id);
    setLocalRoommates(updated);
    onUpdateRoommates(updated);
    triggerSuccess('Roommate removido.');
  };

  const totalIncome = localRoommates.reduce((sum, r) => sum + r.income, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Notifications */}
      {successMsg && (
        <div id="success-banner" className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Apartment Details Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <Home className="text-indigo-600" size={22} />
            Datos del Departamento
          </h2>
          <form onSubmit={handleSaveApartment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Nombre de tu Depa
              </label>
              <input
                id="apartment-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Ej. Depa 402 Miraflores"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-base"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Moneda Alquiler
                </label>
                <div className="grid grid-cols-2 gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setRentCurrency('PEN');
                    }}
                    className={`py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition ${
                      rentCurrency === 'PEN'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    PEN (S/.)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRentCurrency('USD');
                    }}
                    className={`py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition ${
                      rentCurrency === 'USD'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Costo de Alquiler ({rentCurrency === 'USD' ? '$' : 'S/.'})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-semibold text-sm">
                    {rentCurrency === 'USD' ? '$' : 'S/.'}
                  </span>
                  <input
                    id="apartment-rent-input"
                    type="number"
                    value={rentInput}
                    onChange={(e) => setRentInput(Number(e.target.value))}
                    placeholder="Ej. 2800"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-base"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Costo de Mantenimiento (S/.)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-semibold text-sm">
                    S/.
                  </span>
                  <input
                    id="apartment-maintenance-input"
                    type="number"
                    value={maintenanceInput}
                    onChange={(e) => setMaintenanceInput(Number(e.target.value))}
                    placeholder="Ej. 350"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-base"
                  />
                </div>
              </div>

              {rentCurrency === 'USD' ? (
                <div>
                  <label className="block text-xs font-medium text-indigo-500 dark:text-indigo-405 mb-1">
                    Tipo de Cambio para Alquiler (T/C)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-semibold text-sm">
                      S/.
                    </span>
                    <input
                      id="rent-exchange-rate-input"
                      type="number"
                      step="0.001"
                      value={exchangeRateInput}
                      onChange={(e) => setExchangeRateInput(Number(e.target.value))}
                      placeholder="Ej. 3.80"
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-base"
                    />
                  </div>
                </div>
              ) : (
                <div className="hidden sm:block opacity-0 pointer-events-none" />
              )}
            </div>

            <button
              id="save-apartment-button"
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition duration-200 shadow-sm shadow-indigo-600/10 cursor-pointer text-sm"
            >
              Guardar Configuración de Depa
            </button>
          </form>
        </div>

        {/* Roommates Roster Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <Users className="text-indigo-600" size={22} />
              Registro de Roommates e Ingresos
            </h2>

            {/* List existing */}
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-1">
              {localRoommates.map((roommate) => {
                const percentageOfTotal = totalIncome > 0 ? (roommate.income / totalIncome) * 100 : 0;
                return (
                  <div
                    key={roommate.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: roommate.color }}
                      />
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block text-sm">
                          {roommate.name}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          Equivale al {percentageOfTotal.toFixed(1)}% del depa
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-semibold">
                          S/.
                        </span>
                        <input
                          type="number"
                          value={roommate.income}
                          onChange={(e) => handleUpdateIncome(roommate.id, Number(e.target.value))}
                          placeholder="Ingreso"
                          className="w-28 pl-7 pr-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-base font-mono font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveRoommate(roommate.id)}
                        className="min-w-[36px] min-h-[36px] p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-150 dark:hover:bg-zinc-800 transition flex items-center justify-center"
                        title="Remover roommate"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Roommate Section */}
          <form onSubmit={handleAddRoommate} className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Agregar Roommate</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="add-roommate-name-input"
                type="text"
                value={newRoommateName}
                onChange={(e) => setNewRoommateName(e.target.value)}
                placeholder="Nombre"
                className="px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">
                  S/.
                </span>
                <input
                  id="add-roommate-income-input"
                  type="number"
                  value={newRoommateIncome}
                  onChange={(e) => setNewRoommateIncome(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ingreso mensual"
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <button
              id="submit-roommate-button"
              type="submit"
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-950 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-medium rounded-lg text-xs transition duration-200 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Registrar Roommate
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
