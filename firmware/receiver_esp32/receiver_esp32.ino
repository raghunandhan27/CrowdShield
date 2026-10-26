// ============================================================================
// CrowdShield — Master Command Center Receiver & Gateway Firmware
// Board: ESP32 DevKit V1 (Connected directly to Command Center Laptop via USB)
// Dual Radio: 433MHz SX1278 LoRa Transceiver + 2.4GHz ESP-NOW Mesh Receiver
// Communication: 115200 Baud USB Serial (Matches serial_reader.py contract)
// ----------------------------------------------------------------------------
// Proven Enhancements:
//   - 1 MHz SPI Clock: Eliminates jumper wire ringing & bus collisions
//   - Dual-Engine Reception: 0ms latency DIO0 interrupt + Polling Fallback
//   - Exact Radio Matching: 433MHz, SF9, BW 125kHz, CR 4/5, SyncWord 0x12
// ============================================================================

#include <SPI.h>
#include <LoRa.h>
#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>

// --- LoRa Configuration ---
#define LORA_BAND 433E6 // 433 MHz (Matches Zonal Nodes)
#define LORA_SS   5     // Chip Select (NSS)
#define LORA_RST  14    // LoRa Reset
#define LORA_DIO0 26    // IRQ Pin (GPIO 26 or GPIO 33)

// Activity LED
#define RX_LED_PIN 2    // Onboard Blue LED

// Universal broadcast MAC address (FF:FF:FF:FF:FF:FF)
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

bool loraAvailable = false;
bool espnowAvailable = false;

volatile bool loraPacketReceived = false;
String loraPayloadBuffer = "";
int loraRssiBuffer = 0;

// Activity flash helper
void blinkLed(int ms) {
  digitalWrite(RX_LED_PIN, HIGH);
  delay(ms);
  digitalWrite(RX_LED_PIN, LOW);
}

// ============================================================================
// LORA INTERRUPT RECEIVE CALLBACK (0ms Latency)
// ============================================================================
void onLoRaRecv(int packetSize) {
  if (packetSize <= 0) return;

  loraPayloadBuffer = "";
  while (LoRa.available()) {
    loraPayloadBuffer += (char)LoRa.read();
  }
  loraPayloadBuffer.trim();
  loraRssiBuffer = LoRa.packetRssi();
  loraPacketReceived = true;
}

// ============================================================================
// ESP-NOW RECEIVE CALLBACK
// ============================================================================
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
void onEspNowRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
  int rssi = (info && info->rx_ctrl) ? info->rx_ctrl->rssi : -62;
#else
void onEspNowRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
  int rssi = -62;
#endif
  if (len <= 0) return;

  char buffer[256];
  int copyLen = (len < 255) ? len : 255;
  memcpy(buffer, incomingData, copyLen);
  buffer[copyLen] = '\0';

  // Output to Laptop USB Serial in standard format: JSON \t RSSI
  Serial.print(buffer);
  Serial.print("\t");
  Serial.println(rssi);

  digitalWrite(RX_LED_PIN, HIGH);
  delayMicroseconds(15000);
  digitalWrite(RX_LED_PIN, LOW);
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50); // Fast non-blocking serial read
  delay(300);

  pinMode(RX_LED_PIN, OUTPUT);
  digitalWrite(RX_LED_PIN, LOW);

  // Configure possible DIO0 pins as inputs
  pinMode(26, INPUT);
  pinMode(33, INPUT);

  // 1. Initialize SX1278 LoRa Receiver (433MHz)
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  LoRa.setSPIFrequency(1E6); // 1 MHz SPI eliminates jumper-wire line noise

  if (LoRa.begin(LORA_BAND)) {
    loraAvailable = true;
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
    LoRa.setSyncWord(0x12);
    LoRa.setTxPower(10, PA_OUTPUT_PA_BOOST_PIN);
    LoRa.setOCP(100);

    // Register 0ms interrupt callback
    LoRa.onReceive(onLoRaRecv);
    LoRa.receive(); // Enter continuous RX mode
  }

  // 2. Initialize Wi-Fi in Station Mode on Channel 1 for ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(1, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  // 3. Initialize ESP-NOW
  if (esp_now_init() == ESP_OK) {
    espnowAvailable = true;
    esp_now_register_recv_cb(onEspNowRecv);

    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 1;
    peerInfo.encrypt = false;
    esp_now_add_peer(&peerInfo);
  }

  // Visual ready indication: 3 quick blinks
  for (int i = 0; i < 3; i++) {
    digitalWrite(RX_LED_PIN, HIGH); delay(70);
    digitalWrite(RX_LED_PIN, LOW); delay(70);
  }

  // Status handshake line for Python serial reader
  Serial.printf("{\"status\":\"GATEWAY_READY\",\"lora\":%s,\"espnow\":%s,\"band\":\"433MHz\",\"baud\":115200}\n",
                loraAvailable ? "\"ONLINE\"" : "\"OFFLINE\"",
                espnowAvailable ? "\"ONLINE\"" : "\"OFFLINE\"");
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  // --------------------------------------------------------------------------
  // 1. LORA PACKET ARRIVED VIA HARDWARE INTERRUPT (0ms Latency)
  // --------------------------------------------------------------------------
  if (loraPacketReceived) {
    loraPacketReceived = false;

    // Output line: JSON <tab> RSSI
    Serial.print(loraPayloadBuffer);
    Serial.print("\t");
    Serial.println(loraRssiBuffer);

    digitalWrite(RX_LED_PIN, HIGH);
    delayMicroseconds(20000);
    digitalWrite(RX_LED_PIN, LOW);
  }

  // --------------------------------------------------------------------------
  // 2. POLLING FALLBACK (In case DIO0 wire is loose)
  // --------------------------------------------------------------------------
  if (loraAvailable) {
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
      String payload = "";
      while (LoRa.available()) {
        payload += (char)LoRa.read();
      }
      payload.trim();
      int rssi = LoRa.packetRssi();

      // Output line: JSON <tab> RSSI
      Serial.print(payload);
      Serial.print("\t");
      Serial.println(rssi);

      digitalWrite(RX_LED_PIN, HIGH);
      delayMicroseconds(20000);
      digitalWrite(RX_LED_PIN, LOW);

      // Return to continuous RX
      LoRa.receive();
    }
  }

  // --------------------------------------------------------------------------
  // 3. RECEIVE OPERATOR DOWNLINK FROM LAPTOP USB -> BROADCAST OVER AIR
  // --------------------------------------------------------------------------
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.length() > 0) {
      // 1. Broadcast over LoRa 433MHz
      if (loraAvailable) {
        LoRa.beginPacket();
        LoRa.print(cmd);
        LoRa.endPacket();
        LoRa.receive(); // Re-enter continuous RX immediately!
      }

      // 2. Broadcast over ESP-NOW 2.4GHz
      if (espnowAvailable) {
        esp_now_send(broadcastAddress, (uint8_t*)cmd.c_str(), cmd.length());
      }

      // Visual confirm flash
      digitalWrite(RX_LED_PIN, HIGH);
      delay(30);
      digitalWrite(RX_LED_PIN, LOW);

      Serial.printf("{\"status\":\"DOWNLINK_BROADCAST_OK\",\"len\":%d}\n", cmd.length());
    }
  }

  delay(2);
}
