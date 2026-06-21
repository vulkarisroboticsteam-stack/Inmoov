import React from 'react';
import '../styles/VideoFeed.css';

export default function VideoFeed({ frame }) {
  return (
    <div className="video-section glass-card">
      {frame ? (
        <>
          <img src={frame} alt="Video Feed" className="video-feed" />
          <div className="scan-line-overlay"></div>
        </>
      ) : (
        <div className="video-overlay-text">
          <span className="gradient-text">AGUARDANDO SINAL DA CÂMERA...</span>
        </div>
      )}
      
      {/* Elementos decorativos (hud) */}
      <div className="hud-corner hud-tl" aria-hidden="true"></div>
      <div className="hud-corner hud-tr" aria-hidden="true"></div>
      <div className="hud-corner hud-bl" aria-hidden="true"></div>
      <div className="hud-corner hud-br" aria-hidden="true"></div>
    </div>
  );
}
