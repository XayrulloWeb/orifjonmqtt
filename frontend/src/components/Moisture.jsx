import { Activity, Droplet } from 'lucide-react';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function Moisture({ currentMoisture, isDry, pumpState, threshold }) {
  const isPumpOn = pumpState === 'ON';
  const pumpLabel = isPumpOn ? 'yoqilgan' : 'o`chirilgan';
  const safeMoisture = clamp(Number.isFinite(currentMoisture) ? currentMoisture : 0, 0, 100);
  const ringStyle = {
    background: `conic-gradient(${isDry ? '#f97316' : '#0f766e'} ${safeMoisture}%, #dbe5e7 ${safeMoisture}% 100%)`,
  };

  return (
    <div className="panel section-entrance relative overflow-hidden rounded-3xl p-6" data-delay="1">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-teal-300/30 blur-2xl" />

      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Joriy namlik</h3>
        <Activity size={20} className="text-teal-700" />
      </div>

      <div className="mx-auto mb-6 grid h-44 w-44 place-content-center rounded-full p-3" style={ringStyle}>
        <div className="grid h-full w-full place-content-center rounded-full bg-white/90 shadow-inner">
          <p className={`text-5xl font-black ${isDry ? 'text-orange-500' : 'text-teal-700'}`}>{safeMoisture}%</p>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">tuproq</p>
        </div>
      </div>

      <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${isDry ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
        {isDry ? 'Namlik chegaradan past. Sug`orish tavsiya etiladi.' : 'Namlik me`yorda va chegaradan yuqori.'}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Droplet size={16} className="text-teal-700" />
          Chegara: {threshold}%
        </div>
        <div className={`font-bold ${isPumpOn ? 'text-emerald-700' : 'text-slate-700'}`}>Nasos {pumpLabel}</div>
      </div>
    </div>
  );
}
