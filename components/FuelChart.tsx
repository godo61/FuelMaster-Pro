import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import { CalculatedEntry } from '../types';

interface FuelChartProps {
  data: CalculatedEntry[];
  type: 'consumption' | 'price' | 'cost' | 'efficiency';
}

const FuelChart: React.FC<FuelChartProps> = ({ data, type }) => {
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Sin datos suficientes</div>;

  const formatVal = (val: any) => parseFloat(val).toFixed(2);

  const renderChart = () => {
    switch (type) {
      case 'consumption':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{fontSize: 9, fill: '#64748b'}} stroke="transparent" />
            <YAxis tick={{fontSize: 9, fill: '#64748b'}} stroke="transparent" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
              itemStyle={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '12px' }}
            />
            <Area name="L/100km" type="monotone" dataKey="consumption" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCons)" strokeWidth={3} />
          </AreaChart>
        );
      case 'efficiency':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{fontSize: 9, fill: '#64748b'}} stroke="transparent" />
            <YAxis tick={{fontSize: 9, fill: '#64748b'}} stroke="transparent" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
              itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
            />
            <Area name="km/L" type="monotone" dataKey="kmPerLiter" stroke="#10b981" fillOpacity={1} fill="url(#colorEff)" strokeWidth={3} />
          </AreaChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[280px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart() || <div>Error de gráfico</div>}
      </ResponsiveContainer>
    </div>
  );
};

export default FuelChart;
