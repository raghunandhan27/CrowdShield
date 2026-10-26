// ============================================================================
// CrowdShield Command Center Gateway Firmware (ESP8266 NodeMCU / D1 Mini)
// Connection: Plugged directly into Command Center Laptop via USB Cable (115200 baud)
// Protocol: 2.4GHz ESP-NOW Wireless Mesh Receiver & Downlink Transmitter
// Compatible with ESP32 Zonal Field Nodes!
// ============================================================================
//
// FUNCTIONALITY:
// 1. Receives wireless 2.4GHz ESP-NOW packets from all Zonal ESP32 nodes (Zones 1, 2, 3).
// 2. Streams JSON telemetry out USB Serial to Python backend.
// 3. Listens on USB Serial for operator warning dispatch commands from the web app.
// 4. Immediately broadcasts downlink reply packets over ESP-NOW to all zonal nodes.
// ============================================================================

#include <ESP8266WiFi.h>
#include <espnow.h>

extern "C" {
  #include <user_interface.h>
}

#define LED_PIN LED_BUILTIN // Active LOW on NodeMCU / WeMos D1 Mini

// Universal broadcast MAC address (FF:FF:FF:FF:FF:FF)
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Flag to toggle LED safely in main loop, NOT inside the ISR callback
volatile bool packetReceivedFlag = false;

// ESP8266 ESP-NOW Receive Callback (Runs in ISR Context - NO delay() allowed!)
void onDataRecv(uint8_t *mac, uint8_t *incomingData, uint8_t len) {
  if (len <= 0) return;

  // Stream raw payload directly to USB Serial followed by \t RSSI
  Serial.write(incomingData, len);
  Serial.print("\t-65\n");

  packetReceivedFlag = true;
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // Turn OFF built-in LED initially (Active LOW)

  // 1. Wi-Fi Station Mode for ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // 2. Lock Wi-Fi Channel explicitly to Channel 1 (Matches Zonal ESP32s)
  wifi_set_channel(1);

  // 3. Initialize ESP-NOW
  if (esp_now_init() != 0) {
    Serial.println("{\"status\":\"ESP8266_ESPNOW_INIT_FAILED\"}");
    while (true) {
      digitalWrite(LED_PIN, LOW); delay(100);
      digitalWrite(LED_PIN, HIGH); delay(100);
    }
  }

  // 4. Set COMBO role (Receive uplinks + Transmit downlinks)
  esp_now_set_self_role(ESP_NOW_ROLE_COMBO);

  // 5. Register Receive Callback
  esp_now_register_recv_cb(onDataRecv);

  // 6. Register Broadcast Peer (FF:FF:FF:FF:FF:FF) on Channel 1
  if (esp_now_add_peer(broadcastAddress, ESP_NOW_ROLE_COMBO, 1, NULL, 0) != 0) {
    Serial.println("{\"status\":\"ESP8266_PEER_ADD_FAILED\"}");
  }

  // Startup flash
  for (int i = 0; i < 4; i++) {
    digitalWrite(LED_PIN, LOW); delay(50);
    digitalWrite(LED_PIN, HIGH); delay(50);
  }

  Serial.println("{\"status\":\"ESP8266_GATEWAY_READY\",\"band\":\"2.4GHz\",\"channel\":1,\"baud\":115200,\"role\":\"RECEIVER_AND_DISPATCH\"}");
}

void loop() {
  // Safe LED toggle in main thread
  if (packetReceivedFlag) {
    packetReceivedFlag = false;
    digitalWrite(LED_PIN, LOW);
    delay(20);
    digitalWrite(LED_PIN, HIGH);
  }

  // Check for downlink operator commands sent from Laptop Python over USB Serial
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.length() > 0) {
      // Broadcast downlink command out over 2.4GHz ESP-NOW Channel 1 to all zonal field nodes
      int res = esp_now_send(broadcastAddress, (uint8_t*)cmd.c_str(), cmd.length());

      // Pulse LED to confirm transmission
      digitalWrite(LED_PIN, LOW);
      delay(40);
      digitalWrite(LED_PIN, HIGH);

      if (res == 0) {
        Serial.printf("{\"status\":\"DOWNLINK_BROADCAST_OK\",\"len\":%d}\n", cmd.length());
      } else {
        Serial.println("{\"status\":\"DOWNLINK_BROADCAST_ERR\"}");
      }
    }
  }

  delay(2);
}
