// 3B modeller: araçlar (profil ekstrüzyonlu gövde), yaya (eklemli),
// trafik levhaları/ışıkları ve çevre ögeleri. Tüm geometri kodla üretilir.

import * as THREE from 'three';
import { ARAC_TURLERI } from '../../data/kazaData.ts';
import type { AracTuruId, IsaretTipi } from '../../types/kazaTypes.ts';
import { levhaBicimi, levhaCiz, type LevhaSecenek } from '../levhaCizim.ts';
import { plakaDokusu } from './dokular.ts';

type Nokta2 = [number, number];

// ---- Ortak malzemeler (bir kez üretilir, paylaşılır) ----
const MALZEME = {
    cam: new THREE.MeshStandardMaterial({ color: 0x1e2a36, roughness: 0.08, metalness: 0.6 }),
    lastik: new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.92 }),
    jant: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.3, metalness: 0.85 }),
    plastik: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.7 }),
    krom: new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.2, metalness: 1 }),
    far: new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff1c4, emissiveIntensity: 1.4, roughness: 0.2 }),
    stop: new THREE.MeshStandardMaterial({ color: 0xb3121c, emissive: 0xd11a24, emissiveIntensity: 0.9, roughness: 0.3 }),
    sinyal: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5 }),
    kasa: new THREE.MeshStandardMaterial({ color: 0xe9eaec, roughness: 0.6, metalness: 0.1 }),
    sasi: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.8 }),
    ten: new THREE.MeshStandardMaterial({ color: 0xd8a47f, roughness: 0.75 }),
    sac: new THREE.MeshStandardMaterial({ color: 0x2d221c, roughness: 0.9 }),
    pantolon: new THREE.MeshStandardMaterial({ color: 0x2f3b55, roughness: 0.85 }),
    ayakkabi: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.8 }),
    direk: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.35, metalness: 0.8 }),
    levhaArka: new THREE.MeshStandardMaterial({ color: 0x8e949b, roughness: 0.5, metalness: 0.7 }),
};

function govdeMalzemesi(renk: string | number): THREE.MeshStandardMaterial {
    // Ortam yansımasıyla metalik boya görünümü; clearcoat'lu fiziksel malzemeden çok daha hızlı derlenir
    return new THREE.MeshStandardMaterial({ color: renk, roughness: 0.28, metalness: 0.55, envMapIntensity: 1.25 });
}

/** (z, y) çokgenini x ekseninde genişlik kadar ekstrüde eder, merkezler */
function ekstrude(noktalar: Nokta2[], genislik: number, egim = 0.04): THREE.ExtrudeGeometry {
    const sekil = new THREE.Shape(noktalar.map(([z, y]) => new THREE.Vector2(z, y)));
    const derinlik = Math.max(0.01, genislik - 2 * egim);
    const geo = new THREE.ExtrudeGeometry(sekil, {
        depth: derinlik, bevelEnabled: egim > 0, bevelSize: egim, bevelThickness: egim, bevelOffset: -egim, bevelSegments: 2, curveSegments: 6,
    });
    geo.rotateY(-Math.PI / 2);
    geo.translate(derinlik / 2, 0, 0);
    geo.computeVertexNormals();
    return geo;
}

/** Üst siluete teker kemerlerini ekleyerek kapalı gövde çokgeni kurar */
function silhuet(ust: Nokta2[], tabanY: number, akslar: number[], r: number): Nokta2[] {
    const sonuc: Nokta2[] = [...ust];
    // Alt kenar: önden arkaya, aks hizalarında yarım daire kemer
    const sirali = [...akslar].sort((a, b) => b - a);
    const kemerR = r + 0.06;
    for (const z of sirali) {
        if (r + kemerR <= tabanY) continue;
        const merkezY = r;
        const yariAci = Math.acos(Math.min(1, (tabanY - merkezY) / kemerR));
        const n = 9;
        for (let i = 0; i <= n; i++) {
            const a = -yariAci + (2 * yariAci * i) / n;
            sonuc.push([z + kemerR * Math.sin(-a), merkezY + kemerR * Math.cos(a)]);
        }
    }
    return sonuc;
}

/** Gövde çokgeninin y yüksekliğindeki en ön (yön=1) veya en arka (yön=-1) z değeri */
function kenarZ(cokgen: Nokta2[], y: number, yon: 1 | -1): number {
    let sonuc = yon === 1 ? -Infinity : Infinity;
    for (let i = 0; i < cokgen.length; i++) {
        const [z1, y1] = cokgen[i];
        const [z2, y2] = cokgen[(i + 1) % cokgen.length];
        if ((y1 - y) * (y2 - y) > 0 || y1 === y2) continue;
        const z = z1 + ((y - y1) / (y2 - y1)) * (z2 - z1);
        sonuc = yon === 1 ? Math.max(sonuc, z) : Math.min(sonuc, z);
    }
    return Number.isFinite(sonuc) ? sonuc : 0;
}

