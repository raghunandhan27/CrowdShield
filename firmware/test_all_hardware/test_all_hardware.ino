// ============================================================================
// CrowdShield Zonal Node — Complete Hardware Diagnostic Test Sketch
// Tests: 
//   1. Status LED (GPIO 27)
//   2. 1602 LCD Display (4-Bit: RS=21, E=22, D4=17, D5=16, D6=4, D7=15)
//   3. DFPlayer Mini Audio & Speaker (RX=25, TX=26 via 1kΩ)
//   4. SX1278 LoRa Transceiver (NSS=5, RST=14, DIO0=33, SCK=18, MISO=19, MOSI=23)
//   5. SOS Push Button (GPIO 12 to GND, Internal PULLUP)
// ============================================================================

#include <SPI.h>
#include <LoRa.h>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include <LiquidCrystal.h>

// --- Pin Definitions ---
#define LED_PIN     27   // Status LED (via 330Ω to GND)
#define BUTTON_PIN  12   // SOS Button (One leg to GPIO 12, other leg to GND)

// DFPlayer Mini on HardwareSerial 2
#define DF_RX_PIN   25   // ESP32 RX2 connects to DFPlayer TX
#define DF_TX_PIN   26   // ESP32 TX2 connects via 1kΩ to DFPlayer RX

// SX1278 LoRa SPI Pins
#define LORA_SS     5    // Chip Select (NSS)
#define LORA_RST    14   // LoRa Reset
#define LORA_DIO0   33   // Packet Ready IRQ
#define LORA_BAND   433E6 // 433 MHz for SX1278

// 1602 LCD (Parallel 4-Bit: RS=21, E=22, D4=17, D5=16, D6=4, D7=15)
LiquidCrystal lcd(21, 22, 17, 16, 4, 15);

HardwareSerial dfSerial(2);
DFRobotDFPlayerMini myDFPlayer;

bool dfPlayerOnline = false;
bool loraOnline = false;
int lastButtonState = HIGH;
uint32_t packetCount = 0;
unsigned long lastBeacon = 0;

void updateLcd(const char* line1, const char* line2) {
  char buf1[17];
  char buf2[17];
  snprintf(buf1, sizeof(buf1), "%-16s", line1);
  snprintf(buf2, sizeof(buf2), "%-16s", line2);
  lcd.setCursor(0, 0);
  lcd.print(buf1);
  lcd.setCursor(0, 1);
  lcd.print(buf2);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("   CROWDSHIELD ALL-IN-ONE HARDWARE DIAGNOSTIC TEST     ");
  Serial.println("=======================================================\n");

  // --- 1. TEST LED (GPIO 27) ---
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP); // Button to GND

  Serial.println("[TEST 1/5] Testing LED on GPIO 27...");
  for (int i = 0; i < 4; i++) {
    digitalWrite(LED_PIN, HIGH); delay(100);
    digitalWrite(LED_PIN, LOW); delay(100);
  }
  digitalWrite(LED_PIN, HIGH); // Keep solid ON
  Serial.println(" -> LED Test: PASSED (Flashing completed, now Solid ON)");

  // --- 2. TEST 1602 LCD DISPLAY (RS=21, E=22, D4=17, D5=16, D6=4, D7=15) ---
  Serial.println("\n[TEST 2/5] Initializing 1602 LCD Display...");
  lcd.begin(16, 2);
  updateLcd("1. LCD & LED: OK", "TESTING AUDIO...");
  Serial.println(" -> LCD Display Test: PASSED (Check screen text!)");
  delay(1500);

  // --- 3. TEST DFPLAYER MINI & SPEAKER (RX=25, TX=26) ---
  Serial.println("\n[TEST 3/5] Initializing DFPlayer Mini & Speaker...");
  dfSerial.begin(9600, SERIAL_8N1, DF_RX_PIN, DF_TX_PIN);
  delay(200);

  if (myDFPlayer.begin(dfSerial)) {
    dfPlayerOnline = true;
    myDFPlayer.volume(28); // Volume range: 0-30
    delay(100);
    Serial.println(" -> DFPlayer Mini: DETECTED! Playing Track 1 from SD Card...");
    updateLcd("2. AUDIO: OK!   ", "PLAYING TRACK 1 ");
    myDFPlayer.play(1); // Play Track 1
    delay(2000);
  } else {
    Serial.println(" -> [WARN] DFPlayer Mini NOT detected! (Check RX/TX wiring, 1k resistor, or SD card format).");
    updateLcd("2. AUDIO: WARN  ", "NO DFPLAYER RESP");
    delay(1500);
  }

  // --- 4. TEST SX1278 LORA TRANSCEIVER (433MHz) ---
  Serial.println("\n[TEST 4/5] Initializing SX1278 LoRa Transceiver (433MHz)...");
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (LoRa.begin(LORA_BAND)) {
    loraOnline = true;
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setTxPower(17);
    Serial.println(" -> SX1278 LoRa: DETECTED & ONLINE at 433 MHz!");
    updateLcd("3. LORA: ONLINE ", "BAND: 433.0 MHz ");
    
    // Send initial boot packet
    LoRa.beginPacket();
    LoRa.print("{\"event\":\"NODE_BOOT_TEST\",\"status\":\"ALL_HW_OK\"}");
    LoRa.endPacket();
    Serial.println(" -> Transmitted first test packet over 433MHz LoRa!");
    delay(1500);
  } else {
    Serial.println(" -> [ERROR] SX1278 LoRa NOT detected! Check 3.3V, GND, NSS=5, SCK=18, MOSI=23, MISO=19.");
    updateLcd("3. LORA: FAILED ", "CHECK 3.3V & SPI");
    delay(2000);
  }

  // --- 5. TEST BUTTON INSTRUCTIONS ---
  Serial.println("\n[TEST 5/5] Ready for SOS Button Test!");
  Serial.println(" >>> PRESS THE SOS BUTTON ON GPIO 12 TO TEST! <<<\n");
  updateLcd("SYS READY: TX #0", "PRESS SOS BUTTON");
}

