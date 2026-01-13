import { CalculatedEntry } from '../types';

// Genera el texto CSV
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

// Descarga directa (para PC o Fallback)
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

// --- FUNCIÓN RECUPERADA DE MASTER PALEO ---
// Esta es la que funciona en tu móvil viejo
export const shareCSV = async (entries: CalculatedEntry[]) => {
  const csvContent = generateCSV(entries);
  const fileName = `FuelMaster_Backup_${new Date().toISOString().split('T')[0]}.csv`;
  
  // El truco: Usar constructor File y tipo text/csv
  const file = new File([csvContent], fileName, { type: 'text/csv' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      // El truco 2: Solo enviar 'files' y 'title', nada de 'text'
      await navigator.share({
        title: 'FuelMaster Backup CSV',
        files: [file]
      });
    } catch (err) {
      console.log('Share cancelado o fallido');
    }
  } else {
    // Si no es compatible, descargamos
    alert("Tu dispositivo no soporta compartir archivos directos. Iniciando descarga...");
    downloadCSV(entries, fileName);
  }
};
