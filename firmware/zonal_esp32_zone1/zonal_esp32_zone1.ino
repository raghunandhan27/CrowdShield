// ============================================================================
// CrowdShield — Production Zonal Field Node Firmware: ZONE 1
// Board: ESP32 DevKit V1
// Location: Main Gate Plaza | Designated Exit: Gate A (West)
// Dual Radio: 433MHz SX1278 LoRa Long-Range + 2.4GHz ESP-NOW Mesh Fallback
// Peripherals: 1602 LCD Display + DFPlayer Mini Audio + SOS Button + Status LED
// ============================================================================
//
// PHYSICAL PIN CONNECTIONS (IDENTICAL FOR ALL 3 ZONAL NODES):
// ----------------------------------------------------------------------------
// 1. SOS PUSH BUTTON:
//    - One leg        -> ESP32 GPIO 13
//    - Other leg      -> ESP32 GND
//    (Internal pull-up enabled; pressing button pulls GPIO 13 to LOW)
//
// 2. STATUS / VISUAL ALARM LED:
//    - Anode (Long leg)  -> ESP32 GPIO 27 (via 330Ω resistor)
//    - Cathode (Short)   -> ESP32 GND
//
// 3. 1602 LCD DISPLAY (Direct 4-Bit Parallel Mode):
//    - Pin 1 (VSS/GND)   -> GND
//    - Pin 2 (VDD/5V)    -> 5V (ESP32 VIN)
//    - Pin 3 (VO)        -> 1kΩ or 1.5kΩ resistor to GND (Optimal contrast)
//    - Pin 4 (RS)        -> ESP32 GPIO 21
//    - Pin 5 (RW)        -> GND (Write mode)
//    - Pin 6 (E)         -> ESP32 GPIO 22
//    - Pin 11 (D4)       -> ESP32 GPIO 17
//    - Pin 12 (D5)       -> ESP32 GPIO 16
//    - Pin 13 (D6)       -> ESP32 GPIO 4
//    - Pin 14 (D7)       -> ESP32 GPIO 15
//    - Pin 15 (A/BLA)    -> 5V (via 220Ω resistor or directly to 3.3V)
//    - Pin 16 (K/BLK)    -> GND
//
// 4. DFPLAYER MINI MP3 PLAYER & 3W SPEAKER:
//    - Pin 1 (VCC)       -> 5V (ESP32 VIN)
//    - Pin 2 (RX)        -> 1kΩ resistor -> ESP32 GPIO 26 (TX2)
//    - Pin 3 (TX)        -> ESP32 GPIO 25 (RX2)
//    - Pin 6 (SPK_1)     -> Speaker terminal 1
//    - Pin 7 (GND)       -> GND
//    - Pin 8 (SPK_2)     -> Speaker terminal 2
//
// 5. SX1278 LORA TRANSCEIVER (Ra-02 433MHz):
//    - 3.3V              -> ESP32 3.3V (CRITICAL: NEVER CONNECT TO 5V!)
//    - GND               -> GND
//    - NSS (CS)          -> ESP32 GPIO 5
//    - RST               -> ESP32 GPIO 14
//    - DIO0              -> ESP32 GPIO 33
//    - SCK               -> ESP32 GPIO 18
//    - MISO              -> ESP32 GPIO 19
//    - MOSI              -> ESP32 GPIO 23
// ============================================================================

#include <SPI.h>
#include <LoRa.h>
#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include <LiquidCrystal.h>

// ============================================================================
// ZONE CONFIGURATION (ZONE 1)
// ============================================================================
#define ZONE_ID 1
const char* NODE_NAME  = "NODE-Z1";
const char* ZONE_NAME  = "MAIN GATE PLAZA";
const char* EXIT_POINT = "GATE A (WEST)";
const char* EVAC_MSG   = "EXIT VIA GATE A ";
const char* IDLE_MSG   = "EXIT: GATE A (W)";

