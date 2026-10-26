// ============================================================================
// CrowdShield Command Center Gateway Firmware (ESP32 DevKit)
// Connection: Plugged directly into Command Center Laptop via USB Cable (115200 baud)
// Protocol: 2.4GHz ESP-NOW Wireless Mesh Receiver & Downlink Transmitter
// No LoRa required! Zero configuration plug-and-play gateway.
// ============================================================================
//
// FUNCTIONALITY:
// 1. Receives wireless 2.4GHz ESP-NOW packets from all Zonal ESP32 nodes (Zones 1, 2, 3).
// 2. Streams each JSON telemetry line out USB Serial to Python (serial_reader.py).
// 3. Listens on USB Serial for operator warning dispatch commands from the web app.
// 4. Immediately broadcasts downlink reply packets over ESP-NOW to all zonal nodes.
// ============================================================================

#include <esp_now.h>
#include <WiFi.h>

#define RX_LED_PIN 2  // Onboard blue LED (GPIO 2 on most ESP32 DevKit boards)

// Universal broadcast MAC address (FF:FF:FF:FF:FF:FF)
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// ESP-NOW Receive Callback (Supports both ESP32 Core 2.x and Core 3.x)
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
  int rssi = (info && info->rx_ctrl) ? info->rx_ctrl->rssi : -62;
#else
void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
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

  // Quick activity flash
  digitalWrite(RX_LED_PIN, HIGH);
  delayMicroseconds(20000);
  digitalWrite(RX_LED_PIN, LOW);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(RX_LED_PIN, OUTPUT);
  digitalWrite(RX_LED_PIN, LOW);

  // Wi-Fi Station Mode for ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("{\"status\":\"ESPNOW_GATEWAY_INIT_FAILED\"}");
    while (true) {
      digitalWrite(RX_LED_PIN, !digitalRead(RX_LED_PIN));
      delay(150);
    }
  }

  // Register Receive Callback
  esp_now_register_recv_cb(onDataRecv);

  // Register Broadcast Peer
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("{\"status\":\"GATEWAY_PEER_ADD_FAILED\"}");
  }

  // Startup indication
  for (int i = 0; i < 3; i++) {
    digitalWrite(RX_LED_PIN, HIGH); delay(80);
    digitalWrite(RX_LED_PIN, LOW); delay(80);
  }

  Serial.println("{\"status\":\"ESPNOW_GATEWAY_READY\",\"band\":\"2.4GHz\",\"baud\":115200,\"role\":\"RECEIVER_AND_DISPATCH\"}");
}

void loop() {
  // Check for downlink operator commands sent from Laptop Python over USB Serial
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.length() > 0) {
      // Broadcast downlink command out over 2.4GHz ESP-NOW to all zonal field nodes
      esp_err_t res = esp_now_send(broadcastAddress, (uint8_t*)cmd.c_str(), cmd.length());

      // Pulse LED to confirm transmission
      digitalWrite(RX_LED_PIN, HIGH);
      delay(40);
      digitalWrite(RX_LED_PIN, LOW);

      if (res == ESP_OK) {
        Serial.printf("{\"status\":\"DOWNLINK_BROADCAST_OK\",\"len\":%d}\n", cmd.length());
      } else {
        Serial.println("{\"status\":\"DOWNLINK_BROADCAST_ERR\"}");
      }
    }
  }

  delay(5);
}
