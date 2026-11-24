// Tekstur OLED SSD1306 (128×64, font 6×8 ala Adafruit_GFX) untuk adegan 3D
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { barisOled } from './firmware.js';

const S = 4; // skala piksel

export function useTeksturOled(fwRef) {
  const { kanvas, tekstur } = useMemo(() => {
    const kanvas = document.createElement('canvas');
    kanvas.width = 128 * S;
    kanvas.height = 64 * S;
    const tekstur = new THREE.CanvasTexture(kanvas);
    tekstur.colorSpace = THREE.SRGBColorSpace;
    tekstur.anisotropy = 4;
    return { kanvas, tekstur };
  }, []);
  useEffect(() => () => tekstur.dispose(), [tekstur]);

  const kunciRef = useMemo(() => ({ v: '' }), []);
  useFrame(() => {
    const fw = fwRef.current;
    const kunci = fw.oled.join('|');
    if (kunci === kunciRef.v) return;
    kunciRef.v = kunci;
    const c = kanvas.getContext('2d');
    c.fillStyle = '#02060a';
    c.fillRect(0, 0, kanvas.width, kanvas.height);
    c.fillStyle = '#d8ecff';
    c.font = `600 ${8.6 * S}px "JetBrains Mono", Consolas, monospace`;
    c.textBaseline = 'top';
    barisOled(fw.oled).forEach((baris, r) => {
      for (let i = 0; i < baris.length; i++) c.fillText(baris[i], i * 6 * S + 0.3 * S, r * 8 * S - 0.4 * S);
    });
    tekstur.needsUpdate = true;
  });
  return tekstur;
}
