import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { api } from './api/axios';

import Header from './components/Header';
import Moisture from './components/Moisture';
import Controls from './components/Controls';
import Chart from './components/Chart';
import Logs from './components/Logs';

const DEFAULT_SETTINGS = { isAutoMode: true, moistureThreshold: 40 };

function normalizeSettings(rawSettings) {
  if (!rawSettings || typeof rawSettings !== 'object') {
    return DEFAULT_SETTINGS;
  }

  return {
    isAutoMode:
      typeof rawSettings.isAutoMode === 'boolean'
        ? rawSettings.isAutoMode
        : DEFAULT_SETTINGS.isAutoMode,
    moistureThreshold:
      typeof rawSettings.moistureThreshold === 'number'
        ? rawSettings.moistureThreshold
        : DEFAULT_SETTINGS.moistureThreshold,
  };
}

function toChartData(rawData) {
  const items = Array.isArray(rawData) ? rawData : [];

  return items
    .map((item) => ({
      ...item,
      time: new Date(item.createdAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }))
    .reverse();
}

function normalizePumpState(rawPumpState) {
  return rawPumpState === 'ON' ? 'ON' : 'OFF';
}

function App() {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pumpState, setPumpState] = useState('OFF');

  const applyDashboardPayload = useCallback((payload) => {
    const safePayload = payload && typeof payload === 'object' ? payload : {};

    setData(toChartData(safePayload.data));
    setLogs(Array.isArray(safePayload.logs) ? safePayload.logs : []);
    setSettings(normalizeSettings(safePayload.settings));
    setPumpState(normalizePumpState(safePayload.pumpState ?? safePayload.settings?.pumpState));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [resData, resSettings, resLogs] = await Promise.all([
        api.get('/data'),
        api.get('/settings'),
        api.get('/logs'),
      ]);

      applyDashboardPayload({
        data: resData.data,
        settings: resSettings.data,
        logs: resLogs.data,
        pumpState: resSettings.data?.pumpState,
      });
    } catch (error) {
      console.error('Network error while fetching dashboard data', error);
    }
  }, [applyDashboardPayload]);

  useEffect(() => {
    const initialFetchTimeout = setTimeout(() => {
      fetchData();
    }, 0);

    const socket = io('/', {
      transports: ['websocket', 'polling'],
    });

    socket.on('dashboard:update', applyDashboardPayload);
    socket.on('connect_error', (error) => {
      console.error('Socket connection error', error);
    });

    const fallbackInterval = setInterval(() => {
      fetchData();
    }, 15000);

    return () => {
      clearTimeout(initialFetchTimeout);
      clearInterval(fallbackInterval);
      socket.disconnect();
    };
  }, [applyDashboardPayload, fetchData]);

  const togglePump = async (action) => {
    const toastId = toast.loading('Sending command...');

    try {
      await api.post('/pump', { action });
      toast.success(`Pump ${action === 'ON' ? 'started' : 'stopped'}`, { id: toastId });
      fetchData();
    } catch (error) {
      const errorText = error?.response?.data?.error || 'Server communication error';
      toast.error(errorText, { id: toastId });
    }
  };

  const updateSettings = async (newAutoMode, newThreshold) => {
    setSettings({ isAutoMode: newAutoMode, moistureThreshold: newThreshold });

    try {
      await api.post('/settings', {
        isAutoMode: newAutoMode,
        moistureThreshold: newThreshold,
      });
      toast.success('Settings saved');
    } catch (error) {
      const errorText = error?.response?.data?.error || 'Failed to save settings';
      toast.error(errorText);
      fetchData();
    }
  };

  const currentMoisture = data.length > 0 ? data[data.length - 1].moisture : 0;
  const isDry = currentMoisture < settings.moistureThreshold;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <Toaster position="top-right" />

      <div className="max-w-6xl mx-auto">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Moisture currentMoisture={currentMoisture} isDry={isDry} pumpState={pumpState} />
          <Controls
            settings={settings}
            updateSettings={updateSettings}
            togglePump={togglePump}
            pumpState={pumpState}
          />
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
