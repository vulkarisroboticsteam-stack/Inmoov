import React from 'react';
import '../styles/FingerTracking.css';

export default function FingerTracking({ data, fingers }) {
  return (
    <div className="finger-tracking-card glass-card">
      <div className="tracking-header">
        <span className="tracking-title">Rastreamento de Dedos</span>
        {data.hand_type ? (
          <div className="badge tracking-badge">
            MÃO {data.hand_type === 'Right' ? 'DIREITA' : 'ESQUERDA'}
          </div>
        ) : (
          <div style={{ height: '26px' }}></div>
        )}
      </div>

      <div className="finger-list" role="list">
        {fingers.map((f, idx) => (
          <div
            key={idx}
            className={`finger-item ${f.active ? 'active' : 'inactive'}`}
            role="listitem"
            style={{ '--finger-delay': `${idx * 0.1}s` }}
          >
            <span className="finger-name">{f.name}</span>
            <span className="finger-state">
              {f.active ? 'LEVANTADO' : 'ABAIXADO'}
            </span>
            <div className="finger-glow-bg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
