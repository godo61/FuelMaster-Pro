import { CalculatedEntry } from '../types';

// Generador de texto CSV (Igual que antes)
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

// Descarga directa (Fallback)
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

// --- LA LÓGICA DE MASTER PALEO ---
export const shareCSV = async (entries: CalculatedEntry[]) => {
  const csvContent = generateCSV(entries);
  const fileName = "fuelmaster_backup.csv"; // Nombre fijo como en Master Paleo
  
  // 1. Tipo exacto que funciona en tu móvil
  const file = new File([csvContent], fileName, { type: "text/csv" });

  // 2. Validación y envío
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      // 3. SOLO Title y Files. Sin 'text' para que Gmail no se confunda.
      await navigator.share({ 
        title: 'FuelMaster Backup', 
        files: [file] 
      });
    } catch (err) {
      console.log('Share cancelado o error');
    }
  } else {
    // Si falla, descargamos
    downloadCSV(entries, fileName);
    alert("Tu dispositivo no soporta compartir archivos directos. Se ha descargado el archivo.");
  }
};
