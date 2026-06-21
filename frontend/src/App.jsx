import React, { useState, useEffect, useRef } from 'react';
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
    hand_type: ""
  });

  const [cameraIndex, setCameraIndex] = useState(0);
  const [cameraList, setCameraList] = useState([]);

  const ws = useRef(null);

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
  }, []);

  const handleCameraChange = async (e) => {
    const newIndex = parseInt(e.target.value, 10);
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

  useEffect(() => {
    const connectWs = () => {
      ws.current = new WebSocket('ws://localhost:8000/ws');
      
      ws.current.onopen = () => console.log("WebSocket Conectado");

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
          hand_type: payload.hand_type
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
  }, []);

  const getFingerState = (index) => {
    if (!data.fingers_str || data.fingers_str.length < 6) return false;
    return data.fingers_str[index + 1] === '1';
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
          cameraList={cameraList}
          cameraIndex={cameraIndex}
          onCameraChange={handleCameraChange}
          onReconnectBle={handleReconnectBle}
          onDisconnectBle={handleDisconnectBle}
        />
      </div>
    </>
  );
}

export default App;
