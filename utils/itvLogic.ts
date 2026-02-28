import { VehicleCategory } from '../types';

// NUEVA FUNCIÓN: Traductor de fechas para JavaScript
const parseSafeDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  
  // Si la fecha viene en formato español (DD/MM/YYYY)
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    // En JavaScript, los meses van de 0 a 11 (Enero = 0, Febrero = 1, etc.)
    const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(parsedDate.getTime())) return parsedDate;
  }
  
  // Si viene en formato estándar americano (YYYY-MM-DD), usa el método normal
  const fallbackDate = new Date(dateStr);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

/**
 * Calcula la próxima ITV basándose en la fecha de matriculación
 * pero teniendo en cuenta si el usuario ya ha pasado la revisión correspondiente.
 */
export const calculateNextITV = (
  registrationDateStr: string, 
  category: VehicleCategory,
  lastItvDateStr?: string
): Date | null => {
  if (!registrationDateStr) return null;
  
  // CORRECCIÓN: Usamos nuestro traductor en lugar de new Date() a secas
  const regDate = parseSafeDate(registrationDateStr);
  if (!regDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastItv = parseSafeDate(lastItvDateStr);
  if (lastItv) lastItv.setHours(0, 0, 0, 0);

  /**
   * Determina cuántos años sumar según la edad del vehículo en el momento de la revisión
   */
  const getNextIntervalConfig = (currentDeadline: Date): { years: number, months: number } => {
    const ageInYears = currentDeadline.getFullYear() - regDate.getFullYear();
    
    switch (category) {
      case 'turismo':
      case 'motocicleta':
        if (ageInYears < 4) return { years: 4, months: 0 }; // Primera a los 4 años
        if (ageInYears < 10) return { years: 2, months: 0 }; // Cada 2 años hasta los 10
        return { years: 1, months: 0 }; // Anual a partir de los 10
      
      case 'furgoneta':
        if (ageInYears < 2) return { years: 2, months: 0 };
        if (ageInYears < 6) return { years: 2, months: 0 };
        if (ageInYears < 10) return { years: 1, months: 0 };
        return { years: 0, months: 6 }; // Semestral

      default:
        return { years: 1, months: 0 };
    }
  };

  // Función auxiliar para sumar el intervalo correcto a una fecha dada
  const addInterval = (date: Date) => {
    const interval = getNextIntervalConfig(date);
    if (interval.months > 0) {
      date.setMonth(date.getMonth() + interval.months);
    } else {
      date.setFullYear(date.getFullYear() + interval.years);
    }
  };

  // 1. Empezamos calculando desde la fecha de matriculación
  let nextDeadline = new Date(regDate);

  // 2. Avanzamos la fecha teórica hasta que sea FUTURA respecto a HOY.
  // Esto nos da la próxima ITV teórica "oficial".
  let safety = 0;
  while (nextDeadline <= today && safety < 100) {
    addInterval(nextDeadline);
    safety++;
  }

  // 3. CORRECCIÓN CRÍTICA: Comprobar contra la Última ITV introducida por el usuario.
  if (lastItv && !isNaN(lastItv.getTime())) {
    const diffTime = nextDeadline.getTime() - lastItv.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (nextDeadline <= lastItv || (diffDays >= 0 && diffDays < 60)) {
       addInterval(nextDeadline);
    }
  }

  return nextDeadline;
};
