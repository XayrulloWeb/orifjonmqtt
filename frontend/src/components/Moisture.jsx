import { Activity } from 'lucide-react';

export default function Moisture({ currentMoisture, isDry }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center items-center relative overflow-hidden">
      <div className="absolute top-4 right-4 text-slate-300">
        <Activity size={24} />
      </div>
      <h3 className="text-slate-500 font-semibold mb-4 text-sm uppercase tracking-wider">Текущая влажность</h3>
      <div className={`text-7xl md:text-8xl font-black transition-colors duration-700 ${isDry ? 'text-rose-500' : 'text-emerald-500'}`}>
        {currentMoisture}<span className="text-4xl text-slate-300">%</span>
      </div>
      <div className={`mt-6 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${isDry ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {isDry ? 'Требуется полив' : 'Влажность в норме'}
      </div>
    </div>
  );
}