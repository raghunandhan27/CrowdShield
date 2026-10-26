// ============================================================================
// CrowdShield Command Center Gateway Firmware
// Hardware: ESP32 DevKit + SX1278 LoRa Transceiver (Connected to Laptop via USB)
// Bridges LoRa RF packets from field nodes directly into Python PySerial.
// Relays operator downlink dispatch commands from USB Serial out onto LoRa.
// ============================================================================

#include <SPI.h>
#include <LoRa.h>

// --- Radio Frequency Configuration ---
#define LORA_BAND 433E6 // Set to 866E6 for 865-867MHz India ISM band

// --- Gateway SPI Pinout (DIO0 on GPIO 26 to avoid GPIO 2 boot-strap conflicts) ---
#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  26 
#define RX_LED_PIN 27

void setup() {
  Serial.begin(115200);
  pinMode(RX_LED_PIN, OUTPUT);
  digitalWrite(RX_LED_PIN, LOW);

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("{\"status\":\"LORA_GATEWAY_INIT_FAILED\"}");
    while (true) {
      digitalWrite(RX_LED_PIN, !digitalRead(RX_LED_PIN));
      delay(150);
    }
  }

  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);

  digitalWrite(RX_LED_PIN, HIGH);
  Serial.println("{\"status\":\"LORA_GATEWAY_READY\",\"band_mhz\":433,\"baud\":115200}");
}

void loop() {
  // --- 1. RECEIVE LORA PACKET FROM FIELD -> FORWARD TO LAPTOP USB SERIAL ---
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String msg = "";
    while (LoRa.available()) {
      msg += (char)LoRa.read();
    }
    int rssi = LoRa.packetRssi();

    // Transmit formatted line: JSON <tab> RSSI (Matches serial_reader.py data contract)
    Serial.print(msg);
    Serial.print("\t");
    Serial.println(rssi);

    // Activity blink
    digitalWrite(RX_LED_PIN, LOW);
    delay(30);
    digitalWrite(RX_LED_PIN, HIGH);
  }

  // --- 2. RECEIVE OPERATOR DOWNLINK COMMAND FROM LAPTOP USB -> BROADCAST VIA LORA ---
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) {
      LoRa.beginPacket();
      LoRa.print(cmd);
      LoRa.endPacket();

      // Visual pulse
      for (int i = 0; i < 2; i++) {
        digitalWrite(RX_LED_PIN, LOW); delay(50);
        digitalWrite(RX_LED_PIN, HIGH); delay(50);
      }
    }
  }
}
