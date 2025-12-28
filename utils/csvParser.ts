
import { FuelEntry } from '../types';

/**
 * Limpia números del formato específico de Google Sheets (Europeo):
 * "1.368,00" -> 1368
 * "36,29" -> 36.29
 * "1,18 €" -> 1.18
 */
export const cleanToyotaNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  let s = String(val).trim();
  
  // 1. Quitar comillas, moneda, unidades y espacios
  s = s.replace(/["€$£kmlL\s]/g, '');
  if (!s) return 0;

  // 2. Formato Europeo: 1.234,56
  // El punto es separador de miles, la coma es decimal.
  // Primero quitamos el punto de miles.
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, ''); // Quitar miles
    s = s.replace(',', '.');  // Cambiar decimal
  } 
  // Si solo hay coma, es decimal (ej: 36,29)
  else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  // Si hay puntos pero NO comas, y parece un número grande (ej: 112.035)
  // lo tratamos como miles si tiene 3 decimales exactos al final.
  else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      s = s.replace(/\./g, '');
    }
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const isDateLike = (s: string): boolean => {
  if (!s) return false;
  const clean = s.split(' ')[0];
  const parts = clean.split(/[\/\-\.]/);
  return parts.length === 3 && parts.every(p => !isNaN(Number(p)));
};

export const parseFuelCSV = (csvText: string): FuelEntry[] => {
  const cleanCSV = csvText.replace(/^\uFEFF/, '').trim();
  const lines = cleanCSV.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  // Localizar cabecera real
  let headerRowIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('FECHA')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) throw new Error("No se encontró la cabecera 'FECHA'.");

  const separator = ','; // Tu nuevo CSV usa coma
  const rawHeaders = lines[headerRowIdx].split(separator).map(h => 
    h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
  );

  const findCol = (aliases: string[]) => rawHeaders.findIndex(h => aliases.some(a => h === a || h.includes(a)));

  const idx = {
    date: findCol(['fecha']),
    kmIni: findCol(['kminicial']),
    kmFin: findCol(['kmfinal']),
    liters: findCol(['litros']),
    cost: findCol(['gasto']),
    price: findCol(['pvp', 'precio']),
    dist: findCol(['kilometros', 'distancia'])
  };

  const entries: FuelEntry[] = [];
  for (let i = headerRowIdx + 1; i < lines.length; i++) {
    // Regex para manejar valores entre comillas que contienen comas (formato Google Sheets)
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    const parts = lines[i].split(regex).map(p => p.trim());
    
    if (!parts[idx.date] || !isDateLike(parts[idx.date])) continue;

    const kmInicial = cleanToyotaNum(parts[idx.kmIni]);
    const kmFinal = cleanToyotaNum(parts[idx.kmFin]);
    const fuelAmount = cleanToyotaNum(parts[idx.liters]);
    const cost = cleanToyotaNum(parts[idx.cost]);
    const distance = idx.dist !== -1 ? cleanToyotaNum(parts[idx.dist]) : (kmFinal - kmInicial);

    if (kmFinal === 0 && fuelAmount === 0) continue;

    entries.push({
      id: `toyota-${i}-${Date.now()}`,
      date: parts[idx.date],
      kmInicial, 
      kmFinal,
      distancia: distance,
      fuelAmount,
      pricePerLiter: cleanToyotaNum(parts[idx.price]) || (fuelAmount > 0 ? cost / fuelAmount : 0),
      cost: cost,
      consumption: 0,
      kmPerLiter: 0
    });
  }

  return entries;
};
