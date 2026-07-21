// Kusur oranı değerlendirme motoru.
// 2918 sayılı Karayolları Trafik Kanunu (özellikle m.84'te sayılan asli kusur
// halleri) ve yerleşik bilirkişi uygulaması esas alınarak ağırlıklandırılmış
// basitleştirilmiş bir puanlama modelidir. Hukuki görüş niteliği taşımaz.

export const IHLALLER = [
    { id: 'kirmizi-isik',   ad: 'Kırmızı ışık ihlali',                        puan: 100, dayanak: 'KTK m.47; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'gecis-onceligi', ad: 'Kavşakta geçiş önceliğine uymama',           puan: 100, dayanak: 'KTK m.57; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'karsi-serit',    ad: 'Karşı şeride / yasak yöne girme',            puan: 100, dayanak: 'KTK m.46; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'arkadan-carpma', ad: 'Arkadan çarpma (takip mesafesi ihlali)',     puan: 100, dayanak: 'KTK m.56; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'yasak-sollama',  ad: 'Geçme (sollama) yasağı ihlali',              puan: 90,  dayanak: 'KTK m.54; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'manevra',        ad: 'Kurallara aykırı dönüş / manevra',           puan: 70,  dayanak: 'KTK m.53; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'serit-ihlali',   ad: 'Şerit izleme / değiştirme kuralı ihlali',    puan: 55,  dayanak: 'KTK m.56 (şerit izleme ve değiştirme)' },
    { id: 'alkol',          ad: 'Alkol / uyuşturucu etkisinde sürüş',         puan: 80,  dayanak: 'KTK m.48' },
    { id: 'dikkatsizlik',   ad: 'Dikkatsizlik (telefon vb.)',                 puan: 35,  dayanak: 'Genel dikkat ve özen yükümlülüğü — tali kusur ağırlığında' },
    { id: 'gerekli-tedbir', ad: 'Tehlikeyi görünce tedbir almama',            puan: 25,  dayanak: 'KTK m.52 (hızın şartlara uydurulması)' },
    { id: 'yaya-gecidi',    ad: 'Yaya geçidinde yavaşlamama / yayaya öncelik vermeme', puan: 100, dayanak: 'KTK m.74' },
];

// Yaya katılımcılar için ihlal listesi (KTK m.68 — yayaların uyacakları kurallar)
export const YAYA_IHLALLERI = [
    { id: 'yaya-kirmizi',    ad: 'Kırmızı ışıkta / yaya kırmızısında geçme',            puan: 80, dayanak: 'KTK m.68 (ışıklı işaretlere uyma)' },
    { id: 'yaya-gecit-disi', ad: 'Yakında geçit varken geçit dışından geçme',           puan: 60, dayanak: 'KTK m.68' },
    { id: 'yaya-tasit-yolu', ad: 'Taşıt yolunda yürüme / taşıt yoluna ani çıkış',       puan: 50, dayanak: 'KTK m.68' },
    { id: 'yaya-dikkatsiz',  ad: 'Yola kontrolsüz / dikkatsiz çıkma',                   puan: 35, dayanak: 'KTK m.68' },
];

const TUM_IHLALLER = [...IHLALLER, ...YAYA_IHLALLERI];

// Hız aşımının kusur puanı: limitin %10'una kadar tolere edilir,
// üzeri kademeli olarak ağırlaşır (m.84/b: "arızalı... aşırı hızla" / m.51).
export function hizAsimiPuani(hizKmh, limitKmh) {
    if (!limitKmh || !hizKmh) return null;
    const oran = hizKmh / limitKmh;
    if (oran <= 1.10) return null;
    if (oran <= 1.30) return { id: 'hiz-10-30', ad: `Hız limitini aşma (%${Math.round((oran - 1) * 100)})`, puan: 35, dayanak: 'KTK m.51 — tali kusur ağırlığında' };
    if (oran <= 1.50) return { id: 'hiz-30-50', ad: `Hız limitini ciddi aşma (%${Math.round((oran - 1) * 100)})`, puan: 65, dayanak: 'KTK m.51' };
    return { id: 'hiz-50+', ad: `Hız limitini ağır aşma (%${Math.round((oran - 1) * 100)})`, puan: 100, dayanak: 'KTK m.51 — asli kusur ağırlığında' };
}

// arac = { ihlaller: ['kirmizi-isik', ...], hizKmh, limitKmh }
function aracPuani(arac) {
    const gerekceler = [];
    let toplam = 0;
    for (const id of arac.ihlaller) {
        const k = TUM_IHLALLER.find(i => i.id === id);
        if (!k) continue;
        toplam += k.puan;
        gerekceler.push({ ad: k.ad, dayanak: k.dayanak, puan: k.puan });
    }
    const hiz = hizAsimiPuani(arac.hizKmh, arac.limitKmh);
    if (hiz) { toplam += hiz.puan; gerekceler.push({ ad: hiz.ad, dayanak: hiz.dayanak, puan: hiz.puan }); }
    return { toplam, gerekceler };
}

function etiket(oran) {
    if (oran === 0)   return { ad: 'Kusursuz',     sinif: 'kusursuz' };
    if (oran > 0.5)   return { ad: 'Asli kusurlu', sinif: 'asli' };
    if (oran === 0.5) return { ad: 'Eşit kusurlu', sinif: 'tali' };
    return { ad: 'Tali kusurlu', sinif: 'tali' };
}

// Ana giriş: iki aracın ihlal/hız verisinden kusur dağılımı üretir.
export function kusurHesapla(aracA, aracB) {
    const A = aracPuani(aracA);
    const B = aracPuani(aracB);
    const toplam = A.toplam + B.toplam;

    let hamOran, belirsiz = false;
    if (toplam === 0) { hamOran = 0.5; belirsiz = true; }
    else hamOran = A.toplam / toplam;

    // Türk uygulamasında kusur 8'lik dilimle ifade edilir; ham puan oranı
    // en yakın dilime YUVARLANIR. Böylece yalnızca %100-0, %87,5-12,5,
    // %75-25, %62,5-37,5 ve %50-50 gibi yerleşik dağılımlar çıkar.
    let sekizA = Math.round(hamOran * 8);
    if (toplam > 0) {
        if (A.toplam > 0 && sekizA === 0) sekizA = 1;   // kusuru olan tarafa en az 1/8
        if (B.toplam > 0 && sekizA === 8) sekizA = 7;
        if (A.toplam === 0) sekizA = 0;                 // hiç ihlali olmayan taraf kusursuz
        if (B.toplam === 0 && A.toplam > 0) sekizA = 8;
    }
    const sekizB = 8 - sekizA;
    const oranA = sekizA / 8, oranB = sekizB / 8;
    const yuzdeMetni = (o) => {
        const y = o * 100;
        return Number.isInteger(y) ? String(y) : y.toFixed(1).replace('.', ',');
    };

    return {
        belirsiz,
        A: { oran: oranA, yuzde: oranA * 100, yuzdeMetin: yuzdeMetni(oranA), sekizlik: `${sekizA}/8`, etiket: etiket(belirsiz ? 0.5 : oranA), gerekceler: A.gerekceler },
        B: { oran: oranB, yuzde: oranB * 100, yuzdeMetin: yuzdeMetni(oranB), sekizlik: `${sekizB}/8`, etiket: etiket(belirsiz ? 0.5 : oranB), gerekceler: B.gerekceler },
    };
}
