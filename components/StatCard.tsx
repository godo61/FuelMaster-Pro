import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  trendData?: number[];
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon, color, trendData }) => {
  // Función para generar los puntos del sparkline dentro de un área SVG de 100x30
  const generatePath = () => {
    if (!trendData || trendData.length < 2) return "";
    const min = Math.min(...trendData);
    const max = Math.max(...trendData);
    const range = max - min || 1;
    const width = 100;
    const height = 30;
    const padding = 2;

    const points = trendData.map((val, i) => {
      const x = (i / (trendData.length - 1)) * width;
      // Invertimos Y: max es 0 (arriba), min es height (abajo)
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

  const path = generatePath();

  return (
    <div className="premium-card p-6 flex flex-col justify-between group overflow-hidden relative">
      {/* Sparkline de fondo si hay datos */}
      {trendData && trendData.length >= 2 && (
        <div className="absolute bottom-0 left-0 w-full h-8 opacity-40 pointer-events-none group-hover:opacity-70 transition-opacity">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={color.replace('bg-', 'text-')}
            />
          </svg>
        </div>
      )}

      <div className="flex items-start justify-between relative z-10">
        <div className={`p-3 rounded-xl ${color} bg-opacity-100 dark:bg-opacity-20 text-white shadow-lg transition-all`}>
          {icon}
        </div>
        <div className="h-1 w-8 bg-slate-500/10 rounded-full mt-2"></div>
      </div>
      
      <div className="mt-6 relative z-10">
        <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black group-hover:text-emerald-500 transition-colors">
            {value}
          </span>
          {unit && <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{unit}</span>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;