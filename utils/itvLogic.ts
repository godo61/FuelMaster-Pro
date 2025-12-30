import { VehicleCategory } from '../types';

/**
 * Calcula la próxima ITV basándose en la fecha de matriculación, 
 * la categoría del vehículo y la última ITV real pasada (si existe).
 * Aplica la regla de los 30 días de España.
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

  // 1. Calcular el vencimiento teórico basado SOLAMENTE en la matriculación
  // para saber en qué tramo de edad estamos.
  const getTheoreticalExpiry = (date: Date): Date => {
    const next = new Date(date);
    const ageInYears = (today.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    switch (category) {
      case 'turismo':
        if (ageInYears < 4) return addTime(regDate, 4);
        if (ageInYears < 10) return addTime(date, 2);
        return addTime(date, 1);
      case 'motocicleta':
        if (ageInYears < 4) return addTime(regDate, 4);
        return addTime(date, 2);
      case 'ciclomotor':
        if (ageInYears < 3) return addTime(regDate, 3);
        return addTime(date, 2);
      case 'furgoneta':
        if (ageInYears < 2) return addTime(regDate, 2);
        if (ageInYears < 6) return addTime(date, 2);
        if (ageInYears < 10) return addTime(date, 1);
        return addTime(date, 0, 6);
      default:
        return addTime(date, 1);
    }
  };

  const addTime = (date: Date, years: number, months: number = 0) => {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  // 2. Si no hay última ITV registrada, la próxima es a los X años de matricular
  if (!lastItvDateStr) {
    let firstITV = regDate;
    if (category === 'turismo' || category === 'motocicleta') firstITV = addTime(regDate, 4);
    else if (category === 'ciclomotor') firstITV = addTime(regDate, 3);
    else if (category === 'furgoneta') firstITV = addTime(regDate, 2);
    else firstITV = addTime(regDate, 1);
    
    // Si ya pasó la primera ITV teórica, proyectamos según la edad actual
    while (firstITV <= today) {
        firstITV = getTheoreticalExpiry(firstITV);
    }
    return firstITV;
  }

  // 3. Lógica con inspección real y REGLA DE LOS 30 DÍAS
  const lastRealDate = new Date(lastItvDateStr);
  // Estimamos cuándo debería haber caducado la anterior para aplicar los 30 días
  // Como no tenemos el histórico completo, proyectamos el intervalo desde la matriculación
  // para encontrar el "vencimiento teórico" más cercano a la fecha real introducida.
  let theoreticalDeadline = regDate;
  let safety = 0;
  while (theoreticalDeadline < lastRealDate && safety < 50) {
    theoreticalDeadline = getTheoreticalExpiry(theoreticalDeadline);
    safety++;
  }

  // REGLA 30 DÍAS: Si pasó la ITV hasta 30 días antes del vencimiento teórico
  const diffMs = theoreticalDeadline.getTime() - lastRealDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  const baseDateForNext = (diffDays > 0 && diffDays <= 30) 
    ? theoreticalDeadline // Snap al vencimiento original
    : lastRealDate;      // Fecha de la inspección real

  return getTheoreticalExpiry(baseDateForNext);
};