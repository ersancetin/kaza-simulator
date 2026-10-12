// Yerel depolama (Privacy-by-Design): veriler yalnızca bu tarayıcıda,
// SHA-256 bütünlük karmasıyla saklanır; karma tutmayan (elle değiştirilmiş
// veya bozulmuş) kayıt yok sayılır. Hiçbir veri sunucuya gönderilmez.

const ONEK = 'gateos.kaza-simulator.';
const TUZ = 'kaza-simulator/v3';

async function karma(metin: string): Promise<string> {
    const veri = new TextEncoder().encode(TUZ + metin);
    const ozet = await crypto.subtle.digest('SHA-256', veri);
    return Array.from(new Uint8Array(ozet), (b) => b.toString(16).padStart(2, '0')).join('');
}

const b64 = (s: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64Coz = (s: string): string => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

interface Kayit {
    v: 1;
    d: string;
    h: string;
}

export async function guvenliKaydet<T>(anahtar: string, deger: T): Promise<void> {
    try {
        const d = b64(JSON.stringify(deger));
        const kayit: Kayit = { v: 1, d, h: await karma(d) };
        localStorage.setItem(ONEK + anahtar, JSON.stringify(kayit));
    } catch {
        /* özel pencere veya kota: tercih kaydı isteğe bağlıdır */
    }
}

export async function guvenliYukle<T>(anahtar: string, dogrula: (v: unknown) => v is T): Promise<T | null> {
    try {
        const ham = localStorage.getItem(ONEK + anahtar);
        if (!ham) return null;
        const kayit = JSON.parse(ham) as Partial<Kayit>;
        if (kayit.v !== 1 || typeof kayit.d !== 'string' || typeof kayit.h !== 'string') return null;
        if ((await karma(kayit.d)) !== kayit.h) return null;
        const deger: unknown = JSON.parse(b64Coz(kayit.d));
        return dogrula(deger) ? deger : null;
    } catch {
        return null;
    }
}
