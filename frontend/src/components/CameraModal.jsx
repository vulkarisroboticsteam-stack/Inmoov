import { useEffect } from 'react';
import '../styles/CameraModal.css';
import { IconClose, IconCamera } from './Icons';

export default function CameraModal({ cameraList, cameraIndex, onCameraChange, onClose }) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fallbackCameras = ["Câmera 0", "Câmera 1", "Câmera 2", "Câmera 3", "Câmera 4"];
  const listToRender = cameraList && cameraList.length > 0 ? cameraList : fallbackCameras;

  return (
    <div className="camera-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="camera-modal-title">
      <div className="camera-modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="camera-modal-header">
          <div className="camera-modal-title-wrapper">
            <IconCamera size={20} className="camera-modal-icon-title" />
            <h2 id="camera-modal-title" className="camera-modal-title">Dispositivos de Vídeo</h2>
          </div>
          <button className="camera-modal-close-btn" onClick={onClose} aria-label="Fechar">
            <IconClose size={20} />
          </button>
        </div>

        <div className="camera-modal-divider"></div>

        <div className="camera-modal-body" role="list">
          {listToRender.map((camName, idx) => {
            const isActive = cameraIndex === idx;
            return (
              <button
                key={idx}
                role="listitem"
                className={`camera-option-btn ${isActive ? 'camera-option-btn--active' : ''}`}
                onClick={() => {
                  onCameraChange(idx);
                  onClose();
                }}
              >
                <div className="camera-option-info">
                  <IconCamera size={18} className="camera-option-icon" />
                  <span className="camera-option-name">{camName}</span>
                </div>
                {isActive && (
                  <div className="camera-option-badge">
                    <span>ATIVO</span>
                  </div>
                )}
                <div className="camera-option-hover-glow"></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
