// ============================================================================
// CrowdShield — STEP 2: BULLETPROOF HIGH-SENSITIVITY LORA RECEIVER
// ----------------------------------------------------------------------------
// Features:
//   1. Dual-Engine Reception: Interrupt-driven Continuous RX + Polling Fallback
//   2. Live Ambient RSSI Meter: Proves RF carrier wave detection in real-time
//   3. Dual-Pin DIO0 Compatibility: Works whether DIO0 is GPIO 26 or GPIO 33
//   4. Automatic Blue LED Strobe on every packet received
// ============================================================================

#include <SPI.h>
#include <LoRa.h>

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  26   // Default IRQ Pin (or GPIO 33)
#define LORA_BAND  433E6 // 433 MHz (Must match Transmitter!)

#define RX_LED     2    // Onboard Blue LED

volatile bool packetReceived = false;
volatile int incomingPacketLength = 0;
String incomingPacketPayload = "";
int incomingRssi = 0;
float incomingSnr = 0;

uint32_t totalPacketsReceived = 0;
unsigned long lastHeartbeat = 0;

// Interrupt Callback: Fires the microsecond a packet lands over the air
void onReceive(int packetSize) {
  if (packetSize == 0) return;

  incomingPacketPayload = "";
  while (LoRa.available()) {
    incomingPacketPayload += (char)LoRa.read();
  }
  incomingPacketPayload.trim();

  incomingPacketLength = packetSize;
  incomingRssi = LoRa.packetRssi();
  incomingSnr = LoRa.packetSnr();
  packetReceived = true;
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(RX_LED, OUTPUT);
  digitalWrite(RX_LED, LOW);

  // Configure possible DIO0 pins as inputs
  pinMode(26, INPUT);
  pinMode(33, INPUT);

  Serial.println("\n=======================================================");
  Serial.println("  STEP 2: HIGH-SENSITIVITY LORA RECEIVER MONITOR       ");
  Serial.println("=======================================================");
  Serial.println("Connecting to SX1278 Ra-02 chip over SPI...");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  LoRa.setSPIFrequency(1E6); // 1 MHz SPI eliminates jumper-wire noise

  // Initialize LoRa at 433 MHz
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("\n❌ [ERROR] SX1278 LoRa CHIP NOT DETECTED ON RECEIVER!");
    Serial.println("   ------------------------------------------------");
    Serial.println("   Check your SPI jumper wires right now:");
    Serial.println("     1. 3.3V -> Must be connected to ESP32 3.3V (NOT 5V)");
    Serial.println("     2. GND  -> ESP32 GND");
    Serial.println("     3. NSS  -> ESP32 GPIO 5");
    Serial.println("     4. RST  -> ESP32 GPIO 14");
    Serial.println("     5. SCK  -> ESP32 GPIO 18");
    Serial.println("     6. MISO -> ESP32 GPIO 19");
    Serial.println("     7. MOSI -> ESP32 GPIO 23");
    Serial.println("     8. DIO0 -> ESP32 GPIO 26 (or GPIO 33)");
    Serial.println("   ------------------------------------------------\n");
    while (true) {
      digitalWrite(RX_LED, HIGH); delay(150);
      digitalWrite(RX_LED, LOW); delay(150);
    }
  }

  // Radio Configuration (Exact match with Zone 1 Transmitter):
  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(0x12);

  // Register interrupt callback for 0ms latency reception
  LoRa.onReceive(onReceive);

  // Put radio into Continuous Receive mode
  LoRa.receive();

  Serial.println("\n✅ [SUCCESS] SX1278 LoRa Receiver is ONLINE & LISTENING!");
  Serial.println("   Frequency : 433.0 MHz");
  Serial.println("   Parameters: SF9 | BW: 125kHz | CR: 4/5 | SyncWord: 0x12");
  Serial.println("   Mode      : CONTINUOUS RX (Dual Interrupt + Polling Engine)");
  Serial.println("-------------------------------------------------------");
  Serial.println("Listening for incoming packets from Zone 1 Transmitter...\n");

  // Visual ready indication: 3 quick blinks
  for (int i = 0; i < 3; i++) {
    digitalWrite(RX_LED, HIGH); delay(80);
    digitalWrite(RX_LED, LOW); delay(80);
  }
}

void loop() {
  unsigned long now = millis();

  // --------------------------------------------------------------------------
  // ENGINE 1: INTERRUPT-DRIVEN RECEPTION (DIO0 triggered)
  // --------------------------------------------------------------------------
  if (packetReceived) {
    packetReceived = false;
    totalPacketsReceived++;

    // Flash onboard Blue LED
    digitalWrite(RX_LED, HIGH);

    if (incomingPacketPayload.indexOf("SOS") != -1) {
      Serial.println("\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨");
      Serial.printf(">>> [EMERGENCY SOS RECEIVED #%d] <<<\n", totalPacketsReceived);
      Serial.printf("    Payload : %s\n", incomingPacketPayload.c_str());
      Serial.printf("    Signal  : RSSI = %d dBm | SNR = %.1f dB\n", incomingRssi, incomingSnr);
      Serial.println("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n");
    } else {
      Serial.printf("✔ [RX #%-4d] Payload: %-38s | RSSI: %-4d dBm | SNR: %+.1f dB\n",
                    totalPacketsReceived, incomingPacketPayload.c_str(), incomingRssi, incomingSnr);
    }

    delay(30);
    digitalWrite(RX_LED, LOW);
  }

  // --------------------------------------------------------------------------
  // ENGINE 2: POLLING FALLBACK (In case DIO0 wire is loose or disconnected)
  // --------------------------------------------------------------------------
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    totalPacketsReceived++;

    String polledPayload = "";
    while (LoRa.available()) {
      polledPayload += (char)LoRa.read();
    }
    polledPayload.trim();

    int polledRssi = LoRa.packetRssi();
    float polledSnr = LoRa.packetSnr();

    // Flash onboard Blue LED
    digitalWrite(RX_LED, HIGH);

    if (polledPayload.indexOf("SOS") != -1) {
      Serial.println("\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨");
      Serial.printf(">>> [EMERGENCY SOS RECEIVED #%d (Polled)] <<<\n", totalPacketsReceived);
      Serial.printf("    Payload : %s\n", polledPayload.c_str());
      Serial.printf("    Signal  : RSSI = %d dBm | SNR = %.1f dB\n", polledRssi, polledSnr);
      Serial.println("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n");
    } else {
      Serial.printf("✔ [RX #%-4d (Polled)] Payload: %-34s | RSSI: %-4d dBm | SNR: %+.1f dB\n",
                    totalPacketsReceived, polledPayload.c_str(), polledRssi, polledSnr);
    }

    delay(30);
    digitalWrite(RX_LED, LOW);

    // Return to clean continuous receive mode
    LoRa.receive();
  }

  // --------------------------------------------------------------------------
  // LIVE RF SPECTRUM & HEARTBEAT MONITOR (Every 2 seconds)
  // --------------------------------------------------------------------------
  if (now - lastHeartbeat >= 2000) {
    lastHeartbeat = now;
    if (totalPacketsReceived == 0) {
      int liveRssi = LoRa.rssi(); // Real-time ambient RF signal meter!
      Serial.printf("[LISTENING... %-4lus | Live RF Signal: %-4d dBm] Waiting for Zone 1 packet...\n", 
                    now / 1000, liveRssi);
    }
  }

  delay(5);
}
