// Kaza simülasyon motoru (saf TypeScript, çizimden bağımsız).
//
// 1) Çarpışma öncesi: her taraf kendi şeridinde, "seyir → reaksiyon →
//    frenleme" evreleriyle kapalı-form kinematikle ilerler; iki taraf da
//    t = tCarpisma anında tanımlı temas pozuna ulaşır.
// 2) Çarpışma anı: 2B katı cisim itki (impuls) modeli — momentum ve açısal
//    momentum korunur; temas noktasının moment kolu dönme üretir; çarpma
//    katsayısı (e) ve temas sürtünmesi (Coulomb) uygulanır.
// 3) Çarpışma sonrası: sabit adımlı entegrasyon. Lastik sürtünmesi boyuna/
//    yanal ayrı sınırlanır (sürtünme dairesi), sapma hareketi sönümlenir;
//    yönlendirilmiş kutular (OBB/SAT) ile ikincil temaslar ve sabit engeller
//    çözülür. Yaya Searle fırlatma modeliyle havalanır, düşer ve kayar.
//
// Sonuç 60 kare/sn örneklenmiş kare dizisidir; oynatıcı yalnızca okur,
// böylece zaman çubuğunda ileri-geri sarma anlık ve tutarlıdır.

import { ARAC_TURLERI, YAYA_BOYUT } from '../data/kazaData.ts';
import type {
    CozulmusCarpismaTipi, IzSerisi, KatilimciTipi, SabitEngel, SimGirdi, SimKatilimci,
    SimSonuc, TarafId, TarafSonuc, Vec2,
} from '../types/kazaTypes.ts';
import { KANAL_SAYISI } from '../types/kazaTypes.ts';
import { Rota, birim, nokta, sag, seritOfseti, uzaklik, yumusat } from './geometry.ts';
import { G, durusMesafesi, frenMesafesi, frenSonrasiHiz, kacinilabilirlik, searleAsgariHiz } from './physics.ts';

const FPS = 60;
const ALT_ADIM = 4;
const DT = 1 / (FPS * ALT_ADIM);
const TEMEL_SEYIR = 2.5;      // en yavaş tarafın frenden önce görünen seyir süresi (s)
const DURMUS_BEKLEME = 1.5;   // çarpışmadan önce durmuş aracın bekleme süresi (s)
const E_ARAC = 0.12;          // araç–araç çarpma (restitüsyon) katsayısı
const E_YAYA = 0.0;
const MU_TEMAS_ARAC = 0.4;    // gövde–gövde temas sürtünmesi
const MU_TEMAS_YAYA = 0.2;
const MU_YAYA_ZEMIN = 0.66;   // Searle: yaya–zemin
const MU_YUVARLANMA = 0.12;   // frensiz, hasarlı aracın boyuna yavaşlaması (g cinsinden)
const AZAMI_SONRASI = 12;     // çarpışma sonrası azami süre (s)

// ---- 2B vektör yardımcıları (standart açı: θ, ω saat yönü tersine) ----
const topla = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
const cikar = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
const carp = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, z: a.z * k });
const capraz = (a: Vec2, b: Vec2): number => a.x * b.z - a.z * b.x;
const kisit = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** rotation.y (ψ) ↔ standart açı (θ = -ψ) */
const psiTeta = (psi: number): number => -psi;
const ileri = (teta: number): Vec2 => ({ x: -Math.sin(teta), z: Math.cos(teta) });
const yanal = (teta: number): Vec2 => ({ x: Math.cos(teta), z: Math.sin(teta) });
const yerelDunya = (c: Vec2, teta: number, lx: number, lz: number): Vec2 => ({
    x: c.x + lx * Math.cos(teta) - lz * Math.sin(teta),
    z: c.z + lx * Math.sin(teta) + lz * Math.cos(teta),
});

interface Govde {
    id: TarafId | 'engel';
    tip: KatilimciTipi | 'engel';
    ikiTeker: boolean;
    m: number;
    invM: number;
    invI: number;
    yx: number;
    yz: number;
    boy: number;
    en: number;
    c: Vec2;
    v: Vec2;
    teta: number;
    w: number;
    mu: number;
    frenli: boolean;
    dinlenme: boolean;
    // Yaya
    y: number;
    vy: number;
    havada: boolean;
    devrilme: number;
    /** Çarpışmadan sonra karşı tarafla temas çözümü kapalı (yaya) */
    ayrik: boolean;
}

