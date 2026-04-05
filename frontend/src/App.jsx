import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import {
  api,
  clearStoredAuthToken,
  getStoredAuthToken,
  storeAuthToken,
} from './api/axios';

import Header from './components/Header';
import Moisture from './components/Moisture';
import Controls from './components/Controls';
import Chart from './components/Chart';
import Logs from './components/Logs';
import Login from './components/Login';

const DEFAULT_SETTINGS = { isAutoMode: true, moistureThreshold: 40 };
const SOCKET_URL = import.meta.env.DEV
  ? import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'
  : '/';

function localizeServerError(errorMessage) {
  const map = {
    'Action must be ON or OFF': 'Buyruq faqat ON yoki OFF bo`lishi kerak',
    'Disable auto mode before manual control': 'Qo`lda boshqarishdan oldin avto rejimni o`chiring',
    'Failed to control pump': 'Nasosni boshqarishda xato',
    'MQTT is not connected, try again in a few seconds': 'MQTT ulanmagan, bir necha soniyadan keyin qayta urinib ko`ring',
    'Failed to update settings': 'Sozlamalarni yangilashda xato',
    'Failed to fetch data': 'Ma`lumotlarni olishda xato',
    'Failed to fetch settings': 'Sozlamalarni olishda xato',
    'Failed to fetch logs': 'Jurnallarni olishda xato',
    'Invalid login or password': 'Login yoki parol noto`g`ri',
    Unauthorized: 'Avtorizatsiya talab qilinadi',
  };

  return map[errorMessage] || errorMessage;
}

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
      time: new Date(item.createdAt).toLocaleTimeString('uz-UZ', {
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
  const [authToken, setAuthToken] = useState(() => getStoredAuthToken());
  const [authStatus, setAuthStatus] = useState(() => (getStoredAuthToken() ? 'checking' : 'unauthenticated'));
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pumpState, setPumpState] = useState('OFF');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  const logout = useCallback((showToast = false, message = 'Hisobdan chiqildi') => {
    clearStoredAuthToken();
    setAuthToken(null);
    setAuthStatus('unauthenticated');
    setIsSocketConnected(false);

    if (showToast) {
      toast.success(message);
    }
  }, []);

  const forceRelogin = useCallback((message = 'Sessiya tugadi. Qayta kiring.') => {
    clearStoredAuthToken();
    setAuthToken(null);
    setAuthStatus('unauthenticated');
    setIsSocketConnected(false);
    toast.error(message);
  }, []);

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
      if (error?.response?.status === 401) {
        forceRelogin();
        return;
      }

      console.error('Panel ma`lumotlarini olishda tarmoq xatosi', error);
    }
  }, [applyDashboardPayload, forceRelogin]);

  const installApp = useCallback(async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;

    if (choice?.outcome === 'accepted') {
      toast.success('Ilova o`rnatilishi boshlandi');
    }

    setDeferredInstallPrompt(null);
    setCanInstall(false);
  }, [deferredInstallPrompt]);

  const handleLogin = useCallback(async ({ login, password }) => {
    const toastId = toast.loading('Kirish tekshirilmoqda...');
    setIsLoginLoading(true);

    try {
      const response = await api.post('/auth/login', {
        login: login.trim(),
        password,
      });

      const nextToken = response?.data?.token;
      if (!nextToken) {
        throw new Error('Token is missing in response');
      }

      storeAuthToken(nextToken);
      setAuthToken(nextToken);
      setAuthStatus('authenticated');
      toast.success('Muvaffaqiyatli kirildi', { id: toastId });
    } catch (error) {
      const serverMessage = error?.response?.data?.error;
      const errorText = serverMessage
        ? localizeServerError(serverMessage)
        : 'Kirishda xatolik yuz berdi';
      toast.error(errorText, { id: toastId });
      setAuthStatus('unauthenticated');
    } finally {
      setIsLoginLoading(false);
    }
  }, []);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
      setCanInstall(true);
    };

    const handleInstalled = () => {
      setDeferredInstallPrompt(null);
      setCanInstall(false);
      toast.success('Ilova muvaffaqiyatli o`rnatildi');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      setAuthStatus('unauthenticated');
      return;
    }

    let isCancelled = false;
    setAuthStatus('checking');

    api
      .get('/auth/me')
      .then(() => {
        if (!isCancelled) {
          setAuthStatus('authenticated');
        }
      })
      .catch(() => {
        if (!isCancelled) {
          clearStoredAuthToken();
          setAuthToken(null);
          setAuthStatus('unauthenticated');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !authToken) {
      return;
    }

    const initialFetchTimeout = setTimeout(() => {
      fetchData();
    }, 0);

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: authToken,
      },
    });

    const handleConnect = () => setIsSocketConnected(true);
    const handleDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('dashboard:update', applyDashboardPayload);
    socket.on('connect_error', (error) => {
      setIsSocketConnected(false);
      if (error?.message === 'Unauthorized') {
        forceRelogin();
        return;
      }
      console.error('Socket ulanishida xato', error);
    });

    const fallbackInterval = setInterval(() => {
      fetchData();
    }, 15000);

    return () => {
      clearTimeout(initialFetchTimeout);
      clearInterval(fallbackInterval);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('dashboard:update', applyDashboardPayload);
      socket.disconnect();
    };
  }, [authStatus, authToken, applyDashboardPayload, fetchData, forceRelogin]);

  const togglePump = async (action) => {
    const toastId = toast.loading('Buyruq yuborilmoqda...');

    try {
      await api.post('/pump', { action });
      toast.success(`Nasos ${action === 'ON' ? 'yoqildi' : 'o`chirildi'}`, { id: toastId });
      fetchData();
    } catch (error) {
      if (error?.response?.status === 401) {
        forceRelogin();
        toast.dismiss(toastId);
        return;
      }

      const serverMessage = error?.response?.data?.error;
      const errorText = serverMessage
        ? localizeServerError(serverMessage)
        : 'Server bilan aloqa xatosi';
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
      toast.success('Sozlamalar saqlandi');
    } catch (error) {
      if (error?.response?.status === 401) {
        forceRelogin();
        return;
      }

      const serverMessage = error?.response?.data?.error;
      const errorText = serverMessage
        ? localizeServerError(serverMessage)
        : 'Sozlamalarni saqlashda xato';
      toast.error(errorText);
      fetchData();
    }
  };

  const currentMoisture = data.length > 0 ? data[data.length - 1].moisture : 0;
  const isDry = currentMoisture < settings.moistureThreshold;

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '14px',
            border: '1px solid #dce7e4',
            fontWeight: 700,
          },
        }}
      />

      {authStatus !== 'authenticated' ? (
        <Login onSubmit={handleLogin} isLoading={isLoginLoading || authStatus === 'checking'} />
      ) : (
        <div className="app-shell min-h-screen p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            <Header
              isSocketConnected={isSocketConnected}
              isOnline={isOnline}
              canInstall={canInstall}
              onInstall={installApp}
              pumpState={pumpState}
              onLogout={() => logout(true, 'Hisobdan chiqdingiz')}
            />

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Moisture
                currentMoisture={currentMoisture}
                isDry={isDry}
                pumpState={pumpState}
                threshold={settings.moistureThreshold}
              />
              <Controls
                settings={settings}
                updateSettings={updateSettings}
                togglePump={togglePump}
                pumpState={pumpState}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Chart data={data} />
              <Logs logs={logs} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