// Pin Assignments
// SILENT PRESENTATION MODE: Set to 1 to mute hardware speaker for Judge Presentation
#define SILENT_PRESENTATION_MODE 0
#define BUTTON_PIN 13   // SOS Button connected to GPIO 13 and GND
#define LED_PIN    27   // Status & Alarm LED
#define MIC_PIN    34   // Optional sound/mic analog sensor (ADC1)

// DFPlayer Mini on HardwareSerial 2
#define DF_RX_PIN  25   // Connects to DFPlayer TX
#define DF_TX_PIN  26   // Connects through 1kΩ to DFPlayer RX

// SX1278 LoRa SPI Pins
#define LORA_SS    5    // Chip Select (NSS)
#define LORA_RST   14   // Hardware Reset
#define LORA_DIO0  33   // Packet Ready IRQ
#define LORA_BAND  433E6 // 433 MHz for SX1278

// 1602 LCD: RS=21, E=22, D4=17, D5=16, D6=4, D7=15
LiquidCrystal lcd(21, 22, 17, 16, 4, 15);

HardwareSerial dfSerial(2);
DFRobotDFPlayerMini myDFPlayer;

bool dfPlayerOnline = false;
bool loraOnline = false;

// Robust Button Debounce & Edge Detection
int lastRawButtonReading = HIGH;
int stableButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 80;

unsigned long lastSend = 0;
unsigned long lastDownlinkHeard = 0;
unsigned long sosLatchUntil = 0;
uint32_t seqCounter = 0;
int currentDisplayedState = 0; // 0=Normal, 1=SOS, 2=Evac, 3=Caution, 4=AllClear

// ESP-NOW Broadcast MAC Address (FF:FF:FF:FF:FF:FF)
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Volatile state for audio & display playback triggered from downlink
volatile int pendingTrackToPlay = 0;
volatile int pendingAlertLevel = 0;
volatile bool pendingLcdUpdate = false;
char pendingLcdLine1[17] = "";
char pendingLcdLine2[17] = "";

// LCD Helper to print formatted 16-character lines cleanly (Anti-Flicker Text Caching)
static char lastLcdLine1[17] = "";
static char lastLcdLine2[17] = "";

void updateLcd(const char* line1, const char* line2) {
  char buf1[17];
  char buf2[17];
  snprintf(buf1, sizeof(buf1), "%-16s", line1 ? line1 : "");
  snprintf(buf2, sizeof(buf2), "%-16s", line2 ? line2 : "");

  // Skip hardware write if display content has not changed - eliminates 100% of LCD flickering!
  if (strncmp(lastLcdLine1, buf1, 16) == 0 && strncmp(lastLcdLine2, buf2, 16) == 0) {
    return;
  }
  strncpy(lastLcdLine1, buf1, 16);
  lastLcdLine1[16] = '\0';
  strncpy(lastLcdLine2, buf2, 16);
  lastLcdLine2[16] = '\0';

  lcd.setCursor(0, 0);
  lcd.print(buf1);
  lcd.setCursor(0, 1);
  lcd.print(buf2);
}

// ============================================================================
// TELEMETRY TRANSMITTER (TRANSMITS DUAL BURST: LORA 433MHz + ESP-NOW 2.4GHz)
// ============================================================================
void transmitPacket(bool isSosActive) {
  seqCounter++;
  float volts = 4.12; 
  int pct = 90;
  int micVal = analogRead(MIC_PIN);
  int motionDetected = (micVal > 3000) ? 1 : 0;

  String pkt = "{\"node\":\"" + String(NODE_NAME) + "\"" +
               ",\"z\":" + String(ZONE_ID) +
               ",\"sos\":" + String(isSosActive ? 1 : 0) +
               ",\"mo\":" + String(motionDetected) +
               ",\"seq\":" + String(seqCounter) +
               ",\"batteryVolts\":" + String(volts, 2) +
               ",\"batteryPct\":" + String(pct) + "}";

  // 1. Transmit via 433MHz SX1278 LoRa
  if (loraOnline) {
    LoRa.beginPacket();
    LoRa.print(pkt);
    LoRa.endPacket();
    LoRa.receive(); // Immediately resume continuous receive mode
  }

  // 2. Transmit via 2.4GHz ESP-NOW Mesh
  esp_now_send(broadcastAddress, (uint8_t*)pkt.c_str(), pkt.length());

  if (isSosActive) {
    Serial.printf("[TX 🚨 SOS] (LoRa:%s, ESP-NOW:OK) %s\n", loraOnline ? "OK" : "OFF", pkt.c_str());
    digitalWrite(LED_PIN, LOW); delay(25); digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.printf("[TX Heartbeat] %s (LoRa:%s)\n", pkt.c_str(), loraOnline ? "OK" : "OFF");
    digitalWrite(LED_PIN, LOW); delay(15); digitalWrite(LED_PIN, HIGH);
  }
}

