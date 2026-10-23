import { useEffect, useRef, useState } from 'react';
import { IconClose } from './Icons';
import '../styles/MotionDeleteModal.css';

export default function MotionDeleteModal({ name, onConfirm, onClose, error }) {
  const cancelRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const result = await onConfirm();
    if (!result) setIsSubmitting(false);
  };

  return (
    <div
      className="motion-delete-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
      role="presentation"
    >
      <div
        className="motion-delete-modal glass-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="motion-delete-modal-title"
        aria-describedby="motion-delete-modal-description"
      >
        <div className="motion-delete-modal-header">
          <h2 id="motion-delete-modal-title">Excluir comando?</h2>
          <button
            type="button"
            className="motion-delete-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar janela de exclusão"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="motion-delete-modal-divider" aria-hidden="true"></div>

        <p id="motion-delete-modal-description" className="motion-delete-modal-description">
          O comando <strong>{name}</strong> e o arquivo <strong>.txt</strong> correspondente serão removidos da biblioteca.
          Essa ação não pode ser desfeita.
        </p>

        {error && <div className="motion-delete-modal-error" role="alert">{error}</div>}

        <div className="motion-delete-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="motion-delete-modal-btn motion-delete-modal-btn--cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="motion-delete-modal-btn motion-delete-modal-btn--confirm"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Excluindo...' : 'Excluir comando'}
          </button>
        </div>
      </div>
    </div>
  );
}
