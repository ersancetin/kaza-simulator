// OpenStreetMap verileri (isteğe bağlı çevrimiçi zenginleştirme).
// Uygulama bu servisler olmadan da şablon senaryolarla tam çalışır.
// Yalnızca kullanıcı haritadan konum seçtiğinde, doğrudan tarayıcıdan
// Nominatim (adres) ve Overpass (yol geometrisi) sorgulanır; sunucumuz
// aracılık etmez, telemetri gönderilmez. Overpass yanıtları IndexedDB'de
// önbelleğe alınır: aynı bölge ikinci kez anında açılır.

import { YOL_GENISLIKLERI } from '../data/kazaData.ts';
import type { Bina, Cevre, Isaret, IsaretTipi, SecilenKonum, Vec2, Yol, YolSinifi } from '../types/kazaTypes.ts';

const OVERPASS_SUNUCULAR = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

interface OsmGeom {
    lat: number;
    lon: number;
}

interface OsmEleman {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
    geometry?: OsmGeom[];
}

interface OverpassYanit {
    elements?: OsmEleman[];
}

interface NominatimSonuc {
    lat: string;
    lon: string;
    display_name: string;
}

function zamanAsimliFetch(url: string, secenek: RequestInit, ms: number, dis?: AbortSignal): Promise<Response> {
    const d = new AbortController();
    const z = setTimeout(() => d.abort(), ms);
    const iptal = (): void => d.abort();
    dis?.addEventListener('abort', iptal);
    return fetch(url, { ...secenek, signal: d.signal }).finally(() => {
        clearTimeout(z);
        dis?.removeEventListener('abort', iptal);
    });
}

// ---- IndexedDB önbellek ----
const DB_AD = 'kaza-simulator';
const DEPO = 'overpass';

function dbAc(): Promise<IDBDatabase | null> {
    return new Promise((coz) => {
        try {
            const istek = indexedDB.open(DB_AD, 1);
            istek.onupgradeneeded = () => istek.result.createObjectStore(DEPO);
            istek.onsuccess = () => coz(istek.result);
            istek.onerror = () => coz(null);
        } catch {
            coz(null);
        }
    });
}

async function onbellekOku(anahtar: string): Promise<OverpassYanit | null> {
    const db = await dbAc();
    if (!db) return null;
    return new Promise((coz) => {
        try {
            const istek = db.transaction(DEPO, 'readonly').objectStore(DEPO).get(anahtar);
            istek.onsuccess = () => {
                const v = istek.result as { zaman: number; veri: OverpassYanit } | undefined;
                // 30 gün geçerli
                coz(v && Date.now() - v.zaman < 30 * 864e5 ? v.veri : null);
            };
            istek.onerror = () => coz(null);
        } catch {
            coz(null);
        }
    });
}

async function onbellekYaz(anahtar: string, veri: OverpassYanit): Promise<void> {
    const db = await dbAc();
    if (!db) return;
    try {
        db.transaction(DEPO, 'readwrite').objectStore(DEPO).put({ zaman: Date.now(), veri }, anahtar);
    } catch {
        /* önbellek isteğe bağlıdır */
    }
}

async function overpassSorgula(sorgu: string, sinyal?: AbortSignal): Promise<OverpassYanit> {
    let sonHata: unknown = null;
    for (const sunucu of OVERPASS_SUNUCULAR) {
        try {
            const r = await zamanAsimliFetch(sunucu, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(sorgu),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }, 25000, sinyal);
            if (!r.ok) {
                sonHata = new Error('HTTP ' + r.status);
                continue;
            }
            return (await r.json()) as OverpassYanit;
        } catch (e) {
            if (sinyal?.aborted) throw e;
            sonHata = e;
        }
    }
    throw sonHata instanceof Error ? sonHata : new Error('Overpass sunucularına ulaşılamadı');
}

const SINIFLAR = Object.keys(YOL_GENISLIKLERI).join('|');

