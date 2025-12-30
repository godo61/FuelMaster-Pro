
import { VehicleCategory } from '../types';

export const calculateNextITV = (registrationDateStr: string, category: VehicleCategory): Date => {
  const regDate = new Date(registrationDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextITV = new Date(regDate);

  // Función auxiliar para añadir meses/años de forma segura
  const addTime = (date: Date, years: number, months: number = 0) => {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  // Lógica iterativa para encontrar la próxima inspección futura
  while (nextITV <= today) {
    const yearsDiff = today.getFullYear() - regDate.getFullYear();
    const ageInYears = (nextITV.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    switch (category) {
      case 'turismo':
        if (ageInYears < 4) nextITV = addTime(regDate, 4);
        else if (ageInYears < 10) nextITV = addTime(nextITV, 2);
        else nextITV = addTime(nextITV, 1);
        break;

      case 'motocicleta':
        if (ageInYears < 4) nextITV = addTime(regDate, 4);
        else nextITV = addTime(nextITV, 2);
        break;

      case 'ciclomotor':
        if (ageInYears < 3) nextITV = addTime(regDate, 3);
        else nextITV = addTime(nextITV, 2);
        break;

      case 'furgoneta':
        if (ageInYears < 2) nextITV = addTime(regDate, 2);
        else if (ageInYears < 6) nextITV = addTime(nextITV, 2);
        else if (ageInYears < 10) nextITV = addTime(nextITV, 1);
        else nextITV = addTime(nextITV, 0, 6); // Semestral
        break;

      case 'pesado':
        if (ageInYears < 10) nextITV = addTime(nextITV, 1);
        else nextITV = addTime(nextITV, 0, 6);
        break;

      case 'autobus':
        if (ageInYears < 5) nextITV = addTime(nextITV, 1);
        else nextITV = addTime(nextITV, 0, 6);
        break;

      case 'caravana':
        if (ageInYears < 6) nextITV = addTime(regDate, 6);
        else nextITV = addTime(nextITV, 2);
        break;

      case 'historico':
        const age = yearsDiff;
        if (age >= 60) return new Date(2099, 0, 1); // Exento
        if (age >= 45) nextITV = addTime(nextITV, 4);
        else if (age >= 40) nextITV = addTime(nextITV, 3);
        else nextITV = addTime(nextITV, 2);
        break;

      default:
        nextITV = addTime(nextITV, 1);
    }
    
    // Evitar bucles infinitos por fechas mal configuradas
    if (nextITV.getFullYear() > today.getFullYear() + 10) break;
  }

  return nextITV;
};
