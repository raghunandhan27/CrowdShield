// ============================================================================
// CrowdShield Field Node Firmware (ESP32 + LoRa + DFPlayer + Sensors)
// Hardware: ESP32 DevKit + SX1278 (433MHz/866MHz) + DFPlayer Mini + 3W 4Ω Spk + SOS Button
// ============================================================================

#include <SPI.h>
#include <LoRa.h>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>

// --- Radio Frequency Configuration ---
// For India ISM license-free band: use 866E6
// For standard 433MHz SX1278 modules: use 433E6
#define LORA_BAND 433E6 

// --- LoRa SPI Pinout ---
#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2   // Or GPIO 33/26 depending on board

// --- Peripheral Pinout (Remapped for PSRAM compatibility) ---
#define BUTTON_PIN 13  // Physical SOS Push-Button (to GND, internal pull-up)
#define LED_PIN    27  // Status / Visual Alarm LED (via 330Ω to GND)
#define MIC_PIN    34  // Analog Audio / Mic Envelope (ADC1 input)

// HardwareSerial 2 for DFPlayer Mini
#define DF_RX_PIN  25  // Connects to DFPlayer TX
#define DF_TX_PIN  26  // Connects via 1kΩ resistor to DFPlayer RX

const int ZONE_ID = 1; // Change to 2, 3, or 4 per physical node
const char* NODE_NAME = "NODE-Z1";

HardwareSerial dfSerial(2);
DFRobotDFPlayerMini myDFPlayer;

bool dfPlayerOnline = false;
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long lastSend = 0;
unsigned long lastAudioAlertTime = 0;
unsigned long lastDownlinkHeard = 0;
uint32_t seqCounter = 0;

void setup() {
  Serial.begin(115200);
  
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(MIC_PIN, INPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n[CrowdShield] Booting Field Node...");

  // 1. Initialize DFPlayer Mini
  dfSerial.begin(9600, SERIAL_8N1, DF_RX_PIN, DF_TX_PIN);
  if (myDFPlayer.begin(dfSerial)) {
    dfPlayerOnline = true;
    myDFPlayer.volume(22); // Volume range: 0-30
    Serial.println("[DFPlayer] Online and ready with 3W 4Ω speaker!");
  } else {
    Serial.println("[WARN] DFPlayer not detected or SD card missing. Running in radio/sensor mode.");
  }

  // 2. Initialize LoRa Radio
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[ERROR] LoRa transceiver failed to start! Check 3.3V and SPI wiring.");
    while (true) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      delay(200);
    }
  }

  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setTxPower(14);

  digitalWrite(LED_PIN, HIGH); // Solid light = node initialized
  lastDownlinkHeard = millis();
  Serial.printf("[LoRa] Online on frequency %.1f MHz. Node %s ready!\n", LORA_BAND / 1E6, NODE_NAME);
}

void loop() {
  unsigned long now = millis();

  // --- 1. SOS BUTTON DEBOUNCE & DETECTION ---
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = now;
  }
  bool sosActive = false;
  if ((now - lastDebounceTime) > 40) {
    if (reading == LOW) {
      sosActive = true;
    }
  }
  lastButtonState = reading;

  // --- 2. DUAL-RATE HEARTBEAT TRANSMISSION ---
  // Transmits every 500ms when SOS is held, otherwise every 5000ms as alive heartbeat
  unsigned long interval = sosActive ? 500 : 5000;
  if (now - lastSend >= interval) {
    seqCounter++;
    
    // Read analog noise / sound envelope
    int micVal = analogRead(MIC_PIN);
    int motionDetected = (micVal > 3000) ? 1 : 0;

    // Send compact JSON packet
    String pkt = "{\"node\":\"" + String(NODE_NAME) + "\"" +
                 ",\"z\":" + String(ZONE_ID) +
                 ",\"sos\":" + String(sosActive ? 1 : 0) +
                 ",\"mo\":" + String(motionDetected) +
                 ",\"seq\":" + String(seqCounter) + "}";

    LoRa.beginPacket();
    LoRa.print(pkt);
    LoRa.endPacket();

    Serial.printf("[TX Uplink] %s\n", pkt.c_str());

    // Flash LED on packet transmission
    digitalWrite(LED_PIN, LOW);
    delay(40);
    digitalWrite(LED_PIN, HIGH);

    lastSend = now;
  }

  // --- 3. DOWNLINK RECEIVER (LISTEN FOR COMMAND CENTER) ---
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    incoming.trim();
    lastDownlinkHeard = now;

    Serial.printf("[RX Downlink] %s (RSSI: %d dBm)\n", incoming.c_str(), LoRa.packetRssi());

    // Check if command is for this zone or broadcast
    if (incoming.indexOf("EVACUATE") != -1 || incoming.indexOf("\"lvl\":3") != -1) {
      // Critical Red Alarm!
      Serial.println("[ACTION] Critical Evacuation Triggered!");
      if (dfPlayerOnline) {
        myDFPlayer.play(1); // Play 0001.mp3
      }
      // Rapid SOS LED strobe
      for (int i = 0; i < 6; i++) {
        digitalWrite(LED_PIN, LOW); delay(80);
        digitalWrite(LED_PIN, HIGH); delay(80);
      }
    } else if (incoming.indexOf("\"lvl\":0") != -1) {
      // Normal state restored
      digitalWrite(LED_PIN, HIGH);
    }
  }

  // --- 4. 30-SECOND FAIL-SAFE INDICATOR ---
  // If no heartbeat or downlink command is heard for 30s, slow blink to warn field staff
  if (now - lastDownlinkHeard > 30000) {
    if ((now / 1000) % 2 == 0) {
      digitalWrite(LED_PIN, LOW);
    } else {
      digitalWrite(LED_PIN, HIGH);
    }
  }
}
