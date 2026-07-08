#include <ArduinoBLE.h>
#include <Servo.h>

#define numOfValsRec 5
#define PIN_THUMB  3
#define PIN_INDEX  5
#define PIN_MIDDLE 6
#define PIN_RING   9
#define PIN_PINKY  10
#define PIN_WRIST  11

// Nome que vai aparecer no Bluetooth
const char* DEVICE_NAME = "InMoov_Hand";

// UUIDs no padrão UART BLE
const char* SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const char* RX_UUID      = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"; // PC envia para ESP32
const char* TX_UUID      = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"; // ESP32 responde ao PC

BLEService inmoovService(SERVICE_UUID);
BLEStringCharacteristic rxCharacteristic(RX_UUID, BLEWrite | BLEWriteWithoutResponse, 20);
BLEStringCharacteristic txCharacteristic(TX_UUID, BLENotify, 20);

Servo servoThumb;
Servo servoIndex;
Servo servoMiddle;
Servo servoRing;
Servo servoPinky;
Servo servoWrist;

int valsRec[numOfValsRec] = {1, 1, 1, 1, 1};
int wristVal = 90; // Ponto inicial de 90 graus

void setup() {
  Serial.begin(115200);

  // Pinos dos servos
  servoThumb.attach(PIN_THUMB, 500, 2400);
  servoIndex.attach(PIN_INDEX, 500, 2400);
  servoMiddle.attach(PIN_MIDDLE, 500, 2400);
  servoRing.attach(PIN_RING, 500, 2400);
  servoPinky.attach(PIN_PINKY, 500, 2400);
  servoWrist.attach(PIN_WRIST, 500, 2400);

  moverServos();

  if (!BLE.begin()) {
    Serial.println("Erro ao iniciar BLE!");
    while (1);
  }

  BLE.setLocalName(DEVICE_NAME);
  BLE.setDeviceName(DEVICE_NAME);
  BLE.setAdvertisedService(inmoovService);

  inmoovService.addCharacteristic(rxCharacteristic);
  inmoovService.addCharacteristic(txCharacteristic);

  BLE.addService(inmoovService);

  rxCharacteristic.writeValue("$11111,090");
  txCharacteristic.writeValue("BLE iniciado");

  BLE.advertise();

  Serial.println("Bluetooth BLE iniciado.");
  Serial.println("Aguardando conexão...");
}

void loop() {
  BLE.poll();

  String comando = "";
  bool recebido = false;

  if (rxCharacteristic.written()) {
    comando = rxCharacteristic.value();
    recebido = true;
    Serial.print("Recebido via BLE: ");
    Serial.println(comando);
  } else if (Serial.available() > 0) {
    comando = Serial.readStringUntil('\n');
    recebido = true;
    Serial.print("Recebido via Serial: ");
    Serial.println(comando);
  }

  if (recebido) {
    comando.trim();

    if (comandoValido(comando)) {
      for (int i = 0; i < numOfValsRec; i++) {
        valsRec[i] = comando.substring(i + 1, i + 2).toInt();
      }

      // Lê o valor do ângulo do pulso a partir da posição 7 (ex: $11111,090)
      wristVal = comando.substring(7, 10).toInt();

      moverServos();

      txCharacteristic.writeValue("OK: " + comando);
    } else {
      txCharacteristic.writeValue("Comando invalido");
    }
  }

  delay(5);
}

bool comandoValido(String comando) {
  // Novo formato: $11111,090 (10 caracteres)
  if (comando.length() != 10) {
    return false;
  }

  if (comando.charAt(0) != '$') {
    return false;
  }

  for (int i = 1; i <= 5; i++) {
    char c = comando.charAt(i);
    if (c != '0' && c != '1') {
      return false;
    }
  }

  if (comando.charAt(6) != ',') {
    return false;
  }

  for (int i = 7; i <= 9; i++) {
    char c = comando.charAt(i);
    if (!isDigit(c)) {
      return false;
    }
  }

  return true;
}

void moverServos() {
  servoThumb.write(valsRec[0] == 1 ? 180 : 0);
  servoIndex.write(valsRec[1] == 1 ? 180 : 0);
  servoMiddle.write(valsRec[2] == 1 ? 180 : 0);
  servoRing.write(valsRec[3] == 1 ? 180 : 0);
  servoPinky.write(valsRec[4] == 1 ? 180 : 0);
  servoWrist.write(wristVal);
}