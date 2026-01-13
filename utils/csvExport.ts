import { CalculatedEntry } from '../types';

// 1. Generar el texto CSV
export const generateCSV = (entries: CalculatedEntry[]): string => {
  const headers = ['Fecha', 'Km Inicial', 'Km Final', 'Distancia', 'Litros', 'Precio/L', 'Coste Total', 'Consumo (L/100km)', 'Km/L'];
  const rows = entries.map(e => [
    e.date,
    e.kmInicial,
    e.kmFinal,
    e.distancia,
    e.fuelAmount,
    e.pricePerLiter,
    e.cost,
    e.consumption,
    e.kmPerLiter
  ].join(','));
  
  return [headers.join(','), ...rows].join('\n');
};

// 2. Descarga directa
export const downloadCSV = (entries: CalculatedEntry[], filename: string) => {
  const csvContent = generateCSV(entries);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 3. SHARE MODIFICADO (Truco anti-crash)
export const shareCSV = async (entries: CalculatedEntry[]) => {
  const csvContent = generateCSV(entries);
  const fileName = "fuelmaster_backup.csv";
  
  // TRUCO: Usamos 'text/plain' en lugar de 'text/csv'.
  // Esto hace que Android trate el archivo de forma más ligera y evita crasheos en móviles viejos.
  // La extensión .csv se mantiene, así que Excel lo abrirá bien igual.
  const file = new File([csvContent], fileName, { type: 'text/plain' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      // Sin 'text' en el payload, igual que Master Paleo
      await navigator.share({
        title: 'FuelMaster Backup',
        files: [file]
      });
    } catch (err) {
      console.log('Share cancelado');
    }
  } else {
    downloadCSV(entries, fileName);
  }
};