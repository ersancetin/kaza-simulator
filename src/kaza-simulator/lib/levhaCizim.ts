// Trafik levhalarının kanvas çizimi (Karayolları trafik işaretleri biçiminde).
// Hem 3B sahnedeki levha dokuları hem de arayüzdeki palet küçük resimleri
// aynı fonksiyonla üretilir — sahnede görülen ile panelde seçilen birebir aynıdır.

import type { IsaretTipi } from '../types/kazaTypes.ts';

const KIRMIZI = '#C8102E';
const MAVI = '#0A4DA2';
const SARI = '#F6C400';
const SIYAH = '#141414';
const BEYAZ = '#FFFFFF';

export interface LevhaBicim {
    /** Dünya ölçüsünde genişlik/yükseklik (m) */
    genislik: number;
    yukseklik: number;
}

export interface LevhaSecenek {
    metin?: string;
    deger?: number;
    /** Arka yüz: yalnızca gri siluet */
    arka?: boolean;
}

type Ctx = CanvasRenderingContext2D;

function daire(x: Ctx, s: number, r: number, dolgu: string): void {
    x.fillStyle = dolgu;
    x.beginPath();
    x.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    x.fill();
}

function halka(x: Ctx, s: number, r: number, kalinlik: number, renk: string): void {
    x.strokeStyle = renk;
    x.lineWidth = kalinlik;
    x.beginPath();
    x.arc(s / 2, s / 2, r - kalinlik / 2, 0, Math.PI * 2);
    x.stroke();
}

function cokgen(x: Ctx, noktalar: Array<[number, number]>): void {
    x.beginPath();
    noktalar.forEach(([px, py], i) => (i === 0 ? x.moveTo(px, py) : x.lineTo(px, py)));
    x.closePath();
}