function teker(r: number, genislik: number): THREE.Group {
    const g = new THREE.Group();
    const lastik = new THREE.Mesh(new THREE.CylinderGeometry(r, r, genislik, 22), MALZEME.lastik);
    lastik.rotation.z = Math.PI / 2;
    lastik.castShadow = true;
    g.add(lastik);
    const jant = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, genislik + 0.015, 14), MALZEME.jant);
    jant.rotation.z = Math.PI / 2;
    g.add(jant);
    const gobek = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, genislik + 0.03, 8), MALZEME.plastik);
    gobek.rotation.z = Math.PI / 2;
    g.add(gobek);
    // Jant kolları: dönüş gözle görülsün
    for (let i = 0; i < 5; i++) {
        const kol = new THREE.Mesh(new THREE.BoxGeometry(genislik + 0.02, r * 0.95, r * 0.09), MALZEME.plastik);
        kol.rotation.x = (i * Math.PI) / 5;
        g.add(kol);
    }
    g.userData.tekerR = r;
    return g;
}

function kutu(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, golge = true): THREE.Mesh {
    const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    k.position.set(x, y, z);
    k.castShadow = golge;
    return k;
}

function plakaEkle(g: THREE.Group, plaka: string, onZ: number, arkaZ: number, onY: number, arkaY: number, onPlaka = true): void {
    const metin = plaka.trim() || '  ';
    const mat = new THREE.MeshBasicMaterial({ map: plakaDokusu(metin), toneMapped: false });
    const geo = new THREE.PlaneGeometry(0.52, 0.115);
    if (onPlaka) {
        const on = new THREE.Mesh(geo, mat);
        on.position.set(0, onY, onZ + 0.012);
        g.add(on);
    }
    const arka = new THREE.Mesh(geo, mat);
    arka.position.set(0, arkaY, arkaZ - 0.012);
    arka.rotation.y = Math.PI;
    g.add(arka);
}

function lambalar(g: THREE.Group, en: number, onZ: number, arkaZ: number, farY: number, stopY: number, boyutX = 0.34): void {
    for (const s of [-1, 1]) {
        g.add(kutu(boyutX, 0.13, 0.05, MALZEME.far, s * (en / 2 - boyutX / 2 - 0.08), farY, onZ, false));
        g.add(kutu(boyutX * 0.85, 0.12, 0.05, MALZEME.stop, s * (en / 2 - boyutX / 2 - 0.06), stopY, arkaZ, false));
    }
}

interface BinekProfili {
    alt: Nokta2[];
    kabin: Nokta2[];
    tavan: Nokta2[];
    akslar: number[];
    r: number;
    taban: number;
}

const BINEK: Record<'sedan' | 'suv' | 'pikap', BinekProfili> = {
    sedan: {
        alt: [[-2.25, 0.3], [-2.27, 0.62], [-2.2, 0.86], [-1.6, 0.95], [1.2, 0.98], [2.12, 0.82], [2.26, 0.58], [2.22, 0.3]],
        kabin: [[-1.6, 0.92], [-0.86, 1.42], [0.32, 1.44], [1.24, 0.95]],
        tavan: [[-0.96, 1.35], [-0.86, 1.432], [0.32, 1.455], [0.46, 1.37]],
        akslar: [1.35, -1.33], r: 0.33, taban: 0.3,
    },
    suv: {
        alt: [[-2.3, 0.4], [-2.32, 0.78], [-2.27, 1.06], [1.3, 1.09], [2.2, 0.99], [2.32, 0.72], [2.28, 0.4]],
        kabin: [[-2.24, 1.03], [-2.12, 1.62], [0.55, 1.66], [1.36, 1.06]],
        tavan: [[-2.2, 1.56], [-2.13, 1.645], [0.55, 1.68], [0.7, 1.6]],
        akslar: [1.4, -1.4], r: 0.37, taban: 0.4,
    },
    pikap: {
        alt: [[-2.65, 0.42], [-2.67, 1.13], [1.35, 1.15], [2.3, 1.03], [2.65, 0.75], [2.6, 0.42]],
        kabin: [[-0.55, 1.1], [-0.5, 1.72], [0.7, 1.75], [1.42, 1.12]],
        tavan: [[-0.56, 1.66], [-0.51, 1.74], [0.7, 1.77], [0.86, 1.68]],
        akslar: [1.65, -1.75], r: 0.38, taban: 0.42,
    },
};

