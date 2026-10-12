// Trafik ışığı evreleri: kullanıcı her taraf için çarpışma anındaki ışık rengini
// seçer; canlandırmada ışık bu ana göre yeşil → sarı → kırmızı akışıyla gösterilir.

import type { IsikDurumu, IsikRengi, TarafId, Vec2 } from '../types/kazaTypes.ts';

/** Sarı ışık süresi (s) — kentsel kavşaklarda tipik 3 sn */
export const SARI_SURE = 3;
/** "Kırmızıda geçti" kurgusunda kırmızının çarpışmadan kaç sn önce yandığı */
export const KIRMIZI_ONCESI = 2.5;

/** t anında, çarpışma anı durumu verilen ışığın rengi; 'yok' → null */
export function isikRengi(durum: IsikDurumu, t: number, tC: number): IsikRengi | null {
    switch (durum) {
        case 'yok':
            return null;
        case 'yesil':
            return 'yesil';
        case 'sari':
            return t < tC - 1.0 ? 'yesil' : 'sari';
        case 'kirmizi':
            if (t >= tC - KIRMIZI_ONCESI) return 'kirmizi';
            return t >= tC - KIRMIZI_ONCESI - SARI_SURE ? 'sari' : 'yesil';
    }
}

/** Kesişen akış için tamamlayıcı durum (biri yeşilken diğeri kırmızıdır) */
export function tamamlayici(d: IsikDurumu): IsikDurumu {
    if (d === 'yesil') return 'kirmizi';
    if (d === 'sari' || d === 'kirmizi') return d === 'kirmizi' ? 'yesil' : 'kirmizi';
    return 'yok';
}

export interface IsikTarafBilgisi {
    /** Tarafın çarpışma noktasındaki gidiş yönü */
    yon: Vec2 | null;
    durum: IsikDurumu;
}

/**
 * Bir ışık direğinin hangi akışa hizmet ettiğini bulur ve durumunu verir.
 * Işık yüzü f yönüne bakar; gidiş yönü -f olan trafiğe hizmet eder.
 */
export function isikAkisDurumu(yuz: Vec2, taraflar: Record<TarafId, IsikTarafBilgisi>): IsikDurumu {
    const hizmet = { x: -yuz.x, z: -yuz.z };
    const benzer = (y: Vec2 | null): number => (y ? hizmet.x * y.x + hizmet.z * y.z : 0);
    const { A, B } = taraflar;
    // Doğrudan tarafa bakan ışık
    if (benzer(A.yon) > 0.7 && A.durum !== 'yok') return A.durum;
    if (benzer(B.yon) > 0.7 && B.durum !== 'yok') return B.durum;
    // Aynı eksende karşı yönden gelen akış aynı fazdadır
    if (Math.abs(benzer(A.yon)) > 0.7 && A.durum !== 'yok') return A.durum;
    if (Math.abs(benzer(B.yon)) > 0.7 && B.durum !== 'yok') return B.durum;
    // Kesişen eksen: diğer tarafın tamamlayıcısı
    if (A.yon && Math.abs(benzer(A.yon)) < 0.3 && A.durum !== 'yok') return tamamlayici(A.durum);
    if (B.yon && Math.abs(benzer(B.yon)) < 0.3 && B.durum !== 'yok') return tamamlayici(B.durum);
    return 'yok';
}
