import { Droplets } from 'lucide-react';

export default function Header() {
  return (
    <header className="mb-8 flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-4">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
          <Droplets size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">AgroIoT Dashboard</h1>
          <p className="text-slate-500 text-sm font-medium">Система интеллектуального полива</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-200">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-sm font-semibold text-slate-600">Система в сети</span>
      </div>
    </header>
  );
}