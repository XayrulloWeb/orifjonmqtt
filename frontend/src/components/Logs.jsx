import { History } from 'lucide-react';

function getModeLabel(mode) {
  if (mode === 'AUTO') {
    return 'Avtomatika';
  }

  if (mode === 'MANUAL') {
    return 'Qo`lda';
  }

  return 'Tizim';
}

function getActionLabel(action) {
  return action === 'ON' ? 'Yoqish' : 'O`chirish';
}

export default function Logs({ logs }) {
  const list = Array.isArray(logs) ? logs : [];

  return (
    <div className="panel section-entrance rounded-3xl p-6" data-delay="4">
      <div className="mb-5 flex items-center gap-2">
        <History size={20} className="text-amber-600" />
        <h3 className="font-extrabold text-slate-900">Nasos hodisalari</h3>
      </div>

      <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
        {list.length === 0 ? (
          <p className="grid h-[220px] place-content-center rounded-2xl border border-dashed border-slate-300 bg-white/60 text-sm font-semibold text-slate-500">
            Hozircha hodisalar yo`q
          </p>
        ) : (
          list.map((log) => (
            <article
              key={log.id}
              className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_8px_25px_-24px_rgba(15,23,42,0.9)]"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-slate-800">
                  Nasos {log.action === 'ON' ? 'yoqildi' : 'o`chirildi'}
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    log.action === 'ON' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {getActionLabel(log.action)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{getModeLabel(log.mode)}</span>
                <span>{new Date(log.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
