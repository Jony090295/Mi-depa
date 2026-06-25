export interface Roommate {
  id: string;
  name: string;
  income: number;
  color: string;
  userId?: string;
}

export interface Apartment {
  name: string;
  rentCost: number;
  roommates: Roommate[];
}

export type ExpenseCategory = 'alquiler' | 'membresia' | 'auto' | 'servicio' | 'comida' | 'limpieza' | 'otros';

export type SplitType = 'porcentaje' | 'proporcional' | 'equitativo'; // % custom, proporcional a ingresos, 50-50

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: string; // Roommate ID who fronted the money
  date: string;
  splitType: SplitType;
  splits: Record<string, number>; // Roommate ID -> Target share (percent or weight)
  calculatedShares: Record<string, number>; // Roommate ID -> Sols/Amount they need to pay
  currency?: 'PEN' | 'USD';
  exchangeRate?: number;
  recurrentBillId?: string;
  recurrentBillMonth?: string;
  receiptImage?: string; // base64 encoded image
}

export interface SettlementRecord {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  currency: 'PEN' | 'USD';
  exchangeRate?: number;
  date: string; // ISO date
  note?: string;
}

export interface VariableReminder {
  id: string;
  name: string;
  amount?: number;
  currency?: 'PEN' | 'USD';
  frequencyDays: number; // 7 = weekly, 14 = biweekly, 30 = monthly
  lastDone?: string; // ISO date
  notes?: string;
}

export interface RecurrentBill {
  id: string;
  name: string; // luz, agua, telefono, internet, alquiler, etc.
  amount: number;
  dueDate: string; // e.g., "15" or a specific date string
  status: 'pagado' | 'por pagar';
  alertSent: boolean;
  notes?: string;
  paidBy?: string; // Roommate ID
  splitType?: SplitType | 'no_dividir';
  splits?: Record<string, number>; // Custom percentages set in registration
  associatedExpenseId?: string; // Auto-created Expense ID linked to this bill
  currency?: 'PEN' | 'USD';
  exchangeRate?: number;
  category?: ExpenseCategory;
  isAutoDebit?: boolean;
  createdAt?: string; // "YYYY-MM" when this template was created/activated
  deletedAt?: string; // "YYYY-MM" when this template was soft-deleted/deactivated
}

export interface RecurrentBillHistory {
  id: string;
  billId: string;
  name: string;
  amount: number;
  dueDate: string;
  notes?: string;
  paidBy: string;
  splitType: SplitType | 'no_dividir';
  splits?: Record<string, number>;
  currency?: 'PEN' | 'USD';
  exchangeRate?: number;
  monthPaidFor: string;
  datePaid: string;
  status?: 'pagado' | 'por pagar' | 'descartado';
  category?: ExpenseCategory;
  isAutoDebit?: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  addedBy: string;
}

export interface TrustedService {
  id: string;
  name: string;
  category: string; // e.g. "Instalación de rollers", "Electricista", "Plomero"
  description: string;
  phone: string;
  rating: number; // 1-5
  recommendedBy?: string;
  userId?: string;
}

export interface ForumReply {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface ForumPost {
  id: string;
  author: string;
  title: string;
  content: string;
  type: 'tip' | 'pregunta' | 'alerta';
  createdAt: string;
  replies: ForumReply[];
  userId?: string;
}