function govdeOlustur(p: SimKatilimci | null, engel: SabitEngel | null, mu: number): Govde {
    if (engel) {
        return {
            id: 'engel', tip: 'engel', ikiTeker: false, m: Infinity, invM: 0, invI: 0,
            yx: engel.yx, yz: engel.yz, boy: engel.yz * 2, en: engel.yx * 2,
            c: { ...engel.merkez }, v: { x: 0, z: 0 }, teta: psiTeta(engel.aci), w: 0,
            mu, frenli: false, dinlenme: true, y: 0, vy: 0, havada: false, devrilme: 0, ayrik: false,
        };
    }
    if (!p) throw new Error('Gövde tanımsız');
    const T = p.tip === 'yaya' ? YAYA_BOYUT : ARAC_TURLERI[p.tur];
    const m = Math.max(20, p.kutle);
    const I = (m * (T.boy * T.boy + T.en * T.en)) / 12;
    return {
        id: p.id, tip: p.tip, ikiTeker: p.tip === 'arac' && ARAC_TURLERI[p.tur].profil === 'iki-teker',
        m, invM: 1 / m, invI: 1 / I, yx: T.en / 2, yz: T.boy / 2, boy: T.boy, en: T.en,
        c: { x: 0, z: 0 }, v: { x: 0, z: 0 }, teta: 0, w: 0,
        mu, frenli: p.izM > 0.05, dinlenme: false, y: 0, vy: 0, havada: false, devrilme: 0, ayrik: false,
    };
}

function noktaHizi(g: Govde, r: Vec2): Vec2 {
    return { x: g.v.x - g.w * r.z, z: g.v.z + g.w * r.x };
}

function itkiUygula(g: Govde, J: Vec2, r: Vec2): void {
    if (g.invM === 0) return;
    g.v = topla(g.v, carp(J, g.invM));
    g.w += capraz(r, J) * g.invI;
    g.dinlenme = false;
}

/**
 * Temas noktasında itki çözümü. n: A'dan B'ye birim normal.
 * Dönüş: normal itki büyüklüğü (N·s); yaklaşma yoksa 0.
 */
function temasCoz(A: Govde, B: Govde, P: Vec2, n: Vec2, e: number, muTemas: number): number {
    const rA = cikar(P, A.c);
    const rB = cikar(P, B.c);
    const vr = cikar(noktaHizi(B, rB), noktaHizi(A, rA));
    const vn = nokta(vr, n);
    if (vn >= 0) return 0;
    const rnA = capraz(rA, n);
    const rnB = capraz(rB, n);
    const K = A.invM + B.invM + rnA * rnA * A.invI + rnB * rnB * B.invI;
    if (K <= 0) return 0;
    const j = (-(1 + e) * vn) / K;
    itkiUygula(A, carp(n, -j), rA);
    itkiUygula(B, carp(n, j), rB);

    // Teğetsel (sürtünme) itki — Coulomb sınırı: |jt| ≤ µ·j
    const vr2 = cikar(noktaHizi(B, rB), noktaHizi(A, rA));
    const vt = cikar(vr2, carp(n, nokta(vr2, n)));
    const vtL = Math.hypot(vt.x, vt.z);
    if (vtL > 1e-4) {
        const t = carp(vt, 1 / vtL);
        const rtA = capraz(rA, t);
        const rtB = capraz(rB, t);
        const Kt = A.invM + B.invM + rtA * rtA * A.invI + rtB * rtB * B.invI;
        const jt = kisit(-vtL / Kt, -muTemas * j, muTemas * j);
        itkiUygula(A, carp(t, -jt), rA);
        itkiUygula(B, carp(t, jt), rB);
    }
    return j;
}

interface SatSonuc {
    n: Vec2;
    derinlik: number;
    temas: Vec2;
}

function koseler(g: Govde): Vec2[] {
    return [
        yerelDunya(g.c, g.teta, g.yx, g.yz), yerelDunya(g.c, g.teta, -g.yx, g.yz),
        yerelDunya(g.c, g.teta, -g.yx, -g.yz), yerelDunya(g.c, g.teta, g.yx, -g.yz),
    ];
}

