// Çevre sahnesi: yollar (asfalt, kaldırım, bordür), yol çizgileri, kavşak
// dolguları, dur çizgileri, yaya geçitleri, binalar, ağaçlar, levhalar ve
// sokak adları. Çok sayıda parça tek ağda birleştirilir (az çizim çağrısı).

import * as THREE from 'three';
import { ISARET_KATALOGU, KALDIRIMLI_SINIFLAR, YAYA_SINIFLARI } from '../../data/kazaData.ts';
import type { Cevre, Isaret, Vec2, Yol } from '../../types/kazaTypes.ts';
import { Rota, enYakinYol, kavsakDugumleri, ofsetliNoktalar, sag, uzaklik, yonAci, type KavsakDugumu } from '../geometry.ts';
import { dokular, yolAdiDokusu } from './dokular.ts';
import {
    agacOlustur, agacOrmani, aracOlustur, bariyerOlustur, direkOlustur, dubaOlustur, hayvanOlustur,
    konteynerOlustur, levhaOlustur, trafikIsigiOlustur,
} from './modeller.ts';

const KALDIRIM = 3.0;

/** Polyline boyunca sabit genişlikte şerit (UV: dünya koordinatı / uvOlcek) */
export function seritGeometri(pts: readonly Vec2[], genislik: number, y: number, birlesim = false, uvOlcek = 6): THREE.BufferGeometry {
    const konum: number[] = [];
    const uv: number[] = [];
    const indeks: number[] = [];
    let v = 0;
    const ekle = (x: number, z: number): void => {
        konum.push(x, y, z);
        uv.push(x / uvOlcek, z / uvOlcek);
    };
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const l = uzaklik(a, b);
        const d = l < 0.005 ? { x: 1, z: 0 } : { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
        const r = sag(d);
        const h = genislik / 2;
        ekle(a.x + r.x * h, a.z + r.z * h);
        ekle(a.x - r.x * h, a.z - r.z * h);
        ekle(b.x + r.x * h, b.z + r.z * h);
        ekle(b.x - r.x * h, b.z - r.z * h);
        indeks.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
        v += 4;
    }
    if (birlesim) {
        const dilim = 10;
        for (let i = 1; i < pts.length - 1; i++) {
            const merkez = v;
            ekle(pts[i].x, pts[i].z);
            for (let k = 0; k <= dilim; k++) {
                const a = (k / dilim) * Math.PI * 2;
                ekle(pts[i].x + Math.cos(a) * (genislik / 2), pts[i].z + Math.sin(a) * (genislik / 2));
            }
            for (let k = 0; k < dilim; k++) indeks.push(merkez, merkez + 2 + k, merkez + 1 + k);
            v += dilim + 2;
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(konum, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(konum.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(indeks);
    return g;
}

function disk(merkez: Vec2, yaricap: number, y: number, uvOlcek = 6): THREE.BufferGeometry {
    const g = new THREE.CircleGeometry(yaricap, 28);
    g.rotateX(-Math.PI / 2);
    g.translate(merkez.x, y, merkez.z);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / uvOlcek, p.getZ(i) / uvOlcek);
    return g;
}

/** Çok sayıda geometriyi tek tampona birleştirir (index'siz) */
export function birlestir(geometriler: THREE.BufferGeometry[], renkler: THREE.Color[] | null = null): THREE.BufferGeometry {
    const duz = geometriler.map((g) => (g.index ? g.toNonIndexed() : g));
    let toplam = 0;
    for (const g of duz) toplam += g.attributes.position.count;
    const konum = new Float32Array(toplam * 3);
    const normal = new Float32Array(toplam * 3);
    const uv = new Float32Array(toplam * 2);
    const renk = renkler ? new Float32Array(toplam * 3) : null;
    let of = 0;
    duz.forEach((g, i) => {
        const n = g.attributes.position.count;
        konum.set(g.attributes.position.array as Float32Array, of * 3);
        if (g.attributes.normal) normal.set(g.attributes.normal.array as Float32Array, of * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, of * 2);
        if (renk && renkler) {
            const c = renkler[i];
            for (let k = 0; k < n; k++) {
                renk[(of + k) * 3] = c.r;
                renk[(of + k) * 3 + 1] = c.g;
                renk[(of + k) * 3 + 2] = c.b;
            }
        }
        of += n;
    });
    for (const g of duz) g.dispose();
    for (const g of geometriler) g.dispose();
    const s = new THREE.BufferGeometry();
    s.setAttribute('position', new THREE.BufferAttribute(konum, 3));
    s.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    s.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (renk) s.setAttribute('color', new THREE.BufferAttribute(renk, 3));
    return s;
}

function kaplamaMalzemesi(renk: number, doku: THREE.Texture | null, katman: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: renk, map: doku, roughness: 0.95, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -katman, polygonOffsetUnits: -katman * 2,
    });
}

const kavsakIcinde = (p: Vec2, dugumler: readonly KavsakDugumu[], pay = 0): boolean =>
    dugumler.some((d) => uzaklik(p, d.nokta) < d.yaricap + pay);

/** Kavşak dairelerinin dışında kalan kesintisiz parçalar */
function kesintisizParcalar(pts: readonly Vec2[], dugumler: readonly KavsakDugumu[], pay: number): Vec2[][] {
    const rota = new Rota([...pts]);
    const parcalar: Vec2[][] = [];
    let mevcut: Vec2[] = [];
    for (let s = 0; s <= rota.uzunluk; s += 1) {
        const p = rota.konum(s);
        if (kavsakIcinde(p, dugumler, pay)) {
            if (mevcut.length >= 2) parcalar.push(mevcut);
            mevcut = [];
        } else mevcut.push(p);
    }
    if (mevcut.length >= 2) parcalar.push(mevcut);
    return parcalar;
}

interface YolCizgileri {
    beyaz: THREE.BufferGeometry[];
}

function yolCizgileriEkle(yol: Yol, dugumler: readonly KavsakDugumu[], merkez: Vec2, h: YolCizgileri): void {
    if (YAYA_SINIFLARI.has(yol.sinif) || yol.sinif === 'service' || yol.genislik < 5) return;
    if (!yol.noktalar.some((p) => uzaklik(p, merkez) < 700)) return;
    const N = Math.max(1, yol.seritSayisi || (yol.tekYon ? 1 : 2));
    const anaYol = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(yol.sinif) || yol.sinif.endsWith('_link');
    for (let k = 1; k < N; k++) {
        const lateral = -yol.genislik / 2 + k * (yol.genislik / N);
        const pts = ofsetliNoktalar(yol.noktalar, lateral);
        const orta = !yol.tekYon && N % 2 === 0 && k === N / 2;
        if (orta && N >= 4) {
            // Çok şeritli yolda karşı yönleri ayıran çift kesintisiz çizgi
            for (const ofs of [-0.12, 0.12]) {
                for (const parca of kesintisizParcalar(ofsetliNoktalar(pts, ofs), dugumler, 0.5)) h.beyaz.push(seritGeometri(parca, 0.12, 0, false, 1));
            }
        } else {
            const rota = new Rota(pts);
            const cizgi = 3;
            const bosluk = orta ? 5 : 6;
            for (let s = 1; s < rota.uzunluk - cizgi; s += cizgi + bosluk) {
                const a = rota.konum(s);
                const b = rota.konum(s + cizgi);
                if (kavsakIcinde(a, dugumler, 1) || kavsakIcinde(b, dugumler, 1)) continue;
                h.beyaz.push(seritGeometri([a, b], 0.13, 0, false, 1));
            }
        }
    }
    if (anaYol) {
        for (const yan of [-1, 1]) {
            const pts = ofsetliNoktalar(yol.noktalar, yan * (yol.genislik / 2 - 0.3));
            for (const parca of kesintisizParcalar(pts, dugumler, 0.5)) h.beyaz.push(seritGeometri(parca, 0.15, 0, false, 1));
        }
    }
}

/** Kavşağa giren her kolun sağ yarısına dur çizgisi */
function durCizgileri(yollar: readonly Yol[], dugumler: readonly KavsakDugumu[], merkez: Vec2): THREE.BufferGeometry[] {
    const sonuc: THREE.BufferGeometry[] = [];
    for (const d of dugumler) {
        if (uzaklik(d.nokta, merkez) > 260) continue;
        for (const yol of yollar) {
            if (YAYA_SINIFLARI.has(yol.sinif) || yol.sinif === 'service') continue;
            const n = yol.noktalar;
            for (let i = 0; i < n.length; i++) {
                if (uzaklik(n[i], d.nokta) > 0.6) continue;
                for (const komsu of [i - 1, i + 1]) {
                    if (komsu < 0 || komsu >= n.length) continue;
                    const l = uzaklik(n[komsu], n[i]);
                    if (l < d.yaricap + 4) continue;
                    const u = { x: (n[komsu].x - n[i].x) / l, z: (n[komsu].z - n[i].z) / l };
                    const gelen = { x: -u.x, z: -u.z };
                    const r = sag(gelen);
                    const m = { x: d.nokta.x + u.x * (d.yaricap + 1.2), z: d.nokta.z + u.z * (d.yaricap + 1.2) };
                    const ic = yol.tekYon ? -yol.genislik / 2 + 0.3 : 0.15;
                    const dis = yol.genislik / 2 - 0.3;
                    const a = { x: m.x + r.x * ic, z: m.z + r.z * ic };
                    const b = { x: m.x + r.x * dis, z: m.z + r.z * dis };
                    sonuc.push(seritGeometri([a, b], 0.45, 0, false, 1));
                }
            }
        }
    }
    return sonuc;
}

function zebra(is: Isaret, yollar: readonly Yol[]): THREE.BufferGeometry[] {
    const y = enYakinYol(yollar, is, true);
    if (!y || y.mesafe > 15) return [];
    const w = y.yol.genislik;
    const r = sag(y.yon);
    const bantlar: THREE.BufferGeometry[] = [];
    const bant = 0.5;
    const adet = Math.floor((w - 0.4) / (bant * 2));
    const bas = -(adet * bant * 2 - bant) / 2;
    for (let b = 0; b < adet; b++) {
        const lateral = bas + b * bant * 2;
        const o = { x: y.konum.x + r.x * lateral, z: y.konum.z + r.z * lateral };
        bantlar.push(seritGeometri([{ x: o.x - y.yon.x * 1.5, z: o.z - y.yon.z * 1.5 }, { x: o.x + y.yon.x * 1.5, z: o.z + y.yon.z * 1.5 }], bant, 0, false, 1));
    }
    return bantlar;
}

function binaGeometrisi(cevre: Cevre, merkez: Vec2): THREE.BufferGeometry | null {
    const binalar = cevre.binalar
        .filter((b) => b.noktalar.length >= 3)
        .map((b) => {
            const cx = b.noktalar.reduce((s, p) => s + p.x, 0) / b.noktalar.length;
            const cz = b.noktalar.reduce((s, p) => s + p.z, 0) / b.noktalar.length;
            return { b, uz: Math.hypot(cx - merkez.x, cz - merkez.z) };
        })
        .sort((a, b) => a.uz - b.uz)
        .slice(0, 3500);
    if (!binalar.length) return null;
    const DUVAR = ['#efe6d8', '#e8d9c4', '#f2efe9', '#dcd3c6', '#e9dccd', '#d9c2a8', '#efe3cf', '#cfd4d8', '#e4e0d6'];
    const CATI = ['#8f8a84', '#a0644e', '#7d7f84', '#9b5b46', '#6f7176'];
    const konum: number[] = [];
    const normal: number[] = [];
    const uv: number[] = [];
    const renk: number[] = [];
    const duvarRenk = new THREE.Color();
    const catiRenk = new THREE.Color();
    for (const { b } of binalar) {
        const sekil = new THREE.Shape(b.noktalar.map((p) => new THREE.Vector2(p.x, -p.z)));
        const geo = new THREE.ExtrudeGeometry(sekil, { depth: b.yukseklik, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        const g = geo.index ? geo.toNonIndexed() : geo;
        g.computeVertexNormals();
        const h = Math.abs(Math.sin(b.noktalar[0].x * 3.17 + b.noktalar[0].z * 1.31) * 1000) % 1;
        duvarRenk.set(DUVAR[Math.floor(h * DUVAR.length)]);
        catiRenk.set(CATI[Math.floor(((h * 7) % 1) * CATI.length)]);
        const p = g.attributes.position;
        const n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
            konum.push(x, y, z);
            normal.push(nx, ny, nz);
            if (ny > 0.5) {
                uv.push(0.02, 0.98);
                renk.push(catiRenk.r, catiRenk.g, catiRenk.b);
            } else {
                uv.push((x * -nz + z * nx) / 3.2, y / 3.1);
                renk.push(duvarRenk.r, duvarRenk.g, duvarRenk.b);
            }
        }
        geo.dispose();
        if (g !== geo) g.dispose();
    }
    const s = new THREE.BufferGeometry();
    s.setAttribute('position', new THREE.Float32BufferAttribute(konum, 3));
    s.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    s.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    s.setAttribute('color', new THREE.Float32BufferAttribute(renk, 3));
    return s;
}

function yolAdlari(cevre: Cevre, merkez: Vec2): THREE.Object3D[] {
    const sonuc: THREE.Object3D[] = [];
    const yazilan = new Map<string, number>();
    for (const yol of cevre.yollar) {
        if (!yol.ad || yol.ad === 'İsimsiz yol' || YAYA_SINIFLARI.has(yol.sinif)) continue;
        const n = yol.noktalar;
        let birikim = 999;
        for (let i = 1; i < n.length; i++) {
            const a = n[i - 1];
            const b = n[i];
            const parca = uzaklik(a, b);
            birikim += parca;
            if (birikim < 140 || parca < 18) continue;
            const o = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
            if (uzaklik(o, merkez) > 420 || uzaklik(o, merkez) < 28) continue;
            if ((yazilan.get(yol.ad) ?? 0) >= 4) break;
            yazilan.set(yol.ad, (yazilan.get(yol.ad) ?? 0) + 1);
            birikim = 0;
            const { doku, oran } = yolAdiDokusu(yol.ad);
            const yuk = Math.min(2.2, yol.genislik * 0.22);
            const geo = new THREE.PlaneGeometry(yuk * oran, yuk);
            geo.rotateX(-Math.PI / 2);
            const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: doku, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 }));
            const d = { x: (b.x - a.x) / parca, z: (b.z - a.z) / parca };
            // Metin soldan sağa okunsun: yön ters ise çevir
            const aci = Math.atan2(-d.z, d.x);
            m.rotation.y = Math.abs(aci) > Math.PI / 2 ? aci + Math.PI : aci;
            m.position.set(o.x, 0.04, o.z);
            m.renderOrder = 2;
            sonuc.push(m);
        }
    }
    return sonuc.slice(0, 40);
}

