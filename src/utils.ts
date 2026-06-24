import { Expense, Roommate, RecurrentBill, RecurrentBillHistory, ShoppingItem, ForumPost, SettlementRecord } from "./types";

export const CATEGORY_LABELS: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  alquiler: { label: "Alquiler", icon: "Home", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400" },
  membresia: { label: "Membresías", icon: "Tv", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400" },
  auto: { label: "Auto / Cochera", icon: "Car", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  servicio: { label: "Servicios Básicos", icon: "Droplet", bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-600 dark:text-cyan-400" },
  comida: { label: "Comida & Víveres", icon: "ShoppingCart", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  limpieza: { label: "Limpieza", icon: "Sparkles", bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-600 dark:text-pink-400" },
  otros: { label: "Otros", icon: "HelpCircle", bg: "bg-slate-50 dark:bg-slate-950/40", text: "text-slate-600 dark:text-slate-400" }
};

export function inferCategoryFromName(name: string): import('./types').ExpenseCategory {
  const l = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/alquiler|renta|arriendo|departamento|cochera|estacionamiento|cclp|depa\b/.test(l)) return 'alquiler';
  if (/luz|enel|agua|sedapal|gas|calidda|internet|wifi|cable|telefon|celular|claro|movistar|entel|bitel|mantenimiento|mante|cuota\s*mante|porteria|conserje|arbitrios/.test(l)) return 'servicio';
  if (/spotify|netflix|disney|hbo|prime|apple|youtube|gym|gimnasio|suscripcion|membresia|membership|crunchyroll|deezer|canva/.test(l)) return 'membresia';
  if (/gasolina|grifo|gasolinera|uber|taxi|peaje|repsol|pecsa|primax|estacion|revision tecnica|soat|seguro\s*auto/.test(l)) return 'auto';
  if (/mercado|supermercado|super|wong|tottus|metro|plaza.?vea|vivanda|delivery|rappi|pedidos|comida|almuerzo|cena|desayuno|restaurante|pollo|pizza|sushi|lunch/.test(l)) return 'comida';
  if (/limpieza|detergente|escoba|trapeador|desinfectante|lejia|jabon|esponja|bolsa.?basura|katia|servicio.?limp/.test(l)) return 'limpieza';
  return 'otros';
}

export const INITIAL_ROOMMATES: Roommate[] = [
  { id: "r1", name: "Carlos", income: 3500, color: "#6366f1" }, // Indigo
  { id: "r2", name: "Sofía", income: 5200, color: "#ec4899" },  // Pink
  { id: "r3", name: "Mateo", income: 4100, color: "#10b981" }   // Emerald
];

export const INITIAL_BILLS: RecurrentBill[] = [
  { id: "b1", name: "Alquiler de departamento", amount: 2800, dueDate: "05 de cada mes", status: "pagado", alertSent: false, notes: "A transferirse directo a la cuenta del propietario.", splitType: "no_dividir", category: "alquiler", isAutoDebit: false },
  { id: "b2", name: "Luz Enel", amount: 165, dueDate: "12 de cada mes", status: "por pagar", alertSent: false, notes: "Suele vencer a mitad de mes. Revisar correo del dpto.", splitType: "equitativo", paidBy: "r1", category: "servicio", isAutoDebit: false },
  { id: "b3", name: "Servicio de Agua Sedapal", amount: 92, dueDate: "18 de cada mes", status: "pagado", alertSent: false, notes: "Llega bimensual en promedio.", splitType: "equitativo", paidBy: "r3", category: "servicio", isAutoDebit: false },
  { id: "b5", name: "Internet Fibra Claro 200MB", amount: 120, dueDate: "25 de cada mes", status: "por pagar", alertSent: false, splitType: "proporcional", paidBy: "r1", category: "servicio", isAutoDebit: true },
  { id: "b6", name: "Membresía Netflix Familiar", amount: 45, dueDate: "02 de cada mes", status: "pagado", alertSent: false, notes: "Tarjeta de Sofía afiliada.", splitType: "porcentaje", paidBy: "r2", splits: { r1: 20, r2: 40, r3: 40 }, category: "membresia", isAutoDebit: true }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: "e1",
    title: "Alquiler mensual dpto.",
    amount: 2800,
    category: "alquiler",
    paidBy: "r2", // Pagado por Sofía
    date: "2026-06-01",
    splitType: "proporcional", // Proporcional a ingresos
    splits: { r1: 1, r2: 1, r3: 1 },
    calculatedShares: {
      r1: 763.64, // 3500 / 12800 * 2800
      r2: 1134.54, // 5200 / 12800 * 2800
      r3: 895.45,  // 4100 / 12800 * 2800
    }
  },
  {
    id: "e2",
    title: "Mercado Wong compras quincena",
    amount: 420,
    category: "comida",
    paidBy: "r3", // Mateo
    date: "2026-06-02",
    splitType: "equitativo", // 50-50 / 33-33-33
    splits: { r1: 33.33, r2: 33.33, r3: 33.33 },
    calculatedShares: { r1: 140, r2: 140, r3: 140 }
  },
  {
    id: "e3",
    title: "Detergente, esponjas y rollos de papel",
    amount: 85,
    category: "limpieza",
    paidBy: "r1", // Carlos
    date: "2026-06-03",
    splitType: "porcentaje",
    splits: { r1: 20, r2: 40, r3: 40 },
    calculatedShares: { r1: 17, r2: 34, r3: 34 }
  }
];

export const INITIAL_SHOPPING_ITEMS: ShoppingItem[] = [
  { id: "sh1", name: "Leche descremada deslactosada", quantity: "2 cajas", checked: false, addedBy: "Sofía" },
  { id: "sh2", name: "Bolsas de basura grandes (negras)", quantity: "1 paquete", checked: true, addedBy: "Carlos" },
  { id: "sh3", name: "Plátanos de seda", quantity: "1 mano", checked: false, addedBy: "Mateo" },
  { id: "sh4", name: "Palta fuerte", quantity: "4 unidades", checked: false, addedBy: "Carlos" }
];

export const INITIAL_FORUM_POSTS: ForumPost[] = [
  {
    id: "fp2",
    author: "Mateo",
    title: "¿Dónde compraron las repisas flotantes del pasillo?",
    content: "Quiero instalar unas repisas similares en mi habitación para organizar mis libros. ¿Fueron hechas a medida o de Sodimac?",
    type: "pregunta",
    createdAt: "2026-06-02T10:00:00Z",
    replies: [
      { id: "fr3", author: "Carlos", content: "Las compramos en Sodimac del Ovalo Gutiérrez, son las de marca Keter. Son fáciles de empotrar. Juan Rollers (el instalador del directorio) las instaló en 15 minutos.", createdAt: "2026-06-02T11:20:00Z" }
    ]
  },
  {
    id: "fp3",
    author: "Carlos",
    title: "Tip de Ahorro: Mercado Mayorista Surco",
    content: "Dato para ahorrar: si compramos las verduras y papelera en el mercado de Surco en vez del super, gastaremos exactamente la mitad de presupuesto mensual. El fin de semana puedo manejar yo si nos organizamos.",
    type: "tip",
    createdAt: "2026-06-03T09:12:00Z",
    replies: []
  }
];

export interface Settlement {
  from: string; // Roommate who owes
  to: string;   // Roommate who is owed
  amount: number;
  currency: 'PEN' | 'USD';
  exchangeRate?: number;
}

/**
 * Calculates who owes whom how much based on expenses paid vs. target shares
 * calculated separately for PEN and USD currencies.
 */
export function calculateSettlementsForCurrency(
  expenses: Expense[],
  roommates: Roommate[],
  curr: 'PEN' | 'USD',
  settlementHistory: SettlementRecord[] = []
): Settlement[] {
  // Map roommateId -> NetBalance (positive means they paid more than they owe, negative means they owe more than they paid)
  const balances: Record<string, number> = {};
  
  // Initialize balances with 0
  roommates.forEach(r => {
    balances[r.id] = 0;
  });

  // Calculate net balances for the specified currency
  expenses.forEach(expense => {
    const expenseCurrency = expense.currency || 'PEN';
    if (expenseCurrency !== curr) return;

    const paidBy = expense.paidBy;
    const amount = expense.amount;
    
    // The person who paid gets credit
    if (balances[paidBy] !== undefined) {
      balances[paidBy] += amount;
    }

    // Every roommate gets charged their calculated share
    const shares = expense.calculatedShares || {};
    Object.entries(shares).forEach(([roommateId, shareAmount]) => {
      if (balances[roommateId] !== undefined) {
        balances[roommateId] -= shareAmount;
      }
    });
  });

  // Apply settlement history: fromId paid toId, so fromId's debt shrinks
  settlementHistory
    .filter(s => s.currency === curr)
    .forEach(s => {
      if (balances[s.fromId] !== undefined) balances[s.fromId] += s.amount;
      if (balances[s.toId]   !== undefined) balances[s.toId]   -= s.amount;
    });

  // Separate people who are owed (creditors) and who owe (debtors)
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  Object.entries(balances).forEach(([id, balance]) => {
    // Round to 2 decimals to prevent floating point issues
    const roundedBalance = Math.round(balance * 100) / 100;
    if (roundedBalance > 0.01) {
      creditors.push({ id, amount: roundedBalance });
    } else if (roundedBalance < -0.01) {
      debtors.push({ id, amount: Math.abs(roundedBalance) });
    }
  });

  // Sort by amount descending to greedily settle balances
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    const settleAmount = Math.min(creditor.amount, debtor.amount);
    
    if (settleAmount > 0.01) {
      // Find a representative exchange rate for reference
      let representativeRate = 3.80;
      const usdExpenses = expenses.filter(e => e.currency === 'USD');
      if (usdExpenses.length > 0) {
        representativeRate = usdExpenses[usdExpenses.length - 1].exchangeRate || 3.80;
      }

      settlements.push({
        from: debtor.id,
        to: creditor.id,
        amount: Math.round(settleAmount * 100) / 100,
        currency: curr,
        exchangeRate: representativeRate
      });
    }

    creditor.amount -= settleAmount;
    debtor.amount -= settleAmount;

    if (creditor.amount <= 0.01) creditorIndex++;
    if (debtor.amount <= 0.01) debtorIndex++;
  }

  return settlements;
}

export function calculateSettlements(
  expenses: Expense[],
  roommates: Roommate[],
  settlementHistory: SettlementRecord[] = []
): Settlement[] {
  const penSettlements = calculateSettlementsForCurrency(expenses, roommates, 'PEN', settlementHistory);
  const usdSettlements = calculateSettlementsForCurrency(expenses, roommates, 'USD', settlementHistory);
  return [...penSettlements, ...usdSettlements];
}

export const INITIAL_BILL_HISTORY: RecurrentBillHistory[] = [
  {
    id: "h1",
    billId: "b1",
    name: "Alquiler de departamento",
    amount: 2800,
    dueDate: "05 de cada mes",
    notes: "Pagado por transferencia.",
    paidBy: "r1",
    splitType: "no_dividir",
    monthPaidFor: "Mayo 2026",
    datePaid: "2026-05-05",
    currency: "PEN",
    category: "alquiler",
    isAutoDebit: false
  },
  {
    id: "h2",
    billId: "b2",
    name: "Luz Enel",
    amount: 158.40,
    dueDate: "12 de cada mes",
    notes: "Consumo de otoño.",
    paidBy: "r1",
    splitType: "equitativo",
    monthPaidFor: "Mayo 2026",
    datePaid: "2026-05-11",
    currency: "PEN",
    category: "servicio",
    isAutoDebit: false
  },
  {
    id: "h3",
    billId: "b3",
    name: "Servicio de Agua Sedapal",
    amount: 94.50,
    dueDate: "18 de cada mes",
    paidBy: "r3",
    splitType: "equitativo",
    monthPaidFor: "Mayo 2026",
    datePaid: "2026-05-17",
    currency: "PEN",
    category: "servicio",
    isAutoDebit: false
  },
  {
    id: "h4",
    billId: "b5",
    name: "Internet Fibra Claro 200MB",
    amount: 120,
    dueDate: "25 de cada mes",
    paidBy: "r1",
    splitType: "proporcional",
    monthPaidFor: "Mayo 2026",
    datePaid: "2026-05-24",
    currency: "PEN",
    category: "servicio",
    isAutoDebit: true
  },
  {
    id: "h5",
    billId: "b6",
    name: "Membresía Netflix Familiar",
    amount: 45,
    dueDate: "02 de cada mes",
    notes: "Débito automático.",
    paidBy: "r2",
    splitType: "porcentaje",
    splits: { r1: 20, r2: 40, r3: 40 },
    monthPaidFor: "Mayo 2026",
    datePaid: "2026-05-02",
    currency: "PEN",
    category: "membresia",
    isAutoDebit: true
  },
  {
    id: "h6",
    billId: "b1",
    name: "Alquiler de departamento",
    amount: 2800,
    dueDate: "05 de cada mes",
    paidBy: "r1",
    splitType: "no_dividir",
    monthPaidFor: "Abril 2026",
    datePaid: "2026-04-05",
    currency: "PEN"
  },
  {
    id: "h7",
    billId: "b2",
    name: "Luz Enel",
    amount: 162.10,
    dueDate: "12 de cada mes",
    paidBy: "r1",
    splitType: "equitativo",
    monthPaidFor: "Abril 2026",
    datePaid: "2026-04-12",
    currency: "PEN"
  },
  {
    id: "h8",
    billId: "b3",
    name: "Servicio de Agua Sedapal",
    amount: 90.20,
    dueDate: "18 de cada mes",
    paidBy: "r3",
    splitType: "equitativo",
    monthPaidFor: "Abril 2026",
    datePaid: "2026-04-16",
    currency: "PEN"
  }
];
