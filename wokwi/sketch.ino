#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <DHT.h>

#define PIN_PH 34
#define PIN_TDS 35
#define PIN_TDS_MOSFET 25
#define PIN_TEMP_DHT 4
#define PIN_TRIG 5
#define PIN_ECHO 18
#define PIN_SERVO 13
#define PIN_BTN_FEED 14
#define PIN_BUZZER 19
#define PIN_LED_LOCK 23
#define PIN_RELAY_DRAIN 26
#define PIN_RELAY_INLET 27
#define PIN_RELAY_PH_UP 32
#define PIN_RELAY_PH_DOWN 33

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
Servo feeder;
DHT dht(PIN_TEMP_DHT, DHT22);

String state = "NORMAL";
bool feedLocked = false;
int feedPortion = 100;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TDS_MOSFET, OUTPUT);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_BTN_FEED, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_LOCK, OUTPUT);
  pinMode(PIN_RELAY_DRAIN, OUTPUT);
  pinMode(PIN_RELAY_INLET, OUTPUT);
  pinMode(PIN_RELAY_PH_UP, OUTPUT);
  pinMode(PIN_RELAY_PH_DOWN, OUTPUT);

  feeder.attach(PIN_SERVO);
  feeder.write(0);
  dht.begin();
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}

void loop() {
  // 1. Sequential Reading (Nyalakan MOSFET TDS -> Baca -> Matikan -> Baca pH)
  digitalWrite(PIN_TDS_MOSFET, HIGH);
  delay(150);
  float tdsRaw = analogRead(PIN_TDS) * (1000.0 / 4095.0);
  digitalWrite(PIN_TDS_MOSFET, LOW);
  delay(100);

  float ph = analogRead(PIN_PH) * (14.0 / 4095.0);
  float temp = dht.readTemperature();
  if (isnan(temp)) temp = 28.0;

  // Kompensasi Suhu TDS (2% per derajat C dari 25C)
  float tds = tdsRaw / (1.0 + 0.02 * (temp - 25.0));

  // 2. Baca Level Air (Ultrasonik)
  digitalWrite(PIN_TRIG, LOW); delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  float distCm = pulseIn(PIN_ECHO, HIGH) * 0.034 / 2.0;

  // 3. Evaluasi FSM & Safety Interlock (Simulasi Local Failsafe / Keputusan AI)
  bool drainOn = false, inletOn = false, upOn = false, downOn = false;

  if (tds > 600.0) {
    state = "CLEANING";
    feedLocked = true;
    feedPortion = 0;
    drainOn = (distCm < 45.0);   // Kuras ke Tangki POC sampai batas aman
    inletOn = (distCm >= 45.0);  // Isi air bersih kembali
  } else if (ph < 6.5 || ph > 8.2) {
    state = "PH_RECOVERY";
    feedLocked = true;
    feedPortion = 0;
    upOn = (ph < 6.5);
    downOn = (ph > 8.2);
  } else {
    state = "NORMAL";
    feedLocked = false;
    feedPortion = (temp < 24.0 || tds > 450.0) ? 50 : 100;
  }

  digitalWrite(PIN_LED_LOCK, feedLocked ? HIGH : LOW);
  digitalWrite(PIN_RELAY_DRAIN, drainOn);
  digitalWrite(PIN_RELAY_INLET, inletOn);
  digitalWrite(PIN_RELAY_PH_UP, upOn);
  digitalWrite(PIN_RELAY_PH_DOWN, downOn);

  // 4. Tombol Manual Feed + Hard Safety Interlock
  if (digitalRead(PIN_BTN_FEED) == LOW) {
    if (feedLocked) {
      tone(PIN_BUZZER, 1200, 300);
      Serial.println("{\"event\":\"FEED_BLOCKED\",\"state\":\"" + state + "\"}");
    } else {
      feeder.write(90);
      delay(feedPortion == 100 ? 1200 : 600);
      feeder.write(0);
      Serial.println("{\"event\":\"FEED_OK\",\"portion\":" + String(feedPortion) + "}");
    }
    delay(300);
  }

  // 5. Update OLED & Cetak JSON Telemetri (Siap dibaca Dashboard / 3D Antigravity)
  oled.clearDisplay();
  oled.setTextColor(WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.printf("AQUA-LOCK AI | %s\n", state.c_str());
  oled.printf("pH: %.2f | T: %.1fC\n", ph, temp);
  oled.printf("TDS: %.0f ppm\n", tds);
  oled.printf("FEED: %s (%d%%)\n", feedLocked ? "LOCKED!" : "READY", feedPortion);
  oled.display();

  Serial.printf("{\"ph\":%.2f,\"tds\":%.1f,\"temp\":%.1f,\"level_cm\":%.1f,\"state\":\"%s\",\"feed_lock\":%s,\"feed_portion\":%d,\"drain\":%d,\"inlet\":%d,\"ph_up\":%d,\"ph_down\":%d}\n",
                ph, tds, temp, distCm, state.c_str(), feedLocked ? "true" : "false", feedPortion, drainOn, inletOn, upOn, downOn);
  delay(500);
}
