// Statik, tip güvenli veri havuzları: yüzeyler, araç türleri, kural ihlalleri,
// levha/öge kataloğu ve internetsiz çalışan şablon senaryolar.

import type {
    AracTuru, AracTuruId, Bina, Cevre, Ihlal, IsaretTipi, Isaret, KatilimciGirdi,
    SablonSenaryo, SimSonuc, TarafId, Vec2, Yol, YolSinifi, Yuzey, GenelKosullar,
} from '../types/kazaTypes.ts';

export const SURUM = 'v3.4';

// ---- Kurumsal kimlik ve yasal metinler ----
const TABAN_YOL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) || '';
export const MARKA = {
    kurum: 'Cumhuriyet Avukatları',
    kurumBuyuk: 'CUMHURİYET AVUKATLARI',
    uygulama: 'Kaza Simülatörü',
    logo: `${TABAN_YOL}/logo.png`,
    instagram: 'https://www.instagram.com/cumhuriyet_avukatlari',
    instagramAd: 'cumhuriyet_avukatlari',
} as const;

/** Kısa uyarı: altbilgi, HUD, kroki */
export const KISA_UYARI = 'Simülasyondur; hukuki görüş, bilirkişi raporu veya kusur tespiti değildir, delil niteliği taşımaz.';

/** Ana uyarı: tüm ekranlarda ve raporda aynı ifade */
export const ANA_UYARI = {
    baslik: 'Bu bir simülasyondur',
    metin: 'Hukuki görüş, bilirkişi raporu veya kusur tespiti değildir; delil niteliği taşımaz.',
    kisa: 'Simülasyondur · hukuki görüş ve bilirkişi raporu değildir',
} as const;

/** Uzun uyarı metni: ilk giriş penceresi, başlangıç ekranı ve rapor */
export const YASAL_UYARI: readonly string[] = [
    'Kaza Simülatörü, Cumhuriyet Avukatları tarafından meslektaşlarımızın faydasına, trafik kazası dosyalarında olayın görselleştirilmesi ve ön değerlendirmesine yardımcı olmak amacıyla ücretsiz olarak hazırlanmış bir simülasyon aracıdır.',
    'Uygulamanın ürettiği canlandırma, kroki, hız, mesafe ve kusur dağılımları basitleştirilmiş fizik modellerine ve kullanıcının girdiği verilere dayanır. Sonuçlar hukuki görüş, bilirkişi raporu, Adli Tıp/ATK veya kusur raporu niteliği taşımaz; delil olarak ya da bu raporların yerine kullanılamaz.',
    'Somut olayda kusur, hız ve tazminat değerlendirmesi; dosyadaki tüm deliller ışığında uzman bilirkişiler ve yetkili yargı mercilerince yapılır. Mevzuat atıfları örneklendirme amaçlıdır; güncel ve bağlayıcı metin için resmî kaynaklara başvurulmalıdır.',
    'Uygulamanın kullanımından veya sonuçlarına dayanılarak alınan kararlardan doğabilecek zararlardan Cumhuriyet Avukatları sorumlu tutulamaz.',
];

/** Hava koşuluna göre önerilen yol yüzeyi */
export const HAVA_YUZEY: Readonly<Record<'yagmur' | 'kar', string>> = { yagmur: 'islak-asfalt', kar: 'karli' };

export const ISIK_ADI: Readonly<Record<GenelKosullar['isik']['A'], string>> = { yok: 'ışık yok', yesil: 'yeşil', sari: 'sarı', kirmizi: 'kırmızı' };

export const AYDINLATMA_ADI: Readonly<Record<GenelKosullar['aydinlatma'], string>> = { gunduz: 'Gündüz', aksam: 'Alacakaranlık', gece: 'Gece' };
export const HAVA_ADI: Readonly<Record<GenelKosullar['hava'], string>> = { acik: 'Açık', yagmur: 'Yağmurlu', sis: 'Sisli', kar: 'Karlı' };

export const CARPISMA_TIP_ADI: Readonly<Record<SimSonuc['tip'], string>> = {
    yandan: 'Önden-yana (yandan) çarpışma',
    'kafa-kafaya': 'Kafa kafaya çarpışma',
    arkadan: 'Arkadan çarpma',
    siyirma: 'Sıyırma',
    yaya: 'Yayaya çarpma',
};

