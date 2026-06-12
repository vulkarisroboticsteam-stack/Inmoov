# ==========================================================
# INMOOV - ESP32 BLE + VISÃO COMPUTACIONAL
# Corrigido para erro do Bleak no Windows
# ==========================================================

import sys
sys.coinit_flags = 0  # força MTA no Windows antes de qualquer lib gráfica

import os
import time
import asyncio

from bleak import BleakScanner, BleakClient

try:
    from bleak.backends.winrt.util import uninitialize_sta
    uninitialize_sta()
except Exception:
    pass


# ==========================================================
# CONFIGURAÇÕES BLE
# ==========================================================
DEVICE_NAME = "InMoov_Hand"

RX_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  # Python envia para ESP32
TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  # ESP32 responde ao Python


# ==========================================================
# CONFIGURAÇÕES DO SISTEMA
# ==========================================================
gestos_bloqueados = ["$00100", "$10100"]

prev_fingers_str = ""
last_send_time = 0
send_interval = 0.05


# ==========================================================
# CALLBACK DE RESPOSTA DA ESP32
# ==========================================================
def notificacao_ble(sender, data):
    try:
        print("Recebido da ESP32:", data.decode("utf-8").strip())
    except Exception:
        print("Recebido da ESP32:", data)


# ==========================================================
# PROCURAR ESP32 VIA BLE
# ==========================================================
async def encontrar_esp32():
    print("Procurando ESP32 via Bluetooth BLE...")

    try:
        devices = await BleakScanner.discover(timeout=8)
    except Exception as e:
        print("❌ Erro ao procurar dispositivos BLE:")
        print(e)
        return None

    print("\nDispositivos encontrados:")

    for device in devices:
        nome = device.name if device.name else "Sem nome"
        print(f"- {nome} | {device.address}")

        if device.name and DEVICE_NAME in device.name:
            print(f"\n✅ ESP32 encontrada: {device.name}")
            return device

    print("\n❌ ESP32 não encontrada.")
    print("Confira se o código da ESP32 está rodando e se o nome é InMoov_Hand.")
    return None


# ==========================================================
# CARREGAR LOGO
# ==========================================================
def carregar_logo(cv2):
    logo_path = os.path.join(os.path.dirname(__file__), "logo_vulkaris.png")
    logo_original = cv2.imread(logo_path, cv2.IMREAD_UNCHANGED)

    if logo_original is None:
        print("⚠️ Aviso: logo não encontrada, verifique se logo_vulkaris.jpg está na pasta do inmoov.py.")
        return None

    h, w = logo_original.shape[:2]
    fator = 100 / w

    logo_original = cv2.resize(
        logo_original,
        (100, int(h * fator)),
        interpolation=cv2.INTER_AREA
    )

    return logo_original


def overlay_logo(frame, logo, x=0, y=0):
    overlay = logo.copy()
    h, w = overlay.shape[:2]

    if y + h > frame.shape[0] or x + w > frame.shape[1]:
        return frame

    if len(overlay.shape) == 3 and overlay.shape[2] == 4:
        alpha = overlay[:, :, 3] / 255.0

        for c in range(3):
            frame[y:y+h, x:x+w, c] = (
                alpha * overlay[:, :, c] +
                (1 - alpha) * frame[y:y+h, x:x+w, c]
            )

    elif len(overlay.shape) == 3:
        frame[y:y+h, x:x+w] = overlay

    return frame


