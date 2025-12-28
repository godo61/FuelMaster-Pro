import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { CalculatedEntry, SummaryStats } from '../types';

export const exportToPDF = (stats: SummaryStats, entries: CalculatedEntry[]) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('FUELMASTER PRO ANALYTICS', 15, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('INFORME DE EFICIENCIA AUTOMOTRIZ', 15, 25);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 15, 32);

  // Summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen Ejecutivo', 15, 55);
  
  const statsData = [
    ['Consumo Medio:', `${stats.avgConsumption.toFixed(2)} L/100km`, 'Eficiencia:', `${stats.avgKmPerLiter.toFixed(2)} km/L`],
    ['Gasto Total:', `${stats.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 'Coste/100km:', `${stats.avgCostPer100Km.toFixed(2)} €`],
    ['Kilometraje:', `${stats.lastOdometer.toLocaleString('es-ES')} km`, 'Combustible:', `${stats.totalFuel.toLocaleString('es-ES')} L`]
  ];

  doc.autoTable({
    startY: 65,
    body: statsData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } }
  });

  // Table
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
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Fecha', 'Odómetro', 'Distancia', 'Litros', 'PVP €/L', 'Coste €', 'L/100km']],
    body: tableData,
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(`FuelMaster_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};