function binekArac(g: THREE.Group, profil: 'sedan' | 'suv' | 'pikap', en: number, boy: number, govde: THREE.Material, plaka: string): void {
    const P = BINEK[profil];
    const altGeo = ekstrude(silhuet(P.alt, P.taban, P.akslar, P.r), en, 0.06);
    const alt = new THREE.Mesh(altGeo, govde);
    alt.castShadow = true;
    alt.receiveShadow = true;
    g.add(alt);
    const kabin = new THREE.Mesh(ekstrude(P.kabin, en - 0.16, 0.05), MALZEME.cam);
    kabin.castShadow = true;
    g.add(kabin);
    const tavan = new THREE.Mesh(ekstrude(P.tavan, en - 0.12, 0.03), govde);
    tavan.castShadow = true;
    g.add(tavan);
    if (profil === 'pikap') {
        // Kasa içi (koyu) ve kasa kenarları
        g.add(kutu(en - 0.22, 0.02, 1.95, MALZEME.plastik, 0, 1.14, -1.62, false));
    }
    const tamponY = P.taban + 0.1;
    const plakaY = P.taban + 0.27;
    const farY = P.alt[P.alt.length - 3][1] - 0.07;
    const stopY = P.alt[2][1] - 0.1;
    const on = (y: number): number => kenarZ(P.alt, y, 1);
    const arka = (y: number): number => kenarZ(P.alt, y, -1);
    // Tamponlar, ızgara
    g.add(kutu(en - 0.08, 0.17, 0.14, MALZEME.plastik, 0, tamponY, on(tamponY) - 0.04));
    g.add(kutu(en - 0.08, 0.17, 0.14, MALZEME.plastik, 0, tamponY, arka(tamponY) + 0.04));
    const izgaraY = (farY + plakaY) / 2;
    g.add(kutu(en * 0.42, 0.11, 0.04, MALZEME.plastik, 0, izgaraY, on(izgaraY) + 0.005, false));
    // Aynalar
    const aynaZ = P.kabin[P.kabin.length - 1][0] - 0.25;
    for (const s of [-1, 1]) g.add(kutu(0.16, 0.1, 0.07, govde, s * (en / 2 + 0.06), P.kabin[0][1] + 0.08, aynaZ));
    // Farlar ve stoplar gövde kenarına oturur
    for (const s of [-1, 1]) {
        g.add(kutu(0.36, 0.12, 0.06, MALZEME.far, s * (en / 2 - 0.27), farY, on(farY) - 0.015, false));
        g.add(kutu(0.32, 0.12, 0.06, MALZEME.stop, s * (en / 2 - 0.24), stopY, arka(stopY) + 0.015, false));
    }
    for (const z of P.akslar) {
        for (const s of [-1, 1]) {
            const t = teker(P.r, 0.24);
            t.position.set(s * (en / 2 - 0.14), P.r, z);
            g.add(t);
        }
    }
    const arkaPlakaY = (P.alt[1][1] + P.taban) / 2 + 0.12;
    plakaEkle(g, plaka, on(plakaY) + 0.005, arka(arkaPlakaY) - 0.005, plakaY, arkaPlakaY);
}

/** Bant camlı kutu araçlar (panelvan, otobüs) */
function kutuArac(g: THREE.Group, govdeNoktalari: Nokta2[], camNoktalari: Nokta2[], en: number, boy: number, akslar: number[], r: number, govde: THREE.Material, plaka: string, taban: number): void {
    const gv = new THREE.Mesh(ekstrude(silhuet(govdeNoktalari, taban, akslar, r), en, 0.07), govde);
    gv.castShadow = true;
    gv.receiveShadow = true;
    g.add(gv);
    g.add(new THREE.Mesh(ekstrude(camNoktalari, en + 0.02, 0.02), MALZEME.cam));
    lambalar(g, en, boy / 2 + 0.01, -boy / 2 - 0.005, taban + 0.45, taban + 0.6, 0.3);
    g.add(kutu(en - 0.05, 0.22, 0.1, MALZEME.plastik, 0, taban + 0.1, boy / 2 + 0.02));
    g.add(kutu(en - 0.05, 0.22, 0.1, MALZEME.plastik, 0, taban + 0.1, -boy / 2 - 0.02));
    for (const s of [-1, 1]) g.add(kutu(0.08, 0.32, 0.18, MALZEME.plastik, s * (en / 2 + 0.08), camNoktalari[0][1] + 0.25, boy / 2 - 0.9));
    for (const z of akslar) {
        for (const s of [-1, 1]) {
            const t = teker(r, 0.3);
            t.position.set(s * (en / 2 - 0.17), r, z);
            g.add(t);
        }
    }
    plakaEkle(g, plaka, boy / 2 + 0.07, -boy / 2 - 0.07, taban + 0.3, taban + 0.35);
}

