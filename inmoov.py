import cv2
import cvzone
import serial
import time
import serial.tools.list_ports
import tkinter as tk
from tkinter import ttk, messagebox
from cvzone.HandTrackingModule import HandDetector

# ==========================
# INTERFACE TKINTER PARA SELEÇÃO DA PORTA
# ==========================
def selecionar_porta_serial():
    portas = list(serial.tools.list_ports.comports())
    if not portas:
        messagebox.showerror("Erro", "Nenhuma porta serial encontrada!")
        exit()

    root = tk.Tk()
    root.title("Seleção de Porta Serial")
    root.geometry("300x150")
    root.resizable(False, False)

    tk.Label(root, text="Selecione a porta serial:", font=("Arial", 10, "bold")).pack(pady=10)

    porta_var = tk.StringVar(value=portas[0].device)
    combo = ttk.Combobox(root, textvariable=porta_var, values=[p.device for p in portas], state="readonly")
    combo.pack(pady=5)

    def confirmar():
        root.selected_port = porta_var.get()
        root.destroy()

    ttk.Button(root, text="Conectar", command=confirmar).pack(pady=10)
    root.mainloop()
    return getattr(root, "selected_port", None)

porta_serial = selecionar_porta_serial()
if not porta_serial:
    print("Nenhuma porta selecionada. Encerrando...")
    exit()

# ==========================
# CONEXÃO SERIAL
# ==========================
try:
    mySerial = serial.Serial(porta_serial, 9600, timeout=1)
    time.sleep(2)
    print(f"✅ Conectado com sucesso em {porta_serial}")
except serial.SerialException as e:
    print(f"❌ Erro ao abrir a porta serial: {e}")
    print("\n💡 Feche o Arduino IDE ou outro programa que esteja usando a mesma porta.")
    exit()

# ==========================
# CONFIGURAÇÕES DO SISTEMA
# ==========================
detector = HandDetector(maxHands=1, detectionCon=0.7)
gestos_bloqueados = ["$00100", "$10100"]
#gestos_bloqueados = []


cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Erro: Não foi possível acessar a câmera.")
    exit()

cv2.namedWindow("Image", cv2.WND_PROP_FULLSCREEN)
cv2.setWindowProperty("Image", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

prev_fingers_str = ""
last_send_time = 0
send_interval = 0.05  # 100 ms

# ==========================
# INSERÇÃO DE LOGO (NÍTIDA)
# ==========================import cvzone
# import cv2
# import serial
# from cvzone.HandTrackingModule import HandDetector
# import time
#
# detector = HandDetector(maxHands=1, detectionCon=0.7)
# gestos_bloqueados = ["$00100", "$10100"]
#
# try:
#     mySerial = serial.Serial("COM4", 9600, timeout=1)
#     time.sleep(2)
# except serial.SerialException as e:
#     print(f"Erro ao abrir a porta serial: {e}")
#     exit()
#
# cap = cv2.VideoCapture(0)
# if not cap.isOpened():
#     print("Erro: Não foi possível acessar a câmera.")
#     exit()
#
# # Janela em tela cheia
# cv2.namedWindow("Image", cv2.WND_PROP_FULLSCREEN)
# cv2.setWindowProperty("Image", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
#
# prev_fingers_str = ""
# last_send_time = 0
# send_interval = 0.1  # segundos (100 ms)
#
# try:
#     while True:
#         success, img = cap.read()
#         if not success:
#             print("Erro ao capturar frame.")
#             break
#
#         hands, img = detector.findHands(img, draw=True) #habilita desenho na mão
#
#         if hands:
#             hand = hands[0]
#             fingers = detector.fingersUp(hand)
#             fingers_str = "$" + "".join(map(str, fingers))
#
#             if fingers_str in gestos_bloqueados:
#                 print(f"Gesto bloqueado detectado: {fingers_str} - envio cancelado.")
#             else:
#                 current_time = time.time()
#                 if fingers_str != prev_fingers_str and (current_time - last_send_time) > send_interval:
#                     try:
#                         mySerial.write(fingers_str.encode())
#                         prev_fingers_str = fingers_str
#                         last_send_time = current_time
#                         print(f"Enviado: {fingers_str}")
#                     except serial.SerialException as e:
#                         print(f"Erro ao enviar dados: {e}")
#
#             # Ler todo buffer disponível para evitar travamento
#             while mySerial.in_waiting > 0:
#                 try:
#                     data = mySerial.readline().decode('utf-8').strip()
#                     if data:
#                         print(f"Recebido: {data}")
#                 except Exception as e:
#                     print(f"Erro ao ler dados: {e}")
#
#         cv2.imshow("Image", img)
#         if cv2.waitKey(1) & 0xFF == ord('q'):
#             break
#
# finally:
#     cap.release()
#     cv2.destroyAllWindows()
#     mySerial.close()
#     print("Programa finalizado.")
logo_path = "./logo_vulkaris.jpg"
logo_original = cv2.imread(logo_path, cv2.IMREAD_UNCHANGED)
if logo_original is None:
    print("⚠️ Aviso: logo não encontrada, verifique o caminho.")
else:
    # Redimensiona mantendo qualidade
    h, w = logo_original.shape[:2]
    fator = 100 / w
    logo_original = cv2.resize(logo_original, (100, int(h * fator)), interpolation=cv2.INTER_AREA)

def overlay_logo(frame, logo, x=0, y=0):
    """Desenha a logo sem perder qualidade"""
    overlay = logo.copy()
    h, w = overlay.shape[:2]

    # Evita desenhar fora da tela
    if y + h > frame.shape[0] or x + w > frame.shape[1]:
        return frame

    if overlay.shape[2] == 4:
        alpha = overlay[:, :, 3] / 255.0
        for c in range(3):
            frame[y:y+h, x:x+w, c] = (
                alpha * overlay[:, :, c] + (1 - alpha) * frame[y:y+h, x:x+w, c]
            )
    else:
        frame[y:y+h, x:x+w] = overlay
    return frame

# ==========================
# LOOP PRINCIPAL
# ==========================
try:
    while True:
        success, img = cap.read()
        if not success:
            print("Erro ao capturar frame.")
            break

        hands, img = detector.findHands(img, draw=True)

        if hands:
            hand = hands[0]
            fingers = detector.fingersUp(hand)
            fingers_str = "$" + "".join(map(str, fingers))

            if fingers_str in gestos_bloqueados:
                print(f"Gesto bloqueado detectado: {fingers_str} - envio cancelado.")
            else:
                current_time = time.time()
                if fingers_str != prev_fingers_str and (current_time - last_send_time) > send_interval:
                    mySerial.write(fingers_str.encode())
                    prev_fingers_str = fingers_str
                    last_send_time = current_time
                    print(f"Enviado: {fingers_str}")

            while mySerial.in_waiting > 0:
                data = mySerial.readline().decode('utf-8').strip()
                if data:
                    print(f"Recebido: {data}")

        # desenha a logo sobre o frame (mantendo nitidez)
        if logo_original is not None:
            img = overlay_logo(img, logo_original, 0, 0)

        cv2.imshow("Image", img)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

finally:
    cap.release()
    cv2.destroyAllWindows()
    mySerial.close()
    print("Programa finalizado.")
