import type { ElementType } from 'react';
import {
  Home, Zap, ShoppingCart, Droplet, CreditCard, Car, MoreHorizontal,
  Heart, Tag, Activity,
} from 'lucide-react';
import { inferCategoryFromName } from '../utils';

const CATEGORY_ICON_MAP: Record<string, ElementType> = {
  alquiler: Home, servicio: Zap, comida: ShoppingCart, limpieza: Droplet,
  membresia: CreditCard, auto: Car, otros: MoreHorizontal,
  salud: Heart, ropa: Tag, deporte: Activity,
};

/**
 * Ícono de una categoría. Las renombradas o creadas por el usuario no están en
 * el mapa; en vez de caer directo al genérico se infiere por el nombre, así
 * "mercado" conserva el carrito de "comida". inferCategoryFromName devuelve
 * 'otros' cuando no reconoce nada, que también está en el mapa.
 */
export function categoryIcon(cat: string): ElementType {
  return CATEGORY_ICON_MAP[cat] ?? CATEGORY_ICON_MAP[inferCategoryFromName(cat)] ?? MoreHorizontal;
}
