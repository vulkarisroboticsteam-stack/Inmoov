# Controle de Braço Robótico com Detecção de Mãos

Este projeto consiste no desenvolvimento de um braço robótico controlado em tempo real por meio da detecção de movimentos da mão do usuário. Ele é baseado no robô humanoide **InMoov** e combina programação em Python e um microcontrolador **ESP32** para integrar a captura de movimentos com o controle dos motores que movimentam o braço via **Bluetooth**.

---

## 1. Hardware Utilizado
- **Braço robótico** baseado no design do InMoov.
- **Microcontrolador ESP32** com suporte a Bluetooth (BLE) para controle sem fio dos motores servo que movimentam os dedos do braço.
- **Módulos servo** para controlar os dedos individualmente.
- **Câmera (Webcam)** para capturar os movimentos da mão no PC.

---

## 2. Funcionamento do Sistema
O sistema é dividido em duas partes principais que se comunicam sem fio via Bluetooth Low Energy (BLE): **processamento de imagem** no computador (Python) e **controle dos motores** no microcontrolador (ESP32).

### **Parte 1: Detecção de Movimentos com Python**
- A biblioteca **cvzone** e seu módulo **HandDetector** (baseado em MediaPipe) são usados para detectar a mão do usuário a partir da imagem capturada pela câmera.
- A posição dos dedos é analisada e convertida em um formato binário. Cada dedo é representado por um valor:  
  - **1**: Dedo levantado.  
  - **0**: Dedo abaixado.  
- Os dados são enviados do PC para o ESP32 via **Bluetooth BLE** no formato `"$XXXXX"`, onde cada **X** corresponde ao estado de um dedo (polegar, indicador, médio, anelar, mínimo).

### **Parte 2: Controle do Braço Robótico com ESP32**
- No ESP32, os valores recebidos via Bluetooth controlam diretamente os motores servo. Cada motor é responsável por um dedo do braço robótico.
- Quando o valor recebido para um dedo é **1**, o motor correspondente posiciona o dedo na posição "levantada". Para o valor **0**, o dedo é abaixado.
- Essa lógica replica os movimentos da mão do usuário no braço robótico em tempo real.

---

## 3. Código Python
O código Python (`inmoov.py`) utiliza uma câmera para capturar a mão do usuário e processa os dados em tempo real:
- Conecta automaticamente ao ESP32 chamado "InMoov_Hand" via BLE.
- Detecta os dedos levantados com o auxílio das bibliotecas **cvzone** e **MediaPipe**.
- Converte os dados para o formato apropriado e os envia ao ESP32 via conexão Bluetooth.
- Exibe o feedback de confirmação recebido de volta do microcontrolador.
- Possui um sistema de bloqueio de gestos inapropriados (como o dedo do meio isolado).

---

## 4. Código ESP32 (C++)
O código em C++ (`inmoov_hand.ino`) é responsável por:
- Inicializar o rádio Bluetooth BLE e atuar como um servidor para o PC conectar.
- Interpretar os comandos de posição da mão recebidos do Python.
- Controlar 5 motores servo para movimentar os dedos do braço robótico correspondente à leitura recebida.
- Enviar mensagens de status (OK) de volta para o Python após cada movimento bem sucedido.

---

## 5. Integração e Operação
1. Ligue o ESP32 conectado aos Servomotores.
2. Inicie o script Python no PC. O script se conectará ao ESP32 via Bluetooth automaticamente.
3. O usuário posiciona a mão em frente à câmera.
4. O Python detecta os dedos levantados, converte as informações e as envia para o ESP32.
5. O ESP32 processa os dados e movimenta os dedos do braço robótico, reproduzindo fielmente os movimentos da mão.

---

## Conclusão
Este projeto demonstra como a integração entre visão computacional, comunicações sem fio e hardware pode ser usada para criar sistemas interativos sofisticados. Ele destaca a eficiência do uso de Python para processamento de imagem pesado e do microcontrolador ESP32 com Bluetooth para controle rápido de motores e atuadores a distância.

---

### Tecnologias e Ferramentas:
 <div style="display=inline-block">
    <img height=40 title="ESP32" alt="ESP32" src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg"/>&nbsp;
    <img height=40 title="Python" alt="Python" src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original-wordmark.svg"/>&nbsp;
    <img height=40 title="Bluetooth" alt="Bluetooth" src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bluetooth/bluetooth-original.svg"/>&nbsp;
    <img height=40 title="OpenCV" alt="OpenCV" src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/opencv/opencv-original-wordmark.svg"/>&nbsp;
 </div>
