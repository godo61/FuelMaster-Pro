import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon, color }) => {
  return (
    <div className="premium-card p-6 flex flex-col justify-between group overflow-hidden">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${color} bg-opacity-100 dark:bg-opacity-20 text-white shadow-lg transition-all`}>
          {icon}
        </div>
        <div className="h-1 w-8 bg-slate-500/10 rounded-full mt-2"></div>
      </div>
      <div className="mt-6">
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