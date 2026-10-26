// ============================================================================
// CrowdShield Hybrid Bridge Node Firmware
// Hardware: ESP32 + LoRa SX1278 (Connected via SPI) + Native 2.4GHz Wi-Fi (ESP-NOW)
// Bridges local high-speed cluster (Zones 2 & 3) onto the long-range LoRa backbone.
// Uses FreeRTOS Queue to prevent dropping packets during LoRa transmission!
// ============================================================================

#include <esp_now.h>
#include <WiFi.h>
#include <SPI.h>
#include <LoRa.h>

#define SS_PIN    5
#define RST_PIN   14
#define DIO0_PIN  26
#define LORA_BAND 433E6 // Or 866E6

typedef struct {
  uint8_t zone;
  uint8_t sos;
  uint8_t motion;
  uint32_t seq;
} Msg;

QueueHandle_t packetQueue;

// ESP-NOW 3.x callback signature (On core 2.x: const uint8_t *mac, const uint8_t *d, int len)
void onEspNowRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len != sizeof(Msg)) return;
  Msg m;
  memcpy(&m, data, sizeof(m));
  // Queue incoming packet non-blockingly so ESP-NOW never stalls
  xQueueSend(packetQueue, &m, 0);
}

void setup() {
  Serial.begin(115200);
  packetQueue = xQueueCreate(16, sizeof(Msg));

  // Initialize LoRa
  LoRa.setPins(SS_PIN, RST_PIN, DIO0_PIN);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("{\"error\":\"LORA_INIT_FAILED\"}");
    while (1);
  }
  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setTxPower(14);

  // Initialize ESP-NOW
  WiFi.mode(WIFI_STA);
  if (esp_now_init() != ESP_OK) {
    Serial.println("{\"error\":\"ESPNOW_INIT_FAILED\"}");
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);

  Serial.println("{\"status\":\"BRIDGE_NODE_ONLINE\"}");
}

void loop() {
  Msg m;
  // Drain queued packets from ESP-NOW cluster and broadcast over LoRa
  if (xQueueReceive(packetQueue, &m, pdMS_TO_TICKS(20))) {
    String payload = "{\"z\":" + String(m.zone) +
                     ",\"sos\":" + String(m.sos) +
                     ",\"mo\":" + String(m.motion) +
                     ",\"seq\":" + String(m.seq) + "}";
    LoRa.beginPacket();
    LoRa.print(payload);
    LoRa.endPacket();

    Serial.printf("[Bridge Relayed] %s\n", payload.c_str());
  }

  // Also listen for LoRa downlink commands from Gateway and broadcast to ESP-NOW cluster
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String cmd = "";
    while (LoRa.available()) {
      cmd += (char)LoRa.read();
    }
    // Broadcast to all nodes using broadcast MAC FF:FF:FF:FF:FF:FF
    uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    esp_now_send(broadcastAddress, (uint8_t*)cmd.c_str(), cmd.length());
  }
}