function metin(x: Ctx, yazi: string, cx: number, cy: number, boyut: number, renk: string, kalin = 800): void {
    x.fillStyle = renk;
    x.font = `${kalin} ${boyut}px "Montserrat Variable", Montserrat, Arial, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(yazi, cx, cy);
}

/** Yürüyen insan piktogramı (merkez, ölçek) */
function yaya(x: Ctx, cx: number, cy: number, k: number, renk: string): void {
    x.fillStyle = renk;
    x.strokeStyle = renk;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.arc(cx + 2 * k, cy - 30 * k, 7 * k, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 9 * k;
    x.beginPath();
    x.moveTo(cx + 1 * k, cy - 20 * k);
    x.lineTo(cx - 3 * k, cy + 6 * k);
    x.stroke();
    x.lineWidth = 7 * k;
    x.beginPath();
    x.moveTo(cx - 3 * k, cy + 4 * k);
    x.lineTo(cx - 14 * k, cy + 32 * k);
    x.moveTo(cx - 3 * k, cy + 4 * k);
    x.lineTo(cx + 8 * k, cy + 18 * k);
    x.lineTo(cx + 12 * k, cy + 34 * k);
    x.moveTo(cx, cy - 15 * k);
    x.lineTo(cx - 14 * k, cy - 2 * k);
    x.moveTo(cx, cy - 15 * k);
    x.lineTo(cx + 14 * k, cy - 6 * k);
    x.stroke();
}

/** Üstten görünüşte araç piktogramı */
function arac(x: Ctx, cx: number, cy: number, k: number, renk: string): void {
    x.fillStyle = renk;
    x.beginPath();
    x.roundRect(cx - 13 * k, cy - 22 * k, 26 * k, 44 * k, 7 * k);
    x.fill();
    x.fillStyle = BEYAZ;
    x.globalAlpha = 0.85;
    x.fillRect(cx - 9 * k, cy - 12 * k, 18 * k, 7 * k);
    x.fillRect(cx - 9 * k, cy + 8 * k, 18 * k, 5 * k);
    x.globalAlpha = 1;
}

/** Levhanın dünya ölçüleri */
export function levhaBicimi(tip: IsaretTipi, sec: LevhaSecenek = {}): LevhaBicim {
    switch (tip) {
        case 'give_way':
        case 'okul-gecidi':
            return { genislik: 0.9, yukseklik: 0.8 };
        case 'ana-yol':
            return { genislik: 0.75, yukseklik: 0.75 };
        case 'yaya-gecidi-levha':
            return { genislik: 0.65, yukseklik: 0.65 };
        case 'ozel-tabela': {
            const uz = Math.min(24, (sec.metin ?? 'LEVHA').length);
            return { genislik: Math.max(0.9, 0.3 + uz * 0.13), yukseklik: 0.55 };
        }
        default:
            return { genislik: 0.7, yukseklik: 0.7 };
    }
}

/**
 * Levhayı verilen kanvasa çizer. Kanvas boyutu çağırana aittir; çizim
 * kanvasın kısa kenarına göre ölçeklenir (yazılı levha hariç).
 */
export function levhaCiz(c: HTMLCanvasElement, tip: IsaretTipi, sec: LevhaSecenek = {}): void {
    const x = c.getContext('2d');
    if (!x) return;
    const W = c.width;
    const H = c.height;
    x.clearRect(0, 0, W, H);
    const s = Math.min(W, H);
    x.save();
    x.translate((W - s) / 2, (H - s) / 2);
    const k = s / 160;
    const arka = sec.arka === true;
    const GRI = '#8E949B';

    switch (tip) {
        case 'stop': {
            const nk: Array<[number, number]> = [];
            for (let i = 0; i < 8; i++) {
                const a = Math.PI / 8 + (i * Math.PI) / 4;
                nk.push([80 * k + 78 * k * Math.cos(a), 80 * k + 78 * k * Math.sin(a)]);
            }
            cokgen(x, nk);
            x.fillStyle = arka ? GRI : BEYAZ;
            x.fill();
            if (arka) break;
            const ic = nk.map(([px, py]): [number, number] => [80 * k + (px - 80 * k) * 0.9, 80 * k + (py - 80 * k) * 0.9]);
            cokgen(x, ic);
            x.fillStyle = KIRMIZI;
            x.fill();
            metin(x, 'DUR', 80 * k, 83 * k, 50 * k, BEYAZ);
            break;
        }
        case 'give_way':
        case 'okul-gecidi': {
            const tersUcgen = tip === 'give_way';
            const dis: Array<[number, number]> = tersUcgen
                ? [[4 * k, 14 * k], [156 * k, 14 * k], [80 * k, 150 * k]]
                : [[80 * k, 8 * k], [156 * k, 144 * k], [4 * k, 144 * k]];
            cokgen(x, dis);
            x.fillStyle = arka ? GRI : KIRMIZI;
            x.lineJoin = 'round';
            x.fill();
            if (arka) break;
            const ic: Array<[number, number]> = tersUcgen
                ? [[30 * k, 29 * k], [130 * k, 29 * k], [80 * k, 119 * k]]
                : [[80 * k, 38 * k], [131 * k, 129 * k], [29 * k, 129 * k]];
            cokgen(x, ic);
            x.fillStyle = BEYAZ;
            x.fill();
            if (!tersUcgen) {
                yaya(x, 66 * k, 98 * k, 0.75 * k, SIYAH);
                yaya(x, 94 * k, 102 * k, 0.6 * k, SIYAH);
            }
            break;
        }
        case 'ana-yol': {
            cokgen(x, [[80 * k, 2 * k], [158 * k, 80 * k], [80 * k, 158 * k], [2 * k, 80 * k]]);
            x.fillStyle = arka ? GRI : BEYAZ;
            x.fill();
            if (arka) break;
            cokgen(x, [[80 * k, 30 * k], [130 * k, 80 * k], [80 * k, 130 * k], [30 * k, 80 * k]]);
            x.fillStyle = SARI;
            x.fill();
            break;
        }
        case 'hiz-tabela':
        case 'sollama-yasak': {
            daire(x, s, 79 * k, arka ? GRI : BEYAZ);
            if (arka) break;
            halka(x, s, 76 * k, 17 * k, KIRMIZI);
            if (tip === 'hiz-tabela') {
                const d = String(sec.deger ?? 50);
                metin(x, d, 80 * k, 84 * k, (d.length > 2 ? 52 : 64) * k, SIYAH);
            } else {
                arac(x, 58 * k, 82 * k, 0.95 * k, KIRMIZI);
                arac(x, 102 * k, 82 * k, 0.95 * k, SIYAH);
            }
            break;
        }
        case 'park-yasak': {
            daire(x, s, 79 * k, arka ? GRI : BEYAZ);
            if (arka) break;
            daire(x, s, 74 * k, KIRMIZI);
            daire(x, s, 58 * k, MAVI);
            x.strokeStyle = KIRMIZI;
            x.lineWidth = 15 * k;
            x.beginPath();
            x.moveTo(80 * k - 42 * k, 80 * k - 42 * k);
            x.lineTo(80 * k + 42 * k, 80 * k + 42 * k);
            x.stroke();
            break;
        }
        case 'giris-yok': {
            daire(x, s, 79 * k, arka ? GRI : BEYAZ);
            if (arka) break;
            daire(x, s, 75 * k, KIRMIZI);
            x.fillStyle = BEYAZ;
            x.fillRect(26 * k, 68 * k, 108 * k, 24 * k);
            break;
        }
        case 'donel-kavsak': {
            daire(x, s, 79 * k, arka ? GRI : BEYAZ);
            if (arka) break;
            daire(x, s, 75 * k, MAVI);
            x.strokeStyle = BEYAZ;
            x.fillStyle = BEYAZ;
            x.lineWidth = 11 * k;
            for (let i = 0; i < 3; i++) {
                const a0 = (i * 2 * Math.PI) / 3 - Math.PI / 2 + 0.35;
                const a1 = a0 + 1.35;
                x.beginPath();
                x.arc(80 * k, 80 * k, 40 * k, a0, a1);
                x.stroke();
                const ux = Math.cos(a1);
                const uy = Math.sin(a1);
                const px = 80 * k + 40 * k * ux;
                const py = 80 * k + 40 * k * uy;
                const tx = -uy;
                const ty = ux;
                cokgen(x, [
                    [px + tx * 16 * k, py + ty * 16 * k],
                    [px + ux * 14 * k, py + uy * 14 * k],
                    [px - ux * 14 * k, py - uy * 14 * k],
                ]);
                x.fill();
            }
            break;
        }
        case 'yaya-gecidi-levha': {
            x.fillStyle = arka ? GRI : BEYAZ;
            x.beginPath();
            x.roundRect(2 * k, 2 * k, 156 * k, 156 * k, 12 * k);
            x.fill();
            if (arka) break;
            x.fillStyle = MAVI;
            x.beginPath();
            x.roundRect(8 * k, 8 * k, 144 * k, 144 * k, 9 * k);
            x.fill();
            cokgen(x, [[80 * k, 22 * k], [140 * k, 136 * k], [20 * k, 136 * k]]);
            x.fillStyle = BEYAZ;
            x.fill();
            // Zebra çizgileri ve yaya
            x.fillStyle = SIYAH;
            for (let i = 0; i < 4; i++) x.fillRect((48 + i * 18) * k, 124 * k, 10 * k, 6 * k);
            yaya(x, 80 * k, 92 * k, 0.78 * k, SIYAH);
            break;
        }
        case 'traffic_signals': {
            x.fillStyle = arka ? GRI : '#1d1f22';
            x.beginPath();
            x.roundRect(52 * k, 6 * k, 56 * k, 148 * k, 14 * k);
            x.fill();
            if (arka) break;
            const renkler = [KIRMIZI, SARI, '#1FA34A'];
            renkler.forEach((r, i) => {
                x.fillStyle = r;
                x.beginPath();
                x.arc(80 * k, (32 + i * 48) * k, 17 * k, 0, Math.PI * 2);
                x.fill();
            });
            break;
        }
        case 'ozel-tabela': {
            x.restore();
            const yazi = (sec.metin ?? 'LEVHA').toLocaleUpperCase('tr-TR').slice(0, 24);
            const r = Math.min(W, H) * 0.12;
            x.fillStyle = arka ? GRI : BEYAZ;
            x.beginPath();
            x.roundRect(1, 1, W - 2, H - 2, r);
            x.fill();
            if (arka) return;
            x.fillStyle = MAVI;
            const p = Math.max(3, H * 0.06);
            x.beginPath();
            x.roundRect(p, p, W - 2 * p, H - 2 * p, r * 0.75);
            x.fill();
            let boyut = H * 0.5;
            x.font = `800 ${boyut}px "Montserrat Variable", Montserrat, Arial, sans-serif`;
            const olcum = x.measureText(yazi).width;
            if (olcum > W * 0.86) boyut *= (W * 0.86) / olcum;
            metin(x, yazi, W / 2, H / 2 + H * 0.02, boyut, BEYAZ);
            return;
        }
        default: {
            daire(x, s, 79 * k, arka ? GRI : '#e5e7eb');
        }
    }
    x.restore();
}

/** Palet için küçük resim (data URL) */
export function levhaKucukResim(tip: IsaretTipi, sec: LevhaSecenek = {}, boyut = 96): string {
    const c = document.createElement('canvas');
    const b = levhaBicimi(tip, sec);
    c.width = tip === 'ozel-tabela' ? Math.round(boyut * (b.genislik / b.yukseklik)) : boyut;
    c.height = boyut;
    levhaCiz(c, tip, sec);
    return c.toDataURL('image/png');
}
