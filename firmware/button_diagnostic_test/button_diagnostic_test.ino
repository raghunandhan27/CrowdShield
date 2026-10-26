// ============================================================================
// CrowdShield — 10-Second SOS Button Diagnostic Tool
// Tests both GPIO 12 and GPIO 13 with internal pull-ups
// Open Serial Monitor at 115200 Baud
// ============================================================================

const int PIN_12 = 12;
const int PIN_13 = 13;

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(PIN_12, INPUT_PULLUP);
  pinMode(PIN_13, INPUT_PULLUP);

  Serial.println("\n=======================================================");
  Serial.println("     CROWDSHIELD SOS BUTTON DIAGNOSTIC MONITOR        ");
  Serial.println("=======================================================");
  Serial.println("Press your SOS button to see the reading change!");
  Serial.println("Expected behaviour:");
  Serial.println(" - When UNPRESSED: Value MUST be HIGH (1)");
  Serial.println(" - When PRESSED:   Value MUST change to LOW (0)");
  Serial.println("-------------------------------------------------------\n");
}

void loop() {
  int val12 = digitalRead(PIN_12);
  int val13 = digitalRead(PIN_13);

  Serial.printf("[DIAGNOSTIC] GPIO 12: %s (%d)  |  GPIO 13: %s (%d)\n",
    (val12 == HIGH) ? "HIGH (RELEASED - OK)" : "LOW (PRESSED/SHORTED)", val12,
    (val13 == HIGH) ? "HIGH (RELEASED - OK)" : "LOW (PRESSED/SHORTED)", val13
  );

  delay(500);
}
