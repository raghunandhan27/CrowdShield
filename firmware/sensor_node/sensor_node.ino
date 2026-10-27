/*
  CrowdShield Zonal Node ESP32 Firmware
  - Real-time I2C OLED Digital Signboard (SSD1306 on GPIO 21 SDA & GPIO 22 SCL)
  - Automatic LED Wayfinding Arrows:
      * GPIO 18: Arrow -> Gate A (Normal Egress)
      * GPIO 19: Arrow -> Gate B / Gate C (Safe Bypass Egress)
  - Relay for Emergency Doors + Exhaust Fan (GPIO 33)
  - DFPlayer Mini Voice Synthesizer on GPIO 25/26 (Serial2)
  - Physical Flame / Smoke Sensor input on GPIO 35 (KY-026 Active LOW)
  - Physical SOS / Fire Button on GPIO 13 (Active LOW)
  - ESP-NOW & LoRa Mesh Zero-Internet Resilient Network
*/

#include <WiFi.h>
#include <esp_now.h>
#include <HardwareSerial.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define ZONE_ID         1   // Set to 1, 2, or 3 for each node

// Breadboard Pins
#define BUTTON_PIN      13  // SOS / Fire Button (Active LOW)
#define LED_PIN         27  // Red Beacon Status LED
#define DF_RX_PIN       25  // To DFPlayer TX (Pin 3)
#define DF_TX_PIN       26  // Via 1k resistor to DFPlayer RX (Pin 2)

// Actuators & Wayfinding Arrow Pins
#define SERVO_PIN       32  // SG90 Servo Entry Barrier
#define RELAY_FAN_PIN   33  // Emergency Exit Door Unlocker + Exhaust Fan Relay
#define ARROW_GATE_A    18  // Green LED Arrow -> Gate A (Normal Route)
#define ARROW_GATE_B    19  // Green LED Arrow -> Gate B / Gate C (Safe Reroute)
#define FIRE_SENSOR_PIN 35  // Optional Flame Sensor (KY-026 Digital DO, Active LOW)

// I2C OLED Display (SSD1306 128x64)
#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
bool hasDisplay = false;

HardwareSerial dfSerial(2);
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Uplink Packet (Zonal Node -> Gateway -> Python Backend)
typedef struct {
  uint8_t zone;
  uint8_t sos;    // 1 = SOS Medical, 2 = FIRE DETECTED!
  uint8_t motion;
  uint32_t seq;
} UplinkMsg;

// Downlink Packet (Python Backend -> Gateway -> Zonal Node Display)
typedef struct {
  uint8_t z;            // Target Zone (1..4 or 0 for All)
  uint8_t lvl;          // Risk Level (0..3)
  char headerText[40];  // e.g., "FIRE IN Z2! AVOID Z2"
  char routeText[40];   // e.g., "SAFE EXIT: GATE B"
} DownlinkDisplayMsg;

UplinkMsg msg;
DownlinkDisplayMsg incomingDisplay;
volatile bool newDisplayCmd = false;

bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long lastSendTime = 0;

// ==========================================================
// 1. UPDATE PHYSICAL DISPLAY SCREEN & WAYFINDING ARROWS
// ==========================================================
void renderDisplayAndActuators(uint8_t lvl, const char* header, const char* route) {
  Serial.println("\n+------------------------------------------------+");
  Serial.println("|        ZONAL LIVE DIGITAL SIGNBOARD            |");
  Serial.println("+------------------------------------------------+");
  Serial.print  ("| ZONE "); Serial.print(ZONE_ID);
  Serial.print  (" | ALERT LEVEL: "); Serial.println(lvl);
  Serial.print  ("| STATUS : "); Serial.println(header);
  Serial.print  ("| ROUTE  : >>> "); Serial.print(route); Serial.println(" <<<");
  Serial.println("+------------------------------------------------+\n");

  // Update I2C OLED Screen if connected on GPIO 21 / 22
  if (hasDisplay) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);

    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print("ZONE "); display.print(ZONE_ID);
    display.print(" | ALERT LVL "); display.println(lvl);
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

    display.setCursor(0, 15);
    display.println(header);

    display.setTextSize(2); // Bold large text for safe exit route
    display.setCursor(0, 34);
    display.println(route);
    display.display();
  }

  // Automatically set Physical LED Wayfinding Arrows based on the calculated route!
  String routeStr = String(route);
  if (routeStr.indexOf("GATE B") != -1 || routeStr.indexOf("GATE C") != -1) {
    digitalWrite(ARROW_GATE_A, LOW);   // Turn OFF blocked Gate A arrow
    digitalWrite(ARROW_GATE_B, HIGH);  // Turn ON safe bypass Gate B arrow!
    Serial.println(" -> [LED ARROWS] Rerouted! Gate A Arrow OFF | Gate B Arrow ON");
  } else {
    digitalWrite(ARROW_GATE_A, HIGH);
    digitalWrite(ARROW_GATE_B, LOW);
    Serial.println(" -> [LED ARROWS] Normal Path: Gate A Arrow ON");
  }

  // Trigger Emergency Relay (Unlock doors + Exhaust Fan) & Speaker on Level 2/3
  if (lvl >= 2) {
    digitalWrite(RELAY_FAN_PIN, HIGH); // Unlock emergency doors & start exhaust
    playDFTrack(lvl);                  // Play Track 2 (Reroute) or Track 3 (Evacuate)
  } else if (lvl == 1) {
    playDFTrack(1);
  } else {
    digitalWrite(RELAY_FAN_PIN, LOW);
  }
}

