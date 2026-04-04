import { Settings2, Power } from 'lucide-react';

export default function Controls({ settings, updateSettings, togglePump }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
      <div className="flex items-center gap-2 mb-6 text-slate-800">
        <Settings2 size={24} className="text-blue-500"/>
        <h3 className="text-xl font-bold">Настройки и Управление</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        {/* Настройки */}
        <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <label className="flex justify-between items-center cursor-pointer">
            <span className="font-bold text-slate-700">Автоматический полив</span>
            <div className="relative inline-flex items-center">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={settings.isAutoMode}
                onChange={(e) => updateSettings(e.target.checked, settings.moistureThreshold)}
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </div>
          </label>

          <div>
            <div className="flex justify-between mb-2">
              <span className="font-bold text-slate-700">Порог включения насоса</span>
              <span className="font-black text-blue-600">{settings.moistureThreshold}%</span>
            </div>
            <input 
              type="range" min="10" max="90" 
              value={settings.moistureThreshold}
              onChange={(e) => updateSettings(settings.isAutoMode, parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Ручное управление */}
        <div className="flex flex-col justify-center space-y-4">
          <button 
            onClick={() => togglePump('ON')} 
            disabled={settings.isAutoMode}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl shadow-sm transition-all flex justify-center items-center gap-2 active:scale-95"
          >
            <Power size={20} /> Включить насос
          </button>
          <button 
            onClick={() => togglePump('OFF')} 
            disabled={settings.isAutoMode}
            className="w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl shadow-sm transition-all flex justify-center items-center gap-2 active:scale-95"
          >
            Остановить полив
          </button>
          {settings.isAutoMode && (
            <p className="text-xs text-center font-medium text-slate-400">Отключите авторежим для ручного управления</p>
          )}
        </div>
      </div>
    </div>
  );
}