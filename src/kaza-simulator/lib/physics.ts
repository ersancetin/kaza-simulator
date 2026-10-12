// Kaza rekonstrüksiyonunda kullanılan standart bağıntılar.
// Tüm iç hesaplar SI birimlerindedir (m, s, m/s); arayüz km/s kullanır.

export const G = 9.81;

export const kmh2ms = (v: number): number => v / 3.6;
export const ms2kmh = (v: number): number => v * 3.6;

/** Fren izinden hız: v0 = √(vSon² + 2·µ·g·d) */
export function izdenHiz(mu: number, izUzunlugu: number, vSon = 0): number {
    return Math.sqrt(vSon * vSon + 2 * mu * G * izUzunlugu);
}

/** v0 hızıyla d metre frenlendikten sonraki hız (durduysa 0) */
export function frenSonrasiHiz(v0: number, mu: number, d: number): number {
    const kare = v0 * v0 - 2 * mu * G * d;
    return kare > 0 ? Math.sqrt(kare) : 0;
}

/** Tam durma için gereken fren mesafesi */
export function frenMesafesi(v0: number, mu: number): number {
    return (v0 * v0) / (2 * mu * G);
}

/** İntikal (reaksiyon) mesafesi dâhil toplam duruş mesafesi */
export function durusMesafesi(v0: number, mu: number, reaksiyonSuresi = 1.0): number {
    return v0 * reaksiyonSuresi + frenMesafesi(v0, mu);
}

/**
 * Searle (1983) bağıntısı: yayanın fırlatma mesafesinden asgari çarpma hızı.
 * v_min = √(2µgs / (1 + µ²)), µ: yaya–zemin sürtünmesi (~0,66).
 */
export function searleAsgariHiz(firlatmaMesafesi: number, muYaya = 0.66): number {
    return Math.sqrt((2 * muYaya * G * firlatmaMesafesi) / (1 + muYaya * muYaya));
}

export interface SiddetEtiketi {
    ad: string;
    renk: string;
}

/** Delta-V'ye göre kaba şiddet sınıfı (km/s eşikleri) */
export function siddetEtiketi(deltaVms: number): SiddetEtiketi {
    const dv = ms2kmh(deltaVms);
    if (dv < 8) return { ad: 'Hafif', renk: '#15803d' };
    if (dv < 20) return { ad: 'Orta', renk: '#a16207' };
    if (dv < 40) return { ad: 'Ağır', renk: '#c2410c' };
    return { ad: 'Çok ağır', renk: '#C81D25' };
}

export interface KacinmaGirdi {
    /** Algılama noktasının çarpışma noktasına uzaklığı (m) */
    algilamaMesafesi: number;
    limitHizi: number;
    mu: number;
    reaksiyon: number;
}

/**
 * Kaçınılabilirlik: sürücü hız sınırında seyretseydi, tehlikeyi aynı
 * noktada algılayıp frene bastığında çarpışma noktasından önce durabilir
 * miydi; duramıyorsa hangi hızla çarpardı.
 */
export function kacinilabilirlik(g: KacinmaGirdi): { durus: number; carpmaHizi: number; kacinilabilir: boolean } {
    const v = g.limitHizi;
    const durus = durusMesafesi(v, g.mu, g.reaksiyon);
    if (durus <= g.algilamaMesafesi) return { durus, carpmaHizi: 0, kacinilabilir: true };
    const frenYolu = g.algilamaMesafesi - v * g.reaksiyon;
    const carpmaHizi = frenYolu <= 0 ? v : frenSonrasiHiz(v, g.mu, frenYolu);
    return { durus, carpmaHizi, kacinilabilir: false };
}