// ==========================================================
// 2. ZERO-LIBRARY DFPLAYER COMMANDS
// ==========================================================
void sendDFCommand(uint8_t cmd, uint16_t param) {
  uint8_t pH = (uint8_t)(param >> 8);
  uint8_t pL = (uint8_t)(param & 0xFF);
  uint16_t csum = 0 - (0xFF + 0x06 + cmd + 0x00 + pH + pL);
  uint8_t pkt[10] = {0x7E, 0xFF, 0x06, cmd, 0x00, pH, pL, (uint8_t)(csum >> 8), (uint8_t)(csum & 0xFF), 0xEF};
  dfSerial.write(pkt, 10);
}

void playDFTrack(int trackNum) {
  sendDFCommand(0x03, trackNum);
  for (int i = 0; i < 4; i++) {
    digitalWrite(LED_PIN, LOW); delay(100);
    digitalWrite(LED_PIN, HIGH); delay(100);
  }
}

// ==========================================================
// 3. WIRELESS RECEIVE CALLBACK (From Gateway ESP32)
// ==========================================================
#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
#else
void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
  if (len == sizeof(DownlinkDisplayMsg)) {
    memcpy((void*)&incomingDisplay, incomingData, sizeof(DownlinkDisplayMsg));
    if (incomingDisplay.z == ZONE_ID || incomingDisplay.z == 0) {
      newDisplayCmd = true;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(RELAY_FAN_PIN, OUTPUT);
  pinMode(ARROW_GATE_A, OUTPUT);
  pinMode(ARROW_GATE_B, OUTPUT);
  pinMode(FIRE_SENSOR_PIN, INPUT);
  digitalWrite(LED_PIN, HIGH);

  // Initialize I2C OLED Display on GPIO 21 (SDA) and GPIO 22 (SCL)
  Wire.begin(21, 22);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    hasDisplay = true;
    display.clearDisplay();
    display.display();
  }

  // Initialize DFPlayer Mini on Serial2
  dfSerial.begin(9600, SERIAL_8N1, DF_RX_PIN, DF_TX_PIN);
  delay(600);
  sendDFCommand(0x06, 26); // Volume 26/30

  // Initialize ESP-NOW
  WiFi.mode(WIFI_STA);
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onDataRecv);
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 0;
    peerInfo.encrypt = false;
    esp_now_add_peer(&peerInfo);
  }

  // Boot into Normal State
  renderDisplayAndActuators(0, "STATUS: ALL CLEAR", "EXIT: GATE A");
  Serial.println("\n[CrowdShield Zonal Node Ready]");
  Serial.println("Type 'FIRE' in Serial Monitor to test automatic Fire Reroute Display!");
}

void loop() {
  unsigned long now = millis();

  // 1. If Gateway sent a new Fire Reroute + Display message over wireless:
  if (newDisplayCmd) {
    newDisplayCmd = false;
    renderDisplayAndActuators(incomingDisplay.lvl, incomingDisplay.headerText, incomingDisplay.routeText);
  }

  // 2. Test Directly in Serial Monitor (Type "FIRE" or "SAFE")
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.equalsIgnoreCase("FIRE")) {
      renderDisplayAndActuators(3, "FIRE IN Z2! AVOID Z2", "USE GATE B ->");
    } else if (cmd.equalsIgnoreCase("SAFE")) {
      renderDisplayAndActuators(0, "STATUS: ALL CLEAR", "EXIT: GATE A");
    }
  }

  // 3. Physical Flame Sensor Check (KY-026 on GPIO 35, Active LOW)
  int flameVal = digitalRead(FIRE_SENSOR_PIN);
  if (flameVal == LOW) { // Flame detected!
    msg.zone = ZONE_ID;
    msg.sos = 2; // 2 = FIRE ALARM
    msg.motion = 1;
    msg.seq++;
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));
    Serial.println(">>> [FLAME SENSOR GPIO 35 TRIGGERED!] Transmitted Fire Alert Uplink!");
    renderDisplayAndActuators(3, "FIRE DETECTED HERE!", "EVACUATE NOW ->");
    delay(1000);
  }

  // 4. Physical Button Press -> Trigger Fire/SOS Uplink to Command Centre
  int reading = digitalRead(BUTTON_PIN);
  if (reading == LOW && lastButtonState == HIGH && (now - lastDebounceTime > 250)) {
    lastDebounceTime = now;
    msg.zone = ZONE_ID;
    msg.sos = 2; // 2 = Fire / Critical Hazard Trigger
    msg.motion = 1;
    msg.seq++;
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));

    Serial.print("{\"z\":"); Serial.print(ZONE_ID);
    Serial.print(",\"sos\":2,\"fire\":1,\"seq\":");
    Serial.print(msg.seq);
    Serial.println("}\t-60");

    // Immediately show local emergency reroute
    renderDisplayAndActuators(3, "FIRE IN Z2! AVOID Z2", "USE GATE B ->");
  }
  lastButtonState = reading;

  // 5. 5-Second Heartbeat
  if (now - lastSendTime >= 5000) {
    lastSendTime = now;
    msg.zone = ZONE_ID;
    msg.sos = 0;
    msg.motion = 0;
    msg.seq++;
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));
  }
}
