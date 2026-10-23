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
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import warnings
import math
import threading
import re
import unicodedata


warnings.filterwarnings("ignore", category=UserWarning, module="google.protobuf.symbol_database")

try:
    from bleak.backends.winrt.util import uninitialize_sta
    uninitialize_sta()
except Exception:
    pass

DEVICE_NAME = "InMoov_Hand"
RX_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
MOTIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "movimentos")

#gestos_bloqueados = ["$00100", "$10100"]
gestos_bloqueados = []


from pydantic import BaseModel

class CameraSelection(BaseModel):
    index: int


class MotionModeSelection(BaseModel):
    mode: str


class MotionRecordRequest(BaseModel):
    name: str


class MotionSelection(BaseModel):
    motion_id: str


class MotionUpdateRequest(BaseModel):
    name: str

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

    def __init__(self):
        self.motion_lock = threading.Lock()
        self.motion_mode = "realtime"
        self.is_recording = False
        self.recording_started_at = None
        self.recorded_motion = []
        self.recorded_duration = 0.0
        self.playback_started_at = None
        self.live_command = None
        self.last_recorded_command = None
        self.recording_name = None
        self.recording_motion_id = None
        self.selected_motion_name = None
        self.selected_motion_id = None

state = AppState()
app = FastAPI()


def motion_id_from_name(name):
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    motion_id = re.sub(r"[^a-zA-Z0-9]+", "_", normalized).strip("_").lower()
    return motion_id[:80] or "movimento"


def motion_file_path(motion_id):
    if not re.fullmatch(r"[a-z0-9_]{1,80}", motion_id or ""):
        return None
    return os.path.join(MOTIONS_DIR, f"{motion_id}.txt")