# ==========================================================
# HUD FUNCTION
# ==========================================================
def draw_hud(cv2, img, fingers_str, ble_connected, fps):
    h, w = img.shape[:2]
    
    # Cores inspiradas na logo (BGR)
    COLOR_BG = (15, 15, 15) # Fundo quase preto
    COLOR_TEXT = (224, 224, 224) # Cinza claro
    COLOR_ACCENT = (100, 30, 20) # Azul escuro/Ciano acinzentado da logo
    COLOR_ACTIVE = (255, 255, 255) # Branco (Ativo)
    COLOR_INACTIVE = (64, 64, 64) # Cinza escuro (Inativo)
    
    # Desenhar painel lateral direito (semi-transparente)
    panel_w = 300
    overlay = img.copy()
    cv2.rectangle(overlay, (w - panel_w, 0), (w, h), COLOR_BG, -1)
    
    # Mesclar com a imagem original (Alpha = 0.75)
    alpha = 0.75
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
    
    # Linhas de Design "Tech"
    cv2.line(img, (w - panel_w, 0), (w - panel_w, h), COLOR_ACCENT, 2)
    cv2.line(img, (w - panel_w + 15, 50), (w - 15, 50), COLOR_ACCENT, 1)
    cv2.line(img, (w - panel_w + 15, h - 30), (w - 15, h - 30), COLOR_ACCENT, 1)
    
    # Título do Painel
    cv2.putText(img, "INMOOV SYSTEM", (w - panel_w + 20, 40), cv2.FONT_HERSHEY_DUPLEX, 0.8, COLOR_TEXT, 1)
    
    # Status de Conexão e FPS
    cv2.putText(img, f"FPS: {fps}", (w - panel_w + 20, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_TEXT, 1)
    
    status_text = "BLE: CONNECTED" if ble_connected else "BLE: DISCONNECTED"
    status_color = COLOR_ACTIVE if ble_connected else COLOR_INACTIVE
    cv2.putText(img, status_text, (w - panel_w + 20, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 1)
    
    # Status dos Dedos
    cv2.putText(img, "FINGER TRACKING:", (w - panel_w + 20, 165), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_TEXT, 1)
    finger_names = ["THUMB", "INDEX", "MIDDLE", "RING", "PINKY"]
    
    y_offset = 205
    if fingers_str and fingers_str.startswith("$") and len(fingers_str) == 6:
        for i, name in enumerate(finger_names):
            state = fingers_str[i+1]
            state_text = "UP" if state == '1' else "DOWN"
            color = COLOR_ACTIVE if state == '1' else COLOR_INACTIVE
            
            # Caixa indicadora
            cv2.rectangle(img, (w - panel_w + 20, y_offset - 12), (w - panel_w + 30, y_offset - 2), color, -1)
            cv2.putText(img, f"{name}: {state_text}", (w - panel_w + 45, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1)
            
            y_offset += 35
    elif fingers_str == "BLOCKED":
        cv2.putText(img, "GESTURE BLOCKED", (w - panel_w + 20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)
        y_offset += 35 * 5
    else:
        cv2.putText(img, "NO HAND DETECTED", (w - panel_w + 20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_INACTIVE, 1)
        y_offset += 35 * 5
            
    # Dados Brutos Enviados
    cv2.line(img, (w - panel_w + 15, y_offset + 10), (w - 15, y_offset + 10), COLOR_ACCENT, 1)
    cv2.putText(img, f"TX DATA: {fingers_str if fingers_str else 'WAITING'}", (w - panel_w + 20, y_offset + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_TEXT, 1)
    
    return img


# ==========================================================
# LOOP PRINCIPAL
# ==========================================================
async def main():
    global prev_fingers_str
    global last_send_time

    # 1. Primeiro conecta no Bluetooth
    device = await encontrar_esp32()

    if device is None:
        return

    try:
        async with BleakClient(device) as client:
            print("\n✅ Conectado à ESP32 via BLE.")

            try:
                await client.start_notify(TX_CHAR_UUID, notificacao_ble)
                print("Notificações BLE ativadas.")
            except Exception as e:
                print("Aviso: não foi possível ativar notificações:")
                print(e)

            # 2. Só depois importa OpenCV, cvzone e MediaPipe
            import cv2
            import cvzone
            from cvzone.HandTrackingModule import HandDetector

            detector = HandDetector(maxHands=1, detectionCon=0.7)
            logo_original = carregar_logo(cv2)

            cap = cv2.VideoCapture(0)

            if not cap.isOpened():
                print("Erro: Não foi possível acessar a câmera.")
                return

            cv2.namedWindow("Image", cv2.WND_PROP_FULLSCREEN)
            cv2.setWindowProperty(
                "Image",
                cv2.WND_PROP_FULLSCREEN,
                cv2.WINDOW_FULLSCREEN
            )

            print("\nSistema iniciado.")
            print("Pressione Q para sair.\n")

            try:
                pTime = 0
                fingers_str_display = ""
                
                while True:
                    success, img = cap.read()

                    if not success:
                        print("Erro ao capturar frame da câmera.")
                        break

                    hands, img = detector.findHands(img, draw=True)

                    if hands:
                        hand = hands[0]
                        fingers = detector.fingersUp(hand)

                        fingers_str = "$" + "".join(map(str, fingers))
                        fingers_str_display = fingers_str

                        if fingers_str in gestos_bloqueados:
                            print(f"Gesto bloqueado: {fingers_str}")
                            fingers_str_display = "BLOCKED"
                        else:
                            current_time = time.time()

                            if (
                                fingers_str != prev_fingers_str and
                                (current_time - last_send_time) > send_interval
                            ):
                                try:
                                    await client.write_gatt_char(
                                        RX_CHAR_UUID,
                                        fingers_str.encode("utf-8"),
                                        response=False
                                    )

                                    prev_fingers_str = fingers_str
                                    last_send_time = current_time

                                    print(f"Enviado via BLE: {fingers_str}")

                                except Exception as e:
                                    print("Erro ao enviar comando via BLE:")
                                    print(e)

                    if logo_original is not None:
                        img = overlay_logo(img, logo_original, 0, 0)

                    # Calcular FPS
                    cTime = time.time()
                    fps = int(1 / (cTime - pTime)) if pTime != 0 else 0
                    pTime = cTime
                    
                    # Desenhar HUD Tech
                    img = draw_hud(cv2, img, fingers_str_display if hands else "", ble_connected=True, fps=fps)

                    cv2.imshow("Image", img)

                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                    await asyncio.sleep(0.001)

            finally:
                cap.release()
                cv2.destroyAllWindows()
                print("Câmera encerrada.")

    except Exception as e:
        print("❌ Erro geral na conexão BLE:")
        print(e)

    print("Programa finalizado.")


if __name__ == "__main__":
    asyncio.run(main())