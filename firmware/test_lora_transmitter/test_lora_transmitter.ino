// ============================================================================
// CrowdShield — 100% STANDARD CLEAN LORA TRANSMITTER TEST (ZONE 1)
// ----------------------------------------------------------------------------
// Pure Standard Arduino LoRa:
//   - Uses official LoRa.beginPacket() and LoRa.endPacket()
//   - SX1278 transmits full packet (~288ms airtime at SF9)
//   - 1 MHz SPI eliminates jumper-wire line noise
//   - Low power (+10dBm, ~30mA): Zero brownouts
// ============================================================================

#include <SPI.h>
#include <LoRa.h>

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  33
#define LORA_BAND  433E6 // 433 MHz

#define BUTTON_PIN 12
#define LED_PIN    27
#define ONBOARD_LED 2

uint32_t pingCount = 0;
unsigned long lastSendTime = 0;

// Debounce state tracking
int buttonState = HIGH;
int lastRawButton = HIGH;
unsigned long lastDebounceTime = 0;

bool sendPacketSafely(const String& payload) {
  LoRa.beginPacket();
  LoRa.print(payload);
  int result = LoRa.endPacket(); // Synchronous: cleanly transmits complete RF packet
  return (result == 1);
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(LED_PIN, OUTPUT);
  pinMode(ONBOARD_LED, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(LED_PIN, LOW);
  digitalWrite(ONBOARD_LED, LOW);

  Serial.println("\n=======================================================");
  Serial.println("     ZONE 1 LORA TRANSMITTER TEST (CLEAN MODE)         ");
  Serial.println("=======================================================");
  Serial.println("Initializing SX1278 SPI bus at 1 MHz...");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  LoRa.setSPIFrequency(1E6); // 1 MHz SPI eliminates jumper-wire noise

  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("❌ [ERROR] SX1278 LoRa CHIP NOT DETECTED!");
    Serial.println("   Check 3.3V, GND, NSS=5, RST=14, SCK=18, MISO=19, MOSI=23.");
    while (true) {
      digitalWrite(ONBOARD_LED, HIGH); delay(150);
      digitalWrite(ONBOARD_LED, LOW); delay(150);
    }
  }

  // Radio Configuration (Exact match with Receiver):
  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(0x12);
  LoRa.setTxPower(10, PA_OUTPUT_PA_BOOST_PIN); // +10dBm (~30mA)
  LoRa.setOCP(100);

  Serial.println("✅ [SUCCESS] SX1278 LoRa Transceiver is ONLINE & READY!");
  Serial.println("   Frequency : 433.0 MHz | SF: 9 | BW: 125kHz | CR: 4/5 | Power: +10 dBm");
  Serial.println("-------------------------------------------------------");
  Serial.println("Transmitting test beacon every 2 seconds...");
  Serial.println("Press SOS button (GPIO 12 to GND) anytime for emergency test.\n");
}

void loop() {
  unsigned long now = millis();

  // 1. Debounced SOS Button Detection (GPIO 12 to GND)
  int rawBtn = digitalRead(BUTTON_PIN);
  if (rawBtn != lastRawButton) {
    lastDebounceTime = now;
    lastRawButton = rawBtn;
  }
  if ((now - lastDebounceTime) > 50) {
    if (rawBtn != buttonState) {
      buttonState = rawBtn;
      if (buttonState == LOW) { // Button Pressed
        Serial.println("\n🚨 [SOS BUTTON TRIGGERED] Sending Emergency Packet...");

        String sosPayload = "{\"alert\":\"SOS\",\"zone\":1,\"btn\":12,\"ts\":" + String(now) + "}";
        unsigned long t0 = millis();
        bool ok = sendPacketSafely(sosPayload);
        unsigned long airtime = millis() - t0;

        if (ok) {
          Serial.printf(" -> 🚨 SOS Packet Sent! Airtime: %lums\n", airtime);
        }

        // 4 Fast flashes
        for (int i = 0; i < 4; i++) {
          digitalWrite(LED_PIN, HIGH); digitalWrite(ONBOARD_LED, HIGH); delay(40);
          digitalWrite(LED_PIN, LOW); digitalWrite(ONBOARD_LED, LOW); delay(40);
        }
      }
    }
  }

  // 2. Periodic Ping Beacon (Every 2.0 Seconds)
  if (now - lastSendTime >= 2000) {
    lastSendTime = now;
    pingCount++;

    String pingPacket = "{\"node\":\"ZONE-1\",\"count\":" + String(pingCount) + ",\"status\":\"OK\"}";

    unsigned long t0 = millis();
    bool ok = sendPacketSafely(pingPacket);
    unsigned long airtime = millis() - t0;

    if (ok) {
      Serial.printf("✔ [TX #%-4d | Airtime: %3lums | Uptime: %-4lus] Sent: %s\n", 
                    pingCount, airtime, now / 1000, pingPacket.c_str());

      // Blink LED on confirmed send
      digitalWrite(LED_PIN, HIGH);
      digitalWrite(ONBOARD_LED, HIGH);
      delay(35);
      digitalWrite(LED_PIN, LOW);
      digitalWrite(ONBOARD_LED, LOW);
    } else {
      Serial.printf("❌ [TX #%-4d Failed to send]\n", pingCount);
    }
  }

  delay(10);
}