/** Yönlendirilmiş iki kutunun ayırıcı eksen testi (SAT) */
function sat(A: Govde, B: Govde): SatSonuc | null {
    const eksenler = [yanal(A.teta), ileri(A.teta), yanal(B.teta), ileri(B.teta)];
    const d = cikar(B.c, A.c);
    let enAz = Infinity;
    let enAzEksen = 0;
    let enAzN: Vec2 = { x: 1, z: 0 };
    for (let i = 0; i < 4; i++) {
        const ax = eksenler[i];
        const rA = A.yx * Math.abs(nokta(yanal(A.teta), ax)) + A.yz * Math.abs(nokta(ileri(A.teta), ax));
        const rB = B.yx * Math.abs(nokta(yanal(B.teta), ax)) + B.yz * Math.abs(nokta(ileri(B.teta), ax));
        const mesafe = nokta(d, ax);
        const ortusme = rA + rB - Math.abs(mesafe);
        if (ortusme <= 0) return null;
        if (ortusme < enAz) {
            enAz = ortusme;
            enAzEksen = i;
            enAzN = mesafe >= 0 ? ax : carp(ax, -1);
        }
    }
    // Temas noktası: diğer kutunun en derine giren köşesi
    let temas: Vec2;
    if (enAzEksen < 2) {
        const k = koseler(B);
        k.sort((a, b) => nokta(a, enAzN) - nokta(b, enAzN));
        temas = nokta(k[1], enAzN) - nokta(k[0], enAzN) < 0.05 ? carp(topla(k[0], k[1]), 0.5) : k[0];
    } else {
        const k = koseler(A);
        k.sort((a, b) => nokta(b, enAzN) - nokta(a, enAzN));
        temas = nokta(k[0], enAzN) - nokta(k[1], enAzN) < 0.05 ? carp(topla(k[0], k[1]), 0.5) : k[0];
    }
    return { n: enAzN, derinlik: enAz, temas };
}

function konumDuzelt(A: Govde, B: Govde, s: SatSonuc): void {
    const toplamInv = A.invM + B.invM;
    if (toplamInv <= 0) return;
    const duzeltme = (Math.max(s.derinlik - 0.005, 0) * 0.8) / toplamInv;
    A.c = cikar(A.c, carp(s.n, duzeltme * A.invM));
    B.c = topla(B.c, carp(s.n, duzeltme * B.invM));
}

// ---- Çarpışma öncesi plan ----
interface Plan {
    p: SimKatilimci;
    rota: Rota;
    v0: number;
    vi: number;
    a: number;
    izEtkin: number;
    tFren: number;
    reak: number;
    bekle: number;
    durmus: boolean;
    boy: number;
    en: number;
}

function planGeri(pl: Plan, tau: number): number {
    if (pl.v0 <= 0.01) return 0;
    const t = tau - pl.bekle;
    if (t <= 0) return 0;
    if (t <= pl.tFren) return pl.vi * t + 0.5 * pl.a * t * t;
    return pl.izEtkin + pl.v0 * (t - pl.tFren);
}

function planHiz(pl: Plan, tau: number): number {
    if (pl.v0 <= 0.01) return 0;
    const t = tau - pl.bekle;
    if (t <= 0) return 0;
    if (t <= pl.tFren) return pl.vi + pl.a * t;
    return pl.v0;
}

/**
 * Şerit güzergâhını, son noktası C (çarpışma anı ağırlık merkezi) olacak
 * biçimde yeniden kurar: boyuna fark yol boyunca uzatma/kısaltma ile, yanal
 * fark ise son G metrede yumuşak şerit değiştirme eğrisiyle giderilir.
 * kayarak=true: yanal hız çarpışma anında sıfırlanmaz (sıyırma).
 */
function hedefliRota(taban: Vec2[], C: Vec2, kayarak: boolean): Rota {
    const r0 = new Rota(taban);
    const L = r0.uzunluk;
    const E = r0.konum(L);
    const d = r0.yon(L);
    const sagV = sag(d);
    const delta = nokta(cikar(C, E), sagV);
    const lambda = nokta(cikar(C, E), d);
    const sonS = L + lambda;
    const Gm = Math.max(14, Math.abs(delta) * 8);
    const pts: Vec2[] = [];
    const bas = Math.min(sonS - 30, Math.max(0, sonS - 450));
    for (let s = bas; s < sonS; s += 1) {
        const p = r0.konum(s);
        const rr = sag(r0.yon(s));
        const w = kisit(1 - (sonS - s) / Gm, 0, 1);
        const karisim = kayarak ? w * w : w * w * (3 - 2 * w);
        pts.push({ x: p.x + rr.x * delta * karisim, z: p.z + rr.z * delta * karisim });
    }
    pts.push({ x: C.x, z: C.z });
    return new Rota(pts);
}

function boyut(p: SimKatilimci): { boy: number; en: number } {
    return p.tip === 'yaya' ? YAYA_BOYUT : ARAC_TURLERI[p.tur];
}

/** Yaklaşımın şerit ortasından geçen güzergâhı (önizleme için de kullanılır) */
export function seritRotasi(y: SimKatilimci['yaklasim'], yaya: boolean): Vec2[] {
    return tabanRota({ tip: yaya ? 'yaya' : 'arac', yaklasim: y } as Pick<SimKatilimci, 'tip' | 'yaklasim'>);
}

