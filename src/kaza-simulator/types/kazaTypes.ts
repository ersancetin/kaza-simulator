// Kaza Simülatörü — tüm veri modelleri ve durum arayüzleri.
// Koordinat sistemi: kaza bölgesi orijinli yerel düzlem, metre cinsinden.
// x = doğu, z = güney (kuzey = -z); Three.js eksenleriyle birebir uyumludur.

export interface Vec2 {
    x: number;
    z: number;
}

export type TarafId = 'A' | 'B';
export type KatilimciTipi = 'arac' | 'yaya';
export type HizModu = 'hiz' | 'iz';

export type AracTuruId =
    | 'otomobil'
    | 'suv'
    | 'kamyonet'
    | 'minibus'
    | 'kamyon'
    | 'otobus'
    | 'cekici'
    | 'motosiklet'
    | 'bisiklet'
    | 'traktor';

/** Araç modelinin 3B gövde biçimi (çizim için) */
export type GovdeProfili = 'sedan' | 'suv' | 'pikap' | 'van' | 'kamyon' | 'otobus' | 'tir' | 'iki-teker' | 'traktor';

export interface AracTuru {
    id: AracTuruId;
    ad: string;
    /** Boy (m) */
    boy: number;
    /** Genişlik (m) */
    en: number;
    /** Yükseklik (m) */
    yukseklik: number;
    /** Tipik kütle (kg) */
    kutle: number;
    profil: GovdeProfili;
    /** Ön yüzey yüksek mi (otobüs/kamyon): yaya ileri savrulur, sarılma olmaz */
    onYuksek: boolean;
}

export interface Yuzey {
    id: string;
    ad: string;
    mu: number;
}

export interface Ihlal {
    id: string;
    ad: string;
    puan: number;
    dayanak: string;
}

export type YolSinifi =
    | 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'unclassified'
    | 'residential' | 'living_street' | 'service'
    | 'motorway_link' | 'trunk_link' | 'primary_link' | 'secondary_link' | 'tertiary_link'
    | 'pedestrian' | 'footway' | 'path' | 'cycleway' | 'track' | 'steps';

export interface Yol {
    id: string;
    ad: string;
    sinif: YolSinifi;
    genislik: number;
    tekYon: boolean;
    seritSayisi: number;
    hizLimiti: number | null;
    yuzey: string | null;
    noktalar: Vec2[];
    /** Kullanıcı tarafından çizildi */
    elle?: boolean;
    /** Kırsal yol: kaldırım yerine toprak banket */
    kaldirimYok?: boolean;
}

export interface Bina {
    noktalar: Vec2[];
    yukseklik: number;
}

export type LevhaTipi =
    | 'stop'
    | 'give_way'
    | 'hiz-tabela'
    | 'sollama-yasak'
    | 'park-yasak'
    | 'giris-yok'
    | 'yaya-gecidi-levha'
    | 'okul-gecidi'
    | 'ana-yol'
    | 'donel-kavsak'
    | 'ozel-tabela';

export type YuzeyIsaretTipi = 'crossing' | 'traffic_calming';
export type OrtamTipi = 'agac' | 'duba' | 'bariyer' | 'direk' | 'konteyner' | 'kedi' | 'kopek' | 'park-arac';

export type IsaretTipi = LevhaTipi | YuzeyIsaretTipi | OrtamTipi | 'traffic_signals';

export interface Isaret {
    id: string;
    tip: IsaretTipi;
    x: number;
    z: number;
    /** Three.js rotation.y (rad); verilmezse en yakın yola göre hizalanır */
    aci?: number;
    /** Yazılı levha metni */
    metin?: string;
    /** Hız levhası değeri */
    deger?: number;
    elle?: boolean;
}

export type CevreKaynagi = 'osm' | 'sablon';

export interface Cevre {
    yollar: Yol[];
    binalar: Bina[];
    isaretler: Isaret[];
    agaclar: Vec2[];
    kaynak: CevreKaynagi;
    yaricap?: number;
}