/** Tek bir işaret/öge nesnesi */
export function isaretNesnesi(is: Isaret, yollar: readonly Yol[]): THREE.Object3D | null {
    const aci = is.aci ?? (() => {
        const y = enYakinYol(yollar, is, true);
        return y ? yonAci(y.yon) : 0;
    })();
    let n: THREE.Object3D | null = null;
    switch (is.tip) {
        case 'traffic_signals': n = trafikIsigiOlustur(); break;
        case 'agac': n = agacOlustur(); break;
        case 'duba': n = dubaOlustur(); break;
        case 'bariyer': n = bariyerOlustur(); break;
        case 'direk': n = direkOlustur(); break;
        case 'konteyner': n = konteynerOlustur(); break;
        case 'kedi': n = hayvanOlustur('kedi'); break;
        case 'kopek': n = hayvanOlustur('kopek'); break;
        case 'park-arac': n = aracOlustur(['#d6d8db', '#3f4650', '#8a2a2a', '#f1f1ee'][Math.abs(Math.round(is.x + is.z)) % 4], 'otomobil', ''); break;
        case 'crossing':
        case 'traffic_calming':
            return null;
        default: {
            const k = ISARET_KATALOGU.find((o) => o.tip === is.tip);
            if (k?.direkli) n = levhaOlustur(is.tip, { metin: is.metin, deger: is.deger });
        }
    }
    if (!n) return null;
    n.position.set(is.x, 0, is.z);
    n.rotation.y = aci;
    n.userData.isaretId = is.id;
    return n;
}