/** Seçilen noktanın çevresindeki yol, bina, ağaç ve işaretleri getirir */
export async function cevreVerisiGetir(lat: number, lon: number, sinyal?: AbortSignal): Promise<Cevre> {
    // Yakın tıklamalar aynı önbellek kaydını kullanır (~100 m ızgara)
    const qLat = Math.round(lat * 1000) / 1000;
    const qLon = Math.round(lon * 1000) / 1000;
    const yaricap = 550;
    const anahtar = `${qLat},${qLon},${yaricap}`;
    let veri = await onbellekOku(anahtar);
    if (!veri) {
        const sorgu = `
[out:json][timeout:25];
(
  way(around:${yaricap},${qLat},${qLon})[highway~"^(${SINIFLAR})$"];
  way(around:${Math.round(yaricap * 0.75)},${qLat},${qLon})[building];
  node(around:${yaricap},${qLat},${qLon})[highway~"^(traffic_signals|stop|give_way|crossing)$"];
  node(around:${yaricap},${qLat},${qLon})[traffic_calming];
  node(around:${Math.round(yaricap * 0.75)},${qLat},${qLon})[natural=tree];
);
out geom;`;
        veri = await overpassSorgula(sorgu, sinyal);
        void onbellekYaz(anahtar, veri);
    }
    return cevreyeDonustur(veri, lat, lon);
}

function cevreyeDonustur(j: OverpassYanit, lat: number, lon: number): Cevre {
    const lat0 = (lat * Math.PI) / 180;
    const mLon = 111320 * Math.cos(lat0);
    const mLat = 110540;
    const izdusum = (p: OsmGeom): Vec2 => ({ x: (p.lon - lon) * mLon, z: -((p.lat - lat) * mLat) });

    const yollar: Yol[] = [];
    const binalar: Bina[] = [];
    const isaretler: Isaret[] = [];
    const agaclar: Vec2[] = [];
    const ISARET: ReadonlySet<string> = new Set(['traffic_signals', 'stop', 'give_way', 'crossing', 'traffic_calming']);

    for (const el of j.elements ?? []) {
        const tags = el.tags ?? {};
        if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
            const p = izdusum({ lat: el.lat, lon: el.lon });
            if (tags.natural === 'tree') {
                agaclar.push(p);
                continue;
            }
            const tip = tags.traffic_calming ? 'traffic_calming' : tags.highway;
            if (!tip || !ISARET.has(tip)) continue;
            isaretler.push({ id: `osm-${el.id}`, tip: tip as IsaretTipi, x: p.x, z: p.z });
            continue;
        }
        if (!el.geometry || el.geometry.length < 2) continue;
        const noktalar = el.geometry.map(izdusum);
        if (tags.highway) {
            const sinif = tags.highway as YolSinifi;
            if (!(sinif in YOL_GENISLIKLERI)) continue;
            const tekYon = tags.oneway === 'yes' || tags.junction === 'roundabout';
            const seritTag = parseInt(tags.lanes ?? '', 10);
            const seritSayisi = seritTag > 0 ? seritTag : tekYon ? 1 : 2;
            const genislikTag = parseFloat(tags.width ?? '');
            const genislik = genislikTag > 2 && genislikTag < 40
                ? genislikTag
                : seritTag > 0 ? Math.min(24, Math.max(4, seritTag * 3.3)) : YOL_GENISLIKLERI[sinif];
            yollar.push({
                id: `osm-${el.id}`,
                ad: tags.name ?? 'İsimsiz yol',
                sinif,
                genislik,
                tekYon,
                seritSayisi,
                hizLimiti: parseInt(tags.maxspeed ?? '', 10) || null,
                yuzey: tags.surface ?? null,
                noktalar,
            });
        } else if (tags.building) {
            let h = tags['building:levels'] ? parseFloat(tags['building:levels']) * 3.1 : 0;
            if (!h || Number.isNaN(h)) h = parseFloat(tags.height ?? '') || 6 + (el.id % 5) * 3;
            binalar.push({ noktalar, yukseklik: Math.min(120, h) });
        }
    }
    return { yollar, binalar, isaretler, agaclar, kaynak: 'osm', yaricap: 550 };
}

/** Türkiye ile sınırlı adres araması */
export async function adresAra(q: string, sinyal?: AbortSignal): Promise<SecilenKonum[]> {
    const r = await zamanAsimliFetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=tr&limit=6&accept-language=tr&q=${encodeURIComponent(q)}`,
        {}, 10000, sinyal,
    );
    const j = (await r.json()) as NominatimSonuc[];
    return j.map((s) => ({ lat: parseFloat(s.lat), lon: parseFloat(s.lon), adres: s.display_name }));
}

export async function tersAdres(lat: number, lon: number, sinyal?: AbortSignal): Promise<string | null> {
    try {
        const r = await zamanAsimliFetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&accept-language=tr`,
            {}, 10000, sinyal,
        );
        const j = (await r.json()) as { display_name?: string };
        return j.display_name ?? null;
    } catch {
        return null;
    }
}
