
export interface FuelEntry {
  id: string;
  date: string;
  kmInicial: number;
  kmFinal: number;
  distancia: number;
  fuelAmount: number; // Litros
  pricePerLiter: number;
  cost: number; // Gasto total del repostaje
  consumption: number; // L/100km
  kmPerLiter: number; // KM/Litro
  kmReserva?: string;
}

export interface CalculatedEntry extends FuelEntry {
  cumulativeCost: number;
  cumulativeLiters: number;
  cumulativeDistance: number;
}

export interface SummaryStats {
  totalDistance: number;
  totalFuel: number;
  totalCost: number;
  avgConsumption: number;
  avgPricePerLiter: number;
  avgCostPer100Km: number;
  avgKmPerLiter: number;
  lastOdometer: number;
}

export interface ServiceConfig {
  nextServiceKm: number;
  nextServiceDate: string;
}
