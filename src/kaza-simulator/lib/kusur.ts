// Olası kusur dağılımı motoru (tespit değildir).
// 2918 sayılı KTK (özellikle m.84'te sayılan asli kusur hâlleri) esas
// alınarak ağırlıklandırılmış, basitleştirilmiş bir puanlama modelidir.
// Hukuki görüş niteliği taşımaz.

import { IHLALLER, YAYA_IHLALLERI } from '../data/kazaData.ts';
import type { Ihlal, KusurGerekce, KusurGirdi, KusurSonuc, KusurTaraf } from '../types/kazaTypes.ts';

const TUM_IHLALLER: readonly Ihlal[] = [...IHLALLER, ...YAYA_IHLALLERI];

/** Hız aşımı puanı: limitin %10'una kadar tolere edilir, üzeri kademeli ağırlaşır */
export function hizAsimiPuani(hizKmh: number | null, limitKmh: number | null): KusurGerekce | null {
    if (!limitKmh || !hizKmh) return null;
    const oran = hizKmh / limitKmh;
    const yuzde = Math.round((oran - 1) * 100);
    if (oran <= 1.1) return null;
    if (oran <= 1.3) return { ad: `Hız sınırının aşılmış olması (%${yuzde})`, puan: 35, dayanak: 'KTK m.51 ile ilgili olabilir — tali kusur ağırlığında değerlendirilebilir' };
    if (oran <= 1.5) return { ad: `Hız sınırının ciddi aşılmış olması (%${yuzde})`, puan: 65, dayanak: 'KTK m.51 ile ilgili olabilir' };
    return { ad: `Hız sınırının ağır aşılmış olması (%${yuzde})`, puan: 100, dayanak: 'KTK m.51 ile ilgili olabilir — asli kusur ağırlığında değerlendirilebilir' };
}

function tarafPuani(g: KusurGirdi): { toplam: number; gerekceler: KusurGerekce[] } {
    const gerekceler: KusurGerekce[] = [];
    let toplam = 0;
    for (const id of g.ihlaller) {
        const k = TUM_IHLALLER.find((i) => i.id === id);
        if (!k) continue;
        toplam += k.puan;
        gerekceler.push({ ad: k.ad, dayanak: k.dayanak, puan: k.puan });
    }
    const hiz = hizAsimiPuani(g.hizKmh, g.limitKmh);
    if (hiz) {
        toplam += hiz.puan;
        gerekceler.push(hiz);
    }
    return { toplam, gerekceler };
}

function etiket(oran: number): KusurTaraf['etiket'] {
    // Tespit değil, girdilere göre olasılık ifadesi
    if (oran === 0) return { ad: 'Kusur görünmüyor', sinif: 'kusursuz' };
    if (oran > 0.5) return { ad: 'Asli kusur ihtimali', sinif: 'asli' };
    if (oran === 0.5) return { ad: 'Eşit kusur ihtimali', sinif: 'tali' };
    return { ad: 'Tali kusur ihtimali', sinif: 'tali' };
}

const yuzdeMetni = (o: number): string => {
    const y = o * 100;
    return Number.isInteger(y) ? String(y) : y.toFixed(1).replace('.', ',');
};

/** İki tarafın ihlal/hız verisinden 8'lik dilimli kusur dağılımı üretir */
export function kusurHesapla(a: KusurGirdi, b: KusurGirdi): KusurSonuc {
    const A = tarafPuani(a);
    const B = tarafPuani(b);
    const toplam = A.toplam + B.toplam;
    const belirsiz = toplam === 0;
    const hamOran = belirsiz ? 0.5 : A.toplam / toplam;

    // Uygulamada kusur 8'lik dilimle ifade edilir; ham oran en yakın dilime yuvarlanır
    let sekizA = Math.round(hamOran * 8);
    if (!belirsiz) {
        if (A.toplam > 0 && sekizA === 0) sekizA = 1;
        if (B.toplam > 0 && sekizA === 8) sekizA = 7;
        if (A.toplam === 0) sekizA = 0;
        if (B.toplam === 0 && A.toplam > 0) sekizA = 8;
    }
    const sekizB = 8 - sekizA;
    const taraf = (sekiz: number, gerekceler: KusurGerekce[]): KusurTaraf => {
        const oran = sekiz / 8;
        return {
            oran,
            yuzde: oran * 100,
            yuzdeMetin: yuzdeMetni(oran),
            sekizlik: `${sekiz}/8`,
            etiket: etiket(belirsiz ? 0.5 : oran),
            gerekceler,
        };
    };
    return { belirsiz, A: taraf(sekizA, A.gerekceler), B: taraf(sekizB, B.gerekceler) };
}
