// Fungsi bantu format angka & waktu untuk tampilan
export const pad = (n) => String(n).padStart(2, '0');

export function jamMenit(t) {
  const d = t % 86400;
  return `${pad(Math.floor(d / 3600))}.${pad(Math.floor((d % 3600) / 60))}`;
}

export function labelWaktu(t) {
  return `Hari ${Math.floor(t / 86400) + 1} · ${jamMenit(t)}`;
}

export const angka = (v, d = 0) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '–'
    : v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

// Informasi tampilan untuk tiap status FSM
export function infoState(k, sim) {
  if (!k.online) return { kode: 'OFFLINE', label: 'Node offline', nada: 'mati' };
  if (sim.t < sim.master.hangSampai) return { kode: 'HANG', label: 'MPU reboot', nada: 'mati' };
  if (k.fsm.state === 'CLEANING') return { kode: 'CLEANING', label: k.fsm.sub === 'DITUNDA' ? 'Cleaning · ditunda' : 'Cleaning', nada: 'kritis' };
  if (k.fsm.state === 'PH_RECOVERY') return { kode: 'PH_RECOVERY', label: 'pH recovery', nada: 'serius' };
  return { kode: 'NORMAL', label: 'Normal', nada: 'baik' };
}

export const NAMA_SUB = {
  CEK_TANGKI: 'Cek tangki POC',
  KURAS: 'Kuras dasar',
  ISI_ULANG: 'Isi air bersih',
  ENDAPKAN: 'Homogenisasi',
  EVALUASI: 'Evaluasi ulang',
  DITUNDA: 'Ditunda (tangki penuh)',
  HITUNG_DOSIS: 'AI hitung dosis',
  DOSING: 'Pompa dosing',
  HOMOGENISASI: 'Homogenisasi',
};
