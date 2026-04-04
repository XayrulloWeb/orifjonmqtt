import { History } from 'lucide-react';

export default function Logs({ logs }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <History size={20} className="text-amber-500"/>
        <h3 className="font-bold text-slate-800">События насоса</h3>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 max-h-[300px]">
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">Событий пока нет</p>
          ) : logs.map((log) => (
            <div key={log.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${log.action === 'ON' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <div>
                  <p className="font-bold text-sm text-slate-700">{log.action === 'ON' ? 'Включение' : 'Выключение'}</p>
                  <p className="text-xs text-slate-400 font-medium">{log.mode === 'AUTO' ? 'Автоматика' : 'Вручную'}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}