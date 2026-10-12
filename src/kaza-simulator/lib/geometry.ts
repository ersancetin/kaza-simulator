// Yol geometrisi yardımcıları: polyline parametrelemesi, en yakın yol,
// yaklaşım güzergâhları, şerit ofseti, kavşak düğümleri.

import { YAYA_SINIFLARI } from '../data/kazaData.ts';
import type { Cevre, Vec2, Yaklasim, Yol } from '../types/kazaTypes.ts';

/** Gidiş yönünün sağı (sağdan trafik; kuzey = -z) */
export const sag = (d: Vec2): Vec2 => ({ x: -d.z, z: d.x });
export const uzaklik = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
export const birim = (v: Vec2): Vec2 => {
    const l = Math.hypot(v.x, v.z) || 1;
    return { x: v.x / l, z: v.z / l };
};
export const nokta = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
/** Three.js rotation.y değeri: yerel +z ekseni bu yöne bakar */
export const yonAci = (d: Vec2): number => Math.atan2(d.x, d.z);
export const aciYon = (aci: number): Vec2 => ({ x: Math.sin(aci), z: Math.cos(aci) });

export interface ParcaIzdusum {
    nokta: Vec2;
    t: number;
    mesafe: number;
}

export function parcaIzdusum(p: Vec2, a: Vec2, b: Vec2): ParcaIzdusum {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const l2 = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2));
    const n = { x: a.x + abx * t, z: a.z + abz * t };
    return { nokta: n, t, mesafe: uzaklik(n, p) };
}

export interface YakinYol {
    yol: Yol;
    mesafe: number;
    konum: Vec2;
    yon: Vec2;
    parca: number;
}

export function enYakinYol(yollar: readonly Yol[], p: Vec2, yayaHaric = true): YakinYol | null {
    let sonuc: YakinYol | null = null;
    for (const yol of yollar) {
        if (yayaHaric && YAYA_SINIFLARI.has(yol.sinif)) continue;
        const n = yol.noktalar;
        for (let i = 1; i < n.length; i++) {
            const iz = parcaIzdusum(p, n[i - 1], n[i]);
            if (!sonuc || iz.mesafe < sonuc.mesafe) {
                sonuc = { yol, mesafe: iz.mesafe, konum: iz.nokta, yon: birim({ x: n[i].x - n[i - 1].x, z: n[i].z - n[i - 1].z }), parca: i };
            }
        }
    }
    return sonuc;
}

/** Yay uzunluğuyla parametrelenmiş polyline */
export class Rota {
    readonly noktalar: Vec2[];
    readonly s: number[];
    readonly uzunluk: number;

    constructor(noktalar: Vec2[]) {
        // Çakışık ardışık noktaları ayıkla
        const temiz: Vec2[] = [];
        for (const p of noktalar) {
            const son = temiz[temiz.length - 1];
            if (!son || uzaklik(son, p) > 0.01) temiz.push({ x: p.x, z: p.z });
        }
        if (temiz.length === 1) temiz.push({ x: temiz[0].x + 0.01, z: temiz[0].z });
        this.noktalar = temiz;
        this.s = [0];
        for (let i = 1; i < temiz.length; i++) this.s.push(this.s[i - 1] + uzaklik(temiz[i - 1], temiz[i]));
        this.uzunluk = this.s[this.s.length - 1];
    }

    /** Baştan s metre ilerideki nokta; aralık dışında düz uzatılır */
    konum(s: number): Vec2 {
        const p = this.noktalar;
        if (s <= 0) {
            const d = birim({ x: p[1].x - p[0].x, z: p[1].z - p[0].z });
            return { x: p[0].x + d.x * s, z: p[0].z + d.z * s };
        }
        if (s >= this.uzunluk) {
            const n = p.length - 1;
            const d = birim({ x: p[n].x - p[n - 1].x, z: p[n].z - p[n - 1].z });
            const e = s - this.uzunluk;
            return { x: p[n].x + d.x * e, z: p[n].z + d.z * e };
        }
        let lo = 0;
        let hi = this.s.length - 1;
        while (hi - lo > 1) {
            const m = (lo + hi) >> 1;
            if (this.s[m] <= s) lo = m;
            else hi = m;
        }
        const t = (s - this.s[lo]) / (this.s[hi] - this.s[lo] || 1);
        return { x: p[lo].x + (p[hi].x - p[lo].x) * t, z: p[lo].z + (p[hi].z - p[lo].z) * t };
    }

    /** Merkezî farkla yumuşatılmış teğet (köşelerde ani dönmeyi önler) */
    yon(s: number, h = 1.2): Vec2 {
        const a = this.konum(s - h);
        const b = this.konum(s + h);
        return birim({ x: b.x - a.x, z: b.z - a.z });
    }
}

