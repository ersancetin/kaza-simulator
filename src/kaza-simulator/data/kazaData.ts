// Statik, tip güvenli veri havuzları: yüzeyler, araç türleri, kural ihlalleri,
// levha/öge kataloğu ve internetsiz çalışan şablon senaryolar.

import type {
    AracTuru, AracTuruId, Bina, Cevre, Ihlal, IsaretTipi, Isaret, KatilimciGirdi,
    SablonSenaryo, TarafId, Vec2, Yol, YolSinifi, Yuzey, GenelKosullar,
} from '../types/kazaTypes.ts';

export const SURUM = 'v3.0';

// Lastik–yol tipik kayma sürtünme katsayıları (kilitli tekerlek)
export const YUZEYLER: readonly Yuzey[] = [
    { id: 'kuru-asfalt', ad: 'Kuru asfalt', mu: 0.75 },
    { id: 'islak-asfalt', ad: 'Islak asfalt', mu: 0.45 },
    { id: 'kuru-beton', ad: 'Kuru beton', mu: 0.8 },
    { id: 'islak-beton', ad: 'Islak beton', mu: 0.55 },
    { id: 'parke', ad: 'Parke taşı', mu: 0.6 },
    { id: 'stabilize', ad: 'Stabilize / çakıl', mu: 0.5 },
    { id: 'karli', ad: 'Karlı yol', mu: 0.25 },
    { id: 'buzlu', ad: 'Buzlu yol', mu: 0.12 },
];

// OSM surface etiketi → yüzey kimliği
export const OSM_YUZEY_ESLEME: Readonly<Record<string, string>> = {
    asphalt: 'kuru-asfalt', paved: 'kuru-asfalt', concrete: 'kuru-beton',
    'concrete:plates': 'kuru-beton', paving_stones: 'parke', sett: 'parke', cobblestone: 'parke',
    gravel: 'stabilize', fine_gravel: 'stabilize', compacted: 'stabilize',
    dirt: 'stabilize', ground: 'stabilize', earth: 'stabilize', unpaved: 'stabilize',
};

export const ARAC_TURLERI: Readonly<Record<AracTuruId, AracTuru>> = {
    otomobil: { id: 'otomobil', ad: 'Otomobil', boy: 4.5, en: 1.8, yukseklik: 1.45, kutle: 1350, profil: 'sedan', onYuksek: false },
    suv: { id: 'suv', ad: 'SUV / Arazi', boy: 4.6, en: 1.86, yukseklik: 1.7, kutle: 1750, profil: 'suv', onYuksek: false },
    kamyonet: { id: 'kamyonet', ad: 'Kamyonet (Pikap)', boy: 5.3, en: 1.9, yukseklik: 1.8, kutle: 2100, profil: 'pikap', onYuksek: false },
    minibus: { id: 'minibus', ad: 'Minibüs / Panelvan', boy: 5.9, en: 2.0, yukseklik: 2.45, kutle: 3000, profil: 'van', onYuksek: true },
    kamyon: { id: 'kamyon', ad: 'Kamyon', boy: 8.5, en: 2.45, yukseklik: 3.3, kutle: 9000, profil: 'kamyon', onYuksek: true },
    otobus: { id: 'otobus', ad: 'Otobüs', boy: 12.0, en: 2.55, yukseklik: 3.2, kutle: 12000, profil: 'otobus', onYuksek: true },
    cekici: { id: 'cekici', ad: 'Çekici (TIR)', boy: 16.5, en: 2.55, yukseklik: 4.0, kutle: 18000, profil: 'tir', onYuksek: true },
    motosiklet: { id: 'motosiklet', ad: 'Motosiklet', boy: 2.1, en: 0.8, yukseklik: 1.5, kutle: 280, profil: 'iki-teker', onYuksek: false },
    bisiklet: { id: 'bisiklet', ad: 'Bisiklet', boy: 1.8, en: 0.6, yukseklik: 1.7, kutle: 95, profil: 'iki-teker', onYuksek: false },
    traktor: { id: 'traktor', ad: 'Traktör', boy: 4.0, en: 2.0, yukseklik: 2.7, kutle: 3500, profil: 'traktor', onYuksek: true },
};

export const YAYA_BOYUT = { boy: 0.45, en: 0.55, yukseklik: 1.72, kutle: 75 } as const;

