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

// --- GENERADOR DE TEXTO (MARKDOWN PARA WHATSAPP) ---
const generateMarkdownReport = (
  stats: SummaryStats, 
  profile: VehicleProfile | null, 
  maintenance: MaintenanceData | null
) => {
  const date = new Date().toLocaleDateString('es-ES');
  let itvTxt = "No configurada";
  if (profile) {
     const itvDate = calculateNextITV(profile.registrationDate, profile.category, profile.lastItvDate);
     if (itvDate) itvTxt = itvDate.toLocaleDateString('es-ES');
  }
  let mantTxt = "No configurado";
  if (maintenance) {
     mantTxt = `${maintenance.nextDate.toLocaleDateString('es-ES')} (o en ${maintenance.kmRemaining} km)`;
  }

  return `
🚗 *INFORME FUELMASTER PRO* 🚗
📅 Fecha: ${date}

📊 *ESTADÍSTICAS GLOBALES*
• Consumo Medio: *${stats.avgConsumption.toFixed(2)} L/100km*
• Gasto Total: *${stats.totalCost.toFixed(2)} €*
• Coste por 100km: *${stats.avgCostPer100Km.toFixed(2)} €*
• Km Totales: *${(stats.lastOdometer - stats.firstOdometer).toLocaleString()} km*

🔧 *MANTENIMIENTO*
• Próxima Revisión: *${mantTxt}*
• Próxima ITV: *${itvTxt}*

_Generado por FuelMaster Pro_
  `.trim();
};

// --- GENERADOR PDF INTERNO ---
const generatePDFDoc = (
  stats: SummaryStats, 
  entries: CalculatedEntry[], 
  profile: VehicleProfile | null, 
  maintenance: MaintenanceData | null
) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();

  // HEADER
  doc.setFillColor(16, 185, 129); // Emerald
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

  // DATOS
  let nextItvString = 'No registrada';
  let nextServiceString = 'No configurado';
  if (profile) {
    const itvDate = calculateNextITV(profile.registrationDate, profile.category, profile.lastItvDate);
    if (itvDate) nextItvString = itvDate.toLocaleDateString('es-ES');
  }
  if (maintenance) {
    nextServiceString = `${maintenance.nextDate.toLocaleDateString('es-ES')} (${maintenance.kmRemaining.toLocaleString('es-ES')} km rest.)`;
  }

  // RESUMEN
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
    }
  });

  // TABLA HISTORIAL
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
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  return doc;
};

// --- EXPORTAR SIMPLE ---
export const exportToPDF = (stats: SummaryStats, entries: CalculatedEntry[], profile: VehicleProfile | null, maintenance: MaintenanceData | null) => {
  const doc = generatePDFDoc(stats, entries, profile, maintenance);
  doc.save(`FuelMaster_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// --- SMART SHARE EXPORTADO CORRECTAMENTE ---
export const smartShareReport = async (stats: SummaryStats, entries: CalculatedEntry[], profile: VehicleProfile | null, maintenance: MaintenanceData | null) => {
  try {
    const doc = generatePDFDoc(stats, entries, profile, maintenance);
    const blob = doc.output('blob');
    const fileName = `FuelMaster_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    throw new Error("No soporta compartir archivos");
  } catch (pdfError) {
    console.log("Fallo PDF, intentando modo Texto...");
    try {
        const textReport = generateMarkdownReport(stats, profile, maintenance);
        await navigator.share({ title: 'Informe FuelMaster', text: textReport });
    } catch (textError) {
        alert("No se pudo compartir. Descargando PDF...");
        const doc = generatePDFDoc(stats, entries, profile, maintenance);
        doc.save(`FuelMaster_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  }
};