/** Kabin + yük kasası (kamyon, çekici) */
function agirVasita(g: THREE.Group, tur: 'kamyon' | 'cekici', en: number, boy: number, yukseklik: number, govde: THREE.Material, plaka: string): void {
    const L = boy / 2;
    const kabinBoy = tur === 'kamyon' ? 2.15 : 2.45;
    const kabinH = tur === 'kamyon' ? 2.85 : 3.75;
    const z0 = L - kabinBoy;
    const kabin: Nokta2[] = [[z0, 0.75], [z0, kabinH - 0.05], [L - 0.3, kabinH], [L, kabinH - 0.55], [L, 0.75]];
    const kb = new THREE.Mesh(ekstrude(kabin, en, 0.07), govde);
    kb.castShadow = true;
    g.add(kb);
    const cam: Nokta2[] = [[L - 1.0, 1.75], [L - 1.0, kabinH - 0.25], [L - 0.26, kabinH - 0.2], [L + 0.015, kabinH - 0.6], [L + 0.015, 1.75]];
    g.add(new THREE.Mesh(ekstrude(cam, en + 0.02, 0.02), MALZEME.cam));
    g.add(kutu(en - 0.1, 0.4, 0.14, MALZEME.plastik, 0, 0.75, L + 0.03));
    g.add(kutu(en * 0.6, 0.6, 0.04, MALZEME.krom, 0, 1.3, L + 0.02, false));
    // Şasi ve yük kasası
    const kasaBas = -L + 0.15;
    const kasaSon = z0 - 0.25;
    g.add(kutu(en - 0.5, 0.35, boy - 0.4, MALZEME.sasi, 0, 0.75, 0));
    const kasaH = yukseklik - 1.15;
    const kasa = kutu(en, kasaH, kasaSon - kasaBas, MALZEME.kasa, 0, 1.15 + kasaH / 2, (kasaBas + kasaSon) / 2);
    kasa.receiveShadow = true;
    g.add(kasa);
    // Kasa yan bandı (taraf rengi)
    for (const s of [-1, 1]) g.add(kutu(0.01, 0.35, kasaSon - kasaBas - 0.3, govde, s * (en / 2 + 0.006), 1.55, (kasaBas + kasaSon) / 2, false));
    for (const s of [-1, 1]) {
        g.add(kutu(0.09, 0.4, 0.2, MALZEME.plastik, s * (en / 2 + 0.1), kabinH - 0.9, L - 0.6));
        g.add(kutu(0.3, 0.14, 0.05, MALZEME.far, s * (en / 2 - 0.3), 0.95, L + 0.06, false));
        g.add(kutu(0.25, 0.14, 0.05, MALZEME.stop, s * (en / 2 - 0.25), 1.0, -L - 0.01, false));
    }
    const r = 0.52;
    const akslar = tur === 'kamyon' ? [L - 1.4, -L + 2.6, -L + 1.3] : [L - 1.3, L - 4.2, -L + 3.2, -L + 1.9, -L + 0.6];
    for (const z of akslar) {
        for (const s of [-1, 1]) {
            const t = teker(r, 0.36);
            t.position.set(s * (en / 2 - 0.2), r, z);
            g.add(t);
        }
    }
    plakaEkle(g, plaka, L + 0.1, -L - 0.02, 0.55, 0.7);
}

/** Oturan sürücü figürü (iki teker, traktör) */
function binici(renk: THREE.Material, kaskli: boolean): THREE.Group {
    const g = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.36, 4, 10), renk);
    govde.position.set(0, 0.42, -0.05);
    govde.rotation.x = 0.35;
    govde.castShadow = true;
    g.add(govde);
    const bas = new THREE.Mesh(new THREE.SphereGeometry(kaskli ? 0.15 : 0.11, 16, 12), kaskli ? renk : MALZEME.ten);
    bas.position.set(0, 0.82, 0.1);
    bas.castShadow = true;
    g.add(bas);
    if (kaskli) {
        const vizor = new THREE.Mesh(new THREE.SphereGeometry(0.152, 16, 8, -0.9, 1.8, 1.1, 0.7), MALZEME.cam);
        vizor.position.copy(bas.position);
        g.add(vizor);
    }
    for (const s of [-1, 1]) {
        const kol = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), renk);
        kol.position.set(s * 0.2, 0.52, 0.22);
        kol.rotation.x = 1.15;
        g.add(kol);
        const bacak = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), MALZEME.pantolon);
        bacak.position.set(s * 0.14, 0.12, 0.18);
        bacak.rotation.x = 1.25;
        g.add(bacak);
    }
    return g;
}

