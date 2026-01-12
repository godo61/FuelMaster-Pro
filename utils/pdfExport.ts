import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { CalculatedEntry, SummaryStats, VehicleProfile } from '../types';
import { calculateNextITV } from './itvLogic';

// Definimos la interfaz para el objeto de mantenimiento que viene de App.tsx
interface MaintenanceData {
  nextKm: number;
  nextDate: Date;
  kmRemaining: number;
  daysRemaining: number;
  isUrgent: boolean;
}

export const exportToPDF = (
  stats: SummaryStats, 
  entries: CalculatedEntry[], 
  profile: VehicleProfile | null, 
  maintenance: MaintenanceData | null
) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- 1. HEADER PREMIUM ---
  // Fondo Esmeralda
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Título Principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FUELMASTER PRO', 15, 20);
  
  // Subtítulo
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('ANALYTICS & MAINTENANCE REPORT', 15, 28);
  
  // Fecha y ID (simulado) alineado a la derecha
  doc.setFontSize(9);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`Ref: ${Date.now().toString().slice(-6)}`, pageWidth - 15, 28, { align: 'right' });

  // --- 2. CÁLCULOS DE MANTENIMIENTO ---
  let nextItvString = 'No registrada';
  let nextServiceString = 'No configurado';

  if (profile) {
    const itvDate = calculateNextITV(profile.registrationDate, profile.category, profile.lastItvDate);
    if (itvDate) nextItvString = itvDate.toLocaleDateString('es-ES');
  }

  if (maintenance) {
    // Formato: "12/12/2026 (Faltan 4.500 km)"
    nextServiceString = `${maintenance.nextDate.toLocaleDateString('es-ES')} (${maintenance.kmRemaining.toLocaleString('es-ES')} km rest.)`;
  }

  // --- 3. RESUMEN EJECUTIVO (TABLA SUPERIOR) ---
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Estado del Vehículo', 15, 60);
  
  const summaryData = [
    // Fila 1: Consumo y Eficiencia
    ['Consumo Medio:', `${stats.avgConsumption.toFixed(2)} L/100km`, 'Eficiencia:', `${stats.avgKmPerLiter.toFixed(2)} km/L`],
    // Fila 2: Economía
    ['Gasto Total:', `${stats.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 'Coste/100km:', `${stats.avgCostPer100Km.toFixed(2)} €`],
    // Fila 3: Uso
    ['Kilometraje:', `${stats.lastOdometer.toLocaleString('es-ES')} km`, 'Combustible:', `${stats.totalFuel.toLocaleString('es-ES')} L`],
    // Fila 4 (NUEVA): Mantenimiento
    ['Próxima Revisión:', nextServiceString, 'Vencimiento ITV:', nextItvString]
  ];

  doc.autoTable({
    startY: 65,
    body: summaryData,
    theme: 'grid', // Cambiado a grid para que parezca más ficha técnica
    styles: { 
        fontSize: 10, 
        cellPadding: 4, 
        lineColor: [226, 232, 240], // Slate-200
        textColor: [51, 65, 85] // Slate-700
    },
    columnStyles: { 
        0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 40 }, // Header col 1
        1: { cellWidth: 'auto' },
        2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 40 }, // Header col 3
        3: { cellWidth: 'auto' }
    },
    didParseCell: function(data: any) {
        // Poner en rojo la ITV o Revisión si es urgente (opcional, por ahora solo negrita en datos)
        if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
            data.cell.styles.fontStyle = 'bold';
        }
    }
  });

  // --- 4. DETALLE DE REPOSTAJES (TABLA PRINCIPAL) ---
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
  // Ajustamos la posición Y basándonos en donde terminó la tabla anterior
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.text('Historial de Repostajes', 15, finalY);

  doc.autoTable({
    startY: finalY + 5,
    head: [['Fecha', 'Odómetro', 'Dist. (km)', 'Litros', 'PVP/L', 'Coste', 'L/100km']],
    body: tableData,
    headStyles: { 
        fillColor: [15, 23, 42], // Slate-900 (Oscuro profesional)
        textColor: [255, 255, 255], 
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
    },
    styles: { 
        fontSize: 8, 
        cellPadding: 3,
        halign: 'center' 
    },
    columnStyles: {
        0: { halign: 'left' }, // Fecha a la izquierda
        5: { fontStyle: 'bold' } // Coste en negrita
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate-50 alterno
    
    // --- 5. FOOTER (Paginación) ---
    didDrawPage: function (data: any) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            `Página ${doc.internal.getNumberOfPages()}`,
            pageWidth - 20,
            pageHeight - 10,
            { align: 'right' }
        );
        doc.text(
            'Generado por FuelMaster Pro',
            15,
            pageHeight - 10
        );
    }
  });

  doc.save(`FuelMaster_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};
