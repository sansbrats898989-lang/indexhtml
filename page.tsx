'use client';

import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';

// Типы состояний плеера
type PlayerStatus = 'stopped' | 'playing' | 'paused';
type Orientation = 'portrait' | 'landscape';

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'event' | 'error';
  message: string;
}

export default function PlayableTesterPage() {
  const [status, setStatus] = useState<PlayerStatus>('stopped');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [playableSrc, setPlayableSrc] = useState<string>('/index.html');
  const [fileName, setFileName] = useState<string>('index.html (default)');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devicePreset, setDevicePreset] = useState<'iphone' | 'android' | 'ipad'>('iphone');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Добавление записи в консоль логов
  const addLog = (message: string, type: 'info' | 'event' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ id: Math.random().toString(36).substring(2, 9), time, type, message }, ...prev]);
  };

  // Перехват сообщений (postMessage) от плейебла внутри iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && (data.event || data.type || data.action)) {
          const eventName = data.event || data.type || data.action;
          addLog(`[Iframe Event] ${eventName}: ${JSON.stringify(data)}`, 'event');
        }
      } catch {
        // Если пришла просто строка
        if (typeof event.data === 'string' && event.data.length < 100) {
          addLog(`[Iframe Message] ${event.data}`, 'event');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Отправка postMessage внутри iframe (поддержка стандартов MRAID / Playable)
  const sendIframeMessage = (action: string, payload: Record<string, unknown> = {}) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const message = { action, event: action, ...payload };
      iframeRef.current.contentWindow.postMessage(message, '*');
      addLog(`[Host -> Iframe] Sent command: ${action}`, 'info');
    }
  };

  // Старт игры
  const handlePlay = () => {
    if (status === 'stopped') {
      setIframeKey((prev) => prev + 1);
      setStatus('playing');
      addLog('Playable started', 'info');
    } else if (status === 'paused') {
      setStatus('playing');
      sendIframeMessage('resume');
      sendIframeMessage('mraid:viewableChange', { isViewable: true });
      addLog('Playable resumed from pause', 'info');
    }
  };

  // Поставить на паузу
  const handlePause = () => {
    if (status === 'playing') {
      setStatus('paused');
      sendIframeMessage('pause');
      sendIframeMessage('mraid:viewableChange', { isViewable: false });
      addLog('Playable paused', 'info');
    }
  };

  // Перезапуск (Полный сброс памяти GPU и Canvas)
  const handleRestart = () => {
    addLog('Reloading iframe (Full Reset)...', 'info');
    setStatus('playing');
    setIframeKey((prev) => prev + 1);
  };

  // Остановка
  const handleStop = () => {
    setStatus('stopped');
    addLog('Playable stopped and unmounted', 'info');
  };

  // Загрузка локального файла HTML
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      addLog('Please upload a valid .html file!', 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPlayableSrc(objectUrl);
    setFileName(file.name);
    setStatus('stopped');
    setIframeKey((prev) => prev + 1);
    addLog(`Loaded local file: ${file.name}`, 'info');
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Размеры контейнера под пресеты
  const getDeviceDimensions = () => {
    let width = 375;
    let height = 812;

    if (devicePreset === 'android') {
      width = 360;
      height = 780;
    } else if (devicePreset === 'ipad') {
      width = 768;
      height = 1024;
    }

    return orientation === 'portrait'
      ? { width: `${width}px`, height: `${height}px` }
      : { width: `${height}px`, height: `${width}px` };
  };

  const dimensions = getDeviceDimensions();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 flex flex-col items-center">
      {/* Шапка */}
      <header className="w-full max-w-6xl mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Playable Ad Tester & Debugger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Тестирование, управление жизненным циклом (Play/Pause/Restart) и эмуляция окружения.
          </p>
        </div>

        {/* Загрузчик файла */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex items-center gap-3 bg-slate-900 border border-dashed border-slate-700 hover:border-blue-500 rounded-lg px-4 py-2 transition cursor-pointer"
        >
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <label className="cursor-pointer text-xs">
            <span className="font-semibold text-blue-400">Выберите index.html</span> или перетащите сюда
            <input type="file" accept=".html,.htm" onChange={handleInputChange} className="hidden" />
          </label>
        </div>
      </header>

      {/* Основная сетка */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Левая панель: Панель управления и Эмулятор устройства */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          {/* Панель кнопок управления */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {status !== 'playing' ? (
                <button
                  onClick={handlePlay}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-sm rounded-lg shadow transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {status === 'paused' ? 'Возобновить' : 'Запустить'}
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-medium text-sm rounded-lg shadow transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  Пауза
                </button>
              )}

              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-medium text-sm rounded-lg border border-slate-700 transition"
                title="Полный перезапуск"
              >
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Перезапустить
              </button>

              <button
                onClick={handleStop}
                disabled={status === 'stopped'}
                className="flex items-center gap-2 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 font-medium text-sm rounded-lg border border-rose-800/50 transition"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
                Остановить
              </button>
            </div>

            {/* Статус-бейдж */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Статус:</span>
              <span
                className={`px-2.5 py-1 rounded-full font-mono font-semibold uppercase tracking-wider ${
                  status === 'playing'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : status === 'paused'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {status}
              </span>
            </div>
          </div>

          {/* Настройки эмуляции экрана */}
          <div className="w-full flex items-center justify-between mb-4 px-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Пресет:</span>
              <select
                value={devicePreset}
                onChange={(e) => setDevicePreset(e.target.value as 'iphone' | 'android' | 'ipad')}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
              >
                <option value="iphone">iPhone (375x812)</option>
                <option value="android">Android (360x780)</option>
                <option value="ipad">iPad (768x1024)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setOrientation('portrait')}
                className={`px-3 py-1 rounded transition ${
                  orientation === 'portrait' ? 'bg-blue-600 text-white font-medium' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Portrait (9:16)
              </button>
              <button
                onClick={() => setOrientation('landscape')}
                className={`px-3 py-1 rounded transition ${
                  orientation === 'landscape' ? 'bg-blue-600 text-white font-medium' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Landscape (16:9)
              </button>
            </div>
          </div>

          {/* Корпус устройства / Экран */}
          <div className="relative flex justify-center items-center p-4 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl transition-all duration-300">
            <div
              style={{ width: dimensions.width, height: dimensions.height }}
              className="relative bg-black rounded-xl overflow-hidden border-4 border-slate-800 shadow-inner transition-all duration-300"
            >
              {/* Игра запущены / остановлена */}
              {status !== 'stopped' ? (
                <>
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    src={playableSrc}
                    title="Playable Preview"
                    className="w-full h-full border-0 select-none"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                  />

                  {/* Слой Паузы (Затемнение и блокировка кликов) */}
                  {status === 'paused' && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20 transition-all">
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold tracking-wide text-amber-200">НА ПАУЗЕ</span>
                      <p className="text-xs text-slate-400 px-6 text-center">
                        Ввод заблокирован. Аудио и анимация приостановлены.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* Заглушка, когда игра остановлена */
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-slate-500">
                  <svg className="w-12 h-12 mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-400">Playable остановлен</p>
                  <p className="text-xs mt-1 text-slate-600">Нажмите «Запустить» для начала игры</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Правая панель: Инфо о файле и Консоль событий */}
        <div className="lg:col-span-5 flex flex-col gap-6 w-full">
          {/* Информация о текущем файле */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Активный файл
            </h3>
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 truncate">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{fileName}</span>
            </div>
          </div>

          {/* Консоль логов событий (postMessage / MRAID) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[480px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Лог событий (postMessage)
              </h3>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                Очистить
              </button>
            </div>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-y-auto flex flex-col gap-2">
              {logs.length === 0 ? (
                <div className="text-slate-600 text-center my-auto italic">
                  События еще не поступали...
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded border leading-relaxed break-all ${
                      log.type === 'event'
                        ? 'bg-blue-950/30 border-blue-800/40 text-blue-300'
                        : log.type === 'error'
                        ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 mr-2">[{log.time}]</span>
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