/** Kaza noktasına gelen bir güzergâh seçeneği */
export interface Yaklasim {
    anahtar: string;
    etiket: string;
    yolAdi: string;
    /** Başlangıçtan kaza noktasına (son nokta = yol eksenindeki en yakın nokta) */
    noktalar: Vec2[];
    genislik: number;
    seritSayisi: number;
    tekYon: boolean;
    /** Tek yönlü yolda trafiğe ters yönde mi */
    tersYon: boolean;
    hizLimiti: number | null;
    yuzey: string | null;
    yaya: boolean;
}

export interface KatilimciGirdi {
    tip: KatilimciTipi;
    tur: AracTuruId;
    plaka: string;
    mod: HizModu;
    /** 'hiz' modunda seyir hızı (km/s) */
    hizKmh: number;
    /** Fren izi uzunluğu (m); 0 → fren yapılmadı */
    izM: number;
    /** 'iz' modunda iz sonundaki (çarpma anı) hız (km/s) */
    izSonuKmh: number;
    kutleKg: number;
    reaksiyonS: number;
    yaklasimAnahtar: string;
    ihlaller: string[];
}

export type CarpismaTipi = 'otomatik' | 'yandan' | 'kafa-kafaya' | 'arkadan' | 'siyirma';
export type CozulmusCarpismaTipi = Exclude<CarpismaTipi, 'otomatik'> | 'yaya';
export type CarpmaBolgesi = 'on' | 'orta' | 'arka';

export type IsikDurumu = 'yok' | 'yesil' | 'sari' | 'kirmizi';
export type Aydinlatma = 'gunduz' | 'aksam' | 'gece';
export type Hava = 'acik' | 'yagmur' | 'sis' | 'kar';
/** Trafik ışığının bir andaki rengi (yanan lamba) */
export type IsikRengi = 'kirmizi' | 'sari' | 'yesil';

export interface GenelKosullar {
    /** Her tarafın karşısındaki ışığın çarpışma anındaki rengi */
    isik: Record<TarafId, IsikDurumu>;
    aydinlatma: Aydinlatma;
    hava: Hava;
    yuzeyId: string;
    mu: number;
    limitKmh: number;
    carpismaTipi: CarpismaTipi;
    /** Çarpan (vuran) taraf */
    carpan: TarafId;
    /** Yandan çarpmada çarpılan aracın neresine çarpıldığı */
    bolge: CarpmaBolgesi;
}

/** Simülasyon motoruna verilen, çözümlenmiş taraf bilgisi */
export interface SimKatilimci {
    id: TarafId;
    tip: KatilimciTipi;
    tur: AracTuruId;
    plaka: string;
    /** Kaza öncesi hız (m/s) */
    v0: number;
    /** Girilen fren izi (m) */
    izM: number;
    kutle: number;
    reaksiyon: number;
    yaklasim: Yaklasim;
}

export interface SimGirdi {
    A: SimKatilimci;
    B: SimKatilimci;
    mu: number;
    limitKmh: number;
    P: Vec2;
    carpismaTipi: CarpismaTipi;
    carpan: TarafId;
    bolge: CarpmaBolgesi;
    /** Çarpışma sonrası savrulmada çarpılabilecek sabit engeller */
    engeller: SabitEngel[];
}

export interface SabitEngel {
    merkez: Vec2;
    /** Three.js rotation.y */
    aci: number;
    /** Yarı genişlik (yerel x) */
    yx: number;
    /** Yarı boy (yerel z) */
    yz: number;
}

/** Kare kanalları: [x, z, sapma(rotation.y), y, devrilme, yol, hız] */
export const KANAL_SAYISI = 7;

export interface Kacinilabilirlik {
    limitHizi: number;
    algilamaMesafesi: number;
    limitteDurusMesafesi: number;
    /** Limit hızında seyretseydi çarpma hızı (m/s); 0 → çarpışma noktasından önce durur */
    limitteCarpmaHizi: number;
    kacinilabilir: boolean;
}

