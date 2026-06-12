import sys
sys.coinit_flags = 0  # força MTA no Windows antes de qualquer lib gráfica

import os
import time
import asyncio
import base64
import json
import cv2
import cvzone
from cvzone.HandTrackingModule import HandDetector
from bleak import BleakScanner, BleakClient
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from bleak.backends.winrt.util import uninitialize_sta
    uninitialize_sta()
except Exception:
    pass

DEVICE_NAME = "InMoov_Hand"
RX_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

gestos_bloqueados = ["$00100", "$10100"]

# Estado Global
class AppState:
    ble_connected = False
    ble_client = None
    prev_fingers_str = ""
    last_send_time = 0
    send_interval = 0.05
    current_frame = None
    current_fingers = ""
    current_status = "WAITING"
    fps = 0
    fingers_to_send = None

state = AppState()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def notificacao_ble(sender, data):
    try:
        print("Recebido da ESP32:", data.decode("utf-8").strip())
    except Exception:
        pass

async def connect_ble():
    print("Procurando ESP32 via Bluetooth BLE...")
    try:
        devices = await BleakScanner.discover(timeout=8)
        target_device = None
        for device in devices:
            if device.name and DEVICE_NAME in device.name:
                target_device = device
                break
                
        if target_device:
            print(f"ESP32 encontrada: {target_device.name}")
            state.ble_client = BleakClient(target_device)
            await state.ble_client.connect()
            state.ble_connected = True
            print("Conectado à ESP32 via BLE.")
            try:
                await state.ble_client.start_notify(TX_CHAR_UUID, notificacao_ble)
            except:
                pass
        else:
            print("ESP32 não encontrada.")
    except Exception as e:
        print(f"Erro BLE: {e}")

async def ble_sender_loop():
    prev_sent = ""
    last_send_time = 0
    send_interval = 0.05
    
    while True:
        if state.ble_connected and state.ble_client and state.fingers_to_send:
            to_send = state.fingers_to_send
            if to_send != prev_sent and (time.time() - last_send_time) > send_interval:
                try:
                    await state.ble_client.write_gatt_char(RX_CHAR_UUID, to_send.encode("utf-8"), response=False)
                    prev_sent = to_send
                    last_send_time = time.time()
                except Exception as e:
                    pass
        await asyncio.sleep(0.01)

import threading

def camera_thread_func():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Erro: Não foi possível acessar a câmera.")
        return

    detector = HandDetector(maxHands=1, detectionCon=0.7)
    pTime = 0
    
    while True:
        success, img = cap.read()
        if not success:
            time.sleep(0.01)
            continue
            
        hands, img = detector.findHands(img, draw=True)
        fingers_str = ""
        status_msg = "NO HAND"
        
        if hands:
            hand = hands[0]
            fingers = detector.fingersUp(hand)
            fingers_str = "$" + "".join(map(str, fingers))
            
            if fingers_str in gestos_bloqueados:
                status_msg = "BLOCKED"
            else:
                status_msg = "OK"
                state.fingers_to_send = fingers_str
                
        cTime = time.time()
        state.fps = int(1 / (cTime - pTime)) if pTime != 0 else 0
        pTime = cTime
        
        state.current_fingers = fingers_str
        state.current_status = status_msg
        
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 60])
        state.current_frame = base64.b64encode(buffer).decode('utf-8')
        
        time.sleep(0.01)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(connect_ble())
    asyncio.create_task(ble_sender_loop())
    threading.Thread(target=camera_thread_func, daemon=True).start()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            if state.current_frame:
                payload = {
                    "frame": state.current_frame,
                    "fps": state.fps,
                    "ble_connected": state.ble_connected,
                    "fingers_str": state.current_fingers,
                    "status": state.current_status
                }
                await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.03) # ~30 FPS limit for WS transmission
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Erro no WebSocket: {e}")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
