import { useState, useEffect } from 'react';
import { api } from './api/axios';
import toast, { Toaster } from 'react-hot-toast';

// РРјРїРѕСЂС‚ РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
import Header from './components/Header';
import Moisture from './components/Moisture';
import Controls from './components/Controls';
import Chart from './components/Chart';
import Logs from './components/Logs';

function App() {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ isAutoMode: true, moistureThreshold: 40 });

  // Р—Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С…
  const fetchData = async () => {
    try {
      const [resData, resSettings, resLogs] = await Promise.all([
        api.get('/data'),
        api.get('/settings'),
        api.get('/logs')
      ]);
      
      const chartData = resData.data.map(item => ({
        ...item,
        time: new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      })).reverse();

      setData(chartData);
      setSettings(resSettings.data);
      setLogs(resLogs.data);
    } catch (error) {
      console.error("РћС€РёР±РєР° СЃРµС‚Рё", error);
    }
  };

  useEffect(() => {
    const initialFetchTimeout = setTimeout(() => {
      fetchData();
    }, 0);

    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => {
      clearTimeout(initialFetchTimeout);
      clearInterval(interval);
    };
  }, []);

  // Р’Р·Р°РёРјРѕРґРµР№СЃС‚РІРёРµ СЃ API
  const togglePump = async (action) => {
    const toastId = toast.loading('РћС‚РїСЂР°РІРєР° РєРѕРјР°РЅРґС‹...');
    try {
      await api.post('/pump', { action });
      toast.success(`РќР°СЃРѕСЃ ${action === 'ON' ? 'Р’РљР›Р®Р§Р•Рќ' : 'Р’Р«РљР›Р®Р§Р•Рќ'}!`, { id: toastId });
      fetchData();
    } catch {
      toast.error('РћС€РёР±РєР° СЃРІСЏР·Рё СЃ СЃРµСЂРІРµСЂРѕРј', { id: toastId });
    }
  };

  const updateSettings = async (newAutoMode, newThreshold) => {
    setSettings({ isAutoMode: newAutoMode, moistureThreshold: newThreshold });
    try {
      await api.post('/settings', { isAutoMode: newAutoMode, moistureThreshold: newThreshold });
      toast.success('РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅРµРЅС‹!');
    } catch {
      toast.error('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
    }
  };

  // Р’С‹С‡РёСЃР»РµРЅРёСЏ
  const currentMoisture = data.length > 0 ? data[data.length - 1].moisture : 0;
  const isDry = currentMoisture < settings.moistureThreshold;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-6xl mx-auto">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Moisture currentMoisture={currentMoisture} isDry={isDry} />
          <Controls settings={settings} updateSettings={updateSettings} togglePump={togglePump} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Chart data={data} />
          <Logs logs={logs} />
        </div>
      </div>
    </div>
  );
}

export default App;
