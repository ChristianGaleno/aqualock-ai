// =============================================================
// model.js — Inference XGBoost murni JavaScript.
// Model dilatih di Python (ml/train_xgboost.py), lalu tiap pohon
// diekspor ke src/sim/xgb_model.js. Cara kerja inference:
//   margin = base_margin + Σ nilai_daun(pohon_i)
//   probabilitas = sigmoid(margin)
// Ini sama persis dengan model.predict_proba() di Python, sehingga
// di Arduino Uno Q (Python) maupun di simulator hasilnya identik.
// =============================================================

// Format node: [fitur, ambang, ya, tidak, hilang, nilaiDaun]
// fitur = -1 berarti node daun.
function nilaiPohon(nodes, x) {
  let i = 0;
  for (;;) {
    const nd = nodes[i];
    if (nd[0] < 0) return nd[5];
    const v = x[nd[0]];
    if (v === null || v === undefined || Number.isNaN(v)) i = nd[4];
    // XGBoost membandingkan dalam float32 → fitur & ambang di-fround
    else i = Math.fround(v) < Math.fround(nd[1]) ? nd[2] : nd[3];
  }
}

export function prediksiProba(model, x) {
  if (!model) return 0;
  let margin = model.base_margin;
  for (const pohon of model.trees) margin += nilaiPohon(pohon, x);
  return 1 / (1 + Math.exp(-margin));
}