export interface TarafSonuc {
    id: TarafId;
    tip: KatilimciTipi;
    tur: AracTuruId;
    boy: number;
    en: number;
    kutle: number;
    v0: number;
    /** Çarpma anı hızı (m/s) */
    vi: number;
    /** Çarpışma hemen sonrası hız (m/s) */
    vSonra: number;
    deltaV: number;
    izGirilen: number;
    izEtkin: number;
    reaksiyon: number;
    mu: number;
    frenMesafesi: number;
    durusMesafesi: number;
    /** Tehlikeyi algıladığı noktanın çarpışma noktasına uzaklığı (m) */
    algilamaMesafesi: number;
    tAlgilama: number;
    tFrenBaslangic: number;
    sonKonum: Vec2;
    /** Çarpışmadan durana kadar ağırlık merkezinin aldığı yol (m) */
    savrulmaMesafesi: number;
    /** Durana kadar dönme (derece) */
    donmeDerece: number;
    /** Kaza öncesi duruyordu */
    durmusAracti: boolean;
    kacinilabilirlik: Kacinilabilirlik | null;
    /** Yalnızca yaya: Searle bağıntısıyla fırlatma mesafesinden asgari çarpma hızı */
    searleAsgariHiz: number | null;
    kareler: Float32Array;
}

export interface IzSerisi {
    /** Lastik izi orta çizgisi */
    noktalar: Vec2[];
    /** Her noktanın oluştuğu an (s) — kademeli gösterim için */
    zamanlar: number[];
    tur: 'fren' | 'kayma';
}

export interface SimSonuc {
    fps: number;
    kareSayisi: number;
    sure: number;
    tCarpisma: number;
    P: Vec2;
    normal: Vec2;
    tip: CozulmusCarpismaTipi;
    carpan: TarafId;
    taraflar: Record<TarafId, TarafSonuc>;
    izler: IzSerisi[];
    /** Çarpışmada sönümlenen kinetik enerji (kJ) */
    enerjiKJ: number;
    uyarilar: string[];
}

export interface KusurGerekce {
    ad: string;
    dayanak: string;
    puan: number;
}

export type KusurSinifi = 'kusursuz' | 'asli' | 'tali';

export interface KusurTaraf {
    oran: number;
    yuzde: number;
    yuzdeMetin: string;
    sekizlik: string;
    etiket: { ad: string; sinif: KusurSinifi };
    gerekceler: KusurGerekce[];
}

export interface KusurSonuc {
    belirsiz: boolean;
    A: KusurTaraf;
    B: KusurTaraf;
}

export interface KusurGirdi {
    ihlaller: string[];
    hizKmh: number | null;
    limitKmh: number | null;
}

export type KameraModu = 'serbest' | 'ustten' | 'A' | 'B' | 'A-surucu' | 'B-surucu';

export type DuzenlemeModu =
    | { tur: 'yok' }
    | { tur: 'nokta' }
    | { tur: 'isaret'; tip: IsaretTipi; metin?: string; deger?: number }
    | { tur: 'ciz'; yaya: boolean; noktalar: Vec2[] };

export interface SablonSenaryo {
    id: string;
    ad: string;
    aciklama: string;
    etiket: string;
    cevre: () => Cevre;
    P: Vec2;
    kosullar: Partial<GenelKosullar>;
    /** Yaklaşım seçimi: etiket içinde aranacak yön adı */
    A: Partial<KatilimciGirdi> & { yon: string };
    B: Partial<KatilimciGirdi> & { yon: string };
}

export interface SecilenKonum {
    lat: number;
    lon: number;
    adres: string;
}

export type CevreDurumu =
    | { tur: 'bos' }
    | { tur: 'yukleniyor'; mesaj: string }
    | { tur: 'hazir'; not: string }
    | { tur: 'hata'; mesaj: string };

export interface KayitliTercihler {
    oynatmaHizi: number;
    kamera: KameraModu;
    yuzeyId: string;
}
