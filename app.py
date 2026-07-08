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
import warnings
import math


warnings.filterwarnings("ignore", category=UserWarning, module="google.protobuf.symbol_database")

try:
    from bleak.backends.winrt.util import uninitialize_sta
    uninitialize_sta()
except Exception:
    pass

DEVICE_NAME = "InMoov_Hand"
RX_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

#gestos_bloqueados = ["$00100", "$10100"]
gestos_bloqueados = []


from pydantic import BaseModel

class CameraSelection(BaseModel):
    index: int

# Estado Global
class AppState:
    ble_connected = False
    ble_searching = False
    ble_client = None
    prev_fingers_str = ""
    last_send_time = 0
    send_interval = 0.05
    current_frame = None
    current_fingers = ""
    current_status = "WAITING"
    fps = 0
    fingers_to_send = None
    current_hand_type = ""
    camera_index = 0
    ble_error = None

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

def ble_disconnect_callback(client):
    print("ESP32 desconectada!")
    state.ble_connected = False
    state.ble_client = None
    state.ble_error = None

async def connect_ble():
    if state.ble_searching:
        return
    state.ble_searching = True
    state.ble_error = None
    print("Procurando ESP32 via Bluetooth BLE...")
    try:
        if state.ble_client and state.ble_connected:
            try:
                await state.ble_client.disconnect()
            except:
                pass
        state.ble_client = None
        state.ble_connected = False
        
        devices = await BleakScanner.discover(timeout=8)
        target_device = None
        for device in devices:
            if device.name and DEVICE_NAME in device.name:
                target_device = device
                break
                
        if target_device:
            print(f"ESP32 encontrada: {target_device.name}")
            state.ble_client = BleakClient(target_device, disconnected_callback=ble_disconnect_callback)
            await state.ble_client.connect()
            state.ble_connected = True
            state.ble_error = None
            print("Conectado à ESP32 via BLE.")
            try:
                await state.ble_client.start_notify(TX_CHAR_UUID, notificacao_ble)
            except:
                pass
        else:
            print("ESP32 não encontrada.")
            state.ble_error = "ESP32 não encontrada."
    except Exception as e:
        err_msg = str(e)
        print(f"Erro BLE: {err_msg}")
        state.ble_error = err_msg
    finally:
        state.ble_searching = False

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
    current_index = state.camera_index
    cap = cv2.VideoCapture(current_index)
    if not cap.isOpened():
        print(f"Erro: Não foi possível acessar a câmera {current_index}.")

    detector = HandDetector(maxHands=1, detectionCon=0.7)
    pTime = 0
    
    while True:
        if state.camera_index != current_index:
            if cap and cap.isOpened():
                cap.release()
            current_index = state.camera_index
            cap = cv2.VideoCapture(current_index)
            if not cap.isOpened():
                print(f"Erro: Não foi possível acessar a câmera {current_index}.")
                time.sleep(1)
                continue

        if cap is None or not cap.isOpened():
            time.sleep(1)
            continue

        success, img = cap.read()
        if not success:
            time.sleep(0.01)
            continue
            
        hands, img = detector.findHands(img, draw=False)
        fingers_str = ""
        status_msg = "NO HAND"
        
        if hands:
            hand = hands[0]
            if 'lmList' in hand:
                lmList = hand['lmList']
                connections = [(0, 1), (1, 2), (2, 3), (3, 4), 
                               (0, 5), (5, 6), (6, 7), (7, 8), 
                               (5, 9), (9, 10), (10, 11), (11, 12), 
                               (9, 13), (13, 14), (14, 15), (15, 16), 
                               (13, 17), (17, 18), (18, 19), (19, 20), 
                               (0, 17), (5, 9), (9, 13), (13, 17)]
                for start, end in connections:
                    x1, y1 = lmList[start][0], lmList[start][1]
                    x2, y2 = lmList[end][0], lmList[end][1]
                    cv2.line(img, (x1, y1), (x2, y2), (255, 136, 0), 2)
                for lm in lmList:
                    x, y = lm[0], lm[1]
                    cv2.circle(img, (x, y), 5, (255, 136, 0), cv2.FILLED)
                    
            # Custom fingersUp for both palm and back of hands
            fingers = []
            wrist_angle = 90
            if 'lmList' in hand:
                # Thumb
                if lmList[5][0] > lmList[17][0]:
                    fingers.append(1 if lmList[4][0] > lmList[3][0] else 0)
                else:
                    fingers.append(1 if lmList[4][0] < lmList[3][0] else 0)
                
                # 4 Fingers
                for tipId in [8, 12, 16, 20]:
                    fingers.append(1 if lmList[tipId][1] < lmList[tipId - 2][1] else 0)
                
                # Wrist angle calculation (Palm as 90º initial state, rotation to Dorso is 90º-0º for Right Hand and 90º-180º for Left Hand)
                try:
                    # Calculate hand scale (distance from wrist 0 to middle finger base 9)
                    scale = math.hypot(lmList[9][0] - lmList[0][0], lmList[9][1] - lmList[0][1])
                    if scale < 1.0:
                        scale = 1.0
                    
                    # Calculate ratio of horizontal distance between index base (5) and pinky base (17)
                    ratio = (lmList[5][0] - lmList[17][0]) / scale
                    clamped_ratio = max(-0.6, min(0.6, ratio))
                    
                    hand_type = hand.get("type", "Right")
                    if hand_type == "Left":
                        # Left Hand: Palm (clamped_ratio = -0.6) is 90º, Dorso (clamped_ratio = 0.6) is 180º
                        mapped_angle = 90.0 + (clamped_ratio + 0.6) * 75.0
                    else:
                        # Right Hand: Palm (clamped_ratio = 0.6) is 90º, Dorso (clamped_ratio = -0.6) is 0º
                        mapped_angle = 90.0 + (clamped_ratio - 0.6) * 75.0
                    
                    # Round to nearest 5 degrees to reduce jitter and BLE transmission frequency
                    quantized_angle = int(round(mapped_angle / 5.0) * 5.0)
                    wrist_angle = max(0, min(180, quantized_angle))
                except Exception:
                    wrist_angle = 90
            else:
                fingers = [0, 0, 0, 0, 0]
                
            fingers_str = "$" + "".join(map(str, fingers))
            payload_str = f"{fingers_str},{wrist_angle:03d}"
            
            if fingers_str in gestos_bloqueados:
                status_msg = "BLOCKED"
            else:
                status_msg = "OK"
                state.fingers_to_send = payload_str
        else:
            hand = None
            fingers_str = ""
            payload_str = ""
                
        cTime = time.time()
        state.fps = int(1 / (cTime - pTime)) if pTime != 0 else 0
        pTime = cTime
        
        state.current_fingers = payload_str

        state.current_status = status_msg
        state.current_hand_type = hand["type"] if hands else ""
        
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 60])
        state.current_frame = base64.b64encode(buffer).decode('utf-8')
        
        time.sleep(0.01)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(connect_ble())
    asyncio.create_task(ble_sender_loop())
    threading.Thread(target=camera_thread_func, daemon=True).start()

