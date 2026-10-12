// Fotoğraf ve video karelerine işlenen bilgi katmanı (HUD) ile taraf
// evresi/hız hesapları. Saf kanvas 2B; Three.js'ten bağımsızdır.

import type { SimSonuc, TarafId, TarafSonuc } from '../types/kazaTypes.ts';
import { KANAL_SAYISI } from '../types/kazaTypes.ts';
import { KISA_UYARI, MARKA } from '../data/kazaData.ts';

let logo: HTMLImageElement | null = null;
let logoSozu: Promise<HTMLImageElement | null> | null = null;

/** Kurum logosunu bir kez yükler (görüntülere işlemek için) */
export function logoYukle(): Promise<HTMLImageElement | null> {
    if (!logoSozu) {
        logoSozu = new Promise((coz) => {
            const i = new Image();
            i.onload = () => { logo = i; coz(i); };
            i.onerror = () => coz(null);
            i.src = MARKA.logo;
        });
    }
    return logoSozu;
}

export function logoGorseli(): HTMLImageElement | null {
    return logo;
}

export interface TarafAnlik {
    hizKmh: number;
    faz: string;
}

export interface HudMetin {
    baslik: string;
    konum: string;
    taraflar: Record<TarafId, { ad: string; renk: string }>;
}

export function tarafFazi(s: TarafSonuc, t: number, tC: number, hiz: number): string {
    if (t < tC - 1e-6) {
        if (s.tip === 'yaya') return hiz > 0.05 ? 'Yürüyor' : 'Duruyor';
        if (s.izEtkin > 0 && t >= s.tFrenBaslangic) return hiz < 0.05 ? 'Durdu' : 'Frenleme';
        if (s.algilamaMesafesi > 0 && t >= s.tAlgilama) return 'Reaksiyon';
        return hiz < 0.05 ? 'Duruyor' : 'Seyir';
    }
    if (t < tC + 0.2) return 'ÇARPIŞMA';
    return hiz > 0.15 ? (s.tip === 'yaya' ? 'Savruluyor' : 'Savrulma') : 'Durdu';
}

export function anlikDurum(sonuc: SimSonuc, t: number): Record<TarafId, TarafAnlik> {
    const oku = (id: TarafId): TarafAnlik => {
        const s = sonuc.taraflar[id];
        const i = Math.max(0, Math.min(sonuc.kareSayisi - 1, Math.round(t * sonuc.fps)));
        const hiz = s.kareler[i * KANAL_SAYISI + 6];
        return { hizKmh: hiz * 3.6, faz: tarafFazi(s, t, sonuc.tCarpisma, hiz) };
    };
    return { A: oku('A'), B: oku('B') };
}

function hap(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, renk: string): void {
    x.fillStyle = renk;
    x.beginPath();
    x.roundRect(px, py, w, h, h / 2);
    x.fill();
}

const FONT = '"Montserrat Variable", Montserrat, "Segoe UI", Arial, sans-serif';

/** Görüntü üzerine başlık, zaman, taraf hızları ve uyarı satırını çizer */
export function hudCiz(x: CanvasRenderingContext2D, W: number, H: number, metin: HudMetin, sonuc: SimSonuc | null, t: number): void {
    const k = Math.max(0.6, Math.min(W, H * 1.6) / 1280);
    const pad = 22 * k;
    x.save();
    x.textBaseline = 'middle';

    // Üst sol: logo + marka + konum
    const ust = `${MARKA.kurumBuyuk} · ${metin.baslik}`;
    x.font = `700 ${15 * k}px ${FONT}`;
    const baslikW = x.measureText(ust).width;
    x.font = `500 ${13 * k}px ${FONT}`;
    const konum = metin.konum.length > 90 ? metin.konum.slice(0, 88) + '…' : metin.konum;
    const konumW = x.measureText(konum).width;
    const logoR = 23 * k;
    const metinX = pad + 12 * k + logoR * 2 + 12 * k;
    const kutuW = metinX - pad + Math.max(baslikW, konumW) + 22 * k;
    x.fillStyle = 'rgba(255,255,255,0.93)';
    x.beginPath();
    x.roundRect(pad, pad, kutuW, 62 * k, 31 * k);
    x.fill();
    if (logo) x.drawImage(logo, pad + 8 * k, pad + 8 * k, logoR * 2, logoR * 2);
    else hap(x, pad + 14 * k, pad + 15 * k, 10 * k, 32 * k, '#C81D25');
    x.fillStyle = '#2D3039';
    x.font = `700 ${15 * k}px ${FONT}`;
    x.fillText(ust, metinX, pad + 23 * k);
    x.fillStyle = '#7F828A';
    x.font = `500 ${13 * k}px ${FONT}`;
    x.fillText(konum, metinX, pad + 43 * k);

    if (sonuc) {
        // Üst sağ: zaman
        const zaman = `t = ${t.toFixed(2)} s`;
        x.font = `700 ${20 * k}px ${FONT}`;
        const zW = x.measureText(zaman).width + 36 * k;
        const carpismaAni = Math.abs(t - sonuc.tCarpisma) < 0.2;
        hap(x, W - pad - zW, pad, zW, 44 * k, carpismaAni ? '#C81D25' : 'rgba(45,48,57,0.88)');
        x.fillStyle = '#fff';
        x.textAlign = 'center';
        x.fillText(zaman, W - pad - zW / 2, pad + 22 * k);
        x.textAlign = 'left';

        // Alt sol: taraf hızları ve evreleri
        const durum = anlikDurum(sonuc, t);
        let y = H - pad - 86 * k;
        for (const id of ['A', 'B'] as const) {
            const tm = metin.taraflar[id];
            const d = durum[id];
            const satir = `${tm.ad}`;
            const deger = `${d.hizKmh.toFixed(0)} km/s · ${d.faz}`;
            x.font = `700 ${15 * k}px ${FONT}`;
            const w1 = x.measureText(satir).width;
            x.font = `600 ${15 * k}px ${FONT}`;
            const w2 = x.measureText(deger).width;
            const w = w1 + w2 + 60 * k;
            x.fillStyle = 'rgba(255,255,255,0.92)';
            x.beginPath();
            x.roundRect(pad, y, w, 36 * k, 18 * k);
            x.fill();
            hap(x, pad + 8 * k, y + 8 * k, 20 * k, 20 * k, tm.renk);
            x.fillStyle = '#2D3039';
            x.font = `700 ${15 * k}px ${FONT}`;
            x.fillText(satir, pad + 36 * k, y + 18 * k);
            x.fillStyle = d.faz === 'ÇARPIŞMA' ? '#C81D25' : '#2D3039';
            x.font = `600 ${15 * k}px ${FONT}`;
            x.fillText(deger, pad + 46 * k + w1, y + 18 * k);
            y += 44 * k;
        }
    }

    // Alt şerit: uyarı
    const uyari = KISA_UYARI;
    x.font = `500 ${11.5 * k}px ${FONT}`;
    const uW = x.measureText(uyari).width + 28 * k;
    hap(x, W - pad - uW, H - pad - 26 * k, uW, 26 * k, 'rgba(45,48,57,0.78)');
    x.fillStyle = 'rgba(255,255,255,0.95)';
    x.fillText(uyari, W - pad - uW + 14 * k, H - pad - 13 * k);
    x.restore();
}
