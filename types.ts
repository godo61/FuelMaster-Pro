export interface FuelEntry {
  id: string;
  date: string;
  kmInicial: number;
  kmFinal: number;
  distancia: number;
  fuelAmount: number;
  pricePerLiter: number;
  cost: number;
  consumption: number;
  kmPerLiter: number;
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

export type VehicleCategory = 
  | 'turismo' 
  | 'motocicleta' 
  | 'ciclomotor' 
  | 'furgoneta' 
  | 'pesado' 
  | 'autobus' 
  | 'caravana' 
  | 'historico';

export interface VehicleProfile {
  registrationDate: string;
  lastItvDate?: string;
  category: VehicleCategory;
  brand?: string;
  model?: string;
  lastServiceKm?: number; // Kilometraje del último mantenimiento
  lastServiceDate?: string; // Fecha del último mantenimiento
}