// Taraf renkleri: A kurumsal kırmızı, B kontrast mavi (raporla birebir)
export const TARAF_RENK: Readonly<Record<TarafId, string>> = { A: '#C81D25', B: '#1F5FBF' };

// ---- Kural ihlalleri (2918 sayılı KTK) ----
export const IHLALLER: readonly Ihlal[] = [
    { id: 'kirmizi-isik', ad: 'Kırmızı ışık ihlali', puan: 100, dayanak: 'KTK m.47; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'gecis-onceligi', ad: 'Kavşakta geçiş önceliğine uymama', puan: 100, dayanak: 'KTK m.57; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'karsi-serit', ad: 'Karşı şeride / yasak yöne girme', puan: 100, dayanak: 'KTK m.46; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'arkadan-carpma', ad: 'Arkadan çarpma (takip mesafesi ihlali)', puan: 100, dayanak: 'KTK m.56; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'yasak-sollama', ad: 'Geçme (sollama) yasağı ihlali', puan: 90, dayanak: 'KTK m.54; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'manevra', ad: 'Kurallara aykırı dönüş / manevra', puan: 70, dayanak: 'KTK m.53; m.84 kapsamında asli kusur sayılan hâl' },
    { id: 'serit-ihlali', ad: 'Şerit izleme / değiştirme kuralı ihlali', puan: 55, dayanak: 'KTK m.56 (şerit izleme ve değiştirme)' },
    { id: 'alkol', ad: 'Alkol / uyuşturucu etkisinde sürüş', puan: 80, dayanak: 'KTK m.48' },
    { id: 'dikkatsizlik', ad: 'Dikkatsizlik (telefon vb.)', puan: 35, dayanak: 'Genel dikkat ve özen yükümlülüğü — tali kusur ağırlığında' },
    { id: 'gerekli-tedbir', ad: 'Tehlikeyi görünce tedbir almama', puan: 25, dayanak: 'KTK m.52 (hızın şartlara uydurulması)' },
    { id: 'yaya-gecidi', ad: 'Yaya geçidinde yayaya öncelik vermeme', puan: 100, dayanak: 'KTK m.74' },
];

export const YAYA_IHLALLERI: readonly Ihlal[] = [
    { id: 'yaya-kirmizi', ad: 'Kırmızı ışıkta / yaya kırmızısında geçme', puan: 80, dayanak: 'KTK m.68 (ışıklı işaretlere uyma)' },
    { id: 'yaya-gecit-disi', ad: 'Yakında geçit varken geçit dışından geçme', puan: 60, dayanak: 'KTK m.68' },
    { id: 'yaya-tasit-yolu', ad: 'Taşıt yolunda yürüme / yola ani çıkış', puan: 50, dayanak: 'KTK m.68' },
    { id: 'yaya-dikkatsiz', ad: 'Yola kontrolsüz / dikkatsiz çıkma', puan: 35, dayanak: 'KTK m.68' },
];

// ---- Levha ve öge kataloğu (palet) ----
export type IsaretGrubu = 'kontrol' | 'yasak' | 'bilgi' | 'zemin' | 'cevre';

export interface IsaretKatalogOgesi {
    tip: IsaretTipi;
    ad: string;
    grup: IsaretGrubu;
    /** Yol kenarına, trafiğe dönük dikilir */
    direkli: boolean;
    /** Savrulan araç çarparsa durduran sabit engel boyutu (yarı x, yarı z) */
    engel?: { yx: number; yz: number };
}

export const ISARET_GRUPLARI: readonly { id: IsaretGrubu; ad: string }[] = [
    { id: 'kontrol', ad: 'Trafik kontrol' },
    { id: 'yasak', ad: 'Yasak ve kısıtlama' },
    { id: 'bilgi', ad: 'Uyarı ve bilgi' },
    { id: 'zemin', ad: 'Yol yüzeyi' },
    { id: 'cevre', ad: 'Çevre ögeleri' },
];

export const ISARET_KATALOGU: readonly IsaretKatalogOgesi[] = [
    { tip: 'traffic_signals', ad: 'Trafik ışığı', grup: 'kontrol', direkli: true, engel: { yx: 0.15, yz: 0.15 } },
    { tip: 'stop', ad: 'DUR', grup: 'kontrol', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'give_way', ad: 'Yol ver', grup: 'kontrol', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'ana-yol', ad: 'Ana yol', grup: 'kontrol', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'hiz-tabela', ad: 'Hız sınırı', grup: 'yasak', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'sollama-yasak', ad: 'Öndeki taşıtı geçmek yasak', grup: 'yasak', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'park-yasak', ad: 'Park yasak', grup: 'yasak', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'giris-yok', ad: 'Girişi olmayan yol', grup: 'yasak', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'yaya-gecidi-levha', ad: 'Yaya geçidi', grup: 'bilgi', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'okul-gecidi', ad: 'Okul geçidi', grup: 'bilgi', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'donel-kavsak', ad: 'Ada etrafında dönünüz', grup: 'bilgi', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'ozel-tabela', ad: 'Yazılı levha', grup: 'bilgi', direkli: true, engel: { yx: 0.08, yz: 0.08 } },
    { tip: 'crossing', ad: 'Yaya geçidi (zebra)', grup: 'zemin', direkli: false },
    { tip: 'traffic_calming', ad: 'Kasis', grup: 'zemin', direkli: false },
    { tip: 'agac', ad: 'Ağaç', grup: 'cevre', direkli: false, engel: { yx: 0.25, yz: 0.25 } },
    { tip: 'direk', ad: 'Elektrik direği', grup: 'cevre', direkli: false, engel: { yx: 0.15, yz: 0.15 } },
    { tip: 'bariyer', ad: 'Bariyer', grup: 'cevre', direkli: false, engel: { yx: 0.15, yz: 1.6 } },
    { tip: 'duba', ad: 'Duba', grup: 'cevre', direkli: false },
    { tip: 'konteyner', ad: 'Çöp konteyneri', grup: 'cevre', direkli: false, engel: { yx: 0.75, yz: 0.5 } },
    { tip: 'park-arac', ad: 'Park etmiş araç', grup: 'cevre', direkli: false, engel: { yx: 0.9, yz: 2.25 } },
    { tip: 'kedi', ad: 'Kedi', grup: 'cevre', direkli: false },
    { tip: 'kopek', ad: 'Köpek', grup: 'cevre', direkli: false },
];

export const ISARET_ADI = (tip: IsaretTipi): string =>
    ISARET_KATALOGU.find((k) => k.tip === tip)?.ad ?? tip;

// ---- OSM yol sınıfları ----
export const YOL_GENISLIKLERI: Readonly<Record<YolSinifi, number>> = {
    motorway: 15, trunk: 13, primary: 11, secondary: 9.5, tertiary: 8,
    unclassified: 7, residential: 6.5, living_street: 5.5, service: 5,
    motorway_link: 8, trunk_link: 8, primary_link: 8, secondary_link: 7, tertiary_link: 7,
    pedestrian: 4, footway: 2, path: 2, cycleway: 2.5, track: 3.5, steps: 2,
};

export const YAYA_SINIFLARI: ReadonlySet<YolSinifi> = new Set<YolSinifi>([
    'pedestrian', 'footway', 'path', 'cycleway', 'track', 'steps',
]);

/** Kaldırımlı (kentsel) yol sınıfları */
export const KALDIRIMLI_SINIFLAR: ReadonlySet<YolSinifi> = new Set<YolSinifi>([
    'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
]);

// ---- Varsayılan taraf girdileri ----
export function varsayilanKatilimci(id: TarafId): KatilimciGirdi {
    return {
        tip: 'arac',
        tur: 'otomobil',
        plaka: '',
        mod: 'hiz',
        hizKmh: id === 'A' ? 60 : 50,
        izM: id === 'A' ? 10 : 0,
        izSonuKmh: 20,
        kutleKg: ARAC_TURLERI.otomobil.kutle,
        reaksiyonS: 1.0,
        yaklasimAnahtar: '',
        ihlaller: [],
    };
}

export const VARSAYILAN_KOSULLAR: GenelKosullar = {
    yuzeyId: 'kuru-asfalt',
    mu: 0.75,
    limitKmh: 50,
    carpismaTipi: 'otomatik',
    carpan: 'A',
    bolge: 'orta',
};

// ============================================================
// Şablon senaryolar (çevrimdışı çalışır)
// ============================================================

let sablonSayac = 0;
function yol(ad: string, sinif: YolSinifi, genislik: number, seritSayisi: number, noktalar: Vec2[], hizLimiti: number | null, tekYon = false): Yol {
    sablonSayac += 1;
    return { id: `sablon-${sablonSayac}`, ad, sinif, genislik, seritSayisi, tekYon, hizLimiti, yuzey: 'asphalt', noktalar };
}

function isaret(tip: IsaretTipi, x: number, z: number, aci?: number, ek: Partial<Isaret> = {}): Isaret {
    sablonSayac += 1;
    return { id: `si-${sablonSayac}`, tip, x, z, aci, ...ek };
}

// Deterministik sözde rastgele (şablonlar her açılışta aynı görünür)
function tohumlu(tohum: number): () => number {
    let s = tohum >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** Bir yol ekseninin iki yanına, kaldırım gerisine bina blokları dizer */
function binaSirasi(baslangic: number, bitis: number, eksen: 'x' | 'z', ofset: number, tohum: number, haric: Array<[number, number]> = []): Bina[] {
    const r = tohumlu(tohum);
    const sonuc: Bina[] = [];
    let s = baslangic;
    while (s < bitis) {
        const cephe = 12 + r() * 14;
        const derinlik = 10 + r() * 8;
        const bosluk = 2 + r() * 5;
        const merkez = s + cephe / 2;
        const engelli = haric.some(([a, b]) => merkez + cephe / 2 > a && merkez - cephe / 2 < b);
        if (!engelli && s + cephe <= bitis) {
            const kat = 2 + Math.floor(r() * 5);
            const yon = Math.sign(ofset);
            const ic = ofset;
            const dis = ofset + yon * derinlik;
            const pts: Vec2[] = eksen === 'x'
                ? [{ x: s, z: ic }, { x: s + cephe, z: ic }, { x: s + cephe, z: dis }, { x: s, z: dis }]
                : [{ x: ic, z: s }, { x: ic, z: s + cephe }, { x: dis, z: s + cephe }, { x: dis, z: s }];
            sonuc.push({ noktalar: pts, yukseklik: kat * 3.1 });
        }
        s += cephe + bosluk;
    }
    return sonuc;
}

function agacSirasi(baslangic: number, bitis: number, aralik: number, eksen: 'x' | 'z', ofset: number, haric: Array<[number, number]> = []): Vec2[] {
    const sonuc: Vec2[] = [];
    for (let s = baslangic; s <= bitis; s += aralik) {
        if (haric.some(([a, b]) => s > a && s < b)) continue;
        sonuc.push(eksen === 'x' ? { x: s, z: ofset } : { x: ofset, z: s });
    }
    return sonuc;
}

function kavsakCevresi(): Cevre {
    // Doğu-batı: 4 şeritli cadde (13 m); kuzey-güney: 2 şeritli cadde (9 m)
    const U = 260;
    const yollar = [
        yol('Atatürk Caddesi', 'primary', 13, 4, [{ x: -U, z: 0 }, { x: 0, z: 0 }, { x: U, z: 0 }], 50),
        yol('İstiklal Caddesi', 'secondary', 9, 2, [{ x: 0, z: -U }, { x: 0, z: 0 }, { x: 0, z: U }], 50),
    ];
    const isaretler: Isaret[] = [
        // Her kolun sağ-yakın köşesinde, gelen trafiğe dönük ışık
        isaret('traffic_signals', 6.2, 8.2, 0),
        isaret('traffic_signals', -6.2, -8.2, Math.PI),
        isaret('traffic_signals', -6.2, 8.2, -Math.PI / 2),
        isaret('traffic_signals', 6.2, -8.2, Math.PI / 2),
        isaret('crossing', 0, 11.5), isaret('crossing', 0, -11.5),
        isaret('crossing', 9.5, 0), isaret('crossing', -9.5, 0),
    ];
    const kavsak: Array<[number, number]> = [[-24, 24]];
    const binalar = [
        ...binaSirasi(-U, U, 'x', 11.5, 11, kavsak), ...binaSirasi(-U, U, 'x', -11.5, 12, kavsak),
        ...binaSirasi(-U, U, 'z', 9.5, 13, [[-32, 32]]), ...binaSirasi(-U, U, 'z', -9.5, 14, [[-32, 32]]),
    ];
    const agaclar = [
        ...agacSirasi(-200, 200, 14, 'x', 8.6, kavsak), ...agacSirasi(-200, 200, 14, 'x', -8.6, kavsak),
    ];
    return { yollar, binalar, isaretler, agaclar, kaynak: 'sablon' };
}

function tKavsakCevresi(): Cevre {
    const yollar = [
        yol('Cumhuriyet Caddesi', 'secondary', 10, 2, [{ x: -260, z: 0 }, { x: 0, z: 0 }, { x: 260, z: 0 }], 50),
        yol('Okul Sokak', 'residential', 7, 2, [{ x: 0, z: 220 }, { x: 0, z: 0 }], 30),
    ];
    const isaretler: Isaret[] = [
        isaret('stop', 5.2, 7.2, 0),
        isaret('ana-yol', -7.5, 6.8, -Math.PI / 2),
        isaret('ana-yol', 7.5, -6.8, Math.PI / 2),
        isaret('okul-gecidi', 5.2, 40, 0),
    ];
    const binalar = [
        ...binaSirasi(-260, 260, 'x', -9, 21),
        ...binaSirasi(-260, -14, 'x', 9, 22), ...binaSirasi(14, 260, 'x', 9, 23),
        ...binaSirasi(32, 220, 'z', 7.5, 24), ...binaSirasi(32, 220, 'z', -7.5, 25),
    ];
    const agaclar = [...agacSirasi(-220, 220, 16, 'x', -7.2, [[-10, 10]])];
    return { yollar, binalar, isaretler, agaclar, kaynak: 'sablon' };
}

function kirsalYolCevresi(): Cevre {
    // Hafif S kıvrımlı iki şeritli şehirlerarası yol
    const pts: Vec2[] = [];
    for (let x = -320; x <= 320; x += 16) pts.push({ x, z: 22 * Math.sin(x / 190) });
    const yollar = [{ ...yol('Köy Yolu (D-750 bağlantı)', 'tertiary', 7.5, 2, pts, 90), kaldirimYok: true }];
    const r = tohumlu(7);
    const agaclar: Vec2[] = [];
    for (let x = -300; x <= 300; x += 9) {
        const z0 = 22 * Math.sin(x / 190);
        if (r() > 0.35) agaclar.push({ x: x + r() * 4, z: z0 + 9 + r() * 14 });
        if (r() > 0.35) agaclar.push({ x: x + r() * 4, z: z0 - 9 - r() * 14 });
    }
    const isaretler: Isaret[] = [
        isaret('hiz-tabela', -60, 22 * Math.sin(-60 / 190) + 5.6, -Math.PI / 2 - 0.11, { deger: 90 }),
        isaret('sollama-yasak', 60, 22 * Math.sin(60 / 190) - 5.6, Math.PI / 2 - 0.11),
    ];
    return { yollar, binalar: [], isaretler, agaclar, kaynak: 'sablon' };
}

function bulvarCevresi(): Cevre {
    const yollar = [
        yol('İnönü Bulvarı', 'primary', 13, 4, [{ x: -300, z: 0 }, { x: 300, z: 0 }], 50),
        yol('Lale Sokak', 'residential', 7, 2, [{ x: 70, z: -200 }, { x: 70, z: 0 }], 30),
    ];
    const isaretler: Isaret[] = [
        isaret('traffic_signals', 62, 8.4, -Math.PI / 2),
        isaret('crossing', 60, 0),
        isaret('hiz-tabela', -80, 8.4, -Math.PI / 2, { deger: 50 }),
    ];
    const binalar = [
        ...binaSirasi(-300, 300, 'x', 11.5, 31), ...binaSirasi(-300, 58, 'x', -11.5, 32), ...binaSirasi(82, 300, 'x', -11.5, 33),
    ];
    const agaclar = [...agacSirasi(-280, 280, 13, 'x', 8.7, [[52, 68]]), ...agacSirasi(-280, 280, 13, 'x', -8.7, [[52, 88]])];
    return { yollar, binalar, isaretler, agaclar, kaynak: 'sablon' };
}

function yayaGecidiCevresi(): Cevre {
    const yollar = [
        yol('Mithatpaşa Caddesi', 'tertiary', 9, 2, [{ x: -260, z: 0 }, { x: 260, z: 0 }], 50),
    ];
    const isaretler: Isaret[] = [
        isaret('crossing', 0, 0),
        isaret('yaya-gecidi-levha', -4, 6.6, -Math.PI / 2),
        isaret('yaya-gecidi-levha', 4, -6.6, Math.PI / 2),
        isaret('park-arac', -14, 6.0, Math.PI / 2),
        isaret('park-arac', -21, 6.0, Math.PI / 2),
    ];
    const binalar = [
        ...binaSirasi(-260, 260, 'x', 10, 41, [[-6, 6]]), ...binaSirasi(-260, 260, 'x', -10, 42, [[-6, 6]]),
    ];
    const agaclar = [...agacSirasi(-240, 240, 12, 'x', 7.4, [[-26, 8]]), ...agacSirasi(-240, 240, 12, 'x', -7.4, [[-8, 8]])];
    return { yollar, binalar, isaretler, agaclar, kaynak: 'sablon' };
}

export const SABLONLAR: readonly SablonSenaryo[] = [
    {
        id: 'isikli-kavsak',
        ad: 'Işıklı kavşakta yandan çarpma',
        aciklama: 'Kırmızı ışıkta geçen araç, kavşağa giren aracın yanına çarpar.',
        etiket: 'Kavşak',
        cevre: kavsakCevresi,
        P: { x: 2.25, z: -3.95 },
        kosullar: { limitKmh: 50, carpismaTipi: 'yandan', carpan: 'A', bolge: 'orta' },
        A: { yon: 'güney yönünden', hizKmh: 62, izM: 9, ihlaller: ['kirmizi-isik'] },
        B: { yon: 'doğu yönünden', hizKmh: 45, izM: 0 },
    },
    {
        id: 't-kavsak',
        ad: 'DUR levhalı T kavşak',
        aciklama: 'Ara yoldan çıkan araç ana yoldaki araca geçiş hakkı vermez.',
        etiket: 'Kavşak',
        cevre: tKavsakCevresi,
        P: { x: 1.75, z: 3.4 },
        kosullar: { limitKmh: 50, carpismaTipi: 'yandan', carpan: 'B', bolge: 'on' },
        A: { yon: 'güney yönünden', hizKmh: 25, izM: 0, ihlaller: ['gecis-onceligi'], tur: 'suv' },
        B: { yon: 'batı yönünden', hizKmh: 55, izM: 14 },
    },
    {
        id: 'kafa-kafaya',
        ad: 'Kırsal yolda kafa kafaya',
        aciklama: 'Virajda karşı şeride geçen araç karşıdan gelen araçla çarpışır.',
        etiket: 'Şehirlerarası',
        cevre: kirsalYolCevresi,
        P: { x: -0.23, z: 1.86 },
        kosullar: { limitKmh: 90, carpismaTipi: 'kafa-kafaya', carpan: 'B' },
        A: { yon: 'batı yönünden', hizKmh: 78, izM: 16 },
        B: { yon: 'doğu yönünden', hizKmh: 88, izM: 6, ihlaller: ['karsi-serit'], tur: 'kamyonet' },
    },
    {
        id: 'arkadan',
        ad: 'Kırmızı ışıkta duran araca arkadan çarpma',
        aciklama: 'Işıkta yavaşlayıp duran araca arkadan gelen araç çarpar.',
        etiket: 'Şehir içi',
        cevre: bulvarCevresi,
        P: { x: 40, z: 4.875 },
        kosullar: { limitKmh: 50, carpismaTipi: 'arkadan', carpan: 'A' },
        A: { yon: 'batı yönünden', hizKmh: 64, izM: 11, ihlaller: ['arkadan-carpma', 'dikkatsizlik'] },
        B: { yon: 'batı yönünden', hizKmh: 30, izM: 6, tur: 'suv' },
    },
    {
        id: 'yaya-gecidi',
        ad: 'Yaya geçidinde yayaya çarpma',
        aciklama: 'Geçitten karşıya geçen yayaya yavaşlamayan araç çarpar.',
        etiket: 'Yaya',
        cevre: yayaGecidiCevresi,
        P: { x: 0, z: 2.25 },
        kosullar: { limitKmh: 50, carpismaTipi: 'otomatik', carpan: 'A' },
        A: { yon: 'batı yönünden', hizKmh: 52, izM: 8, ihlaller: ['yaya-gecidi'] },
        B: { yon: 'kuzey tarafından', tip: 'yaya', hizKmh: 5, izM: 0, kutleKg: 75 },
    },
];

/** Overpass'a ulaşılamazsa veya konum yol dışındaysa kullanılan temsili kavşak */
export function temsiliKavsak(): Cevre {
    return kavsakCevresi();
}
