import React from 'react';
import '../styles/StatusPanel.css';
import { IconInstagram, IconRefresh, IconClose } from './Icons';
import FingerTracking from './FingerTracking';
import CameraSelector from './CameraSelector';

export default function StatusPanel({
  data,
  fingers,
  cameraList,
  cameraIndex,
  onCameraChange,
  onReconnectBle,
  onDisconnectBle
}) {
  return (
    <aside className="status-panel">
      {/* HEADER */}
      <div className="panel-header">
        <div className="brand-section">
          <img src="/logo_vulkaris.png" alt="Logo" className="brand-logo" />
          <div className="brand-titles">
            <h1 className="gradient-text">INMOOV HUB</h1>
            <p>Painel de Controle Biométrico</p>
          </div>
        </div>
        <a href="https://instagram.com/vulkaris_robotics" target="_blank" rel="noopener noreferrer" className="ig-link" aria-label="Instagram Vulkaris">
          <IconInstagram size={24} />
        </a>
      </div>

      <div className="divider"></div>

      {/* BLE STATUS CARD */}
      <div className="glass-card status-card">
        <div className="status-row">
          <span className="status-label">Sistema BLE</span>
          <div className="ble-controls">
            <div className={`badge ble-badge ${data.ble_connected ? 'ble-connected' : data.ble_searching ? 'ble-searching' : 'ble-disconnected'}`}>
              <div className="ble-dot"></div>
              {data.ble_connected ? 'CONECTADO' : data.ble_searching ? 'PROCURANDO...' : 'DESCONECTADO'}
            </div>
            {!data.ble_connected && !data.ble_searching && (
              <button className="btn-icon" onClick={onReconnectBle} title="Tentar reconectar" aria-label="Reconectar">
                <IconRefresh size={18} />
              </button>
            )}
            {data.ble_connected && (
              <button className="btn-icon btn-danger" onClick={onDisconnectBle} title="Desconectar" aria-label="Desconectar">
                <IconClose size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="status-row mt-3">
          <span className="status-label">Câmera FPS</span>
          <span className="fps-value">{data.fps}</span>
        </div>
      </div>

      {/* FINGER TRACKING */}
      <FingerTracking data={data} fingers={fingers} />

      {/* TX DATA */}
      <div className="glass-card tx-card">
        <span className="status-label accent-label">Dados Enviados (TX)</span>
        <div className={`tx-value ${data.status === 'BLOCKED' ? 'tx-blocked' : ''}`}>
          {data.status === 'BLOCKED' ? 'BLOQUEADO' : (data.fingers_str || '---')}
        </div>
      </div>

      {/* CAMERA SELECTOR */}
      <CameraSelector 
        cameraList={cameraList} 
        cameraIndex={cameraIndex} 
        onCameraChange={onCameraChange} 
      />
    </aside>
  );
}