function ikiTeker(g: THREE.Group, tur: 'motosiklet' | 'bisiklet', boy: number, govde: THREE.Material, plaka: string): void {
    const moto = tur === 'motosiklet';
    const r = moto ? 0.31 : 0.34;
    const aks = boy / 2 - r - 0.02;
    for (const z of [aks, -aks]) {
        const t = moto ? teker(r, 0.13) : (() => {
            const grp = new THREE.Group();
            const halka = new THREE.Mesh(new THREE.TorusGeometry(r - 0.02, 0.025, 8, 28), MALZEME.lastik);
            halka.rotation.y = Math.PI / 2;
            grp.add(halka);
            const gobek = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), MALZEME.krom);
            gobek.rotation.z = Math.PI / 2;
            grp.add(gobek);
            for (let i = 0; i < 6; i++) {
                const tel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, (r - 0.03) * 2, 4), MALZEME.krom);
                tel.rotation.x = (i * Math.PI) / 6;
                grp.add(tel);
            }
            grp.userData.tekerR = r;
            return grp;
        })();
        t.position.set(0, r, z);
        g.add(t);
    }
    if (moto) {
        g.add(kutu(0.28, 0.32, 0.9, govde, 0, 0.72, 0.15));              // depo/gövde
        g.add(kutu(0.24, 0.1, 0.6, MALZEME.plastik, 0, 0.88, -0.35));   // sele
        g.add(kutu(0.3, 0.3, 0.55, MALZEME.sasi, 0, 0.45, 0.05));        // motor
        g.add(kutu(0.62, 0.04, 0.04, MALZEME.krom, 0, 1.08, aks - 0.25)); // gidon
        const catal = kutu(0.06, 0.6, 0.06, MALZEME.krom, 0, 0.72, aks - 0.1);
        catal.rotation.x = -0.35;
        g.add(catal);
        g.add(kutu(0.16, 0.12, 0.05, MALZEME.far, 0, 0.95, aks + 0.05, false));
        g.add(kutu(0.14, 0.06, 0.04, MALZEME.stop, 0, 0.82, -boy / 2 + 0.1, false));
        plakaEkle(g, plaka, 0, -boy / 2 + 0.05, 0, 0.62, false);
    } else {
        const boru = (z1: number, y1: number, z2: number, y2: number): void => {
            const l = Math.hypot(z2 - z1, y2 - y1);
            const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, l, 6), govde);
            m.position.set(0, (y1 + y2) / 2, (z1 + z2) / 2);
            m.rotation.x = Math.atan2(z2 - z1, y2 - y1);
            g.add(m);
        };
        boru(-aks, r, -0.05, r + 0.05);
        boru(-0.05, r + 0.05, aks - 0.12, r + 0.48);
        boru(-0.05, r + 0.05, -0.18, r + 0.52);
        boru(-0.18, r + 0.5, aks - 0.14, r + 0.5);
        boru(aks, r, aks - 0.14, r + 0.6);
        g.add(kutu(0.5, 0.03, 0.03, MALZEME.plastik, 0, r + 0.64, aks - 0.16));
        g.add(kutu(0.14, 0.05, 0.24, MALZEME.plastik, 0, r + 0.56, -0.2));
    }
    const b = binici(govde, true);
    b.position.set(0, moto ? 0.62 : 0.66, moto ? -0.3 : -0.25);
    g.add(b);
}

function traktor(g: THREE.Group, en: number, boy: number, govde: THREE.Material, plaka: string): void {
    const L = boy / 2;
    g.add(kutu(0.9, 0.8, 2.0, govde, 0, 1.15, 0.85));                    // motor kaputu
    g.add(kutu(0.7, 0.6, 0.06, MALZEME.plastik, 0, 1.05, L - 0.12));      // ızgara
    g.add(kutu(1.1, 0.25, 1.4, MALZEME.sasi, 0, 1.0, -0.9));              // şasi arkası
    const kabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.3, 1.3), MALZEME.cam);
    kabin.position.set(0, 1.95, -0.95);
    g.add(kabin);
    g.add(kutu(1.35, 0.08, 1.45, govde, 0, 2.64, -0.95));                 // tavan
    for (const s of [-1, 1]) {
        g.add(kutu(0.06, 1.3, 0.06, MALZEME.sasi, s * 0.62, 1.95, -0.32));
        g.add(kutu(0.06, 1.3, 0.06, MALZEME.sasi, s * 0.62, 1.95, -1.58));
        const arka = teker(0.78, 0.42);
        arka.position.set(s * (en / 2 - 0.21), 0.78, -0.95);
        g.add(arka);
        const on = teker(0.44, 0.26);
        on.position.set(s * (en / 2 - 0.35), 0.44, L - 0.75);
        g.add(on);
        g.add(kutu(0.2, 0.12, 0.05, MALZEME.far, s * 0.3, 1.35, L - 0.12, false));
    }
    const egzoz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), MALZEME.sasi);
    egzoz.position.set(0.32, 2.0, 1.3);
    g.add(egzoz);
    plakaEkle(g, plaka, L - 0.1, -L + 0.4, 0.7, 1.0);
}

