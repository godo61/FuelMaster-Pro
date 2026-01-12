import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { CalculatedEntry, SummaryStats, VehicleProfile } from '../types';
import { calculateNextITV } from './itvLogic';

interface MaintenanceData {
  nextKm: number;
  nextDate: Date;
  kmRemaining: number;
  daysRemaining: number;
  isUrgent: boolean;
}

// --- GENERADOR DEL DOCUMENTO (COMÚN) ---
const generatePDFDoc = (
  stats: SummaryStats, 
  entries: CalculatedEntry[], 
  profile: VehicleProfile | null, 
  maintenance: MaintenanceData | null
) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. HEADER
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FUELMASTER PRO', 15, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('ANALYTICS & MAINTENANCE REPORT', 15, 28);
  
  doc.setFontSize(9);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`Ref: ${Date.now().toString().slice(-6)}`, pageWidth - 15, 28, { align: 'right' });

  // 2. DATOS
  let nextItvString = 'No registrada';
  let nextServiceString = 'No configurado';

  if (profile) {
    const itvDate = calculateNextITV(profile.registrationDate, profile.category, profile.lastItvDate);
    if (itvDate) nextItvString = itvDate.toLocaleDateString('es-ES');
  }

  if (maintenance) {
    nextServiceString = `${maintenance.nextDate.toLocaleDateString('es-ES')} (${maintenance.kmRemaining.toLocaleString('es-ES')} km rest.)`;
  }

  // 3. RESUMEN
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Estado del Vehículo', 15, 60);
  
  const summaryData = [
    ['Consumo Medio:', `${stats.avgConsumption.toFixed(2)} L/100km`, 'Eficiencia:', `${stats.avgKmPerLiter.toFixed(2)} km/L`],
    ['Gasto Total:', `${stats.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 'Coste/100km:', `${stats.avgCostPer100Km.toFixed(2)} €`],
    ['Kilometraje:', `${stats.lastOdometer.toLocaleString('es-ES')} km`, 'Combustible:', `${stats.totalFuel.toLocaleString('es-ES')} L`],
    ['Próxima Revisión:', nextServiceString, 'Vencimiento ITV:', nextItvString]
  ];

  doc.autoTable({
    startY: 65,
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4, lineColor: [226, 232, 240], textColor: [51, 65, 85] },
    columnStyles: { 
        0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 40 },
        1: { cellWidth: 'auto' },
        2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 40 },
        3: { cellWidth: 'auto' }
    },
    didParseCell: function(data: any) {
        if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
            data.cell.styles.fontStyle = 'bold';
        }
    }
  });

  // 4. TABLA
  const tableData = entries.slice().reverse().map(e => [
    e.date,
    e.kmFinal.toLocaleString('es-ES'),
    `${e.distancia}`,
    `${e.fuelAmount.toFixed(2)} L`,
    `${e.pricePerLiter.toFixed(3)} €`,
    `${e.cost.toFixed(2)} €`,
    e.consumption.toFixed(2)
  ]);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Historial de Repostajes', 15, finalY);

  doc.autoTable({
    startY: finalY + 5,
    head: [['Fecha', 'Odómetro', 'Dist. (km)', 'Litros', 'PVP/L', 'Coste', 'L/100km']],
    body: tableData,
    headStyles: { 
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255], 
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
    },
    styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
    columnStyles: { 0: { halign: 'left' }, 5: { fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: function (data: any) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
        doc.text('Generado por FuelMaster Pro', 15, pageHeight - 10);
    }
  });

  return doc;
};

// --- FUNCIÓN 1: DESCARGAR ---
export const exportToPDF = (
  stats: SummaryStats, 
  entries: CalculatedEntry[], 
  profile: VehicleProfile | null, 
  maintenance: MaintenanceData | null
) => {
  const doc = generatePDFDoc(stats, entries, profile, maintenance);
  doc.save(`FuelMaster_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// --- FUNCIÓN 2: COMPARTIR (VERSIÓN ROBUSTA: SOLO ARCHIVO) ---
export const sharePDF = async (
  stats: SummaryStats, 
  entries: CalculatedEntry[], 
  profile: VehicleProfile | null, 
  maintenance: MaintenanceData | null
) => {
  const doc = generatePDFDoc(stats, entries, profile, maintenance);
  
  // Usamos 'blob' que es lo más estándar para móviles
  const blob = doc.output('blob');
  const fileName = `FuelMaster_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  const file = new File([blob], fileName, { type: 'application/pdf' });

  // Intentamos compartir SOLO EL ARCHIVO (sin texto ni título para no liar a WhatsApp/Gmail)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file]
      });
      return;
    } catch (err) {
      console.log('Error o cancelación al compartir:', err);
    }
  }

  // Si llegamos aquí es que falló o no es compatible -> DESCARGA AUTOMÁTICA
  alert("No se pudo abrir el menú de compartir. Descargando archivo...");
  doc.save(fileName);
};
