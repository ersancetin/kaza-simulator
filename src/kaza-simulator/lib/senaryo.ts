// Form girdilerini simülasyon girdisine dönüştüren saf yardımcılar.

import { ARAC_TURLERI, ISARET_KATALOGU, varsayilanKatilimci, VARSAYILAN_KOSULLAR, YUZEYLER } from '../data/kazaData.ts';
import type {
    Cevre, GenelKosullar, KatilimciGirdi, KatilimciTipi, SablonSenaryo, SabitEngel, SimGirdi, SimKatilimci,
    TarafId, Vec2, Yaklasim,
} from '../types/kazaTypes.ts';
import { yaklasimlar, yayaGecisleri, yolAcisi } from './geometry.ts';
import { izdenHiz, kmh2ms } from './physics.ts';

/** Katılımcı tipine göre geçerli yaklaşım listesi */
export function yaklasimListesi(cevre: Cevre, P: Vec2, tip: KatilimciTipi): Yaklasim[] {
    const hepsi = yaklasimlar(cevre, P);
    return tip === 'yaya' ? [...yayaGecisleri(cevre, P), ...hepsi] : hepsi.filter((y) => !y.yaya);
}

/** Kaza öncesi hız (m/s): ya doğrudan ya da fren izinden */
export function baslangicHizi(k: KatilimciGirdi, mu: number): number {
    if (k.tip === 'yaya') return kmh2ms(Math.max(0, k.hizKmh));
    if (k.mod === 'iz') return izdenHiz(mu, Math.max(0, k.izM), kmh2ms(Math.max(0, k.izSonuKmh)));
    return kmh2ms(Math.max(0, k.hizKmh));
}

export function simKatilimci(id: TarafId, k: KatilimciGirdi, yaklasim: Yaklasim, mu: number): SimKatilimci {
    return {
        id,
        tip: k.tip,
        tur: k.tur,
        plaka: k.plaka.trim(),
        v0: baslangicHizi(k, mu),
        izM: k.tip === 'yaya' ? 0 : Math.max(0, k.izM),
        kutle: Math.max(20, k.kutleKg || (k.tip === 'yaya' ? 75 : ARAC_TURLERI[k.tur].kutle)),
        reaksiyon: k.tip === 'yaya' ? 0 : Math.max(0, k.reaksiyonS),
        yaklasim,
    };
}

/** Sahnedeki levha direkleri, ağaçlar, bariyerler vb. savrulmada sabit engel olur */
export function sabitEngeller(cevre: Cevre): SabitEngel[] {
    const sonuc: SabitEngel[] = [];
    for (const is of cevre.isaretler) {
        const k = ISARET_KATALOGU.find((o) => o.tip === is.tip);
        if (!k?.engel) continue;
        sonuc.push({
            merkez: { x: is.x, z: is.z },
            aci: is.aci ?? yolAcisi(cevre.yollar, is),
            yx: k.engel.yx,
            yz: k.engel.yz,
        });
    }
    for (const a of cevre.agaclar) sonuc.push({ merkez: a, aci: 0, yx: 0.25, yz: 0.25 });
    return sonuc;
}

export function simGirdisiKur(
    cevre: Cevre, P: Vec2, kosullar: GenelKosullar,
    A: KatilimciGirdi, B: KatilimciGirdi, yA: Yaklasim, yB: Yaklasim,
): SimGirdi {
    return {
        A: simKatilimci('A', A, yA, kosullar.mu),
        B: simKatilimci('B', B, yB, kosullar.mu),
        mu: kosullar.mu,
        limitKmh: kosullar.limitKmh,
        P,
        carpismaTipi: kosullar.carpismaTipi,
        carpan: kosullar.carpan,
        bolge: kosullar.bolge,
        engeller: sabitEngeller(cevre),
    };
}

export interface SablonKurulum {
    cevre: Cevre;
    P: Vec2;
    kosullar: GenelKosullar;
    A: KatilimciGirdi;
    B: KatilimciGirdi;
}

/** Şablon senaryoyu form durumuna açar; yaklaşımlar etiketteki yön adıyla seçilir */
export function sablonKur(s: SablonSenaryo): SablonKurulum {
    const cevre = s.cevre();
    const kosullar: GenelKosullar = { ...VARSAYILAN_KOSULLAR, ...s.kosullar };
    const yuzey = YUZEYLER.find((y) => y.id === kosullar.yuzeyId);
    if (yuzey && s.kosullar.mu === undefined) kosullar.mu = yuzey.mu;
    const kur = (id: TarafId, parca: SablonSenaryo['A']): KatilimciGirdi => {
        const { yon, ...gerisi } = parca;
        const k: KatilimciGirdi = { ...varsayilanKatilimci(id), ...gerisi };
        if (parca.tur && parca.kutleKg === undefined) k.kutleKg = ARAC_TURLERI[parca.tur].kutle;
        const liste = yaklasimListesi(cevre, s.P, k.tip);
        const secilen = liste.find((y) => y.etiket.includes(yon)) ?? liste[0];
        k.yaklasimAnahtar = secilen ? secilen.anahtar : '';
        return k;
    };
    return { cevre, P: { ...s.P }, kosullar, A: kur('A', s.A), B: kur('B', s.B) };
}
