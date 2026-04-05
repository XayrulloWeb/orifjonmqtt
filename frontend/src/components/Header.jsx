import { Download, Droplets, LogOut, Wifi, WifiOff } from 'lucide-react';

export default function Header({
  isSocketConnected,
  isOnline,
  canInstall,
  onInstall,
  pumpState,
  onLogout,
}) {
  const connected = isOnline && isSocketConnected;
  const statusText = connected ? 'Jonli ulanish' : 'Qayta ulanmoqda';
  const pumpLabel = pumpState === 'ON' ? 'yoqilgan' : 'o`chirilgan';

  return (
    <header className="panel section-entrance mb-6 rounded-[2rem] p-5 md:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="icon-surface grid h-14 w-14 place-content-center rounded-2xl">
            <Droplets size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              AgroIoT boshqaruv paneli
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Aqlli sug`orish boshqaruvi, jurnal va namlik tahlili
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <div className={`badge ${connected ? 'badge-ok' : 'badge-warn'}`}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{statusText}</span>
          </div>
          <div className={`badge ${pumpState === 'ON' ? 'badge-ok' : ''}`}>Nasos: {pumpLabel}</div>
          {canInstall && (
            <button
              onClick={onInstall}
              className="badge badge-action transition-transform hover:-translate-y-0.5"
            >
              <Download size={14} />
              <span>Ilovani o`rnatish</span>
            </button>
          )}
          <button onClick={onLogout} className="badge transition-transform hover:-translate-y-0.5">
            <LogOut size={14} />
            <span>Chiqish</span>
          </button>
        </div>
      </div>
    </header>
  );
}
