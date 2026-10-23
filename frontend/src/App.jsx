import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import './App.css';
import VideoFeed from './components/VideoFeed';
import StatusPanel from './components/StatusPanel';

function App() {
  const [frame, setFrame] = useState(null);
  const [data, setData] = useState({
    fps: 0,
    ble_connected: false,
    ble_searching: false,
    fingers_str: "",
    status: "WAITING",
    hand_type: "",
    ble_error: null,
    tx_command: "",
    motion_mode: "realtime",
    recording: false,
    recording_name: null,
    has_recording: false,
    recorded_count: 0,
    recorded_duration: 0,
    selected_motion_id: null,
    selected_motion_name: null
  });

  const [cameraIndex, setCameraIndex] = useState(0);
  const [cameraList, setCameraList] = useState([]);
  const [motionList, setMotionList] = useState([]);
  const [motionLoading, setMotionLoading] = useState(true);
  const [motionLoadError, setMotionLoadError] = useState(null);
  const [motionName, setMotionName] = useState('');
  const [motionError, setMotionError] = useState(null);

  const ws = useRef(null);

  const loadMotions = useCallback(async () => {
    setMotionLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/motions', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(json.motions)) {
        throw new Error('A biblioteca de movimentos não respondeu corretamente.');
      }
      setMotionList(json.motions);
      setMotionLoadError(null);
      return true;
    } catch (err) {
      console.error('Erro ao carregar movimentos:', err);
      setMotionLoadError('Não foi possível carregar os comandos salvos.');
      return false;
    } finally {
      setMotionLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/cameras');
        const json = await res.json();
        if (json.cameras) {
          setCameraList(json.cameras);
        }
      } catch (err) {
        console.error("Erro ao carregar câmeras:", err);
      }
    };
    fetchCameras();
    const initialMotionLoad = window.setTimeout(loadMotions, 0);
    return () => window.clearTimeout(initialMotionLoad);
  }, [loadMotions]);

  const handleCameraChange = async (indexOrEvent) => {
    const newIndex = typeof indexOrEvent === 'object' && indexOrEvent && indexOrEvent.target
      ? parseInt(indexOrEvent.target.value, 10)
      : parseInt(indexOrEvent, 10);

    setCameraIndex(newIndex);
    try {
      await fetch('http://localhost:8000/api/set_camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: newIndex })
      });
    } catch (err) {
      console.error("Erro ao mudar câmera:", err);
    }
  };

  const handleReconnectBle = async () => {
    try {
      await fetch('http://localhost:8000/api/reconnect_ble', { method: 'POST' });
    } catch (err) {
      console.error("Erro ao reconectar BLE:", err);
    }
  };

  const handleDisconnectBle = async () => {
    try {
      await fetch('http://localhost:8000/api/disconnect_ble', { method: 'POST' });
    } catch (err) {
      console.error("Erro ao desconectar BLE:", err);
    }
  };

  const handleResetPosition = async () => {
    try {
      await fetch('http://localhost:8000/api/reset_position', { method: 'POST' });
    } catch (err) {
      console.error("Erro ao resetar posição:", err);
    }
  };

  const handleMotionRequest = async (endpoint, options = {}) => {
    try {
      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || 'Não foi possível atualizar o movimento.');
      }
      await loadMotions();
      setMotionError(null);
      return body;
    } catch (err) {
      setMotionError(err.message);
      return null;
    }
  };

  const handleStartRecording = () => handleMotionRequest('/api/motion/record/start', {
    body: JSON.stringify({ name: motionName.trim() })
  });
  const handleStopRecording = () => handleMotionRequest('/api/motion/record/stop');
  const handleStartPlayback = () => handleMotionRequest('/api/motion/playback/start');
  const handleStopPlayback = () => handleMotionRequest('/api/motion/playback/stop');
  const handleSelectMotion = (motionId) => handleMotionRequest('/api/motion/select', {
    body: JSON.stringify({ motion_id: motionId })
  });
  const handleRenameMotion = (motionId, name) => handleMotionRequest(`/api/motion/${encodeURIComponent(motionId)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: name.trim() })
  });
  const handleDeleteMotion = (motionId) => handleMotionRequest(`/api/motion/${encodeURIComponent(motionId)}`, {
    method: 'DELETE'
  });
  const handleMotionModeChange = (mode) => handleMotionRequest('/api/motion/mode', {
    body: JSON.stringify({ mode })
  });

  useEffect(() => {
    const connectWs = () => {
      ws.current = new WebSocket('ws://localhost:8000/ws');
      
      ws.current.onopen = () => {
        console.log("WebSocket Conectado");
        loadMotions();
      };

      ws.current.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.frame) {
          setFrame(`data:image/jpeg;base64,${payload.frame}`);
        }
        setData({
          fps: payload.fps,
          ble_connected: payload.ble_connected,
          ble_searching: payload.ble_searching,
          fingers_str: payload.fingers_str,
          status: payload.status,
          hand_type: payload.hand_type,
          ble_error: payload.ble_error,
          tx_command: payload.tx_command || "",
          motion_mode: payload.motion_mode || "realtime",
          recording: Boolean(payload.recording),
          recording_name: payload.recording_name || null,
          has_recording: Boolean(payload.has_recording),
          recorded_count: payload.recorded_count || 0,
          recorded_duration: payload.recorded_duration || 0,
          selected_motion_id: payload.selected_motion_id || null,
          selected_motion_name: payload.selected_motion_name || null
        });
      };

      ws.current.onclose = () => {
        console.log("WebSocket Desconectado, tentando reconectar...");
        setTimeout(connectWs, 2000);
      };
    };

    connectWs();

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [loadMotions]);

  const getFingerState = (index) => {
    if (!data.fingers_str || data.fingers_str.length < 6) return false;
    return data.fingers_str[index + 1] === '1';
  };

  const getWristAngle = () => {
    if (!data.fingers_str || data.fingers_str.length < 10) return 90;
    const parts = data.fingers_str.split(',');
    if (parts.length > 1) {
      const angle = parseInt(parts[1], 10);
      return isNaN(angle) ? 90 : angle;
    }
    return 90;
  };

  const fingers = [
    { name: 'Polegar', active: getFingerState(0) },
    { name: 'Indicador', active: getFingerState(1) },
    { name: 'Médio', active: getFingerState(2) },
    { name: 'Anelar', active: getFingerState(3) },
    { name: 'Mínimo', active: getFingerState(4) },
  ];

  return (
    <>
      <div className="bg-orb-1" aria-hidden="true"></div>
      <div className="bg-orb-2" aria-hidden="true"></div>
      
      <div className="app-container">
        <VideoFeed frame={frame} />
        <StatusPanel 
          data={data}
          fingers={fingers}
          wristAngle={getWristAngle()}
          cameraList={cameraList}
          cameraIndex={cameraIndex}
          onCameraChange={handleCameraChange}
          onReconnectBle={handleReconnectBle}
          onDisconnectBle={handleDisconnectBle}
          onResetPosition={handleResetPosition}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onStartPlayback={handleStartPlayback}
          onStopPlayback={handleStopPlayback}
          onMotionModeChange={handleMotionModeChange}
          motionList={motionList}
          motionLoading={motionLoading}
          motionLoadError={motionLoadError}
          onReloadMotions={loadMotions}
          motionName={motionName}
          onMotionNameChange={setMotionName}
          onSelectMotion={handleSelectMotion}
          onRenameMotion={handleRenameMotion}
          onDeleteMotion={handleDeleteMotion}
          onClearMotionError={() => setMotionError(null)}
          motionError={motionError}
        />
      </div>
    </>
  );
}

export default App;
