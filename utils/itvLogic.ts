import { VehicleCategory } from '../types';

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
  
  const regDate = new Date(registrationDateStr);
  if (isNaN(regDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastItv = lastItvDateStr ? new Date(lastItvDateStr) : null;
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
  // Si el usuario ha introducido una ITV reciente, es posible que la "fecha teórica futura"
  // que acabamos de calcular sea precisamente la que el usuario acaba de pasar (p.ej. la pasó 6 días antes).
  
  if (lastItv && !isNaN(lastItv.getTime())) {
    // Si la fecha teórica es ANTERIOR a la última ITV real (improbable si el while funciona, pero por seguridad)
    // O si la fecha teórica está "cubierta" por la última ITV (ej: la ITV fue ayer y vencía en 6 días).
    // Usamos un margen de 60 días: si la ITV teórica vence en menos de 60 días desde la última inspección real,
    // asumimos que esa inspección real CUBRÍA este vencimiento.
    
    const diffTime = nextDeadline.getTime() - lastItv.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Si la fecha límite es anterior a la última pasada O está muy cerca (la acabamos de pasar adelantada)
    // Saltamos al siguiente ciclo.
    if (nextDeadline <= lastItv || (diffDays >= 0 && diffDays < 60)) {
       addInterval(nextDeadline);
    }
  }

  return nextDeadline;
};