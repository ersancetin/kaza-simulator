// Fizik hesaplamaları — trafik kazası rekonstrüksiyonunda kullanılan standart formüller.
// Tüm iç hesaplar SI birimlerindedir (m, s, m/s); arayüz km/s kullanır.

export const G = 9.81;

// Yüzey tipleri ve tipik sürtünme katsayıları (lastik-yol, kilitli tekerlek kayması)
export const YUZEYLER = [
    { id: 'kuru-asfalt',  ad: 'Kuru asfalt',        mu: 0.75 },
    { id: 'islak-asfalt', ad: 'Islak asfalt',       mu: 0.45 },
    { id: 'kuru-beton',   ad: 'Kuru beton',         mu: 0.80 },
    { id: 'islak-beton',  ad: 'Islak beton',        mu: 0.55 },
    { id: 'stabilize',    ad: 'Stabilize / çakıl',  mu: 0.50 },
    { id: 'karli',        ad: 'Karlı yol',          mu: 0.25 },
    { id: 'buzlu',        ad: 'Buzlu yol',          mu: 0.12 },
];

export const kmh2ms = v => v / 3.6;
export const ms2kmh = v => v * 3.6;

// Fren izi uzunluğundan hız: v0 = sqrt(vSon² + 2·µ·g·d)
// vSon = izin sonundaki hız (durduysa 0, çarptıysa çarpma hızı / EES)
export function izdenHiz(mu, izUzunlugu, vSon = 0) {
    return Math.sqrt(vSon * vSon + 2 * mu * G * izUzunlugu);
}

// v0 hızıyla d metre frenlendikten sonraki hız (kalan enerji yoksa 0)
export function frenSonrasiHiz(v0, mu, d) {
    const kare = v0 * v0 - 2 * mu * G * d;
    return kare > 0 ? Math.sqrt(kare) : 0;
}

// Tam durma için gereken fren mesafesi
export function frenMesafesi(v0, mu) {
    return (v0 * v0) / (2 * mu * G);
}

// İntikal (reaksiyon) mesafesi dahil toplam duruş mesafesi
export function durusMesafesi(v0, mu, reaksiyonSuresi = 1.0) {
    return v0 * reaksiyonSuresi + frenMesafesi(v0, mu);
}

// v0'dan vSon'a frenlemenin süresi (a = µg sabit yavaşlama)
export function frenSuresi(v0, vSon, mu) {
    return (v0 - vSon) / (mu * G);
}

// İki boyutlu çarpışma — temas doğrultusu (line-of-impact) impuls modeli.
// n: 1. cisimden 2.'ye birim vektör (temas normali). İtki yalnızca n
// boyunca uygulanır: kafa kafaya çarpışmada cisimler birbirinin içinden
// geçmez (hafif geri sekme), yandan çarpmada çarpılan yana savrulur,
// sıyırmada teğet hız bileşeni korunur. Momentum tam korunur.
export function carpisma2B(m1, v1, m2, v2, e = 0.2, n = null) {
    if (!n) {
        // Normal verilmemişse bağıl hız doğrultusu kullanılır
        const bx = v1.x - v2.x, bz = v1.z - v2.z;
        const l = Math.hypot(bx, bz) || 1;
        n = { x: bx / l, z: bz / l };
    }
    const yaklasma = (v1.x - v2.x) * n.x + (v1.z - v2.z) * n.z; // n boyunca kapanma hızı
    if (yaklasma <= 0) {
        // Ayrışıyorlar: temas etkisi yok
        return { v1s: { ...v1 }, v2s: { ...v2 } };
    }
    const j = (1 + e) * yaklasma / (1 / m1 + 1 / m2);
    return {
        v1s: { x: v1.x - (j / m1) * n.x, z: v1.z - (j / m1) * n.z },
        v2s: { x: v2.x + (j / m2) * n.x, z: v2.z + (j / m2) * n.z },
        j, n, // itki büyüklüğü ve temas normali (dönme hesabı için)
    };
}

// Hız değişimi (delta-V) büyüklüğü — çarpışma şiddeti göstergesi
export function deltaV(vOnce, vSonra) {
    const dx = vSonra.x - vOnce.x, dz = vSonra.z - vOnce.z;
    return Math.hypot(dx, dz);
}

// Delta-V'ye göre kaba şiddet sınıflandırması (km/s cinsinden eşikler)
export function siddetEtiketi(deltaVms) {
    const dv = ms2kmh(deltaVms);
    if (dv < 8)  return { ad: 'Hafif', renk: '#22c55e' };
    if (dv < 20) return { ad: 'Orta',  renk: '#eab308' };
    if (dv < 40) return { ad: 'Ağır',  renk: '#f97316' };
    return { ad: 'Çok ağır', renk: '#ef4444' };
}