/** Araç modeli: yerel +z burun yönü, orijin zemin hizasında gövde merkezi */
export function aracOlustur(renk: string, tur: AracTuruId, plaka: string): THREE.Group {
    const T = ARAC_TURLERI[tur];
    const g = new THREE.Group();
    const govde = govdeMalzemesi(renk);
    switch (T.profil) {
        case 'sedan':
        case 'suv':
        case 'pikap':
            binekArac(g, T.profil, T.en, T.boy, govde, plaka);
            break;
        case 'van': {
            const L = T.boy / 2;
            kutuArac(g,
                [[-L, 0.4], [-L - 0.02, 2.38], [1.75, 2.45], [2.62, 1.3], [L, 1.0], [L - 0.04, 0.4]],
                [[-2.6, 1.42], [-2.6, 2.02], [1.62, 2.1], [2.02, 2.1], [2.68, 1.3], [1.55, 1.3]],
                T.en, T.boy, [L - 0.95, -L + 1.0], 0.38, govde, plaka, 0.4);
            break;
        }
        case 'otobus': {
            const L = T.boy / 2;
            kutuArac(g,
                [[-L, 0.35], [-L - 0.02, 3.12], [L - 0.15, 3.2], [L + 0.02, 2.9], [L + 0.02, 0.35]],
                [[-L + 0.3, 1.32], [-L + 0.3, 2.62], [L - 0.4, 2.66], [L + 0.035, 2.82], [L + 0.035, 0.95], [L - 0.4, 0.95], [L - 0.4, 1.32]],
                T.en, T.boy, [L - 2.4, -L + 3.0], 0.5, govde, plaka, 0.35);
            break;
        }
        case 'kamyon':
            agirVasita(g, 'kamyon', T.en, T.boy, T.yukseklik, govde, plaka);
            break;
        case 'tir':
            agirVasita(g, 'cekici', T.en, T.boy, T.yukseklik, govde, plaka);
            break;
        case 'iki-teker':
            ikiTeker(g, tur === 'bisiklet' ? 'bisiklet' : 'motosiklet', T.boy, govde, plaka);
            break;
        case 'traktor':
            traktor(g, T.en, T.boy, govde, plaka);
            break;
    }
    // Araca özgü stop lambası malzemesi (frende parlar) ve teker listesi
    const stop = MALZEME.stop.clone();
    const tekerler: THREE.Object3D[] = [];
    g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material === MALZEME.stop) m.material = stop;
        if (o.userData.tekerR) tekerler.push(o);
    });
    g.userData.stop = stop;
    g.userData.tekerler = tekerler;
    return g;
}

export interface YayaModeli {
    kok: THREE.Group;
    bacaklar: THREE.Object3D[];
    kollar: THREE.Object3D[];
}

/** Eklemli yaya: kalça/omuz pivotlarıyla yürüme animasyonu yapılabilir */
export function yayaOlustur(renk: string): YayaModeli {
    const kok = new THREE.Group();
    const ceket = new THREE.MeshStandardMaterial({ color: renk, roughness: 0.7 });
    const bacaklar: THREE.Object3D[] = [];
    const kollar: THREE.Object3D[] = [];
    for (const s of [-1, 1]) {
        const kalca = new THREE.Group();
        kalca.position.set(s * 0.1, 0.9, 0);
        const bacak = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.7, 4, 10), MALZEME.pantolon);
        bacak.position.y = -0.43;
        bacak.castShadow = true;
        kalca.add(bacak);
        const ayak = kutu(0.11, 0.08, 0.26, MALZEME.ayakkabi, 0, -0.86, 0.05);
        kalca.add(ayak);
        kok.add(kalca);
        bacaklar.push(kalca);

        const omuz = new THREE.Group();
        omuz.position.set(s * 0.235, 1.43, 0);
        const kol = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), ceket);
        kol.position.y = -0.3;
        kol.castShadow = true;
        omuz.add(kol);
        const el = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), MALZEME.ten);
        el.position.y = -0.6;
        omuz.add(el);
        kok.add(omuz);
        kollar.push(omuz);
    }
    const govde = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 12), ceket);
    govde.position.y = 1.2;
    govde.scale.set(1, 1, 0.7);
    govde.castShadow = true;
    kok.add(govde);
    const boyun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), MALZEME.ten);
    boyun.position.y = 1.52;
    kok.add(boyun);
    const bas = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), MALZEME.ten);
    bas.position.y = 1.64;
    bas.castShadow = true;
    kok.add(bas);
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), MALZEME.sac);
    sac.position.set(0, 1.655, -0.012);
    sac.rotation.x = -0.25;
    kok.add(sac);
    return { kok, bacaklar, kollar };
}

export function yayaAnimasyonu(m: YayaModeli, yol: number, hareketli: boolean): void {
    const faz = (yol / 0.72) * Math.PI;
    const genlik = hareketli ? 0.42 : 0;
    m.bacaklar.forEach((b, i) => { b.rotation.x = Math.sin(faz + i * Math.PI) * genlik; });
    m.kollar.forEach((k, i) => { k.rotation.x = -Math.sin(faz + i * Math.PI) * genlik * 0.8; });
}

// ---- Levhalar ve trafik ışığı ----
const levhaDokuOnbellek = new Map<string, { on: THREE.CanvasTexture; arka: THREE.CanvasTexture }>();

