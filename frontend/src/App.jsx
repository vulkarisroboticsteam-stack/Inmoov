import React, { useState, useEffect, useRef } from 'react';
import './index.css';

function App() {
  const [frame, setFrame] = useState(null);
  const [data, setData] = useState({
    fps: 0,
    ble_connected: false,
    fingers_str: "",
    status: "WAITING",
    hand_type: ""
  });

  const ws = useRef(null);

  useEffect(() => {
    const connectWs = () => {
      ws.current = new WebSocket('ws://localhost:8000/ws');
      
      ws.current.onopen = () => {
        console.log("WebSocket Conectado");
      };

      ws.current.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.frame) {
          setFrame(`data:image/jpeg;base64,${payload.frame}`);
        }
        setData({
          fps: payload.fps,
          ble_connected: payload.ble_connected,
          fingers_str: payload.fingers_str,
          status: payload.status,
          hand_type: payload.hand_type
        });
      };

      ws.current.onclose = () => {
        console.log("WebSocket Desconectado, tentando reconectar...");
        setTimeout(connectWs, 2000);
      };
    };

    connectWs();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const getFingerState = (index) => {
    if (!data.fingers_str || data.fingers_str.length < 6) return false;
    return data.fingers_str[index + 1] === '1';
  };

  const fingers = [
    { name: 'Polegar', active: getFingerState(0) },
    { name: 'Indicador', active: getFingerState(1) },
    { name: 'Médio', active: getFingerState(2) },
    { name: 'Anelar', active: getFingerState(3) },
    { name: 'Mínimo', active: getFingerState(4) },
  ];

  return (
    <div className="app-container">
      <div className="video-section">
        {frame ? (
          <img src={frame} alt="Video Feed" className="video-feed" />
        ) : (
          <div className="video-overlay-text">AGUARDANDO SINAL DA CÂMERA...</div>
        )}
      </div>

      <div className="status-panel">
        <div className="header">
          <div className="brand-section">
            <img src="/logo_vulkaris.png" alt="Logo Vulkaris" className="brand-logo" />
            <div className="brand-titles">
              <h1>INMOOV HUB</h1>
              <p>Painel de Controle Biométrico</p>
            </div>
          </div>
          <a href="https://instagram.com/vulkaris_robotics" target="_blank" rel="noopener noreferrer" className="ig-link" aria-label="Instagram">
            <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </a>
        </div>

        <div className="status-card">
          <div className="status-header">
            <span className="status-title">Sistema BLE</span>
            <div className={`ble-badge ${data.ble_connected ? 'ble-connected' : 'ble-disconnected'}`}>
              {data.ble_connected ? 'CONECTADO' : 'DESCONECTADO'}
            </div>
          </div>
          <div className="status-header" style={{ marginBottom: 0, marginTop: '1rem' }}>
            <span className="status-title">Câmera FPS</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{data.fps}</span>
          </div>
        </div>

        <div className="status-card finger-tracking-card" style={{ flex: 1 }}>
          <div className="finger-tracking-header">
            <span className="status-title">Rastreamento de Dedos</span>
            {data.hand_type ? (
              <div className="hand-type-badge">
                MÃO {data.hand_type === 'Right' ? 'DIREITA' : 'ESQUERDA'} DETECTADA
              </div>
            ) : (
              <div style={{ height: '26px' }}></div>
            )}
          </div>
          <div className="finger-list" style={{ width: '100%' }}>
            {fingers.map((f, idx) => (
              <div key={idx} className={`finger-item ${f.active ? 'active' : 'inactive'}`}>
                <span className="finger-name">{f.name}</span>
                <span className="finger-state">{f.active ? 'LEVANTADO' : 'ABAIXADO'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="data-card">
          <div className="data-title">DADOS ENVIADOS (TX)</div>
          <div className={`data-value ${data.status === 'BLOCKED' ? 'blocked' : ''}`}>
            {data.status === 'BLOCKED' ? 'BLOQUEADO' : (data.fingers_str || '---')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