export interface CevreSahnesi {
    statik: THREE.Group;
    isaretler: THREE.Group;
}

/** Statik çevre (yollar, binalar, ağaçlar) — yalnızca çevre değişince kurulur */
export function statikCevreKur(cevre: Cevre, merkez: Vec2): THREE.Group {
    const grup = new THREE.Group();
    grup.name = 'statik-cevre';
    const d = dokular();
    const dugumler = kavsakDugumleri(cevre.yollar);
    const aracYollari = cevre.yollar.filter((y) => !YAYA_SINIFLARI.has(y.sinif));

    const asfalt: THREE.BufferGeometry[] = [];
    const kaldirim: THREE.BufferGeometry[] = [];
    const bordur: THREE.BufferGeometry[] = [];
    const patika: THREE.BufferGeometry[] = [];
    const banket: THREE.BufferGeometry[] = [];
    const cizgi: YolCizgileri = { beyaz: [] };

    for (const yol of cevre.yollar) {
        if (YAYA_SINIFLARI.has(yol.sinif)) {
            patika.push(seritGeometri(yol.noktalar, Math.max(1.6, yol.genislik), 0, true, 3));
            continue;
        }
        asfalt.push(seritGeometri(yol.noktalar, yol.genislik, 0, true));
        if (yol.kaldirimYok) banket.push(seritGeometri(yol.noktalar, yol.genislik + 3.2, 0, true, 3));
        else if (KALDIRIMLI_SINIFLAR.has(yol.sinif)) {
            kaldirim.push(seritGeometri(yol.noktalar, yol.genislik + KALDIRIM * 2, 0, true, 3));
            for (const yan of [-1, 1]) {
                const pts = ofsetliNoktalar(yol.noktalar, yan * (yol.genislik / 2 + 0.12));
                for (const parca of kesintisizParcalar(pts, dugumler, 0.4)) bordur.push(seritGeometri(parca, 0.25, 0, false, 1));
            }
        }
        yolCizgileriEkle(yol, dugumler, merkez, cizgi);
    }
    for (const dg of dugumler) {
        asfalt.push(disk(dg.nokta, dg.yaricap - 1.3, 0));
        const kentsel = aracYollari.some((y) => KALDIRIMLI_SINIFLAR.has(y.sinif) && !y.kaldirimYok && y.noktalar.some((p) => uzaklik(p, dg.nokta) < 0.6));
        if (kentsel) kaldirim.push(disk(dg.nokta, dg.yaricap - 1.5 + KALDIRIM + 1.2, 0, 3));
    }
    cizgi.beyaz.push(...durCizgileri(cevre.yollar, dugumler, merkez));
    for (const is of cevre.isaretler) if (is.tip === 'crossing') cizgi.beyaz.push(...zebra(is, cevre.yollar));

    const katman = (geos: THREE.BufferGeometry[], mat: THREE.Material, y: number, golgeAl = true): void => {
        if (!geos.length) return;
        const m = new THREE.Mesh(birlestir(geos), mat);
        m.position.y = y;
        m.receiveShadow = golgeAl;
        grup.add(m);
    };
    katman(banket, kaplamaMalzemesi(0xd9cdb0, d.kaldirim, 1), 0.008);
    katman(kaldirim, kaplamaMalzemesi(0xffffff, d.kaldirim, 1), 0.01);
    katman(patika, kaplamaMalzemesi(0xd8cbb6, d.kaldirim, 2), 0.015);
    katman(asfalt, kaplamaMalzemesi(0xffffff, d.asfalt, 3), 0.02);
    katman(bordur, kaplamaMalzemesi(0xe2e0da, null, 4), 0.03);
    katman(cizgi.beyaz, new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 }), 0.035);

    // Kasisler: sarı-siyah bant
    for (const is of cevre.isaretler) {
        if (is.tip !== 'traffic_calming') continue;
        const y = enYakinYol(cevre.yollar, is, true);
        if (!y || y.mesafe > 15) continue;
        const r = sag(y.yon);
        const w = y.yol.genislik / 2;
        const kasis = new THREE.Mesh(
            seritGeometri([{ x: y.konum.x - r.x * w, z: y.konum.z - r.z * w }, { x: y.konum.x + r.x * w, z: y.konum.z + r.z * w }], 0.9, 0, false, 1),
            new THREE.MeshStandardMaterial({ color: 0xf2c300, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 }),
        );
        kasis.position.y = 0.06;
        kasis.receiveShadow = true;
        grup.add(kasis);
    }

    const binaGeo = binaGeometrisi(cevre, merkez);
    if (binaGeo) {
        const m = new THREE.Mesh(binaGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: d.cephe, roughness: 0.85 }));
        m.castShadow = true;
        m.receiveShadow = true;
        grup.add(m);
    }

    const agaclar = cevre.agaclar.filter((a) => uzaklik(a, merkez) < 700).slice(0, 2500);
    grup.add(agacOrmani(agaclar));
    for (const o of yolAdlari(cevre, merkez)) grup.add(o);
    return grup;
}

/** Levhalar ve elle eklenen ögeler — sık değişir, ayrı grupta kurulur */
export function isaretleriKur(cevre: Cevre, merkez: Vec2): THREE.Group {
    const grup = new THREE.Group();
    grup.name = 'isaretler';
    const yakinlar = cevre.isaretler
        .filter((i) => i.elle || uzaklik(i, merkez) < 450)
        .sort((a, b) => uzaklik(a, merkez) - uzaklik(b, merkez))
        .slice(0, 220);
    for (const is of yakinlar) {
        const n = isaretNesnesi(is, cevre.yollar);
        if (n) {
            n.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
            grup.add(n);
        }
    }
    return grup;
}

/** Nesne ağacındaki geometri ve malzemeleri serbest bırakır (bellek sızıntısı koruması) */
export function serbestBirak(o: THREE.Object3D): void {
    o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh || (c as THREE.Sprite).isSprite) {
            m.geometry?.dispose();
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) {
                if (!mat) continue;
                const harita = (mat as THREE.MeshBasicMaterial).map;
                if (harita && harita.userData.tekil === true) harita.dispose();
                mat.dispose();
            }
        }
    });
}