/** Chaikin köşe yumuşatma: uç noktalar korunur */
export function yumusat(pts: Vec2[], tekrar = 2): Vec2[] {
    let p = pts;
    for (let k = 0; k < tekrar; k++) {
        if (p.length < 3) return p;
        const yeni: Vec2[] = [p[0]];
        for (let i = 0; i < p.length - 1; i++) {
            const a = p[i];
            const b = p[i + 1];
            const l = uzaklik(a, b);
            // Kısa parçalarda kesme oranı küçültülür ki kavis taşmasın
            const r = l > 8 ? Math.min(0.25, 4 / l) : 0.25;
            if (i > 0) yeni.push({ x: a.x + (b.x - a.x) * r, z: a.z + (b.z - a.z) * r });
            if (i < p.length - 2) yeni.push({ x: a.x + (b.x - a.x) * (1 - r), z: a.z + (b.z - a.z) * (1 - r) });
        }
        yeni.push(p[p.length - 1]);
        p = yeni;
    }
    return p;
}

/** Polyline'ı her noktada yerel sağa doğru sabit mesafe kaydırır */
export function ofsetliNoktalar(pts: readonly Vec2[], lateral: number): Vec2[] {
    return pts.map((p, i, dizi) => {
        const a = dizi[Math.max(0, i - 1)];
        const b = dizi[Math.min(dizi.length - 1, i + 1)];
        const r = sag(birim({ x: b.x - a.x, z: b.z - a.z }));
        return { x: p.x + r.x * lateral, z: p.z + r.z * lateral };
    });
}

export function pusula(dx: number, dz: number): string {
    const aci = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
    const adlar = ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'];
    return adlar[Math.round(aci / 45) % 8];
}

/** Sağdan trafik: aracın kendi yönündeki en sağ şeridin merkezine ofset */
export function seritOfseti(y: Pick<Yaklasim, 'seritSayisi' | 'tekYon' | 'genislik'>): number {
    const N = Math.max(1, y.seritSayisi || (y.tekYon ? 1 : 2));
    if (y.tekYon && N === 1) return 0;
    if (y.tekYon) return y.genislik / 2 - y.genislik / N / 2;
    const seritGen = y.genislik / N;
    return Math.min(y.genislik / 2 - 0.9, Math.max(1.2, y.genislik / 2 - seritGen / 2));
}

/**
 * Hedef nokta yol yüzeyindeyse aynen korunur; değilse en yakın araç
 * yolu eksenine oturtulur. Yol yoksa (azami mesafe dışında) null.
 */
export function yolaHizala(cevre: Cevre, hedef: Vec2 = { x: 0, z: 0 }, azamiMesafe = 400): { nokta: Vec2; kaymaMetre: number; tam: boolean } | null {
    const y = enYakinYol(cevre.yollar, hedef, true);
    if (!y || y.mesafe > azamiMesafe) return null;
    const tam = y.mesafe <= y.yol.genislik / 2 + 1.0;
    return { nokta: tam ? { x: hedef.x, z: hedef.z } : y.konum, kaymaMetre: tam ? 0 : y.mesafe, tam };
}

/**
 * Kaza noktasına yakın geçen yollardan her iki gidiş yönü için yaklaşım
 * güzergâhı üretir. Yaya yolları `yaya: true` ile işaretlenir.
 */
export function yaklasimlar(cevre: Cevre, K: Vec2): Yaklasim[] {
    const secenekler: Yaklasim[] = [];
    for (const yol of cevre.yollar) {
        const yayaYolu = YAYA_SINIFLARI.has(yol.sinif);
        let enYakin: Vec2 | null = null;
        let enYakinMesafe = Infinity;
        let idx = 0;
        for (let i = 1; i < yol.noktalar.length; i++) {
            const iz = parcaIzdusum(K, yol.noktalar[i - 1], yol.noktalar[i]);
            if (iz.mesafe < enYakinMesafe) {
                enYakinMesafe = iz.mesafe;
                enYakin = iz.nokta;
                idx = i;
            }
        }
        if (!enYakin || enYakinMesafe > (yayaYolu ? 60 : Math.max(25, yol.genislik / 2 + 12))) continue;

        const bastan = yol.noktalar.slice(0, idx).concat([enYakin]);
        const sondan = [...yol.noktalar.slice(idx)].reverse().concat([enYakin]);
        const yonler: Array<[Vec2[], number]> = [[bastan, 0], [sondan, 1]];
        for (const [pts, yonNo] of yonler) {
            if (pts.length < 2) continue;
            let uz = 0;
            for (let i = 1; i < pts.length; i++) uz += uzaklik(pts[i], pts[i - 1]);
            if (uz < 15) continue;
            const tersYon = yol.tekYon && yonNo === 1;
            const gelis = pusula(pts[0].x - enYakin.x, pts[0].z - enYakin.z);
            secenekler.push({
                anahtar: `${yol.id}-${yonNo}`,
                etiket: `${yol.ad}${yayaYolu ? ' (yaya yolu)' : ''} — ${gelis} yönünden${tersYon ? ' (tek yön, TERS YÖN)' : ''}`,
                yolAdi: yol.ad,
                noktalar: pts,
                genislik: yol.genislik,
                seritSayisi: yol.seritSayisi,
                tekYon: yol.tekYon,
                tersYon,
                hizLimiti: yol.hizLimiti,
                yuzey: yol.yuzey,
                yaya: yayaYolu,
            });
        }
    }
    return secenekler;
}

