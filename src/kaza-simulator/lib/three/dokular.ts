// Prosedürel dokular: dış dosya veya ağ isteği olmadan kanvasta üretilir.

import * as THREE from 'three';

function tohumlu(tohum: number): () => number {
    let s = tohum >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function kanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    if (!x) throw new Error('2B kanvas bağlamı alınamadı');
    return [c, x];
}

function tekrarlayan(c: HTMLCanvasElement, renkli = true): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (renkli) t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Benekli doku: taban renk üzerine ince taneli gürültü */
function benekli(taban: string, tonlar: string[], adet: number, boyut: number, tohum: number): THREE.CanvasTexture {
    const [c, x] = kanvas(512, 512);
    x.fillStyle = taban;
    x.fillRect(0, 0, 512, 512);
    const r = tohumlu(tohum);
    for (let i = 0; i < adet; i++) {
        x.fillStyle = tonlar[Math.floor(r() * tonlar.length)];
        x.globalAlpha = 0.25 + r() * 0.5;
        const b = r() * boyut + 0.6;
        x.fillRect(r() * 512, r() * 512, b, b);
    }
    x.globalAlpha = 1;
    return tekrarlayan(c);
}

export interface Dokular {
    asfalt: THREE.CanvasTexture;
    kaldirim: THREE.CanvasTexture;
    cim: THREE.CanvasTexture;
    cephe: THREE.CanvasTexture;
    gokyuzu: THREE.CanvasTexture;
}

let onbellek: Dokular | null = null;

export function dokular(): Dokular {
    if (onbellek) return onbellek;

    const asfalt = benekli('#4a4d52', ['#3c3f44', '#55595f', '#5f6369', '#34373b'], 26000, 2.2, 3);
    const kaldirimTaban = benekli('#c9c6bf', ['#b9b6ae', '#d6d3cc', '#bebab2'], 9000, 2, 5);
    // Kaldırım taşı derzleri
    {
        const c = kaldirimTaban.image as HTMLCanvasElement;
        const x = c.getContext('2d');
        if (x) {
            x.strokeStyle = 'rgba(120,116,108,0.55)';
            x.lineWidth = 3;
            for (let i = 0; i <= 512; i += 128) {
                x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke();
                x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke();
            }
        }
        kaldirimTaban.needsUpdate = true;
    }
    const cim = benekli('#7d9561', ['#6c8653', '#8aa36c', '#738c58', '#93a874', '#667e4e'], 30000, 3, 9);

    // Cephe: beyaz duvar (köşe renkleriyle boyanır) + pencere ızgarası
    const [cc, cx] = kanvas(256, 256);
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, 256, 256);
    cx.fillStyle = '#e9e7e2';
    cx.fillRect(0, 236, 256, 20); // kat silmesi
    cx.fillStyle = '#5b6b7d';
    cx.fillRect(70, 70, 116, 120);
    cx.fillStyle = '#8fa3b8';
    cx.fillRect(78, 78, 48, 104);
    cx.fillStyle = '#7d92a8';
    cx.fillRect(130, 78, 48, 104);
    cx.fillStyle = '#d9d6cf';
    cx.fillRect(64, 190, 128, 10); // denizlik
    const cephe = tekrarlayan(cc);

    // Gökyüzü: dikey degrade
    const [gc, gx] = kanvas(4, 512);
    const d = gx.createLinearGradient(0, 0, 0, 512);
    d.addColorStop(0, '#5f93c9');
    d.addColorStop(0.55, '#a9c8e4');
    d.addColorStop(1, '#e6eef3');
    gx.fillStyle = d;
    gx.fillRect(0, 0, 4, 512);
    const gokyuzu = new THREE.CanvasTexture(gc);
    gokyuzu.colorSpace = THREE.SRGBColorSpace;

    onbellek = { asfalt, kaldirim: kaldirimTaban, cim, cephe, gokyuzu };
    return onbellek;
}

/** TR plakası dokusu (beyaz zemin, mavi TR şeridi, siyah yazı) */
export function plakaDokusu(plaka: string): THREE.CanvasTexture {
    const [c, x] = kanvas(256, 56);
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.roundRect(0, 0, 256, 56, 6);
    x.fill();
    x.strokeStyle = '#111';
    x.lineWidth = 3;
    x.stroke();
    x.fillStyle = '#0033a0';
    x.fillRect(2, 2, 30, 52);
    x.fillStyle = '#fff';
    x.font = '700 16px Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText('TR', 17, 42);
    x.fillStyle = '#111';
    x.font = '800 34px Arial, sans-serif';
    x.textBaseline = 'middle';
    x.fillText(plaka.toLocaleUpperCase('tr-TR').slice(0, 11), 145, 30);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData.tekil = true;
    return t;
}

/** Araç üstünde süzülen taraf etiketi (hap biçimli) */
export function etiketDokusu(yazi: string, renk: string): { doku: THREE.CanvasTexture; oran: number } {
    const [, ox] = kanvas(8, 8);
    ox.font = '800 44px "Montserrat Variable", Montserrat, Arial, sans-serif';
    const w = Math.ceil(ox.measureText(yazi).width) + 56;
    const [c, x] = kanvas(w, 76);
    x.fillStyle = renk;
    x.beginPath();
    x.roundRect(2, 2, w - 4, 72, 36);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.9)';
    x.lineWidth = 4;
    x.stroke();
    x.fillStyle = '#fff';
    x.font = '800 44px "Montserrat Variable", Montserrat, Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(yazi, w / 2, 40);
    const doku = new THREE.CanvasTexture(c);
    doku.colorSpace = THREE.SRGBColorSpace;
    doku.userData.tekil = true;
    return { doku, oran: w / 76 };
}

/** Yol yüzeyine yazılan sokak adı */
export function yolAdiDokusu(ad: string): { doku: THREE.CanvasTexture; oran: number } {
    const [, ox] = kanvas(8, 8);
    ox.font = '700 40px "Montserrat Variable", Montserrat, Arial, sans-serif';
    const w = Math.min(1024, Math.ceil(ox.measureText(ad).width) + 40);
    const [c, x] = kanvas(w, 64);
    x.font = '700 40px "Montserrat Variable", Montserrat, Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineWidth = 6;
    x.strokeStyle = 'rgba(20,22,26,0.75)';
    x.strokeText(ad, w / 2, 34);
    x.fillStyle = 'rgba(255,255,255,0.95)';
    x.fillText(ad, w / 2, 34);
    const doku = new THREE.CanvasTexture(c);
    doku.colorSpace = THREE.SRGBColorSpace;
    doku.userData.tekil = true;
    return { doku, oran: w / 64 };
}