@app.post("/api/reconnect_ble")
async def api_reconnect_ble():
    asyncio.create_task(connect_ble())
    return {"status": "reconnecting"}

@app.post("/api/disconnect_ble")
async def api_disconnect_ble():
    if state.ble_client and state.ble_connected:
        try:
            await state.ble_client.disconnect()
        except:
            pass
    state.ble_client = None
    state.ble_connected = False
    state.ble_searching = False
    state.ble_error = None
    return {"status": "disconnected"}


@app.get("/api/cameras")
async def get_cameras():
    import subprocess
    try:
        output = subprocess.check_output('wmic path Win32_PnPEntity where "PNPClass=\'Image\' OR PNPClass=\'Camera\'" get Caption /value', shell=True).decode('utf-8', errors='ignore')
        cameras = []
        for line in output.split('\n'):
            line = line.strip()
            if line.startswith('Caption='):
                name = line.split('=', 1)[1]
                if name:
                    cameras.append(name)
        if not cameras:
            return {"cameras": ["Câmera 0", "Câmera 1", "Câmera 2"]}
        return {"cameras": cameras}
    except Exception as e:
        return {"cameras": ["Câmera 0", "Câmera 1", "Câmera 2"]}

@app.post("/api/set_camera")
async def api_set_camera(cam: CameraSelection):
    state.camera_index = cam.index
    return {"status": "ok", "camera_index": state.camera_index}

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
                    "ble_searching": state.ble_searching,
                    "fingers_str": state.current_fingers,
                    "status": state.current_status,
                    "hand_type": state.current_hand_type,
                    "ble_error": state.ble_error
                }
                await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.03) # ~30 FPS limit for WS transmission
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Erro no WebSocket: {e}")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