export const GIZLILIK_NOTU = 'Üyelik yok, çerez yok, veri toplanmaz — tüm hesaplamalar tarayıcınızda yapılır, girdileriniz hiçbir sunucuya gönderilmez.';

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
// Madde atıfları 2918 sayılı KTK'nın resmî metniyle (mevzuat.gov.tr, doğrulama 2026-08-19)
// karşılaştırılmıştır. İfade bilinçli olarak "ilgili olabilir" biçimindedir: uygulama
// kusur tespiti yapmaz. m.84 yalnızca araç sürücüleri için asli kusur hâllerini sayar.
const M84 = (bent: string): string => `m.84/${bent} (asli kusur sayılan hâller) kapsamında değerlendirilebilir`;
const M84_DISI = "m.84'te sayılan asli kusur hâlleri arasında değildir; oran yönetmelik esaslarına göre belirlenir";

export const IHLALLER: readonly Ihlal[] = [
    { id: 'kirmizi-isik', hukumler: ['47/1-b', '84/a'], ad: 'Kırmızı ışıkta veya yetkili memurun dur işaretinde geçme', puan: 100, madde84: 'a',
        dayanak: `KTK m.47/1-b (trafik ışıklarına uyma) ile ilgili olabilir; ${M84('a')}` },
    { id: 'karsi-serit', hukumler: ['46/1-a', '46/1-h', '84/b', '84/c', '84/g'], ad: 'Taşıt giremez yola veya karşı yönün şeridine girme', puan: 100, madde84: 'b–c',
        dayanak: `KTK m.46/1-a (sağdan gitme) ve tek yönlü yolda m.46/1-h (ters istikamet) ile ilgili olabilir; taşıt giremez yol, bölünmüş yol veya ikiden fazla şeritli yolda ${M84('b–c')}; iki şeritli yolda m.84/g (şeride tecavüz) yönünden değerlendirilebilir` },
    { id: 'arkadan-carpma', hukumler: ['56/1-c', '52/1-c', '84/d'], ad: 'Arkadan çarpma (güvenli takip mesafesi bırakmama)', puan: 100, madde84: 'd',
        dayanak: `KTK m.56/1-c ve m.52/1-c (araçlar arası mesafe) ile ilgili olabilir; ${M84('d')}` },
    { id: 'yasak-sollama', hukumler: ['54/1-b', '84/e'], ad: 'Geçme yasağı olan yerde geçme', puan: 100, madde84: 'e',
        dayanak: `KTK m.54/1-b (geçmenin yasak olduğu yerler) ile ilgili olabilir; ${M84('e')}` },
    { id: 'manevra', hukumler: ['67/1-a', '67/1-c', '53/son', '84/f', '84/j'], ad: 'Doğrultu değiştirme / dönüş manevrasını kurala aykırı yapma', puan: 90, madde84: 'f, j',
        dayanak: `KTK m.53 (dönüş kuralları) ve m.67/1-a, c (manevralar) ile ilgili olabilir; ${M84('f, j')}` },
    { id: 'serit-ihlali', hukumler: ['46/1-b', '46/1-c', '56/1-a', '84/g'], ad: 'Şeride tecavüz / kurala aykırı şerit değiştirme', puan: 90, madde84: 'g',
        dayanak: `KTK m.46/1-b, c ve m.56/1-a (şerit izleme) ile ilgili olabilir; ${M84('g')}` },
    { id: 'gecis-onceligi', hukumler: ['57/1-a', '57/1-c', '84/h'], ad: 'Kavşakta geçiş önceliğine uymama', puan: 100, madde84: 'h',
        dayanak: `KTK m.57/1-a, c (kavşaklarda geçiş hakkı) ile ilgili olabilir; ${M84('h')}` },
    { id: 'dar-yol-oncelik', hukumler: ['56/1-b', '84/i'], ad: 'Kaplamanın dar olduğu yerde geçiş önceliğine uymama', puan: 90, madde84: 'i',
        dayanak: `KTK m.56/1-b (gelen trafikle karşılaşma) ile ilgili olabilir; ${M84('i')}` },
    { id: 'park-tedbir', hukumler: ['59/1', '84/k'], ad: 'Yerleşim dışı taşıt yolunda park/duraklama veya gerekli tedbiri almama', puan: 90, madde84: 'k',
        dayanak: `KTK m.59/1 (yerleşim dışında taşıt yolunda duraklama/park) ile ilgili olabilir; ${M84('k')}` },
    { id: 'parkli-araca-carpma', hukumler: ['84/l'], ad: 'Kurallara uygun park edilmiş araca çarpma', puan: 100, madde84: 'l',
        dayanak: `${M84('l')}` },
    { id: 'alkol', hukumler: ['48/1'], ad: 'Alkol, uyuşturucu veya uyarıcı madde etkisinde araç sürme', puan: 80,
        dayanak: `KTK m.48/1 (alkollü veya uyuşturucu etkisinde araç sürme yasağı) ile ilgili olabilir; ${M84_DISI}` },
    { id: 'yaya-gecidi', hukumler: ['74/1', '52/1-a', '53/son'], ad: 'Yaya veya okul geçidinde yayaya ilk geçiş hakkı vermeme', puan: 90,
        dayanak: `KTK m.74 (yayalara ilk geçiş hakkı), m.52/1-a (geçide yaklaşırken yavaşlama) ve dönüşlerde m.53 ile ilgili olabilir; ${M84_DISI}` },
    { id: 'gerekli-tedbir', hukumler: ['52/1-a', '52/1-b'], ad: 'Hızı yol, görüş ve hava şartlarına uydurmama', puan: 35,
        dayanak: `KTK m.52/1-a, b ile ilgili olabilir; ${M84_DISI}` },
    { id: 'dikkatsizlik', hukumler: ['73/1'], ad: 'Seyir hâlinde telefon kullanma / dikkatsiz sürüş', puan: 35,
        dayanak: `KTK m.73/1 (telefon kullanma yasağı, saygısız sürüş) ile ilgili olabilir; ${M84_DISI}` },
];