// ============================================================================
// DOWNLINK COMMAND PROCESSOR (SHARED BY LORA AND ESP-NOW)
// ============================================================================
void processDownlinkCommand(const String& incoming, const char* sourceName) {
  Serial.printf("[%s RX Downlink] %s\n", sourceName, incoming.c_str());

  // 1. Support pipe-delimited display format: "zNum|alertLevel|instructionText" (e.g. "1|3|FIRE IN Z2 - REROUTE VIA GATE A")
  if (incoming.indexOf('|') != -1) {
    int firstPipe = incoming.indexOf('|');
    int targetZ = incoming.substring(0, firstPipe).toInt();
    if (targetZ == ZONE_ID || targetZ == 0) {
      int secondPipe = incoming.indexOf('|', firstPipe + 1);
      if (secondPipe != -1) {
        int pipeLvl = incoming.substring(firstPipe + 1, secondPipe).toInt();
        String textPayload = incoming.substring(secondPipe + 1);
        textPayload.trim();
        lastDownlinkHeard = millis();
        int pipeTrack = (pipeLvl >= 3) ? 1 : ((pipeLvl == 2) ? 2 : 3);
        pendingTrackToPlay = pipeTrack;
        pendingAlertLevel = pipeLvl;

        // Display zone-specific instruction and exit arrow on 1602 LCD
        String l1 = textPayload.substring(0, min(16, (int)textPayload.length()));
        String l2 = (textPayload.length() > 16) ? textPayload.substring(16, min(32, (int)textPayload.length())) : "";
        // Thread-safe LCD buffer (rendered in loop to avoid ISR race)
        snprintf(pendingLcdLine1, sizeof(pendingLcdLine1), "%-16s", l1.c_str());
        snprintf(pendingLcdLine2, sizeof(pendingLcdLine2), "%-16s", l2.c_str());
        pendingLcdUpdate = true;
        currentDisplayedState = (pipeLvl >= 3) ? 2 : ((pipeLvl == 2) ? 3 : 4);
        return;
      }
    }
  }

  // 2. Support standard JSON format
  bool isForThisZone = false;
  String myZStr1 = "\"z\":" + String(ZONE_ID);
  String myZStr2 = "\"z\": " + String(ZONE_ID);
  String bCastStr1 = "\"z\":0";
  String bCastStr2 = "\"z\": 0";

  if (incoming.indexOf(myZStr1) != -1 || incoming.indexOf(myZStr2) != -1 ||
      incoming.indexOf("\"zone\":" + String(ZONE_ID)) != -1 ||
      incoming.indexOf("\"zone\": " + String(ZONE_ID)) != -1 ||
      incoming.indexOf(bCastStr1) != -1 || incoming.indexOf(bCastStr2) != -1 ||
      incoming.indexOf("\"zone\":0") != -1 || incoming.indexOf("\"zone\": 0") != -1 ||
      incoming.indexOf("\"z\":\"0\"") != -1 || incoming.indexOf("\"z\": \"0\"") != -1 ||
      incoming.indexOf("ALL") != -1 || incoming.indexOf("SIREN_ON") != -1) {
    isForThisZone = true;
  }

  if (!isForThisZone) {
    return; // Ignore downlinks intended for other zones
  }

  lastDownlinkHeard = millis();

  int trackNum = 1;
  int lvlNum = 3;

  if (incoming.indexOf("\"track\":1") != -1 || incoming.indexOf("\"track\": 1") != -1 ||
      incoming.indexOf("0001") != -1 || incoming.indexOf("EVACUATE") != -1 || 
      incoming.indexOf("SIREN_ON") != -1 || incoming.indexOf("INST-01") != -1 || incoming.indexOf("FALL") != -1) {
    trackNum = 1;
    lvlNum = 3;
  } else if (incoming.indexOf("\"track\":2") != -1 || incoming.indexOf("\"track\": 2") != -1 ||
             incoming.indexOf("0002") != -1 || incoming.indexOf("CAUTION") != -1 || 
             incoming.indexOf("INST-02") != -1) {
    trackNum = 2;
    lvlNum = 2;
  } else if (incoming.indexOf("\"track\":3") != -1 || incoming.indexOf("\"track\": 3") != -1 ||
             incoming.indexOf("0003") != -1 || incoming.indexOf("CLEAR") != -1 || 
             incoming.indexOf("STANDBY") != -1 || incoming.indexOf("INST-03") != -1) {
    trackNum = 3;
    lvlNum = 1;
  }

  pendingTrackToPlay = trackNum;
  pendingAlertLevel = lvlNum;
}

