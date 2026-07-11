import { useState } from 'react';
import '../styles/StatusPanel.css';
import { IconInstagram, IconRefresh, IconClose, IconCamera, IconReset } from './Icons';
import FingerTracking from './FingerTracking';
import CameraModal from './CameraModal';

export default function StatusPanel({
  data,
  fingers,
  wristAngle,
  cameraList,
  cameraIndex,
  onCameraChange,
  onReconnectBle,
  onDisconnectBle,
  onResetPosition
}) {
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

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
        <div className="header-actions">
          <button 
            className="camera-btn" 
            onClick={() => setIsCameraModalOpen(true)} 
            title="Selecionar dispositivo de vídeo" 
            aria-label="Câmera"
          >
            <IconCamera size={20} />
          </button>
          <a href="https://instagram.com/vulkaris_robotics" target="_blank" rel="noopener noreferrer" className="ig-link" aria-label="Instagram Vulkaris">
            <IconInstagram size={20} />
          </a>
        </div>
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

        {data.ble_error && (
          <div className="ble-error-box">
            <strong>Erro BLE:</strong> {data.ble_error.includes("Bluetooth radio is not powered on") || data.ble_error.includes("POWERED_OFF")
              ? "O Bluetooth está desativado no Windows. Ative o Bluetooth nas configurações do seu computador e tente reconectar."
              : data.ble_error}
          </div>
        )}

        <div className="status-row mt-3">
          <span className="status-label">Câmera FPS</span>
          <span className="fps-value">{data.fps}</span>
        </div>
      </div>

      {/* FINGER TRACKING */}
      <FingerTracking data={data} fingers={fingers} wristAngle={wristAngle} />

      {/* RESET BUTTON */}
      <button 
        className="btn-reset-initial" 
        onClick={onResetPosition}
        title="Resetar para a posição inicial (todos os dedos abaixados e o pulso em 90º)"
      >
        <IconReset size={18} />
        <span>Resetar Mão</span>
      </button>

      {/* TX DATA */}
      <div className="glass-card tx-card">
        <span className="status-label accent-label">Dados Enviados (TX)</span>
        <div className={`tx-value ${data.status === 'BLOCKED' ? 'tx-blocked' : ''}`}>
          {data.status === 'BLOCKED' ? 'BLOQUEADO' : (data.fingers_str || '---')}
        </div>
      </div>

      {/* CAMERA SELECTOR POPUP MODAL */}
      {isCameraModalOpen && (
        <CameraModal 
          cameraList={cameraList} 
          cameraIndex={cameraIndex} 
          onCameraChange={onCameraChange} 
          onClose={() => setIsCameraModalOpen(false)} 
        />
      )}
    </aside>
  );
}
