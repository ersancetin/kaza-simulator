// Senaryo kaydetme / açma / bağlantıyla paylaşma (sunucusuz).
// Dosya ve bağlantı dışarıdan gelen, güvenilmeyen veridir: her alan tek tek
// doğrulanır, sayılar sınırlandırılır, metinler kısaltılır; tanınmayan alan atılır.

import { ARAC_TURLERI, ISARET_KATALOGU, SABLONLAR, YAYA_IHLALLERI, IHLALLER, YUZEYLER, YOL_GENISLIKLERI } from '../data/kazaData.ts';
import type {
    AracTuruId, Aydinlatma, CarpismaTipi, CarpmaBolgesi, Cevre, GenelKosullar, Hava, Isaret, IsaretTipi, IsikDurumu,
    KatilimciGirdi, SecilenKonum, TarafId, Vec2, Yol, YolSinifi,
} from '../types/kazaTypes.ts';

export type SenaryoKaynagi =
    | { tip: 'sablon'; id: string }
    | { tip: 'konum'; konum: SecilenKonum }
    | { tip: 'gomulu' };

export interface SenaryoDosyasi {
    tur: 'kaza-simulator-senaryo';
    surum: 1;
    baslik: string;
    kaynak: SenaryoKaynagi;
    /** Yalnızca dosyada: tam çevre (internetsiz yeniden açılabilsin) */
    cevre?: Cevre;
    P: Vec2;
    kosullar: GenelKosullar;
    katilimcilar: Record<TarafId, KatilimciGirdi>;
    elleIsaretler: Isaret[];
    cizilenYollar: Yol[];
}

