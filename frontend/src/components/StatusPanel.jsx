import { useState } from 'react';
import '../styles/StatusPanel.css';
import { IconInstagram, IconRefresh, IconClose, IconCamera, IconReset } from './Icons';
import FingerTracking from './FingerTracking';
import CameraModal from './CameraModal';
import MotionNameModal from './MotionNameModal';
import MotionDeleteModal from './MotionDeleteModal';
import MotionDropdown from './MotionDropdown';

export default function StatusPanel({
  data,
  fingers,
  wristAngle,
  cameraList,
  cameraIndex,
  onCameraChange,
  onReconnectBle,
  onDisconnectBle,
  onResetPosition,
  onStartRecording,
  onStopRecording,
  onStartPlayback,
  onStopPlayback,
  onMotionModeChange,
  motionList,
  motionLoading,
  motionLoadError,
  onReloadMotions,
  motionName,
  onMotionNameChange,
  onSelectMotion,
  onRenameMotion,
  onDeleteMotion,
  onClearMotionError,
  motionError
}) {
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isMotionNameModalOpen, setIsMotionNameModalOpen] = useState(false);
  const [isMotionDeleteModalOpen, setIsMotionDeleteModalOpen] = useState(false);
  const [motionModalMode, setMotionModalMode] = useState('create');
  const selectedMotion = motionList.find((motion) => motion.id === data.selected_motion_id);

  const handleConfirmMotionModal = async () => {
    const result = motionModalMode === 'rename'
      ? await onRenameMotion(data.selected_motion_id, motionName)
      : await onStartRecording();
    if (result) setIsMotionNameModalOpen(false);
  };

  const handleOpenMotionNameModal = () => {
    onClearMotionError();
    setMotionModalMode('create');
    onMotionNameChange('');
    setIsMotionNameModalOpen(true);
  };

  const handleOpenRenameModal = () => {
    if (!data.selected_motion_id) return;
    onClearMotionError();
    setMotionModalMode('rename');
    onMotionNameChange(data.selected_motion_name || '');
    setIsMotionNameModalOpen(true);
  };

  const handleOpenDeleteModal = () => {
    if (!selectedMotion) return;
    onClearMotionError();
    setIsMotionDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedMotion) return null;
    const result = await onDeleteMotion(selectedMotion.id);
    if (result) setIsMotionDeleteModalOpen(false);
    return result;
  };

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

      {/* MOTION RECORDING / PLAYBACK */}
      <div className={`glass-card motion-card ${data.motion_mode === 'recorded' ? 'motion-card--recorded' : ''}`}>
        <div className="motion-card-header">
          <div>
            <span className="status-label">Controle de Movimento</span>
            <p className="motion-subtitle">
              {data.recording
                ? 'Gravando o movimento da câmera'
                : data.motion_mode === 'recorded'
                  ? 'Repetindo a sequência gravada'
                  : 'Controle pela mão em tempo real'}
            </p>
          </div>
          <span className={`motion-status-dot ${data.recording ? 'motion-status-dot--recording' : ''}`}></span>
        </div>

        <div className="motion-mode-toggle" role="group" aria-label="Modo de controle">
          <button
            type="button"
            className={`motion-mode-btn ${data.motion_mode === 'realtime' ? 'motion-mode-btn--active' : ''}`}
            onClick={() => onMotionModeChange('realtime')}
          >
            Ao vivo
          </button>
          <button
            type="button"
            className={`motion-mode-btn ${data.motion_mode === 'recorded' ? 'motion-mode-btn--active motion-mode-btn--recorded' : ''}`}
            onClick={() => onMotionModeChange('recorded')}
            disabled={data.recording || !data.has_recording}
          >
            Gravado
          </button>
        </div>

        <div className="motion-meta">
          <span>{motionLoading
            ? 'Carregando comandos salvos...'
            : data.has_recording
            ? `${Number(data.recorded_duration || 0).toFixed(1)} s gravados`
            : motionList.length > 0
              ? `${motionList.length} comando(s) salvo(s) — selecione um`
              : 'Nenhum movimento salvo'}</span>
          {data.has_recording && <span>{data.recorded_count} poses</span>}
        </div>

        <div className="motion-selector">
          <span className="motion-selector-label">Comando salvo</span>
          <MotionDropdown
            motionList={motionList}
            value={data.selected_motion_id || ''}
            onSelect={onSelectMotion}
            loading={motionLoading}
            disabled={data.recording || motionLoading || motionList.length === 0}
          />
          <div className="motion-crud-actions">
            <button
              type="button"
              className="motion-crud-btn"
              onClick={handleOpenRenameModal}
              disabled={data.recording || !data.selected_motion_id}
            >
              Renomear
            </button>
            <button
              type="button"
              className="motion-crud-btn motion-crud-btn--danger"
              onClick={handleOpenDeleteModal}
              disabled={data.recording || !data.selected_motion_id}
            >
              Excluir
            </button>
          </div>
        </div>

        {motionLoadError && (
          <div className="motion-library-error" role="alert">
            <span>{motionLoadError}</span>
            <button type="button" onClick={onReloadMotions}>Tentar novamente</button>
          </div>
        )}

        <div className="motion-actions">
          <button
            type="button"
            className={`motion-action-btn ${data.recording ? 'motion-action-btn--stop' : 'motion-action-btn--record'}`}
            onClick={data.recording ? onStopRecording : handleOpenMotionNameModal}
          >
            <span className="motion-action-icon">{data.recording ? '■' : '●'}</span>
            {data.recording ? 'Parar gravação' : 'Gravar movimento'}
          </button>
          <button
            type="button"
            className="motion-action-btn motion-action-btn--play"
            onClick={data.motion_mode === 'recorded' ? onStopPlayback : onStartPlayback}
            disabled={data.recording || !data.has_recording}
          >
            <span className="motion-action-icon">{data.motion_mode === 'recorded' ? '■' : '▶'}</span>
            {data.motion_mode === 'recorded' ? 'Parar repetição' : 'Repetir movimento'}
          </button>
        </div>

        {motionError && <div className="motion-error">{motionError}</div>}
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
        <div className={`tx-value ${data.status === 'BLOCKED' && data.motion_mode === 'realtime' ? 'tx-blocked' : ''}`}>
          {data.status === 'BLOCKED' && data.motion_mode === 'realtime' ? 'BLOQUEADO' : (data.tx_command || data.fingers_str || '---')}
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

      {isMotionNameModalOpen && (
        <MotionNameModal
          name={motionName}
          onNameChange={onMotionNameChange}
          onConfirm={handleConfirmMotionModal}
          onClose={() => setIsMotionNameModalOpen(false)}
          eyebrow={motionModalMode === 'rename' ? 'Editar comando' : 'Nova gravação'}
          heading={motionModalMode === 'rename' ? 'Renomeie seu comando' : 'Nomeie seu comando'}
          description={motionModalMode === 'rename'
            ? 'Atualize o nome usado para encontrar esta sequência na biblioteca.'
            : 'Escolha um nome para identificar esta sequência na lista de comandos salvos.'}
          confirmLabel={motionModalMode === 'rename' ? 'Salvar nome' : 'Começar gravação'}
          error={motionError}
        />
      )}

      {isMotionDeleteModalOpen && selectedMotion && (
        <MotionDeleteModal
          name={selectedMotion.name}
          onConfirm={handleConfirmDelete}
          onClose={() => setIsMotionDeleteModalOpen(false)}
          error={motionError}
        />
      )}
    </aside>
  );
}