function levhaDokulari(tip: IsaretTipi, sec: LevhaSecenek): { on: THREE.CanvasTexture; arka: THREE.CanvasTexture } {
    const anahtar = `${tip}|${sec.metin ?? ''}|${sec.deger ?? ''}`;
    const var_ = levhaDokuOnbellek.get(anahtar);
    if (var_) return var_;
    const b = levhaBicimi(tip, sec);
    const yap = (arka: boolean): THREE.CanvasTexture => {
        const c = document.createElement('canvas');
        c.height = 256;
        c.width = Math.round(256 * (b.genislik / b.yukseklik));
        levhaCiz(c, tip, { ...sec, arka });
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
    };
    const d = { on: yap(false), arka: yap(true) };
    levhaDokuOnbellek.set(anahtar, d);
    return d;
}

/** Direkli trafik levhası: ön yüz levha, arka yüz gri metal siluet */
export function levhaOlustur(tip: IsaretTipi, sec: LevhaSecenek): THREE.Group {
    const g = new THREE.Group();
    const b = levhaBicimi(tip, sec);
    const altKenar = 1.9;
    const direkBoy = altKenar + b.yukseklik * 0.85;
    const direk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, direkBoy, 10), MALZEME.direk);
    direk.position.y = direkBoy / 2;
    direk.castShadow = true;
    g.add(direk);
    const d = levhaDokulari(tip, sec);
    const geo = new THREE.PlaneGeometry(b.genislik, b.yukseklik);
    const on = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: d.on, transparent: true, alphaTest: 0.4, roughness: 0.45, side: THREE.FrontSide }));
    on.position.set(0, altKenar + b.yukseklik / 2, 0.055);
    on.castShadow = true;
    g.add(on);
    const arka = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: d.arka, transparent: true, alphaTest: 0.4, roughness: 0.4, metalness: 0.6 }));
    arka.position.set(0, altKenar + b.yukseklik / 2, 0.045);
    arka.rotation.y = Math.PI;
    g.add(arka);
    // Kelepçeler
    for (const dy of [0.25, 0.75]) g.add(kutu(0.1, 0.04, 0.06, MALZEME.direk, 0, altKenar + b.yukseklik * dy, 0.02, false));
    return g;
}

export function trafikIsigiOlustur(): THREE.Group {
    const g = new THREE.Group();
    const direk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 12), new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 }));
    direk.position.y = 1.6;
    direk.castShadow = true;
    g.add(direk);
    const govde = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.6 });
    const kasa = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.0, 0.26), govde);
    kasa.position.set(0, 3.3, 0.08);
    kasa.castShadow = true;
    g.add(kasa);
    const plaka = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.2, 0.02), new THREE.MeshStandardMaterial({ color: 0x111214 }));
    plaka.position.set(0, 3.3, -0.06);
    g.add(plaka);
    const renkler = [0xff2a2a, 0xffc21a, 0x1fd65f];
    renkler.forEach((r, i) => {
        const lamba = new THREE.Mesh(
            new THREE.CircleGeometry(0.1, 20),
            new THREE.MeshStandardMaterial({ color: r, emissive: r, emissiveIntensity: 0.55, roughness: 0.3 }),
        );
        lamba.position.set(0, 3.62 - i * 0.31, 0.215);
        g.add(lamba);
        const siper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 16, 1, true, -Math.PI / 2, Math.PI), govde);
        siper.rotation.x = Math.PI / 2;
        siper.position.set(0, 3.64 - i * 0.31, 0.29);
        g.add(siper);
    });
    return g;
}

// ---- Çevre ögeleri ----
export function agacOlustur(olcek = 1): THREE.Group {
    const g = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 }));
    govde.position.y = 1.2;
    govde.castShadow = true;
    g.add(govde);
    const yaprak = new THREE.MeshStandardMaterial({ color: 0x4f7d3a, roughness: 0.9, flatShading: true });
    for (const [x, y, z, r] of [[0, 3.3, 0, 1.55], [0.5, 2.8, 0.3, 1.05], [-0.45, 2.9, -0.35, 1.0]] as const) {
        const k = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), yaprak);
        k.position.set(x, y, z);
        k.castShadow = true;
        g.add(k);
    }
    g.scale.setScalar(olcek);
    return g;
}

export function dubaOlustur(): THREE.Group {
    const g = new THREE.Group();
    const turuncu = new THREE.MeshStandardMaterial({ color: 0xff5a00, roughness: 0.6 });
    const taban = kutu(0.42, 0.04, 0.42, MALZEME.plastik, 0, 0.02, 0);
    g.add(taban);
    const koni = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.68, 18, 1, true), turuncu);
    koni.position.y = 0.38;
    koni.castShadow = true;
    g.add(koni);
    for (const y of [0.32, 0.5]) {
        const bant = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * (1 - (y - 0.04) / 0.68) + 0.003, 0.17 * (1 - (y - 0.1) / 0.68) + 0.003, 0.07, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
        bant.position.y = y;
        g.add(bant);
    }
    return g;
}