// ESP-NOW Receive Callback
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
#else
void onDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
  if (len <= 0) return;
  char buffer[256];
  int copyLen = (len < 255) ? len : 255;
  memcpy(buffer, incomingData, copyLen);
  buffer[copyLen] = '\0';
  String incoming = String(buffer);
  incoming.trim();
  processDownlinkCommand(incoming, "ESP-NOW");
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(MIC_PIN, INPUT);
  digitalWrite(LED_PIN, LOW);

  // Read initial button state after pull-up settles
  delay(50);
  int bootButtonState = digitalRead(BUTTON_PIN);
  lastRawButtonReading = bootButtonState;
  stableButtonState = bootButtonState;

  // 1. Initialize 1602 LCD Display
  lcd.begin(16, 2);
  updateLcd("CROWDSHIELD NODE", "INITIALIZING...");

  Serial.println("\n=======================================================");
  Serial.printf(" CROWDSHIELD NODE: %s (Zone %d - %s)\n", NODE_NAME, ZONE_ID, ZONE_NAME);
  Serial.printf(" Designated Exit: %s\n", EXIT_POINT);
  Serial.println(" Radios: 433MHz SX1278 LoRa + 2.4GHz ESP-NOW Mesh");
  Serial.printf(" Peripherals: 1602 LCD + DFPlayer + SOS (Pin %d) + LED (Pin 27)\n", BUTTON_PIN);
  Serial.println("=======================================================");

  if (bootButtonState == LOW) {
    Serial.printf(" [NOTICE] SOS Button on GPIO %d is LOW at boot. Alert suppressed until released.\n\n", BUTTON_PIN);
  } else {
    Serial.printf(" [OK] SOS Button on GPIO %d is READY (HIGH = Released).\n\n", BUTTON_PIN);
  }

  // 2. Initialize DFPlayer Mini Audio on HardwareSerial 2
  dfSerial.begin(9600, SERIAL_8N1, DF_RX_PIN, DF_TX_PIN);
  delay(250);

  myDFPlayer.begin(dfSerial, false, false);
  dfPlayerOnline = true;
  delay(100);
  #if SILENT_PRESENTATION_MODE
  myDFPlayer.volume(0); // Muted for Judge Presentation
  Serial.println("[DFPlayer] Speaker Muted (SILENT_PRESENTATION_MODE Active for Judges)");
#else
  myDFPlayer.volume(24); // Stable volume prevents power dip
  delay(50);
  myDFPlayer.volume(24); // Re-assert volume to ensure GD3200/MH2024 UART sync
  Serial.println("[DFPlayer] Active & Ready on TX2 Pin 26 (Volume 24)");
