"""
train_xgboost.py — Melatih model risiko toksisitas NH3 untuk AQUA-LOCK AI

Input : ml/dataset.csv  (dibuat oleh generate_dataset.mjs)
Output: src/sim/xgb_model.js  (pohon XGBoost dalam format JS)
        ml/model_aqualock.json (format asli XGBoost, untuk Arduino Uno Q)

Fitur (PRD F2 + riwayat pakan, Business Case §4): ph, tds, suhu, ph_delta, jam, pakan_6j
Label        : 1 jika NH3 bebas > 0.05 mg/L

Jalankan: python3 ml/train_xgboost.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score)

AKAR = Path(__file__).resolve().parent
FITUR = ["ph", "tds", "suhu", "ph_delta", "jam", "pakan_6j"]

df = pd.read_csv(AKAR / "dataset.csv")

# Split berdasarkan waktu: 80% hari pertama untuk latih, 20% terakhir untuk uji.
# Lebih jujur daripada split acak karena data time-series saling berdekatan.
batas = df["hari"].quantile(0.8)
latih, uji = df[df["hari"] <= batas], df[df["hari"] > batas]
X_latih, y_latih = latih[FITUR].values, latih["label"].values
X_uji, y_uji = uji[FITUR].values, uji["label"].values

# Hyperparameter dipilih lewat validasi waktu (hari 64–80% data):
# kedalaman 3 + 80 pohon memberi F1 validasi terbaik (±0,86);
# menaikkan bobot kelas positif justru menurunkan F1 (presisi anjlok).
KEDALAMAN = 3
model = xgb.XGBClassifier(
    n_estimators=80,
    max_depth=KEDALAMAN,
    learning_rate=0.15,
    subsample=0.9,
    eval_metric="logloss",
    random_state=42,
)
model.fit(X_latih, y_latih)

proba = model.predict_proba(X_uji)[:, 1]
prediksi = (proba >= 0.5).astype(int)
metrik = {
    "f1": round(float(f1_score(y_uji, prediksi)), 3),
    "precision": round(float(precision_score(y_uji, prediksi)), 3),
    "recall": round(float(recall_score(y_uji, prediksi)), 3),
    "accuracy": round(float(accuracy_score(y_uji, prediksi)), 3),
    "confusion": confusion_matrix(y_uji, prediksi).tolist(),
    "n_latih": int(len(latih)),
    "n_uji": int(len(uji)),
    "positif_uji": int(y_uji.sum()),
}
print("Metrik data uji:", json.dumps(metrik, indent=2))

penting = model.get_booster().get_score(importance_type="gain")
total = sum(penting.values())
kepentingan = {FITUR[int(k[1:])]: round(v / total, 3) for k, v in penting.items()}
print("Kepentingan fitur (gain):", kepentingan)

# ---------- Ekspor pohon ke format ringkas untuk JavaScript ----------
booster = model.get_booster()
model.save_model(AKAR / "model_aqualock.json")
konfigurasi = json.loads(booster.save_config())
base_score = float(konfigurasi["learner"]["learner_model_param"]["base_score"].strip("[]"))
base_margin = float(np.log(base_score / (1 - base_score)))

pohon_js = []
for teks in booster.get_dump(dump_format="json"):
    akar = json.loads(teks)
    nodes, urutan = [], {}

    def kumpul(n):
        urutan[n["nodeid"]] = len(urutan)
        for anak in n.get("children", []):
            kumpul(anak)

    def ubah(n):
        if "leaf" in n:
            nodes.append([-1, 0, 0, 0, 0, n["leaf"]])
        else:
            nodes.append([int(n["split"][1:]), n["split_condition"], urutan[n["yes"]],
                          urutan[n["no"]], urutan[n["missing"]], 0])
        for anak in n.get("children", []):
            ubah(anak)

    kumpul(akar)
    ubah(akar)
    pohon_js.append(nodes)

ekspor = {
    "nama": "AQUA-LOCK NH3 Risk XGBoost",
    "fitur": FITUR,
    "n_pohon": len(pohon_js),
    "max_depth": KEDALAMAN,
    "base_margin": base_margin,
    "metrik": metrik,
    "kepentingan": kepentingan,
    "label": "NH3 bebas > 0.05 mg/L (Emerson et al. 1975)",
    "trees": pohon_js,
}
keluar = AKAR.parent / "src" / "sim" / "xgb_model.js"
keluar.write_text("// Dibuat otomatis oleh ml/train_xgboost.py — jangan diedit manual\n"
                  "export default " + json.dumps(ekspor, separators=(",", ":")) + ";\n")
print(f"Model diekspor: {keluar} ({keluar.stat().st_size / 1024:.0f} KB)")

# Sampel untuk uji kecocokan JS vs Python
sampel = uji.sample(200, random_state=1)
pd.DataFrame({**{f: sampel[f] for f in FITUR}, "proba": model.predict_proba(sampel[FITUR].values)[:, 1]}) \
    .to_csv(AKAR / "sampel_uji.csv", index=False)