def parse_motion_file(path):
    motion_id = os.path.splitext(os.path.basename(path))[0]
    motion_name = motion_id.replace("_", " ").title()
    duration = 0.0
    samples = []

    try:
        with open(path, "r", encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("name="):
                    motion_name = line[5:].strip() or motion_name
                    continue
                if line.startswith("duration="):
                    try:
                        duration = max(0.0, float(line[9:].strip()))
                    except ValueError:
                        pass
                    continue
                if "|" not in line:
                    continue
                time_text, command = line.split("|", 1)
                if not re.fullmatch(r"\$[01]{5},\d{3}", command):
                    continue
                try:
                    sample_time = max(0.0, float(time_text.strip()))
                except ValueError:
                    continue
                samples.append({"time": sample_time, "command": command})
    except (OSError, UnicodeError):
        return None

    if not samples:
        return None

    samples.sort(key=lambda sample: sample["time"])
    duration = max(duration, samples[-1]["time"])
    return {
        "id": motion_id,
        "name": motion_name,
        "duration": duration,
        "count": len(samples),
        "samples": samples,
    }


def list_saved_motions():
    os.makedirs(MOTIONS_DIR, exist_ok=True)
    motions = []
    for filename in os.listdir(MOTIONS_DIR):
        if not filename.lower().endswith(".txt"):
            continue
        motion = parse_motion_file(os.path.join(MOTIONS_DIR, filename))
        if motion:
            motions.append({
                "id": motion["id"],
                "name": motion["name"],
                "duration": round(motion["duration"], 2),
                "count": motion["count"],
            })
    return sorted(motions, key=lambda motion: motion["name"].casefold())


def write_motion_file(path, name, samples, duration):
    with open(path, "w", encoding="utf-8", newline="\n") as file:
        file.write("# InMoov Hub motion recording\n")
        file.write(f"name={name}\n")
        file.write(f"duration={duration:.3f}\n")
        file.write("# seconds|command\n")
        for sample in samples:
            file.write(f"{sample['time']:.3f}|{sample['command']}\n")

    return path


def save_motion_file(name, motion_id, samples, duration):
    os.makedirs(MOTIONS_DIR, exist_ok=True)
    path = motion_file_path(motion_id)
    if path is None:
        raise ValueError("Nome de movimento inválido.")
    if os.path.exists(path):
        raise FileExistsError(path)
    return write_motion_file(path, name, samples, duration)


def load_saved_motion(motion_id):
    path = motion_file_path(motion_id)
    if path is None or not os.path.isfile(path):
        return None
    return parse_motion_file(path)

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
        update_playback_command()
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


def update_live_command(command):
    """Atualiza o comando da câmera e registra somente mudanças de pose."""
    now = time.monotonic()
    with state.motion_lock:
        state.live_command = command
        if state.is_recording and state.recording_started_at is not None:
            elapsed = max(0.0, now - state.recording_started_at)
            state.recorded_duration = elapsed
            if command != state.last_recorded_command:
                state.recorded_motion.append({"time": elapsed, "command": command})
                state.last_recorded_command = command

        if state.motion_mode == "realtime":
            state.fingers_to_send = command


def update_playback_command():
    """Seleciona a pose correspondente ao instante atual do loop gravado."""
    now = time.monotonic()
    with state.motion_lock:
        if state.motion_mode != "recorded" or not state.recorded_motion:
            return

        if state.playback_started_at is None:
            state.playback_started_at = now

        duration = state.recorded_duration
        if duration <= 0:
            state.fingers_to_send = state.recorded_motion[0]["command"]
            return

        elapsed = (now - state.playback_started_at) % duration
        selected_command = state.recorded_motion[0]["command"]
        for sample in state.recorded_motion:
            if sample["time"] > elapsed:
                break
            selected_command = sample["command"]
        state.fingers_to_send = selected_command


def get_motion_status():
    with state.motion_lock:
        return {
            "mode": state.motion_mode,
            "recording": state.is_recording,
            "recording_name": state.recording_name,
            "has_recording": bool(state.recorded_motion),
            "recorded_count": len(state.recorded_motion),
            "recorded_duration": round(state.recorded_duration, 2),
            "selected_motion_id": state.selected_motion_id,
            "selected_motion_name": state.selected_motion_name,
        }


def start_recording(name, motion_id):
    now = time.monotonic()
    with state.motion_lock:
        state.motion_mode = "realtime"
        state.playback_started_at = None
        state.recorded_motion = []
        state.recorded_duration = 0.0
        state.recording_started_at = now
        state.is_recording = True
        state.last_recorded_command = None
        state.recording_name = name
        state.recording_motion_id = motion_id
        state.selected_motion_id = None
        state.selected_motion_name = None

        if state.live_command:
            state.recorded_motion.append({"time": 0.0, "command": state.live_command})
            state.last_recorded_command = state.live_command


def stop_recording():
    now = time.monotonic()
    with state.motion_lock:
        was_recording = state.is_recording
        if state.is_recording and state.recording_started_at is not None:
            state.recorded_duration = max(
                state.recorded_duration,
                now - state.recording_started_at,
            )
        state.is_recording = False
        state.recording_started_at = None
        return {
            "count": len(state.recorded_motion) if was_recording else 0,
            "duration": state.recorded_duration,
            "name": state.recording_name,
            "motion_id": state.recording_motion_id,
            "samples": list(state.recorded_motion),
        }

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
                update_live_command(payload_str)
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

@app.post("/api/reset_position")
async def api_reset_position():
    with state.motion_lock:
        state.motion_mode = "realtime"
        state.is_recording = False
        state.recording_started_at = None
        state.playback_started_at = None
        state.live_command = "$00000,090"
        state.fingers_to_send = "$00000,090"
    if state.ble_connected and state.ble_client:
        try:
            await state.ble_client.write_gatt_char(RX_CHAR_UUID, "$00000,090".encode("utf-8"), response=False)
            return {"status": "ok", "message": "Reset command sent"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "ok", "message": "State updated, but BLE not connected"}


@app.get("/api/motions")
async def api_list_motions():
    return {"motions": list_saved_motions()}


@app.get("/api/motion/status")
async def api_motion_status():
    return get_motion_status()


@app.post("/api/motion/record/start")
async def api_start_motion_recording(request: MotionRecordRequest):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Informe um nome para o movimento.")
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="O nome deve ter no máximo 80 caracteres.")

    motion_id = motion_id_from_name(name)
    if motion_file_path(motion_id) and os.path.exists(motion_file_path(motion_id)):
        raise HTTPException(status_code=409, detail="Já existe um movimento com esse nome.")

    start_recording(name, motion_id)
    return {"status": "recording", **get_motion_status()}


@app.post("/api/motion/record/stop")
async def api_stop_motion_recording():
    recording = stop_recording()
    if not recording["count"]:
        with state.motion_lock:
            state.recording_name = None
            state.recording_motion_id = None
        return {"status": "empty", **get_motion_status()}

    try:
        save_motion_file(
            recording["name"],
            recording["motion_id"],
            recording["samples"],
            recording["duration"],
        )
    except FileExistsError:
        raise HTTPException(status_code=409, detail="Já existe um movimento com esse nome.")
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=500, detail=f"Não foi possível salvar o movimento: {error}")

    with state.motion_lock:
        state.selected_motion_id = recording["motion_id"]
        state.selected_motion_name = recording["name"]
        state.recording_name = None
        state.recording_motion_id = None

    return {
        "status": "recorded",
        "recorded_count": recording["count"],
        "recorded_duration": round(recording["duration"], 2),
        **get_motion_status(),
    }