/** Yaya için kaza noktasındaki yolu dik kesen karşıdan karşıya geçiş rotaları */
export function yayaGecisleri(cevre: Cevre, K: Vec2): Yaklasim[] {
    const yakin = enYakinYol(cevre.yollar, K, true);
    if (!yakin || yakin.mesafe > 40) return [];
    const r = sag(yakin.yon);
    const uzunluk = Math.max(22, yakin.yol.genislik / 2 + 16);
    const yap = (isaret: number): Yaklasim => {
        // Geçiş, yolun eksenine dik doğrultuda kaza noktasından geçer
        const merkez = yakin.konum;
        const bas = { x: merkez.x + r.x * isaret * uzunluk, z: merkez.z + r.z * isaret * uzunluk };
        return {
            anahtar: `gecis-${isaret > 0 ? 'sag' : 'sol'}`,
            etiket: `Karşıdan karşıya geçiş — ${pusula(r.x * isaret, r.z * isaret)} tarafından`,
            yolAdi: yakin.yol.ad,
            noktalar: [bas, { x: K.x, z: K.z }],
            genislik: 2,
            seritSayisi: 1,
            tekYon: true,
            tersYon: false,
            hizLimiti: null,
            yuzey: null,
            yaya: true,
        };
    };
    return [yap(1), yap(-1)];
}

export interface KavsakDugumu {
    nokta: Vec2;
    yaricap: number;
}

/** İki veya daha fazla araç yolunun paylaştığı düğümler (OSM kavşakları) */
export function kavsakDugumleri(yollar: readonly Yol[]): KavsakDugumu[] {
    const harita = new Map<string, { nokta: Vec2; yollar: Set<string>; genislik: number }>();
    for (const yol of yollar) {
        if (YAYA_SINIFLARI.has(yol.sinif)) continue;
        for (const p of yol.noktalar) {
            const k = `${Math.round(p.x * 2)}:${Math.round(p.z * 2)}`;
            const kayit = harita.get(k) ?? { nokta: p, yollar: new Set<string>(), genislik: 0 };
            kayit.yollar.add(yol.id);
            kayit.genislik = Math.max(kayit.genislik, yol.genislik);
            harita.set(k, kayit);
        }
    }
    const sonuc: KavsakDugumu[] = [];
    for (const k of harita.values()) {
        if (k.yollar.size >= 2) sonuc.push({ nokta: k.nokta, yaricap: k.genislik / 2 + 1.5 });
    }
    return sonuc;
}

/**
 * Levhayı tıklanan yere en yakın yolun kenarına taşır ve o kenardaki
 * gelen trafiğe dönük açıyı verir.
 */
export function kenaraYerlestir(yollar: readonly Yol[], p: Vec2): { x: number; z: number; aci: number } {
    const y = enYakinYol(yollar, p, true);
    if (!y || y.mesafe > 60) return { x: p.x, z: p.z, aci: 0 };
    const r = sag(y.yon);
    const yan = (p.x - y.konum.x) * r.x + (p.z - y.konum.z) * r.z >= 0 ? 1 : -1;
    const ofs = y.yol.genislik / 2 + 1.2;
    // Sağ kenardaki levha +yön trafiğine (arkaya), sol kenardaki -yön trafiğine bakar
    const aci = yan === 1 ? yonAci({ x: -y.yon.x, z: -y.yon.z }) : yonAci(y.yon);
    return { x: y.konum.x + r.x * ofs * yan, z: y.konum.z + r.z * ofs * yan, aci };
}

export function yolAcisi(yollar: readonly Yol[], p: Vec2): number {
    const y = enYakinYol(yollar, p, true);
    return y ? yonAci(y.yon) : 0;
}
