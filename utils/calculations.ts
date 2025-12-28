
import { FuelEntry, CalculatedEntry, SummaryStats } from '../types';

export const parseToDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split(/[\/\-\.]/).map(Number);
  // Manejar formato DD/MM/YYYY o YYYY-MM-DD
  if (parts[0] > 1000) return new Date(parts[0], parts[1] - 1, parts[2]);
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

export const getDaysRemaining = (targetDateStr: string): number => {
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const calculateEntries = (entries: FuelEntry[]): CalculatedEntry[] => {
  if (entries.length === 0) return [];
  
  const sorted = [...entries].sort((a, b) => {
    const dA = parseToDate(a.date).getTime();
    const dB = parseToDate(b.date).getTime();
    return dA !== dB ? dA - dB : a.kmFinal - b.kmFinal;
  });

  let cumulativeCost = 0;
  let cumulativeLiters = 0;

  return sorted.map((entry, index) => {
    const dist = entry.distancia || (index > 0 ? entry.kmFinal - sorted[index-1].kmFinal : entry.kmFinal - entry.kmInicial);
    const fuel = entry.fuelAmount;
    
    cumulativeCost += entry.cost;
    cumulativeLiters += fuel;

    return {
      ...entry,
      distancia: dist,
      consumption: (dist > 0 && fuel > 0) ? (fuel / dist) * 100 : 0,
      kmPerLiter: (fuel > 0 && dist > 0) ? dist / fuel : 0,
      cumulativeCost,
      cumulativeLiters,
      cumulativeDistance: entry.kmFinal - sorted[0].kmInicial
    };
  });
};

export const getSummaryStats = (entries: CalculatedEntry[]): SummaryStats => {
  if (entries.length === 0) return {
    totalDistance: 0, totalFuel: 0, totalCost: 0, avgConsumption: 0, 
    avgPricePerLiter: 0, avgCostPer100Km: 0, avgKmPerLiter: 0, lastOdometer: 0
  };

  const sorted = [...entries].sort((a, b) => a.kmFinal - b.kmFinal);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const totalDistance = last.kmFinal - first.kmInicial; 
  const totalFuel = sorted.reduce((acc, e) => acc + e.fuelAmount, 0);
  const totalCost = sorted.reduce((acc, e) => acc + e.cost, 0);
  
  // Media de los PVP registrados (como solicitó el usuario)
  const avgPvp = sorted.reduce((acc, e) => acc + e.pricePerLiter, 0) / sorted.length;

  return {
    totalDistance,
    totalFuel,
    totalCost,
    avgConsumption: totalDistance > 0 ? (totalFuel / totalDistance) * 100 : 0,
    avgKmPerLiter: totalFuel > 0 ? totalDistance / totalFuel : 0,
    avgPricePerLiter: avgPvp,
    avgCostPer100Km: totalDistance > 0 ? (totalCost / totalDistance) * 100 : 0,
    lastOdometer: last.kmFinal
  };
};