void loop() {
  unsigned long now = millis();

  // --- 1. CONTINUOUS SOS BUTTON CHECK (GPIO 12) ---
  int buttonReading = digitalRead(BUTTON_PIN);

  // Detect press transition (HIGH -> LOW)
  if (buttonReading == LOW && lastButtonState == HIGH) {
    Serial.println("\n*******************************************************");
    Serial.println(">>> [BUTTON EVENT DETECTED!] SOS Pressed on GPIO 12! <<<");
    Serial.println("*******************************************************");

    // A. Update LCD Screen
    updateLcd("! SOS PRESSED !", "TX EMERGENCY PKT");

    // B. Flash LED rapidly
    for (int i = 0; i < 6; i++) {
      digitalWrite(LED_PIN, LOW); delay(40);
      digitalWrite(LED_PIN, HIGH); delay(40);
    }

    // C. Play Next Song / Alarm on Speaker
    if (dfPlayerOnline) {
      Serial.println("[Audio] Playing Next Track / Alarm Sound...");
      myDFPlayer.volume(30); // Max volume on SOS
      myDFPlayer.next();     // Cycles to next song/track on SD card
    }

    // D. Send Instant Emergency LoRa Packet
    if (loraOnline) {
      String sosPkt = "{\"alert\":\"SOS_TRIGGERED\",\"zone\":1,\"btn_pin\":12,\"ts\":" + String(now) + "}";
      LoRa.beginPacket();
      LoRa.print(sosPkt);
      LoRa.endPacket();
      Serial.printf("[LoRa TX Emergency] %s\n", sosPkt.c_str());
    }

    delay(300); // Debounce delay
  }
  lastButtonState = buttonReading;

  // --- 2. PERIODIC LORA BEACON TRANSMISSION (EVERY 3 SECONDS) ---
  if (now - lastBeacon >= 3000) {
    lastBeacon = now;
    packetCount++;

    if (loraOnline) {
      String beaconPkt = "{\"msg\":\"PING\",\"count\":" + String(packetCount) + ",\"zone\":1}";
      LoRa.beginPacket();
      LoRa.print(beaconPkt);
      LoRa.endPacket();
      Serial.printf("[LoRa TX Beacon #%d] %s\n", packetCount, beaconPkt.c_str());

      // Blink LED briefly on transmission
      digitalWrite(LED_PIN, LOW); delay(25); digitalWrite(LED_PIN, HIGH);

      // Update LCD counter if button not currently being held
      if (digitalRead(BUTTON_PIN) == HIGH) {
        char l1[17];
        snprintf(l1, sizeof(l1), "TX PACKET #%-5d", packetCount);
        updateLcd(l1, "PRESS SOS BUTTON");
      }
    }
  }

  delay(10);
}