@app.post("/api/motion/select")
async def api_select_motion(selection: MotionSelection):
    motion = load_saved_motion(selection.motion_id)
    if motion is None:
        raise HTTPException(status_code=404, detail="Movimento não encontrado.")

    with state.motion_lock:
        if state.is_recording:
            raise HTTPException(status_code=409, detail="Pare a gravação antes de selecionar outro movimento.")
        state.recorded_motion = motion["samples"]
        state.recorded_duration = motion["duration"]
        state.selected_motion_id = motion["id"]
        state.selected_motion_name = motion["name"]
        if state.motion_mode == "recorded":
            state.playback_started_at = time.monotonic()
            state.fingers_to_send = state.recorded_motion[0]["command"]

    return {"status": "selected", **get_motion_status()}


@app.put("/api/motion/{motion_id}")
async def api_update_motion(motion_id: str, request: MotionUpdateRequest):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Informe um nome para o movimento.")
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="O nome deve ter no máximo 80 caracteres.")

    with state.motion_lock:
        if state.is_recording:
            raise HTTPException(status_code=409, detail="Pare a gravação antes de editar um movimento.")

    motion = load_saved_motion(motion_id)
    if motion is None:
        raise HTTPException(status_code=404, detail="Movimento não encontrado.")

    new_motion_id = motion_id_from_name(name)
    old_path = motion_file_path(motion_id)
    new_path = motion_file_path(new_motion_id)
    if old_path is None or new_path is None:
        raise HTTPException(status_code=400, detail="Identificador de movimento inválido.")
    if new_motion_id != motion_id and os.path.exists(new_path):
        raise HTTPException(status_code=409, detail="Já existe um movimento com esse nome.")

    try:
        write_motion_file(new_path, name, motion["samples"], motion["duration"])
        if new_motion_id != motion_id:
            os.remove(old_path)
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"Não foi possível atualizar o movimento: {error}")

    with state.motion_lock:
        if state.selected_motion_id == motion_id:
            state.selected_motion_id = new_motion_id
            state.selected_motion_name = name

    return {"status": "updated", **get_motion_status()}


@app.delete("/api/motion/{motion_id}")
async def api_delete_motion(motion_id: str):
    path = motion_file_path(motion_id)
    if path is None or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Movimento não encontrado.")

    with state.motion_lock:
        if state.is_recording:
            raise HTTPException(status_code=409, detail="Pare a gravação antes de excluir um movimento.")

    try:
        os.remove(path)
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"Não foi possível excluir o movimento: {error}")

    with state.motion_lock:
        if state.selected_motion_id == motion_id:
            state.recorded_motion = []
            state.recorded_duration = 0.0
            state.selected_motion_id = None
            state.selected_motion_name = None
            if state.motion_mode == "recorded":
                state.motion_mode = "realtime"
                state.playback_started_at = None
                state.fingers_to_send = state.live_command

    return {"status": "deleted", **get_motion_status()}


@app.post("/api/motion/mode")
async def api_set_motion_mode(selection: MotionModeSelection):
    if selection.mode not in {"realtime", "recorded"}:
        raise HTTPException(status_code=400, detail="Modo deve ser 'realtime' ou 'recorded'.")

    with state.motion_lock:
        if selection.mode == "recorded" and not state.recorded_motion:
            raise HTTPException(status_code=400, detail="Nenhum movimento gravado disponível.")

        state.motion_mode = selection.mode
        if selection.mode == "recorded":
            state.is_recording = False
            state.recording_started_at = None
            state.playback_started_at = time.monotonic()
            state.fingers_to_send = state.recorded_motion[0]["command"]
        else:
            state.playback_started_at = None
            if state.live_command:
                state.fingers_to_send = state.live_command

    return {"status": "ok", **get_motion_status()}


@app.post("/api/motion/playback/start")
async def api_start_motion_playback():
    with state.motion_lock:
        has_recording = bool(state.recorded_motion)
    if not has_recording:
        raise HTTPException(status_code=400, detail="Nenhum movimento gravado disponível.")

    return await api_set_motion_mode(MotionModeSelection(mode="recorded"))


@app.post("/api/motion/playback/stop")
async def api_stop_motion_playback():
    return await api_set_motion_mode(MotionModeSelection(mode="realtime"))


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
                motion = get_motion_status()
                payload = {
                    "frame": state.current_frame,
                    "fps": state.fps,
                    "ble_connected": state.ble_connected,
                    "ble_searching": state.ble_searching,
                    "fingers_str": state.current_fingers,
                    "status": state.current_status,
                    "hand_type": state.current_hand_type,
                    "ble_error": state.ble_error,
                    "tx_command": state.fingers_to_send or "",
                    "motion_mode": motion["mode"],
                    "recording": motion["recording"],
                    "recording_name": motion["recording_name"],
                    "has_recording": motion["has_recording"],
                    "recorded_count": motion["recorded_count"],
                    "recorded_duration": motion["recorded_duration"],
                    "selected_motion_id": motion["selected_motion_id"],
                    "selected_motion_name": motion["selected_motion_name"]
                }
                await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.03) # ~30 FPS limit for WS transmission
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Erro no WebSocket: {e}")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
