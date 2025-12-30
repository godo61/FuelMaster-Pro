import { VehicleCategory } from '../types';

/**
 * Calcula la próxima ITV basándose estrictamente en el aniversario 
 * de la fecha de matriculación, según la normativa española.
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

  /**
   * Determina cuántos años sumar según la edad actual del vehículo
   */
  const getInterval = (ageInYears: number): number => {
    switch (category) {
      case 'turismo':
      case 'motocicleta':
        if (ageInYears < 4) return 4;
        if (ageInYears < 10) return 2;
        return 1;
      
      case 'furgoneta':
        if (ageInYears < 2) return 2;
        if (ageInYears < 6) return 2;
        if (ageInYears < 10) return 1;
        return 0.5; // Semestral (usaremos lógica de meses abajo)

      default:
        return 1;
    }
  };

  // Buscamos el próximo aniversario que cumpla la ley
  let nextDeadline = new Date(regDate);
  let safety = 0;

  while (nextDeadline <= today && safety < 50) {
    const age = (nextDeadline.getFullYear() - regDate.getFullYear());
    const interval = getInterval(age);
    
    if (interval === 0.5) {
      nextDeadline.setMonth(nextDeadline.getMonth() + 6);
    } else {
      nextDeadline.setFullYear(nextDeadline.getFullYear() + interval);
    }
    safety++;
  }

  return nextDeadline;
};