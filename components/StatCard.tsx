
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
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
          {icon}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</h3>
        <p className="text-2xl font-bold text-slate-900 mt-1">
          {value}
          {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
};

export default StatCard;
