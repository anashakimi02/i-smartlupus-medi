"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface StatusChartProps {
  data: ChartData[];
}

export default function StatusChart({ data }: StatusChartProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
            Taburan Status Semasa
          </h2>
          <p className="text-[11px] text-slate-500 font-bold mt-1 uppercase tracking-wide">
            Analisis Tiket Pelupusan Aset
          </p>
        </div>
      </div>
      
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }}
              width={100}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontWeight: 'bold', fontSize: '12px' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
