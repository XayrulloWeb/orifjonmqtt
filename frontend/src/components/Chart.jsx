import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';

export default function Chart({ data }) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <div className="panel section-entrance min-w-0 rounded-3xl p-6 lg:col-span-2" data-delay="3">
      <div className="mb-5 flex items-center gap-2">
        <Activity size={20} className="text-teal-700" />
        <h3 className="font-extrabold text-slate-900">Namlik dinamikasi</h3>
      </div>

      {!hasData ? (
        <div className="grid h-[300px] place-content-center rounded-2xl border border-dashed border-slate-300 bg-white/60 text-sm font-semibold text-slate-500">
          Sensor ma`lumotlari kutilmoqda...
        </div>
      ) : (
        <div className="h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="moistureFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#d9e3df" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Namlik']}
                labelFormatter={(label) => `Vaqt: ${label}`}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #dbe3df',
                  boxShadow: '0 10px 25px -18px rgba(15, 23, 42, 0.6)',
                }}
                cursor={{ stroke: '#0f766e', strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="moisture"
                stroke="#0f766e"
                strokeWidth={3}
                fill="url(#moistureFill)"
                dot={{ r: 3.2, strokeWidth: 2, fill: '#ffffff', stroke: '#0f766e' }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#0f766e' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
