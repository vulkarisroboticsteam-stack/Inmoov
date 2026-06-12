import React, { useState, useEffect, useRef } from 'react';
import './index.css';

function App() {
  const [frame, setFrame] = useState(null);
  const [data, setData] = useState({
    fps: 0,
    ble_connected: false,
    fingers_str: "",
    status: "WAITING"
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
          status: payload.status
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
          <h1>INMOOV HUB</h1>
          <p>Painel de Controle Biométrico</p>
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

        <div className="status-card" style={{ flex: 1 }}>
          <div className="status-header">
            <span className="status-title">Rastreamento de Dedos</span>
          </div>
          <div className="finger-list">
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
