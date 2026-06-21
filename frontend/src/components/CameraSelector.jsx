import React from 'react';
import '../styles/CameraSelector.css';

export default function CameraSelector({ cameraList, cameraIndex, onCameraChange }) {
  return (
    <div className="camera-selector glass-card">
      <label htmlFor="camera-select" className="camera-label">Câmera</label>
      <div className="select-wrapper">
        <select id="camera-select" value={cameraIndex} onChange={onCameraChange}>
          {cameraList.length > 0 ? (
            cameraList.map((camName, idx) => (
              <option key={idx} value={idx}>{camName}</option>
            ))
          ) : (
            <>
              <option value={0}>Câmera 0</option>
              <option value={1}>Câmera 1</option>
              <option value={2}>Câmera 2</option>
              <option value={3}>Câmera 3</option>
              <option value={4}>Câmera 4</option>
            </>
          )}
        </select>
      </div>
    </div>
  );
}