#endif

  // 3. Initialize SX1278 LoRa Radio (433MHz)
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  LoRa.setSPIFrequency(1E6); // 1 MHz SPI eliminates line noise
  if (LoRa.begin(LORA_BAND)) {
    loraOnline = true;
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
    LoRa.setSyncWord(0x12);
    LoRa.setTxPower(10, PA_OUTPUT_PA_BOOST_PIN); // +10dBm (~30mA) eliminates 3.3V brownout risk
    LoRa.setOCP(100);
    LoRa.receive(); // Enter continuous RX mode immediately
    Serial.println("[LoRa 433MHz] SX1278 Online & Active (SF9, BW125kHz, CR4/5, +10dBm Clean)");
  } else {
    Serial.println("[LoRa 433MHz] Warning: SX1278 not found. Falling back to ESP-NOW 2.4GHz mesh!");
  }

  // 4. Initialize ESP-NOW Mesh Fallback Radio (Wi-Fi Channel 1 Locked)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(1, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (esp_now_init() == ESP_OK) {
    Serial.println("[ESP-NOW 2.4GHz] Mesh Channel 1 Online & Initialized!");

    #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
      esp_now_register_recv_cb(onDataRecv);
    #else
      esp_now_register_recv_cb(onDataRecv);
    #endif

    // Register Broadcast Peer (FF:FF:FF:FF:FF:FF)
    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 1;
    peerInfo.encrypt = false;
    esp_now_add_peer(&peerInfo);
  }

  // Steady Green / Solid ON LED confirms node is live and monitoring
  digitalWrite(LED_PIN, HIGH);

  // Ready Screen on 1602 LCD
  char readyLine[17];
  snprintf(readyLine, sizeof(readyLine), "ZONE %d: READY", ZONE_ID);
  updateLcd(readyLine, IDLE_MSG);
  delay(1200);

  char normalLine[17];
  snprintf(normalLine, sizeof(normalLine), "ZONE %d: ENTRY OK", ZONE_ID);
  updateLcd(normalLine, IDLE_MSG);
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  unsigned long now = millis();

  // Render thread-safe LCD update from downlink if available
  if (pendingLcdUpdate) {
    pendingLcdUpdate = false;
    updateLcd(pendingLcdLine1, pendingLcdLine2);
  }

  // --------------------------------------------------------------------------
  // 1. CHECK FOR INCOMING LORA DOWNLINK PACKETS
  // --------------------------------------------------------------------------
  if (loraOnline) {
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
      String loraIncoming = "";
      while (LoRa.available()) {
        loraIncoming += (char)LoRa.read();
      }
      loraIncoming.trim();
      processDownlinkCommand(loraIncoming, "LoRa");
    }
  }

  // --------------------------------------------------------------------------
  // 2. EXECUTE DOWNLINK ACTIONS (AUDIO PLAYBACK + LCD + STROBE)
  // --------------------------------------------------------------------------
  if (pendingTrackToPlay > 0) {
    int track = pendingTrackToPlay;
    int lvl = pendingAlertLevel;
    pendingTrackToPlay = 0;

    static unsigned long lastAudioPlayTime = 0;
    static int lastAudioTrack = 0;

    // Debounce downlink commands to prevent continuous loop lockup and audio restart
    if (now - lastAudioPlayTime > 3000 || track != lastAudioTrack) {
      lastAudioPlayTime = now;
      lastAudioTrack = track;
#if SILENT_PRESENTATION_MODE
      Serial.printf("\n>>> [ACTION] Warning Track %d Triggered (Audio Muted for Judges Presentation) <<<\n", track);
#else
      Serial.printf("\n>>> [ACTION] Playing Warning Message Track %d on DFPlayer Mini (Level %d) <<<\n", track, lvl);
      myDFPlayer.volume(24);
      delay(30);
      myDFPlayer.play(track);
      delay(30);
      myDFPlayer.start(); // Ensure immediate playback start
#endif

      // Update 1602 LCD Display and Visual LED only on fresh command / cooldown
      if (track == 1) {
        // PRESET 1: EMERGENCY EVACUATION (Targeted to designated exit)
        updateLcd("! EVACUATE NOW !", EVAC_MSG);
        currentDisplayedState = 2;
        for (int i = 0; i < 8; i++) {
          digitalWrite(LED_PIN, LOW); delay(40); yield();
          digitalWrite(LED_PIN, HIGH); delay(40); yield();
        }
      } else if (track == 2) {
        // PRESET 2: CROWD CAUTION / SLOW DOWN
        updateLcd("! CROWD CAUTION !", "SLOW DOWN - WAIT");
        currentDisplayedState = 3;
        for (int i = 0; i < 4; i++) {
          digitalWrite(LED_PIN, LOW); delay(100); yield();
          digitalWrite(LED_PIN, HIGH); delay(100); yield();
        }
      } else {
        // PRESET 3: ALL CLEAR / STANDBY
        char line1[17];
        snprintf(line1, sizeof(line1), "ZONE %d: ALL CLEAR", ZONE_ID);
        updateLcd(line1, IDLE_MSG);
        currentDisplayedState = 4;
        for (int i = 0; i < 2; i++) {
          digitalWrite(LED_PIN, LOW); delay(200); yield();
          digitalWrite(LED_PIN, HIGH); delay(200); yield();
        }
      }

      digitalWrite(LED_PIN, HIGH); // Restore solid ON
    }
  }

  // --------------------------------------------------------------------------
  // 3. PHYSICAL SOS BUTTON DETECTION & DEBOUNCING (GPIO 13)
  // --------------------------------------------------------------------------
  int rawReading = digitalRead(BUTTON_PIN);

  // Debounce timing
  if (rawReading != lastRawButtonReading) {
    lastDebounceTime = now;
  }
  lastRawButtonReading = rawReading;

  // Once signal has remained stable for at least DEBOUNCE_DELAY_MS (50ms)
  if ((now - lastDebounceTime) > DEBOUNCE_DELAY_MS) {
    // True Falling Edge: Transition from RELEASED (HIGH) to PRESSED (LOW)
    if (rawReading == LOW && stableButtonState == HIGH) {
      stableButtonState = LOW;

      Serial.printf("\n🚨 [EMERGENCY SOS PRESSED] Physical Button triggered in Zone %d!\n", ZONE_ID);
      sosLatchUntil = now + 4000; // Latch SOS active for 4 seconds

      char line1[17];
      snprintf(line1, sizeof(line1), "! SOS IN ZONE %d !", ZONE_ID);
      updateLcd(line1, "ALERTING CMDCENTER");
      currentDisplayedState = 1;

      // Immediate Burst: transmit 3 rapid packets spaced by 40ms over both radios
      for (int b = 0; b < 3; b++) {
        transmitPacket(true);
        delay(40);
      }
      lastSend = millis();
    }
    // Rising Edge: Transition from PRESSED (LOW) back to RELEASED (HIGH)
    else if (rawReading == HIGH && stableButtonState == LOW) {
      stableButtonState = HIGH;
      Serial.printf("[BUTTON RELEASED] Zone %d SOS button released (Pin %d = HIGH).\n", ZONE_ID, BUTTON_PIN);
    }
  }

  bool isSosActive = (now < sosLatchUntil);

  // Restore LCD after SOS period clears
  if (!isSosActive && currentDisplayedState == 1) {
    char line1[17];
    snprintf(line1, sizeof(line1), "ZONE %d: ENTRY OK", ZONE_ID);
    updateLcd(line1, IDLE_MSG);
    currentDisplayedState = 0;
  }

  // --------------------------------------------------------------------------
  // 4. PERIODIC TELEMETRY (350ms during active SOS, 2000ms idle heartbeat)
  // --------------------------------------------------------------------------
  unsigned long interval = isSosActive ? 350 : 2000;
  if (now - lastSend >= interval) {
    transmitPacket(isSosActive);
    lastSend = now;
  }

  delay(10);
}
