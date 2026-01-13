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

// 2. Descarga directa (Funciona en PC y la mayoría de móviles)
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

// 3. BACKUP EMAIL SEGURO (Método Texto en Cuerpo - ANTI CRASH)
export const sendBackupViaEmail = (entries: CalculatedEntry[]) => {
  const csvContent = generateCSV(entries);
  const subject = encodeURIComponent(`Backup FuelMaster - ${new Date().toLocaleDateString('es-ES')}`);
  const body = encodeURIComponent(`Aquí tienes tus datos de FuelMaster Pro.\n\nCopia el texto de abajo y guárdalo en un archivo .csv:\n\n${csvContent}`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

// 4. SHARE NATIVO (Solo para móviles nuevos)
export const shareCSV = async (entries: CalculatedEntry[]) => {
  const csvContent = generateCSV(entries);
  const fileName = `FuelMaster_Backup_${new Date().toISOString().split('T')[0]}.csv`;
  const file = new File([csvContent], fileName, { type: 'text/csv' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'FuelMaster Backup CSV',
        files: [file]
      });
    } catch (err) {
      console.log('Share cancelado');
    }
  } else {
    downloadCSV(entries, fileName);
  }
};