type Kayit = Record<string, unknown>;
const nesneMi = (v: unknown): v is Kayit => !!v && typeof v === 'object' && !Array.isArray(v);
const sayi = (v: unknown, min: number, max: number, vars: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : vars;
const metin = (v: unknown, uz: number, vars = ''): string => (typeof v === 'string' ? v.slice(0, uz) : vars);
const secenek = <T extends string>(v: unknown, izinli: readonly T[], vars: T): T => (izinli.includes(v as T) ? (v as T) : vars);
const KOORD = 5000;

function nokta(v: unknown): Vec2 | null {
    if (!nesneMi(v)) return null;
    const x = sayi(v.x, -KOORD, KOORD, NaN);
    const z = sayi(v.z, -KOORD, KOORD, NaN);
    return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
}

function noktalar(v: unknown, enCok = 4000): Vec2[] {
    if (!Array.isArray(v)) return [];
    return v.slice(0, enCok).map(nokta).filter((p): p is Vec2 => p !== null);
}

const SINIFLAR = Object.keys(YOL_GENISLIKLERI) as YolSinifi[];
const ISARET_TIPLERI = [...ISARET_KATALOGU.map((k) => k.tip), 'crossing', 'traffic_calming'] as IsaretTipi[];
const TURLER = Object.keys(ARAC_TURLERI) as AracTuruId[];
const IHLAL_IDLERI = [...IHLALLER, ...YAYA_IHLALLERI].map((i) => i.id);

function yolDogrula(v: unknown): Yol | null {
    if (!nesneMi(v)) return null;
    const n = noktalar(v.noktalar);
    if (n.length < 2) return null;
    return {
        id: metin(v.id, 60, `yol-${Math.random().toString(36).slice(2)}`),
        ad: metin(v.ad, 80, 'İsimsiz yol'),
        sinif: secenek(v.sinif, SINIFLAR, 'residential'),
        genislik: sayi(v.genislik, 1, 40, 7),
        tekYon: v.tekYon === true,
        seritSayisi: Math.round(sayi(v.seritSayisi, 1, 8, 2)),
        hizLimiti: typeof v.hizLimiti === 'number' ? sayi(v.hizLimiti, 5, 160, 50) : null,
        yuzey: typeof v.yuzey === 'string' ? metin(v.yuzey, 30) : null,
        noktalar: n,
        elle: v.elle === true ? true : undefined,
        kaldirimYok: v.kaldirimYok === true ? true : undefined,
    };
}

function isaretDogrula(v: unknown): Isaret | null {
    if (!nesneMi(v)) return null;
    const p = nokta(v);
    if (!p) return null;
    const tip = secenek(v.tip, ISARET_TIPLERI, 'duba');
    if (!ISARET_TIPLERI.includes(v.tip as IsaretTipi)) return null;
    return {
        id: metin(v.id, 60, `i-${Math.random().toString(36).slice(2)}`),
        tip, x: p.x, z: p.z,
        aci: typeof v.aci === 'number' && Number.isFinite(v.aci) ? v.aci : undefined,
        metin: typeof v.metin === 'string' ? metin(v.metin, 24) : undefined,
        deger: typeof v.deger === 'number' ? Math.round(sayi(v.deger, 5, 150, 50)) : undefined,
        elle: v.elle === true ? true : undefined,
    };
}

function katilimciDogrula(v: unknown, vars: KatilimciGirdi): KatilimciGirdi {
    if (!nesneMi(v)) return vars;
    return {
        tip: secenek(v.tip, ['arac', 'yaya'] as const, vars.tip),
        tur: secenek(v.tur, TURLER, vars.tur),
        plaka: metin(v.plaka, 11),
        mod: secenek(v.mod, ['hiz', 'iz'] as const, 'hiz'),
        hizKmh: sayi(v.hizKmh, 0, 250, vars.hizKmh),
        izM: sayi(v.izM, 0, 200, vars.izM),
        izSonuKmh: sayi(v.izSonuKmh, 0, 200, vars.izSonuKmh),
        kutleKg: sayi(v.kutleKg, 10, 44000, vars.kutleKg),
        reaksiyonS: sayi(v.reaksiyonS, 0, 3, vars.reaksiyonS),
        yaklasimAnahtar: metin(v.yaklasimAnahtar, 80),
        ihlaller: Array.isArray(v.ihlaller) ? v.ihlaller.filter((i): i is string => typeof i === 'string' && IHLAL_IDLERI.includes(i)).slice(0, 20) : [],
    };
}

function kosulDogrula(v: unknown, vars: GenelKosullar): GenelKosullar {
    if (!nesneMi(v)) return vars;
    const isik = nesneMi(v.isik) ? v.isik : {};
    const ISIK: readonly IsikDurumu[] = ['yok', 'yesil', 'sari', 'kirmizi'];
    return {
        isik: { A: secenek(isik.A, ISIK, 'yok'), B: secenek(isik.B, ISIK, 'yok') },
        aydinlatma: secenek(v.aydinlatma, ['gunduz', 'aksam', 'gece'] as readonly Aydinlatma[], 'gunduz'),
        hava: secenek(v.hava, ['acik', 'yagmur', 'sis', 'kar'] as readonly Hava[], 'acik'),
        yuzeyId: secenek(v.yuzeyId, YUZEYLER.map((y) => y.id), vars.yuzeyId),
        mu: sayi(v.mu, 0.05, 1.2, vars.mu),
        limitKmh: sayi(v.limitKmh, 5, 160, vars.limitKmh),
        carpismaTipi: secenek(v.carpismaTipi, ['otomatik', 'yandan', 'kafa-kafaya', 'arkadan', 'siyirma'] as readonly CarpismaTipi[], 'otomatik'),
        carpan: secenek(v.carpan, ['A', 'B'] as readonly TarafId[], 'A'),
        bolge: secenek(v.bolge, ['on', 'orta', 'arka'] as readonly CarpmaBolgesi[], 'orta'),
    };
}

/** Güvenilmeyen JSON'u doğrular; geçersizse null */
export function senaryoDogrula(v: unknown, varsKosul: GenelKosullar, varsA: KatilimciGirdi, varsB: KatilimciGirdi): SenaryoDosyasi | null {
    if (!nesneMi(v) || v.tur !== 'kaza-simulator-senaryo' || v.surum !== 1) return null;
    const P = nokta(v.P);
    if (!P) return null;
    let kaynak: SenaryoKaynagi = { tip: 'gomulu' };
    if (nesneMi(v.kaynak)) {
        const k = v.kaynak;
        if (k.tip === 'sablon' && SABLONLAR.some((s) => s.id === k.id)) kaynak = { tip: 'sablon', id: k.id as string };
        else if (k.tip === 'konum' && nesneMi(k.konum)) {
            const lat = sayi(k.konum.lat, 35, 43, NaN);
            const lon = sayi(k.konum.lon, 25, 45.5, NaN);
            if (Number.isFinite(lat) && Number.isFinite(lon)) kaynak = { tip: 'konum', konum: { lat, lon, adres: metin(k.konum.adres, 300, `${lat}, ${lon}`) } };
        }
    }
    let cevre: Cevre | undefined;
    if (nesneMi(v.cevre)) {
        const c = v.cevre;
        const yollar = Array.isArray(c.yollar) ? c.yollar.slice(0, 5000).map(yolDogrula).filter((y): y is Yol => !!y) : [];
        if (yollar.length) {
            cevre = {
                yollar,
                binalar: Array.isArray(c.binalar) ? c.binalar.slice(0, 8000).flatMap((b) => {
                    if (!nesneMi(b)) return [];
                    const n = noktalar(b.noktalar, 200);
                    return n.length >= 3 ? [{ noktalar: n, yukseklik: sayi(b.yukseklik, 2, 150, 9) }] : [];
                }) : [],
                isaretler: Array.isArray(c.isaretler) ? c.isaretler.slice(0, 2000).map(isaretDogrula).filter((i): i is Isaret => !!i) : [],
                agaclar: noktalar(c.agaclar, 5000),
                kaynak: c.kaynak === 'osm' ? 'osm' : 'sablon',
            };
        }
    }
    if (kaynak.tip === 'gomulu' && !cevre) return null;
    const kat = nesneMi(v.katilimcilar) ? v.katilimcilar : {};
    return {
        tur: 'kaza-simulator-senaryo',
        surum: 1,
        baslik: metin(v.baslik, 300, 'Kayıtlı senaryo'),
        kaynak,
        cevre,
        P,
        kosullar: kosulDogrula(v.kosullar, varsKosul),
        katilimcilar: { A: katilimciDogrula(kat.A, varsA), B: katilimciDogrula(kat.B, varsB) },
        elleIsaretler: Array.isArray(v.elleIsaretler) ? v.elleIsaretler.slice(0, 500).map(isaretDogrula).filter((i): i is Isaret => !!i).map((i) => ({ ...i, elle: true })) : [],
        cizilenYollar: Array.isArray(v.cizilenYollar) ? v.cizilenYollar.slice(0, 100).map(yolDogrula).filter((y): y is Yol => !!y).map((y) => ({ ...y, elle: true })) : [],
    };
}

// ---- Bağlantı kodlama: deflate + base64url (tarayıcı yerleşik CompressionStream) ----
const b64url = (u: Uint8Array): string => {
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlCoz = (s: string): Uint8Array => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function akisaUygula(veri: Uint8Array, akis: CompressionStream | DecompressionStream): Promise<Uint8Array> {
    const yanit = new Response(new Blob([veri as BlobPart]).stream().pipeThrough(akis));
    return new Uint8Array(await yanit.arrayBuffer());
}

export async function baglantiKodla(s: SenaryoDosyasi): Promise<string> {
    const { cevre, ...hafif } = s;
    void cevre;
    const ham = new TextEncoder().encode(JSON.stringify(hafif));
    if (typeof CompressionStream !== 'undefined') return 'z' + b64url(await akisaUygula(ham, new CompressionStream('deflate-raw')));
    return 'j' + b64url(ham);
}

export async function baglantiCoz(kod: string): Promise<unknown> {
    if (kod.length > 200_000) return null;
    try {
        const veri = b64urlCoz(kod.slice(1));
        const ham = kod[0] === 'z' ? await akisaUygula(veri, new DecompressionStream('deflate-raw')) : veri;
        return JSON.parse(new TextDecoder().decode(ham));
    } catch {
        return null;
    }
}