// Yayalar m.84 kapsamında değildir (m.84 araç sürücülerini sayar); m.68 esas alınır
export const YAYA_IHLALLERI: readonly Ihlal[] = [
    { id: 'yaya-kirmizi', hukumler: ['68/1-b-1', '47/1-b'], ad: 'Geçitte yaya ışığına / trafik ışığına uymama', puan: 80,
        dayanak: 'KTK m.68/1-b-1 ve m.47/1-b ile ilgili olabilir' },
    { id: 'yaya-gecit-disi', hukumler: ['68/1-b', '68/1-b-son'], ad: 'Yakında (≈100 m) geçit veya kavşak varken başka yerden geçme', puan: 60,
        dayanak: 'KTK m.68/1-b (geçit/kavşak dışından geçme yasağı ve 100 m istisnası) ile ilgili olabilir' },
    { id: 'yaya-tasit-yolu', hukumler: ['68/1-a'], ad: 'Yaya yolu varken taşıt yolunda yürüme', puan: 50,
        dayanak: 'KTK m.68/1-a ile ilgili olabilir' },
    { id: 'yaya-dikkatsiz', hukumler: ['68/1-b-son', '68/1-c'], ad: 'Yolu kontrol etmeden / trafiği tehlikeye düşürecek şekilde geçme', puan: 45,
        dayanak: 'KTK m.68/1-b (son cümle: yolu kontrol ederek geçme) ve m.68/1-c ile ilgili olabilir' },
];

export const MEVZUAT_KAYNAGI = {
    ad: '2918 sayılı Karayolları Trafik Kanunu (RG 18.10.1983, 18195)',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=2918&MevzuatTur=1&MevzuatTertip=5',
    dogrulama: 'Madde metinleri resmî metinle karşılaştırılmıştır (mevzuat.gov.tr, 19.08.2026 tarihli doğrulanmış derleme).',
} as const;

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
    isik: { A: 'yok', B: 'yok' },
    aydinlatma: 'gunduz',
    hava: 'acik',
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
        kosullar: { limitKmh: 50, carpismaTipi: 'yandan', carpan: 'A', bolge: 'orta', isik: { A: 'kirmizi', B: 'yesil' } },
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
        kosullar: { limitKmh: 90, carpismaTipi: 'kafa-kafaya', carpan: 'B', aydinlatma: 'aksam' },
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
        kosullar: { limitKmh: 50, carpismaTipi: 'arkadan', carpan: 'A', isik: { A: 'kirmizi', B: 'kirmizi' } },
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
        kosullar: { limitKmh: 50, carpismaTipi: 'otomatik', carpan: 'A', aydinlatma: 'gece', hava: 'yagmur', yuzeyId: 'islak-asfalt' },
        A: { yon: 'batı yönünden', hizKmh: 52, izM: 8, ihlaller: ['yaya-gecidi'] },
        B: { yon: 'kuzey tarafından', tip: 'yaya', hizKmh: 5, izM: 0, kutleKg: 75 },
    },
];

/** Overpass'a ulaşılamazsa veya konum yol dışındaysa kullanılan temsili kavşak */
export function temsiliKavsak(): Cevre {
    return kavsakCevresi();
}
