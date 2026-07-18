import type { ParsedShoppingItem } from '../types';

const UNIT_MAP: Record<string, string> = {
  kilo: 'kg', kilos: 'kg', kg: 'kg',
  gramo: 'g', gramos: 'g', gr: 'g', g: 'g',
  litro: 'L', litros: 'L', lt: 'L', l: 'L',
  ml: 'ml',
  unidad: 'u', unidades: 'u',
  paquete: 'paq', paquetes: 'paq', paq: 'paq',
  botella: 'bot', botellas: 'bot', bot: 'bot',
  docena: 'doc', docenas: 'doc',
  caja: 'caja', cajas: 'caja',
  bolsa: 'bolsa', bolsas: 'bolsa',
  rollo: 'rollo', rollos: 'rollo',
  tarro: 'tarro', tarros: 'tarro',
};

const UNIT_PAT = Object.keys(UNIT_MAP).join('|');
const SKIP_LINE = /^[-–—]+$|^\s*$/;
const BULLET_STRIP = /^[-•*·]\s*/;
const FILLER = /^(un|una|el|la|los|las|algo de|un poco de|unas|unos)\s+/i;

// "2 kg tomate" or "3 botellas de agua" or "2 lechugas"
const LEAD_QTY = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PAT})?\\s*(?:de\\s+)?`,
  'i'
);
// "tomate 1 kg" or "jabón 4"
const TRAIL_QTY = new RegExp(
  `\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PAT})\\s*$`,
  'i'
);
const TRAIL_NUM = /\s+(\d+(?:[.,]\d+)?)\s*$/;

function normalizeUnit(raw?: string): string | null {
  if (!raw) return null;
  return UNIT_MAP[raw.toLowerCase()] ?? raw.toLowerCase();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseLine(raw: string): ParsedShoppingItem | null {
  const line = raw.replace(BULLET_STRIP, '').trim();
  if (!line || SKIP_LINE.test(line)) return null;

  // Leading quantity: "2 kg tomate", "3 lechugas", "1 litro leche"
  const leadM = line.match(LEAD_QTY);
  if (leadM) {
    const qty = parseFloat(leadM[1].replace(',', '.'));
    const unitRaw = leadM[2];
    const rest = line.slice(leadM[0].length).replace(FILLER, '').trim();
    if (rest.length > 0) {
      const unit = unitRaw ? normalizeUnit(unitRaw) : 'u';
      return { name: cap(rest), quantity: qty, unit };
    }
  }

  // Trailing qty+unit: "tomate 1 kg"
  const trailM = line.match(TRAIL_QTY);
  if (trailM) {
    const name = line.slice(0, trailM.index!).replace(FILLER, '').trim();
    if (name.length > 0) {
      return {
        name: cap(name),
        quantity: parseFloat(trailM[1].replace(',', '.')),
        unit: normalizeUnit(trailM[2]),
      };
    }
  }

  // Trailing number only: "jabón 4"
  const numM = line.match(TRAIL_NUM);
  if (numM) {
    const name = line.slice(0, numM.index!).replace(FILLER, '').trim();
    if (name.length > 0) {
      return {
        name: cap(name),
        quantity: parseFloat(numM[1].replace(',', '.')),
        unit: null,
      };
    }
  }

  // Plain name
  const name = line.replace(FILLER, '').trim();
  return name ? { name: cap(name), quantity: null, unit: null } : null;
}

export function parseShoppingText(text: string): ParsedShoppingItem[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(parseLine)
    .filter((x): x is ParsedShoppingItem => x !== null);
}

export function fmtQty(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '';
  return unit ? `${quantity} ${unit}` : String(quantity);
}
