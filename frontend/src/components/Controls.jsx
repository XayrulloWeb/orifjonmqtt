import { Power, Settings2 } from 'lucide-react';

export default function Controls({ settings, updateSettings, togglePump, pumpState }) {
  const isPumpOn = pumpState === 'ON';
  const manualLocked = settings.isAutoMode;

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
      <div className="flex items-center gap-2 mb-6 text-slate-800">
        <Settings2 size={24} className="text-blue-500" />
        <h3 className="text-xl font-bold">Settings and Control</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <label className="flex justify-between items-center cursor-pointer">
            <span className="font-bold text-slate-700">Auto watering</span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.isAutoMode}
                onChange={(event) => updateSettings(event.target.checked, settings.moistureThreshold)}
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
            </div>
          </label>

          <div>
            <div className="flex justify-between mb-2">
              <span className="font-bold text-slate-700">Pump start threshold</span>
              <span className="font-black text-blue-600">{settings.moistureThreshold}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={settings.moistureThreshold}
              onChange={(event) => updateSettings(settings.isAutoMode, Number.parseInt(event.target.value, 10))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <p className="text-xs text-slate-500 font-semibold">
            Pump state: <span className={isPumpOn ? 'text-emerald-600' : 'text-slate-700'}>{pumpState}</span>
          </p>
        </div>

        <div className="flex flex-col justify-center space-y-4">
          <button
            onClick={() => togglePump('ON')}
            disabled={manualLocked || isPumpOn}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl shadow-sm transition-all flex justify-center items-center gap-2 active:scale-95"
          >
            <Power size={20} /> Turn pump ON
          </button>

          <button
            onClick={() => togglePump('OFF')}
            disabled={manualLocked || !isPumpOn}
            className="w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl shadow-sm transition-all flex justify-center items-center gap-2 active:scale-95"
          >
            Turn pump OFF
          </button>

          {manualLocked && (
            <p className="text-xs text-center font-medium text-slate-400">
              Disable auto mode to send manual pump commands
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
