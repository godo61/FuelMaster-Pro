
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { CalculatedEntry, SummaryStats } from '../types';

export const exportToPDF = (stats: SummaryStats, entries: CalculatedEntry[], insights?: string) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('TOYOTA HYBRID REVOLUTION', 15, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('INFORME PROFESIONAL DE CONSUMO Y EFICIENCIA - C-HR 2018', 15, 25);
  doc.text(`Fecha del informe: ${new Date().toLocaleDateString('es-ES')}`, 15, 32);

  // Summary Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen Ejecutivo', 15, 55);
  
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 58, pageWidth - 15, 58);

  const statsData = [
    ['Consumo Medio:', `${stats.avgConsumption.toFixed(2)} L/100km`, 'Eficiencia:', `${stats.avgKmPerLiter.toFixed(2)} km/L`],
    ['Inversión Total:', `${stats.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 'Coste/100km:', `${stats.avgCostPer100Km.toFixed(2)} €`],
    ['Kilometraje Total:', `${stats.lastOdometer.toLocaleString('es-ES')} km`, 'Litros Totales:', `${stats.totalFuel.toLocaleString('es-ES')} L`],
    ['Media PVP:', `${stats.avgPricePerLiter.toFixed(3)} €/L`, 'Depósito:', '43 Litros']
  ];

  doc.autoTable({
    startY: 65,
    body: statsData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // AI Insights Section
  if (insights) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Análisis FuelMaster AI', 15, currentY);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const splitText = doc.splitTextToSize(insights, pageWidth - 30);
    doc.text(splitText, 15, currentY + 8);
    currentY += (splitText.length * 5) + 20;
  }

  // History Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Histórico Detallado de Repostajes', 15, currentY);

  const tableData = entries.slice().reverse().map(e => [
    e.date,
    e.kmFinal.toLocaleString('es-ES'),
    `${e.distancia} km`,
    `${e.fuelAmount.toFixed(2)} L`,
    `${e.pricePerLiter.toFixed(3)} €`,
    `${e.cost.toFixed(2)} €`,
    e.consumption.toFixed(2)
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [['Fecha', 'Odómetro', 'Distancia', 'Llenado', 'PVP €/L', 'Coste €', 'L/100km']],
    body: tableData,
    headStyles: { fillStyle: 'F', fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(`Toyota_CHR_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};
