import { useEffect, useRef, useState } from 'react';
import { Bot, Gauge, Power, Settings2 } from 'lucide-react';

export default function Controls({ settings, updateSettings, togglePump, pumpState }) {
  const isPumpOn = pumpState === 'ON';
  const manualLocked = settings.isAutoMode;
  const [thresholdDraft, setThresholdDraft] = useState(settings.moistureThreshold);
  const lastCommittedThresholdRef = useRef(settings.moistureThreshold);

  useEffect(() => {
    setThresholdDraft(settings.moistureThreshold);
    lastCommittedThresholdRef.current = settings.moistureThreshold;
  }, [settings.moistureThreshold]);

  const commitThreshold = () => {
    if (thresholdDraft === lastCommittedThresholdRef.current) {
      return;
    }

    lastCommittedThresholdRef.current = thresholdDraft;
    updateSettings(settings.isAutoMode, thresholdDraft);
  };

  return (
    <div className="panel section-entrance rounded-3xl p-6 lg:col-span-2" data-delay="2">
      <div className="mb-5 flex items-center gap-2 text-slate-900">
        <Settings2 size={22} className="text-teal-700" />
        <h3 className="text-lg font-extrabold md:text-xl">Avtomatika va qo`lda boshqaruv</h3>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="panel-soft rounded-2xl p-5">
          <label className="mb-6 flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-700">Avto sug`orish rejimi</p>
              <p className="text-xs text-slate-500">Namlikka qarab nasosni avtomatik boshqaradi.</p>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={settings.isAutoMode}
                onChange={(event) => updateSettings(event.target.checked, settings.moistureThreshold)}
              />
              <div className="h-7 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-teal-600 peer-focus:outline-none after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
            </div>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span className="flex items-center gap-2"><Gauge size={16} className="text-teal-700" /> Nasos yoqilish chegarasi</span>
              <span className="rounded-full bg-teal-50 px-3 py-1 font-extrabold text-teal-700">{thresholdDraft}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={thresholdDraft}
              onChange={(event) => setThresholdDraft(Number.parseInt(event.target.value, 10))}
              onMouseUp={commitThreshold}
              onTouchEnd={commitThreshold}
              onBlur={commitThreshold}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-teal-600"
            />
          </div>

          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <Bot size={14} />
            {settings.isAutoMode ? 'Avto rejim faol' : 'Qo`lda rejim faol'}
          </p>
        </section>

        <section className="panel-soft rounded-2xl p-5">
          <p className="mb-4 text-sm font-bold text-slate-700">Nasosni qo`lda boshqarish</p>

          <div className="space-y-3">
            <button
              onClick={() => togglePump('ON')}
              disabled={manualLocked || isPumpOn}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <span className="flex items-center justify-center gap-2"><Power size={18} /> Nasosni yoqish</span>
            </button>

            <button
              onClick={() => togglePump('OFF')}
              disabled={manualLocked || !isPumpOn}
              className="w-full rounded-2xl bg-rose-600 px-4 py-3 font-bold text-white shadow-sm transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Nasosni o`chirish
            </button>
          </div>

          <p className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600">
            {manualLocked
              ? 'Qo`lda buyruq berishdan oldin avto rejimni o`chiring.'
              : 'Nasos buyruqlari yuborishga tayyor.'}
          </p>
        </section>
      </div>
    </div>
  );
}
