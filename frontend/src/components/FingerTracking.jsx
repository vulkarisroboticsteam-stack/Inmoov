import '../styles/FingerTracking.css';

export default function FingerTracking({ data, fingers, wristAngle = 90 }) {
  // Calculate dynamic path for active arc starting from center (90º) outwards
  const theta = (wristAngle * Math.PI) / 180;
  const targetX = 50 - 40 * Math.cos(theta);
  const targetY = 50 - 40 * Math.sin(theta);
  const sweepFlag = wristAngle >= 90 ? 1 : 0;
  const activePath = wristAngle === 90 
    ? "" 
    : `M 50 10 A 40 40 0 0 ${sweepFlag} ${targetX.toFixed(2)} ${targetY.toFixed(2)}`;

  return (
    <div className="finger-tracking-card glass-card">
      <div className="tracking-header">
        <span className="tracking-title">Rastreamento de Dedos</span>
        {data.hand_type ? (
          <div className="badge tracking-badge">
            MÃO {data.hand_type === 'Right' ? 'DIREITA' : 'ESQUERDA'}
          </div>
        ) : (
          <div className="badge tracking-badge warning-badge">
            MÃO NÃO DETECTADA
          </div>
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

      {/* WRIST TRACKING (GAUGE STYLE) */}
      <div className="wrist-gauge-container">
        <span className="wrist-title">Movimento do Pulso</span>
        
        <div className="wrist-gauge-wrapper">
          <svg className="wrist-gauge" viewBox="0 0 100 55">
            <defs>
              <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
            </defs>
            {/* Background Arc */}
            <path 
              d="M 10 50 A 40 40 0 0 1 90 50" 
              fill="none" 
              stroke="rgba(255, 255, 255, 0.05)" 
              strokeWidth="6" 
              strokeLinecap="round" 
            />
            {/* Center tick (90º) */}
            <line x1="50" y1="10" x2="50" y2="15" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.5" />
            
            {/* Active Arc */}
            {activePath && (
              <path 
                d={activePath} 
                fill="none" 
                stroke="url(#gauge-grad)" 
                strokeWidth="6" 
                strokeLinecap="round" 
              />
            )}
            
            {/* Needle pointer */}
            <g transform={`rotate(${wristAngle - 90}, 50, 50)`} style={{ transition: 'transform 0.1s ease-out' }}>
              <line x1="50" y1="26" x2="50" y2="12" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </svg>
          
          <div className="wrist-gauge-value">
            <span className="value-num">{wristAngle}º</span>
            <span className="value-label">
              {Math.abs(wristAngle - 90) < 25 ? 'PALMA' : 'DORSO'}
            </span>
          </div>
        </div>

        <div className="wrist-gauge-labels">
          <span>Dorso (0º)</span>
          <span>Palma (90º)</span>
          <span>Dorso (180º)</span>
        </div>
      </div>
    </div>
  );
}
