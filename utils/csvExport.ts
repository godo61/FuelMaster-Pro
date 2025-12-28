
import { CalculatedEntry } from '../types';

export const generateCSV = (entries: CalculatedEntry[]): string => {
  const headers = [
    'Fecha', 'Km Inicial', 'Km Final', 'Distancia', 'Litros', 
    'Precio/Litro', 'Coste Total', 'Consumo L/100km', 'Km/Litro', 'Reserva'
  ];

  const rows = entries.map(e => [
    e.date,
    e.kmInicial,
    e.kmFinal,
    e.distancia,
    e.fuelAmount.toFixed(2).replace('.', ','),
    e.pricePerLiter.toFixed(3).replace('.', ','),
    e.cost.toFixed(2).replace('.', ','),
    e.consumption.toFixed(2).replace('.', ','),
    e.kmPerLiter.toFixed(2).replace('.', ','),
    e.kmReserva || ''
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  return csvContent;
};

export const downloadCSV = (entries: CalculatedEntry[], filename: string) => {
  const content = generateCSV(entries);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
