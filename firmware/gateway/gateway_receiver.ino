/*
  CrowdShield Gateway Receiver ESP32 Firmware
  - Connects to Python Backend Spine via USB Serial (115200 baud)
  - Ingests Uplink sensor packets (Heartbeat, Motion, SOS, Fire Alert on GPIO 35) from Zonal Nodes
  - Receives Downlink display packets from Python:
      Format: ZONE|LEVEL|HEADER_TEXT|ROUTE_TEXT
      e.g. 1|3|FIRE IN Z2! AVOID Z2|SAFE EXIT: GATE B
  - Broadcasts display packets wirelessly to all Zonal Nodes over ESP-NOW / LoRa
*/

#include <WiFi.h>
#include <esp_now.h>

uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Uplink Packet (Zonal Node -> Gateway -> Python Backend)
typedef struct {
  uint8_t zone;
  uint8_t sos;    // 1 = SOS, 2 = FIRE!
  uint8_t motion;
  uint32_t seq;
} UplinkMsg;

// Downlink Packet (Python Backend -> Gateway -> Zonal Node Display)
typedef struct {
  uint8_t z;            // Target Zone (1..4 or 0 for All)
  uint8_t lvl;          // Risk Level (0..3)
  char headerText[40];  // e.g. "FIRE IN Z2! AVOID Z2"
  char routeText[40];   // e.g. "SAFE EXIT: GATE B"
} DownlinkDisplayMsg;

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
  int8_t rssi = info->rx_ctrl->rssi;
#else
void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
  int8_t rssi = -65;
#endif
  if (len == sizeof(UplinkMsg)) {
    UplinkMsg msg;
    memcpy(&msg, incomingData, sizeof(UplinkMsg));

    // Print JSON packet for Python serial_reader.py over USB
    Serial.print("{\"z\":"); Serial.print(msg.zone);
    Serial.print(",\"sos\":"); Serial.print(msg.sos);
    if (msg.sos == 2) {
      Serial.print(",\"fire\":1");
    }
    Serial.print(",\"mo\":"); Serial.print(msg.motion);
    Serial.print(",\"seq\":"); Serial.print(msg.seq);
    Serial.print(",\"rssi\":"); Serial.print(rssi);
    Serial.println("}");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);

  WiFi.mode(WIFI_STA);
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onDataRecv);
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 0;
    peerInfo.encrypt = false;
    esp_now_add_peer(&peerInfo);
  }

  Serial.println("[CrowdShield Gateway Ready] Listening for Zonal Uplinks & Serial Downlinks...");
}

void loop() {
  // Check for Downlink command strings from Python backend over USB Serial
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    // Expected format: ZONE|LEVEL|HEADER_TEXT|ROUTE_TEXT
    // e.g.: 1|3|FIRE IN Z2! AVOID Z2|SAFE EXIT: GATE B
    int p1 = line.indexOf('|');
    int p2 = line.indexOf('|', p1 + 1);
    int p3 = line.indexOf('|', p2 + 1);

    if (p1 != -1 && p2 != -1 && p3 != -1) {
      DownlinkDisplayMsg cmd = {};
      cmd.z   = (uint8_t)line.substring(0, p1).toInt();
      cmd.lvl = (uint8_t)line.substring(p1 + 1, p2).toInt();
      line.substring(p2 + 1, p3).toCharArray(cmd.headerText, sizeof(cmd.headerText));
      line.substring(p3 + 1).toCharArray(cmd.routeText, sizeof(cmd.routeText));

      esp_now_send(broadcastAddress, (uint8_t *)&cmd, sizeof(cmd));
      Serial.print("[GATEWAY BROADCAST TO LORA/ESP-NOW] -> Target Zone: ");
      Serial.print(cmd.z);
      Serial.print(" | "); Serial.print(cmd.headerText);
      Serial.print(" | "); Serial.println(cmd.routeText);
    }
  }
}