function tabanRota(p: Pick<SimKatilimci, 'tip' | 'yaklasim'>): Vec2[] {
    const ham = p.yaklasim.noktalar;
    if (p.tip === 'yaya') return ham.slice();
    // Yol köşeleri yuvarlatılır, sağ şeridin merkezine ofsetlenir
    const yumus = yumusat(ham, 2);
    const ofs = seritOfseti(p.yaklasim);
    if (ofs === 0) return yumus;
    return yumus.map((q, i, dizi) => {
        const a = dizi[Math.max(0, i - 1)];
        const b = dizi[Math.min(dizi.length - 1, i + 1)];
        const r = sag(birim({ x: b.x - a.x, z: b.z - a.z }));
        return { x: q.x + r.x * ofs, z: q.z + r.z * ofs };
    });
}

/** Çarpışma tipini çözer ve iki tarafın temas anı merkezlerini hesaplar */
function temasPozu(g: SimGirdi, tabanlar: Record<TarafId, Vec2[]>): {
    tip: CozulmusCarpismaTipi; carpan: TarafId; C: Record<TarafId, Vec2>; n: Vec2; kayan: TarafId | null;
} {
    const yayaVar = g.A.tip === 'yaya' || g.B.tip === 'yaya';
    const carpan: TarafId = yayaVar ? (g.A.tip === 'yaya' ? 'B' : 'A') : g.carpan;
    const diger: TarafId = carpan === 'A' ? 'B' : 'A';
    const S = g[carpan];
    const O = g[diger];
    const rS = new Rota(tabanlar[carpan]);
    const rO = new Rota(tabanlar[diger]);
    const hS = rS.yon(rS.uzunluk);
    const hO = rO.yon(rO.uzunluk);
    const bS = boyut(S);
    const bO = boyut(O);
    const P = g.P;

    let tip: CozulmusCarpismaTipi;
    if (yayaVar) tip = 'yaya';
    else if (g.carpismaTipi !== 'otomatik') tip = g.carpismaTipi;
    else {
        const aci = (Math.acos(kisit(nokta(hS, hO), -1, 1)) * 180) / Math.PI;
        if (S.yaklasim.anahtar === O.yaklasim.anahtar || aci < 30) tip = 'arkadan';
        else if (aci > 150) tip = 'kafa-kafaya';
        else tip = 'yandan';
    }

    const CS = cikar(P, carp(hS, bS.boy / 2));
    let CO: Vec2;
    let n: Vec2 = hS;
    let kayan: TarafId | null = null;
    if (tip === 'yaya') {
        CO = topla(P, carp(hS, 0.25));
    } else if (tip === 'arkadan') {
        CO = topla(P, carp(hO, bO.boy / 2));
    } else if (tip === 'kafa-kafaya') {
        CO = cikar(P, carp(hO, bO.boy / 2));
    } else if (tip === 'yandan') {
        const lO = sag(hO);
        const isaret = nokta(lO, carp(hS, -1)) >= 0 ? 1 : -1;
        const disNormal = carp(lO, isaret);
        const k = g.bolge === 'on' ? bO.boy * 0.28 : g.bolge === 'arka' ? -bO.boy * 0.28 : 0;
        CO = cikar(cikar(P, carp(disNormal, bO.en / 2)), carp(hO, k));
        n = carp(disNormal, -1);
    } else {
        // Sıyırma: çarpan taraf karşı aracın bulunduğu yana kayar
        const lS = sag(hS);
        const ES = rS.konum(rS.uzunluk);
        const EO = rO.konum(rO.uzunluk);
        const yan = nokta(lS, cikar(EO, ES));
        const isaret = Math.abs(yan) < 0.3 ? -1 : Math.sign(yan);
        const disS = carp(lS, isaret);
        const CSs = cikar(cikar(P, carp(disS, bS.en / 2)), carp(hS, bS.boy * 0.3));
        CO = cikar(topla(P, carp(disS, bO.en / 2)), carp(hO, bO.boy * 0.3));
        kayan = carpan;
        return { tip, carpan, C: carpan === 'A' ? { A: CSs, B: CO } : { A: CO, B: CSs }, n: disS, kayan };
    }
    return { tip, carpan, C: carpan === 'A' ? { A: CS, B: CO } : { A: CO, B: CS }, n, kayan };
}

function aksKonumlari(g: Govde): number[] {
    const on = g.boy / 2 - Math.min(1.3, g.boy * 0.2);
    const arka = -(g.boy / 2 - Math.min(1.7, g.boy * 0.22));
    return [on, arka];
}

