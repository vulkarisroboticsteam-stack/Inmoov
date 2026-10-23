import { useEffect, useRef } from 'react';
import { IconClose } from './Icons';
import '../styles/MotionNameModal.css';

export default function MotionNameModal({
  name,
  onNameChange,
  onConfirm,
  onClose,
  error,
  eyebrow = 'Nova gravação',
  heading = 'Nomeie seu comando',
  description = 'Escolha um nome para identificar esta sequência na lista de comandos salvos.',
  confirmLabel = 'Começar gravação'
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'Enter' && event.target === inputRef.current) {
        event.preventDefault();
        if (name.trim()) onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [name, onClose, onConfirm]);

  return (
    <div
      className="motion-name-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="motion-name-modal glass-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="motion-name-modal-title"
      >
        <div className="motion-name-modal-header">
          <div>
            <span className="status-label">{eyebrow}</span>
            <h2 id="motion-name-modal-title">{heading}</h2>
          </div>
          <button
            type="button"
            className="motion-name-modal-close"
            onClick={onClose}
            aria-label="Fechar janela de nome"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="motion-name-modal-divider" aria-hidden="true"></div>

        <p className="motion-name-modal-description">
          {description}
        </p>

        <label className="motion-name-modal-field">
          <span>Nome do comando</span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Ex.: Saudação"
            maxLength={80}
            autoComplete="off"
          />
        </label>

        {error && <div className="motion-name-modal-error" role="alert">{error}</div>}

        <div className="motion-name-modal-actions">
          <button
            type="button"
            className="motion-name-modal-btn motion-name-modal-btn--cancel"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="motion-name-modal-btn motion-name-modal-btn--confirm"
            onClick={onConfirm}
            disabled={!name.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
