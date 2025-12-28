
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
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-slate-400">No hay datos disponibles</div>;

  // Formateador para 2 decimales
  const formatVal = (val: any) => parseFloat(val).toFixed(2);
  const formatPrice = (val: any) => parseFloat(val).toFixed(3);

  const renderChart = () => {
    switch (type) {
      case 'consumption':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#94a3b8" minTickGap={30} />
            <YAxis tickFormatter={(v) => v.toFixed(2)} stroke="#94a3b8" />
            <Tooltip 
              formatter={(value) => [formatVal(value), "L/100km"]}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            />
            <Area name="Consumo" type="monotone" dataKey="consumption" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCons)" strokeWidth={3} />
          </AreaChart>
        );
      case 'efficiency':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#94a3b8" minTickGap={30} />
            <YAxis tickFormatter={(v) => v.toFixed(2)} stroke="#94a3b8" />
            <Tooltip 
              formatter={(value) => [formatVal(value), "km/L"]}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            />
            <Area name="Eficiencia" type="monotone" dataKey="kmPerLiter" stroke="#10b981" fillOpacity={1} fill="url(#colorEff)" strokeWidth={3} />
          </AreaChart>
        );
      case 'price':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#94a3b8" minTickGap={30} />
            <YAxis tickFormatter={(v) => v.toFixed(3)} unit="€" stroke="#94a3b8" domain={['auto', 'auto']} />
            <Tooltip formatter={(value) => [formatPrice(value), "€/L"]} />
            <Line name="Precio/Litro" type="monotone" dataKey="pricePerLiter" stroke="#8b5cf6" strokeWidth={3} dot={false} />
          </LineChart>
        );
      case 'cost':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#94a3b8" minTickGap={30} />
            <YAxis tickFormatter={(v) => v.toFixed(2)} unit="€" stroke="#94a3b8" />
            <Tooltip formatter={(value) => [formatVal(value), "€"]} />
            <Bar name="Gasto" dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        );
    }
  };

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default FuelChart;
