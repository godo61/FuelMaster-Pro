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

// --- LÓGICA PORTADA DE MASTER PALEO ---
export const shareCSV = async (entries: CalculatedEntry[]) => { 
    const csvContent = generateCSV(entries);
    // 1. Creamos el archivo FÍSICO en memoria (Igual que Master Paleo)
    const file = new File([csvContent], "fuelmaster_backup.csv", { type: "text/csv" });
    
    // 2. Verificamos si el navegador soporta compartir ARCHIVOS
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { 
          // 3. CLAVE DEL ÉXITO: Solo enviamos 'title' y 'files'.
          // AL NO ENVIAR 'text', Android no intenta procesar el cuerpo del mensaje
          // y simplemente adjunta el archivo al correo.
          await navigator.share({ title: 'FuelMaster Backup', files: [file] }); 
      } catch (err) {
          console.log("Share cancelado por el usuario");
      }
    } else { 
        // Fallback: Si no soporta compartir, descargamos
        downloadCSV(entries, "fuelmaster_backup.csv"); 
        alert("Tu dispositivo no soporta compartir archivos directamente. Se ha descargado el CSV."); 
    }
};