export function bariyerOlustur(): THREE.Group {
    const g = new THREE.Group();
    const celik = new THREE.MeshStandardMaterial({ color: 0xb4bac1, metalness: 0.85, roughness: 0.35 });
    const ray = kutu(0.06, 0.32, 3.2, celik, 0.09, 0.62, 0);
    g.add(ray);
    for (const z of [-1.2, 0, 1.2]) g.add(kutu(0.1, 0.75, 0.1, celik, 0, 0.375, z));
    return g;
}

export function direkOlustur(): THREE.Group {
    const g = new THREE.Group();
    const beton = new THREE.MeshStandardMaterial({ color: 0xb8b6b0, roughness: 0.9 });
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 8, 10), beton);
    govde.position.y = 4;
    govde.castShadow = true;
    g.add(govde);
    g.add(kutu(1.8, 0.1, 0.1, MALZEME.sasi, 0, 7.6, 0));
    for (const x of [-0.75, 0, 0.75]) {
        const izolator = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e0 }));
        izolator.position.set(x, 7.73, 0);
        g.add(izolator);
    }
    return g;
}

export function konteynerOlustur(): THREE.Group {
    const g = new THREE.Group();
    const yesil = new THREE.MeshStandardMaterial({ color: 0x2f6b46, roughness: 0.6 });
    g.add(kutu(1.4, 1.05, 0.95, yesil, 0, 0.6, 0));
    g.add(kutu(1.46, 0.08, 1.0, MALZEME.plastik, 0, 1.16, 0));
    for (const x of [-0.55, 0.55]) for (const z of [-0.35, 0.35]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), MALZEME.lastik);
        t.rotation.z = Math.PI / 2;
        t.position.set(x, 0.07, z);
        g.add(t);
    }
    return g;
}

export function hayvanOlustur(tur: 'kedi' | 'kopek'): THREE.Group {
    const g = new THREE.Group();
    const renk = new THREE.MeshStandardMaterial({ color: tur === 'kedi' ? 0xb07a45 : 0x8a5a33, roughness: 0.95 });
    const o = tur === 'kedi' ? 0.45 : 0.85;
    const govde = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * o, 0.42 * o, 4, 10), renk);
    govde.rotation.x = Math.PI / 2;
    govde.position.y = 0.36 * o;
    govde.castShadow = true;
    g.add(govde);
    const bas = new THREE.Mesh(new THREE.SphereGeometry(0.12 * o, 12, 10), renk);
    bas.position.set(0, 0.5 * o, 0.36 * o);
    g.add(bas);
    for (const s of [-1, 1]) {
        const kulak = new THREE.Mesh(new THREE.ConeGeometry(0.04 * o, 0.09 * o, 6), renk);
        kulak.position.set(s * 0.06 * o, 0.62 * o, 0.36 * o);
        g.add(kulak);
        for (const z of [0.18, -0.18]) {
            const bacak = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * o, 0.03 * o, 0.3 * o, 6), renk);
            bacak.position.set(s * 0.07 * o, 0.15 * o, z * o);
            g.add(bacak);
        }
    }
    const kuyruk = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * o, 0.025 * o, 0.3 * o, 6), renk);
    kuyruk.position.set(0, 0.45 * o, -0.38 * o);
    kuyruk.rotation.x = -0.8;
    g.add(kuyruk);
    return g;
}

/** Çok sayıda ağaç için örneklenmiş (instanced) ağ: iki çizim çağrısı */
export function agacOrmani(noktalar: ReadonlyArray<{ x: number; z: number }>): THREE.Group {
    const g = new THREE.Group();
    if (!noktalar.length) return g;
    const n = noktalar.length;
    const govdeGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6);
    govdeGeo.translate(0, 1.2, 0);
    const tepeGeo = new THREE.IcosahedronGeometry(1.6, 1);
    tepeGeo.translate(0, 3.4, 0);
    const govdeler = new THREE.InstancedMesh(govdeGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 }), n);
    const tepeler = new THREE.InstancedMesh(tepeGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const renk = new THREE.Color();
    noktalar.forEach((p, i) => {
        const h = Math.abs(Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453) % 1;
        const o = 0.8 + h * 0.5;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h * Math.PI * 2);
        m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(o, o, o));
        govdeler.setMatrixAt(i, m);
        tepeler.setMatrixAt(i, m);
        renk.setHSL(0.24 + h * 0.06, 0.38 + h * 0.15, 0.3 + h * 0.08);
        tepeler.setColorAt(i, renk);
    });
    govdeler.castShadow = tepeler.castShadow = true;
    g.add(govdeler, tepeler);
    return g;
}