/** Ana giriş: simülasyonu koşturur ve kare dizisini üretir */
export function simuleEt(g: SimGirdi): SimSonuc {
    if (g.A.tip === 'yaya' && g.B.tip === 'yaya') throw new Error('En az bir taraf araç olmalıdır.');
    const uyarilar: string[] = [];
    const mu = Math.max(0.05, g.mu);
    const tabanlar: Record<TarafId, Vec2[]> = { A: tabanRota(g.A), B: tabanRota(g.B) };
    const poz = temasPozu(g, tabanlar);

    // ---- Planlar ----
    const planlar = {} as Record<TarafId, Plan>;
    for (const id of ['A', 'B'] as const) {
        const p = g[id];
        const b = boyut(p);
        const a = mu * G;
        const yaya = p.tip === 'yaya';
        const izEtkin = yaya ? 0 : Math.min(p.izM, frenMesafesi(p.v0, mu));
        const vi = yaya ? p.v0 : frenSonrasiHiz(p.v0, mu, izEtkin);
        const durmus = !yaya && p.v0 > 0.01 && vi < 0.05;
        if (durmus) uyarilar.push(`${id} tarafı girilen fren izi boyunca tamamen duruyor; çarpışma anında hareketsiz kabul edildi.`);
        if (!yaya && p.izM > izEtkin + 0.5) {
            uyarilar.push(`${id}: ${p.izM.toFixed(1)} m fren izi, ${(p.v0 * 3.6).toFixed(0)} km/s hız için fiziksel durma mesafesinden (${izEtkin.toFixed(1)} m) uzun; etkin iz kısaltıldı.`);
        }
        planlar[id] = {
            p,
            rota: hedefliRota(tabanlar[id], poz.C[id], poz.kayan === id),
            v0: p.v0,
            vi,
            a,
            izEtkin,
            tFren: izEtkin > 0 ? (p.v0 - vi) / a : 0,
            reak: yaya ? 0 : p.reaksiyon,
            bekle: durmus ? DURMUS_BEKLEME : 0,
            durmus,
            boy: b.boy,
            en: b.en,
        };
    }
    const temelSure = (pl: Plan): number => pl.bekle + pl.tFren + pl.reak + TEMEL_SEYIR;
    let tC = Math.max(temelSure(planlar.A), temelSure(planlar.B));
    tC = Math.ceil(tC * FPS) / FPS;
    const kCarp = Math.round(tC * FPS);

    // ---- Gövdeler (çarpışma anı) ----
    const govdeler = {} as Record<TarafId, Govde>;
    for (const id of ['A', 'B'] as const) {
        const pl = planlar[id];
        const gv = govdeOlustur(pl.p, null, mu);
        const yon = pl.rota.yon(pl.rota.uzunluk);
        gv.c = { ...poz.C[id] };
        gv.teta = psiTeta(Math.atan2(yon.x, yon.z));
        gv.v = carp(yon, pl.vi);
        govdeler[id] = gv;
    }
    const A = govdeler.A;
    const B = govdeler.B;
    const S = govdeler[poz.carpan];
    const O = govdeler[poz.carpan === 'A' ? 'B' : 'A'];
    const oncesiV = { A: { ...A.v }, B: { ...B.v } };
    const kinetik = (gv: Govde): number => 0.5 * gv.m * (gv.v.x ** 2 + gv.v.z ** 2) + (gv.invI > 0 ? (0.5 * gv.w * gv.w) / gv.invI : 0);
    const enerjiOnce = kinetik(A) + kinetik(B);
    const yayaCarpisma = poz.tip === 'yaya';
    const j = temasCoz(S, O, g.P, poz.n, yayaCarpisma ? E_YAYA : E_ARAC, yayaCarpisma ? MU_TEMAS_YAYA : MU_TEMAS_ARAC);
    if (j <= 0) uyarilar.push('Seçilen geometri ve hızlarda taraflar temas anında birbirine yaklaşmıyor; çarpışma itkisi oluşmadı. Hızları veya çarpışma tipini kontrol edin.');
    const enerjiKJ = Math.max(0, enerjiOnce - (kinetik(A) + kinetik(B))) / 1000;
    const sonrasiV = { A: { ...A.v }, B: { ...B.v } };

    // Yaya fırlatma: ön yüzeyi alçak araçta sarılma (≈12°), yüksekte ileri savrulma (≈4°)
    for (const gv of [A, B]) {
        if (gv.tip !== 'yaya' || j <= 0) continue;
        const arac = gv === A ? planlar.B.p : planlar.A.p;
        const aci = ((ARAC_TURLERI[arac.tur].onYuksek ? 4 : 12) * Math.PI) / 180;
        const vh = Math.hypot(gv.v.x, gv.v.z);
        gv.vy = vh * Math.tan(aci);
        gv.havada = gv.vy > 0.2;
        gv.ayrik = true;
    }

    // ---- Sabit engeller (yakındakiler) ----
    const engeller = g.engeller
        .filter((e) => uzaklik(e.merkez, g.P) < 80)
        .map((e) => govdeOlustur(null, e, mu));

    // ---- Kare kaydı ----
    const kareler: Record<TarafId, number[]> = { A: [], B: [] };
    const yolSayac: Record<TarafId, number> = { A: 0, B: 0 };
    const kaydet = (id: TarafId, c: Vec2, psi: number, y: number, devrilme: number, hiz: number): void => {
        kareler[id].push(c.x, c.z, psi, y, devrilme, yolSayac[id], hiz);
    };

    // İz kaydı
    const izler: IzSerisi[] = [];
    const acikIz = new Map<string, IzSerisi>();
    const izNoktasi = (anahtar: string, p: Vec2, t: number, tur: IzSerisi['tur'], aktif: boolean): void => {
        const mevcut = acikIz.get(anahtar);
        if (!aktif) {
            if (mevcut) acikIz.delete(anahtar);
            return;
        }
        if (!mevcut) {
            const yeni: IzSerisi = { noktalar: [p], zamanlar: [t], tur };
            izler.push(yeni);
            acikIz.set(anahtar, yeni);
            return;
        }
        const son = mevcut.noktalar[mevcut.noktalar.length - 1];
        if (uzaklik(son, p) >= 0.25) {
            mevcut.noktalar.push(p);
            mevcut.zamanlar.push(t);
        }
    };

    // ---- 1) Çarpışma öncesi kareler ----
    for (let k = 0; k <= kCarp; k++) {
        const t = k / FPS;
        const tau = tC - t;
        for (const id of ['A', 'B'] as const) {
            const pl = planlar[id];
            const s = pl.rota.uzunluk - planGeri(pl, tau);
            const c = pl.rota.konum(s);
            const yon = pl.rota.yon(s);
            const psi = Math.atan2(yon.x, yon.z);
            yolSayac[id] = s;
            kaydet(id, c, psi, 0, 0, planHiz(pl, tau));
            // Fren izi: ön tekerlekler kilitlendiği andan çarpışmaya kadar
            if (pl.p.tip === 'arac' && pl.izEtkin > 0.2) {
                const frende = tau <= pl.tFren + pl.bekle + 1e-6 && tau >= pl.bekle - 1e-6;
                const teta = psiTeta(psi);
                const lx = pl.en / 2 - 0.25;
                const on = pl.boy / 2 - Math.min(1.3, pl.boy * 0.2);
                if (ARAC_TURLERI[pl.p.tur].profil === 'iki-teker') {
                    izNoktasi(`${id}-fren-0`, yerelDunya(c, teta, 0, -pl.boy / 2 + 0.35), t, 'fren', frende);
                } else {
                    izNoktasi(`${id}-fren-sol`, yerelDunya(c, teta, lx, on), t, 'fren', frende);
                    izNoktasi(`${id}-fren-sag`, yerelDunya(c, teta, -lx, on), t, 'fren', frende);
                }
            }
        }
    }
    acikIz.clear();

    // ---- 2) Çarpışma sonrası dinamik ----
    const tarafGovde = [A, B];
    const tFrenSonrasi = { A: 0, B: 0 };
    let tSon = tC;
    const azamiKare = Math.round(AZAMI_SONRASI * FPS);
    let dinlenmeKaresi = -1;
    for (let k = 1; k <= azamiKare; k++) {
        for (let alt = 0; alt < ALT_ADIM; alt++) {
            for (const gv of tarafGovde) {
                if (gv.dinlenme) continue;
                const id = gv.id as TarafId;
                if (gv.tip === 'yaya') {
                    if (gv.havada) {
                        gv.vy -= G * DT;
                        gv.y += gv.vy * DT;
                        if (gv.y <= 0) {
                            // Searle: yere çarpma anında düşey hız sürtünmeyle yatayı azaltır
                            const vh = Math.hypot(gv.v.x, gv.v.z);
                            const yeni = Math.max(0, vh - MU_YAYA_ZEMIN * Math.abs(gv.vy));
                            gv.v = vh > 0 ? carp(gv.v, yeni / vh) : gv.v;
                            gv.y = 0;
                            gv.vy = 0;
                            gv.havada = false;
                        }
                    } else {
                        const vh = Math.hypot(gv.v.x, gv.v.z);
                        const dv = Math.min(vh, MU_YAYA_ZEMIN * G * DT);
                        gv.v = vh > 0 ? carp(gv.v, (vh - dv) / vh) : gv.v;
                        gv.w -= kisit(gv.w, -6 * DT, 6 * DT);
                    }
                    if (gv.ayrik) gv.devrilme = Math.min(Math.PI / 2, gv.devrilme + (Math.PI / 2) * (DT / 0.35));
                } else {
                    const d = ileri(gv.teta);
                    const l = yanal(gv.teta);
                    const vL = nokta(gv.v, d);
                    const vT = nokta(gv.v, l);
                    let muL: number;
                    let muT: number;
                    if (gv.ikiTeker) {
                        gv.devrilme = Math.min(1.4, gv.devrilme + 1.4 * (DT / 0.5));
                        muL = muT = gv.mu * 0.75;
                    } else {
                        tFrenSonrasi[id] += DT;
                        const fren = gv.frenli || tFrenSonrasi[id] > 1.0;
                        muL = fren ? gv.mu * 0.85 : Math.min(gv.mu, MU_YUVARLANMA);
                        muT = gv.mu;
                    }
                    const aL = -kisit(vL / DT, -muL * G, muL * G);
                    const aT = -kisit(vT / DT, -muT * G, muT * G);
                    // Sürtünme dairesi
                    const aTop = Math.hypot(aL, aT);
                    const sinir = gv.mu * G;
                    const olcek = aTop > sinir ? sinir / aTop : 1;
                    gv.v = topla(gv.v, carp(topla(carp(d, aL * olcek), carp(l, aT * olcek)), DT));
                    const alfa = (gv.mu * G * 0.3 * gv.boy * 12) / (gv.boy * gv.boy + gv.en * gv.en);
                    gv.w -= kisit(gv.w, -alfa * DT, alfa * DT);
                }
                gv.c = topla(gv.c, carp(gv.v, DT));
                gv.teta += gv.w * DT;
                if (!gv.havada && Math.hypot(gv.v.x, gv.v.z) < 0.03 && Math.abs(gv.w) < 0.02) {
                    gv.v = { x: 0, z: 0 };
                    gv.w = 0;
                    if (gv.tip !== 'yaya' || !gv.ayrik || gv.devrilme >= Math.PI / 2 - 1e-3) gv.dinlenme = true;
                }
            }

            // İkincil temaslar: taraflar arası (yaya hariç) ve sabit engeller
            if (!A.ayrik && !B.ayrik) {
                const s = sat(A, B);
                if (s) {
                    konumDuzelt(A, B, s);
                    temasCoz(A, B, s.temas, s.n, E_ARAC, MU_TEMAS_ARAC);
                }
            }
            for (const gv of tarafGovde) {
                if (gv.tip !== 'arac') continue;
                for (const e of engeller) {
                    const s = sat(gv, e);
                    if (s) {
                        konumDuzelt(gv, e, s);
                        temasCoz(gv, e, s.temas, s.n, 0.1, 0.5);
                    }
                }
            }
        }

        const t = tC + k / FPS;
        for (const gv of tarafGovde) {
            const id = gv.id as TarafId;
            const onceki = kareler[id];
            const n = onceki.length;
            const px = onceki[n - KANAL_SAYISI];
            const pz = onceki[n - KANAL_SAYISI + 1];
            yolSayac[id] += Math.hypot(gv.c.x - px, gv.c.z - pz);
            kaydet(id, gv.c, -gv.teta, gv.y, gv.devrilme, Math.hypot(gv.v.x, gv.v.z));

            // Kayma/sürtünme izleri
            if (gv.tip !== 'arac') continue;
            const d = ileri(gv.teta);
            const l = yanal(gv.teta);
            if (gv.ikiTeker) {
                izNoktasi(`${id}-kazima`, { ...gv.c }, t, 'kayma', !gv.dinlenme && gv.devrilme > 1.0 && Math.hypot(gv.v.x, gv.v.z) > 0.4);
                continue;
            }
            const lx = gv.en / 2 - 0.25;
            const [onZ, arkaZ] = aksKonumlari(gv);
            const tekerler: Array<[string, number, number]> = [
                ['on-sol', lx, onZ], ['on-sag', -lx, onZ], ['arka-sol', lx, arkaZ], ['arka-sag', -lx, arkaZ],
            ];
            for (const [ad, x, zz] of tekerler) {
                const r = cikar(yerelDunya(gv.c, gv.teta, x, zz), gv.c);
                const vp = noktaHizi(gv, r);
                const kayma = Math.abs(nokta(vp, l));
                const fren = (gv.frenli || tFrenSonrasi[id] > 1.0) && Math.abs(nokta(vp, d)) > 0.6;
                izNoktasi(`${id}-${ad}`, topla(gv.c, r), t, 'kayma', !gv.dinlenme && (kayma > 1.0 || fren));
            }
        }

        if (A.dinlenme && B.dinlenme) {
            if (dinlenmeKaresi < 0) dinlenmeKaresi = k;
            if (k - dinlenmeKaresi > FPS) {
                tSon = t;
                break;
            }
        }
        tSon = t;
    }
    if (!(A.dinlenme && B.dinlenme)) uyarilar.push('Taraflar azami simülasyon süresi içinde tam durmadı (çok kaygan zemin veya yüksek hız).');

    const kareSayisi = kareler.A.length / KANAL_SAYISI;

    // ---- Özetler ----
    const ozet = (id: TarafId): TarafSonuc => {
        const pl = planlar[id];
        const gv = govdeler[id];
        const p = pl.p;
        const dizi = new Float32Array(kareler[id]);
        const son = { x: dizi[(kareSayisi - 1) * KANAL_SAYISI], z: dizi[(kareSayisi - 1) * KANAL_SAYISI + 1] };
        const ilkPsi = dizi[kCarp * KANAL_SAYISI + 2];
        const sonPsi = dizi[(kareSayisi - 1) * KANAL_SAYISI + 2];
        const yaya = p.tip === 'yaya';
        const algilama = !yaya && pl.izEtkin > 0 ? pl.izEtkin + pl.v0 * pl.reak : 0;
        let kacinma: TarafSonuc['kacinilabilirlik'] = null;
        if (!yaya && algilama > 0 && g.limitKmh > 0) {
            const k = kacinilabilirlik({ algilamaMesafesi: algilama, limitHizi: g.limitKmh / 3.6, mu, reaksiyon: pl.reak });
            kacinma = {
                limitHizi: g.limitKmh / 3.6,
                algilamaMesafesi: algilama,
                limitteDurusMesafesi: k.durus,
                limitteCarpmaHizi: k.carpmaHizi,
                kacinilabilir: k.kacinilabilir,
            };
        }
        const savrulma = uzaklik(poz.C[id], son);
        return {
            id,
            tip: p.tip,
            tur: p.tur,
            boy: pl.boy,
            en: pl.en,
            kutle: gv.m,
            v0: pl.v0,
            vi: pl.vi,
            vSonra: Math.hypot(sonrasiV[id].x, sonrasiV[id].z),
            deltaV: uzaklik(oncesiV[id], sonrasiV[id]),
            izGirilen: p.izM,
            izEtkin: pl.izEtkin,
            reaksiyon: pl.reak,
            mu,
            frenMesafesi: frenMesafesi(pl.v0, mu),
            durusMesafesi: durusMesafesi(pl.v0, mu, pl.reak),
            algilamaMesafesi: algilama,
            tAlgilama: algilama > 0 ? tC - pl.bekle - pl.tFren - pl.reak : 0,
            tFrenBaslangic: pl.izEtkin > 0 ? tC - pl.bekle - pl.tFren : 0,
            sonKonum: son,
            savrulmaMesafesi: savrulma,
            donmeDerece: Math.abs(((sonPsi - ilkPsi) * 180) / Math.PI),
            durmusAracti: pl.durmus || pl.v0 <= 0.01,
            kacinilabilirlik: kacinma,
            searleAsgariHiz: yaya ? searleAsgariHiz(uzaklik(g.P, son)) : null,
            kareler: dizi,
        };
    };

    return {
        fps: FPS,
        kareSayisi,
        sure: (kareSayisi - 1) / FPS,
        tCarpisma: tC,
        P: { ...g.P },
        normal: poz.n,
        tip: poz.tip,
        carpan: poz.carpan,
        taraflar: { A: ozet('A'), B: ozet('B') },
        izler: izler.filter((iz) => iz.noktalar.length >= 2),
        enerjiKJ,
        uyarilar,
    };
}

/** t anındaki kare değerlerini doğrusal aradeğerleme ile okur */
export function kareOku(sonuc: SimSonuc, id: TarafId, t: number, hedef: Float32Array): void {
    const dizi = sonuc.taraflar[id].kareler;
    const f = kisit(t * sonuc.fps, 0, sonuc.kareSayisi - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(sonuc.kareSayisi - 1, i0 + 1);
    const w = f - i0;
    for (let c = 0; c < KANAL_SAYISI; c++) {
        const a = dizi[i0 * KANAL_SAYISI + c];
        const b = dizi[i1 * KANAL_SAYISI + c];
        if (c === 2) {
            // Açı: en kısa yoldan aradeğerle
            let fark = b - a;
            while (fark > Math.PI) fark -= Math.PI * 2;
            while (fark < -Math.PI) fark += Math.PI * 2;
            hedef[c] = a + fark * w;
        } else hedef[c] = a + (b - a) * w;
    }
}
