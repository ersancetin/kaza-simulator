// Harita ekranı: Leaflet + OpenStreetMap, Nominatim araması,
// Overpass API'den seçilen noktanın çevresindeki yol/bina geometrisi.

const TR_MERKEZ = [39.0, 35.3];
const TR_SINIR = L.latLngBounds([35.6, 25.5], [42.4, 45.0]);

let harita = null;
let isaretci = null;
let secilen = null; // { lat, lon, adres }

export function haritayiBaslat(secimCallback) {
    harita = L.map('harita', {
        center: TR_MERKEZ,
        zoom: 6,
        maxBounds: TR_SINIR.pad(0.4),
        minZoom: 5,
        zoomControl: false,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(harita);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları',
    }).addTo(harita);

    // Uzak zoom'da tıklama yakınlaştırır; nokta seçimi ancak sokakların
    // seçilebildiği yakınlıkta (zoom >= 15) yapılır.
    harita.on('click', async (e) => {
        if (!TR_SINIR.contains(e.latlng)) return;
        if (harita.getZoom() < 15) {
            harita.setView(e.latlng, Math.min(17, Math.max(harita.getZoom() + 3, 15)));
            return;
        }
        noktaSec(e.latlng.lat, e.latlng.lng, null, secimCallback);
    });

    // İpucu metnini zoom seviyesine göre güncelle
    const ipucu = document.querySelector('.harita-ipucu');
    const ipucuGuncelle = () => {
        if (!ipucu) return;
        ipucu.innerHTML = harita.getZoom() < 15
            ? 'Yakınlaşmak için haritaya <b>tıklayın</b> veya yukarıdan arama yapın.'
            : 'Kazanın gerçekleştiği noktaya <b>tıklayın</b> (yol üzerine).';
    };
    harita.on('zoomend', ipucuGuncelle);
    ipucuGuncelle();
}

async function noktaSec(lat, lon, adres, cb) {
    if (isaretci) isaretci.remove();
    isaretci = L.marker([lat, lon]).addTo(harita);
    secilen = { lat, lon, adres: adres || `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
    cb(secilen);

    if (!adres) {
        // Ters geokodlama ile okunabilir adres al
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&accept-language=tr`);
            const j = await r.json();
            if (j.display_name && secilen && secilen.lat === lat) {
                secilen.adres = j.display_name;
                cb(secilen);
            }
        } catch { /* adres alınamazsa koordinat gösterilir */ }
    }
}

export function konumaGit(lat, lon, adres, cb) {
    harita.setView([lat, lon], 17);
    noktaSec(lat, lon, adres, cb);
}

// --- Nominatim arama (Türkiye ile sınırlı) ---
let aramaZamanlayici = null;
export function aramaKur(girdi, sonucKutusu, secCallback) {
    girdi.addEventListener('input', () => {
        clearTimeout(aramaZamanlayici);
        const q = girdi.value.trim();
        if (q.length < 3) { sonucKutusu.classList.add('gizli'); return; }
        aramaZamanlayici = setTimeout(async () => {
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=tr&limit=6&accept-language=tr&q=${encodeURIComponent(q)}`);
                const sonuclar = await r.json();
                sonucKutusu.innerHTML = '';
                if (!sonuclar.length) { sonucKutusu.classList.add('gizli'); return; }
                for (const s of sonuclar) {
                    const div = document.createElement('div');
                    div.className = 'arama__sonuc';
                    div.textContent = s.display_name;
                    div.addEventListener('click', () => {
                        sonucKutusu.classList.add('gizli');
                        girdi.value = s.display_name.split(',')[0];
                        secCallback(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
                    });
                    sonucKutusu.appendChild(div);
                }
                sonucKutusu.classList.remove('gizli');
            } catch { sonucKutusu.classList.add('gizli'); }
        }, 350);
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.arama')) sonucKutusu.classList.add('gizli');
    });
}

// --- Overpass: seçilen noktanın çevresindeki yollar ve binalar ---
// Dönen geometri, kaza noktası orijin olacak şekilde metre cinsinden
// yerel düzleme izdüşürülür (x = doğu, z = güney; Three.js eksenleriyle uyumlu).
const YOL_GENISLIKLERI = {
    motorway: 15, trunk: 13, primary: 11, secondary: 9.5, tertiary: 8,
    unclassified: 7, residential: 6.5, living_street: 5.5, service: 5,
    motorway_link: 8, trunk_link: 8, primary_link: 8, secondary_link: 7, tertiary_link: 7,
    pedestrian: 4, footway: 2, path: 2, cycleway: 2.5, track: 3.5,
};

const OVERPASS_SUNUCULAR = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

function zamanAsimliFetch(url, secenekler, sureMs) {
    // AbortSignal.timeout eski tarayıcılarda yok; elle kur
    const denetleyici = new AbortController();
    const z = setTimeout(() => denetleyici.abort(), sureMs);
    return fetch(url, { ...secenekler, signal: denetleyici.signal })
        .finally(() => clearTimeout(z));
}

async function overpassSorgula(sorgu) {
    let sonHata = null;
    for (const sunucu of OVERPASS_SUNUCULAR) {
        try {
            const r = await zamanAsimliFetch(sunucu, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(sorgu),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }, 40000);
            if (!r.ok) { sonHata = new Error('HTTP ' + r.status); continue; }
            return await r.json();
        } catch (e) { sonHata = e; }
    }
    throw sonHata || new Error('Overpass sunucularına ulaşılamadı');
}

// Çevredeki her şeyi (tüm yol tipleri + tüm binalar) geniş yarıçapla çeker.
// Veri çok büyük olur da sorgu başarısız/zaman aşımı olursa yarıçap daraltılır.
export async function cevreVerisiGetir(lat, lon) {
    const yaricaplar = [2000, 900, 450];
    let sonuc = null, sonHata = null;
    for (const yaricap of yaricaplar) {
        const sorgu = `
[out:json][timeout:60];
(
  way(around:${yaricap},${lat},${lon})[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|pedestrian|footway|path|cycleway|track)$"];
  way(around:${yaricap},${lat},${lon})[building];
  node(around:${yaricap},${lat},${lon})[highway~"^(traffic_signals|stop|give_way|crossing)$"];
  node(around:${yaricap},${lat},${lon})[traffic_calming];
);
out geom;`;
        try {
            sonuc = { yaricap, veri: await overpassSorgula(sorgu) };
            break;
        } catch (e) { sonHata = e; }
    }
    if (!sonuc) throw sonHata || new Error('Overpass verisi alınamadı');
    const j = sonuc.veri;

    const lat0 = lat * Math.PI / 180;
    const mLon = 111320 * Math.cos(lat0); // 1° boylam ≈ metre
    const mLat = 110540;                  // 1° enlem ≈ metre
    const izdusum = (p) => ({
        x: (p.lon - lon) * mLon,
        z: -((p.lat - lat) * mLat), // kuzey = -z
    });

    const yollar = [], binalar = [], isaretler = [];
    const ISARET_TIPLERI = ['traffic_signals', 'stop', 'give_way', 'crossing', 'traffic_calming'];
    for (const el of j.elements || []) {
        const tags = el.tags || {};

        // Nokta ögeleri: trafik ışığı, dur/yol ver tabelası, yaya geçidi, kasis
        if (el.type === 'node') {
            const tip = tags.traffic_calming ? 'traffic_calming' : tags.highway;
            if (!ISARET_TIPLERI.includes(tip)) continue;
            const p = izdusum(el);
            isaretler.push({ tip, x: p.x, z: p.z });
            continue;
        }

        if (!el.geometry || el.geometry.length < 2) continue;
        const noktalar = el.geometry.map(izdusum);
        if (tags.highway) {
            const tekYon = tags.oneway === 'yes';
            const seritTag = parseInt(tags.lanes);
            const seritSayisi = seritTag > 0 ? seritTag : (tekYon ? 1 : 2);
            const genislik = seritTag > 0
                ? Math.min(24, Math.max(4, seritTag * 3.3))
                : (YOL_GENISLIKLERI[tags.highway] || 7);
            yollar.push({
                ad: tags.name || 'İsimsiz yol',
                sinif: tags.highway,
                genislik,
                tekYon,
                seritSayisi,
                hizLimiti: parseInt(tags.maxspeed) || null,
                yuzey: tags.surface || null,
                noktalar,
                id: el.id,
            });
        } else if (tags.building) {
            // Deterministik yükseklik: kat bilgisi varsa onu, yoksa id'den türetilmiş 6–18 m
            let h = 0;
            if (tags['building:levels']) h = parseFloat(tags['building:levels']) * 3;
            if (!h || isNaN(h)) h = 6 + (el.id % 5) * 3;
            binalar.push({ noktalar, yukseklik: h });
        }
    }
    return { yollar, binalar, isaretler, yaricap: sonuc.yaricap };
}

// Hedef nokta (varsayılan: orijin = seçilen konum) yol ağının üzerinde
// olmayabilir (idari merkez koordinatı, kaba tıklama vb.). Tüm geometriyi,
// hedefe en yakın yol noktası / kavşak orijine oturacak şekilde kaydırır.
// Yol çok uzaksa null döner. Sahne içinden nokta taşımada da kullanılır.
export function yolaHizala(cevre, azamiMesafe = 400, hedefNokta = { x: 0, z: 0 }) {
    const H = hedefNokta;
    // Yaya yolları çarpışma noktası adayı olamaz (araç yaklaşımı kurulamaz)
    const YAYA = new Set(['pedestrian', 'footway', 'path', 'cycleway', 'track', 'steps']);
    const aracYollari = cevre.yollar.filter(y => !YAYA.has(y.sinif));

    // 1) Hedefe en yakın yol noktası (yol genişliği de izlenir)
    let enYakin = null, enYakinMesafe = Infinity, enYakinGenislik = 7;
    for (const yol of aracYollari) {
        const n = yol.noktalar;
        for (let i = 1; i < n.length; i++) {
            const a = n[i - 1], b = n[i];
            const abx = b.x - a.x, abz = b.z - a.z;
            const l2 = abx * abx + abz * abz || 1;
            let t = ((H.x - a.x) * abx + (H.z - a.z) * abz) / l2;
            t = Math.max(0, Math.min(1, t));
            const px = a.x + abx * t, pz = a.z + abz * t;
            const d = Math.hypot(px - H.x, pz - H.z);
            if (d < enYakinMesafe) { enYakinMesafe = d; enYakin = { x: px, z: pz }; enYakinGenislik = yol.genislik; }
        }
    }
    if (!enYakin || enYakinMesafe > azamiMesafe) return null;

    // Seçilen nokta yola yeterince yakınsa (üzerindeyse) AYNEN korunur —
    // kullanıcının tıkladığı yer neresiyse çarpışma orada kurulur.
    // Yalnızca yoldan uzaksa (araç yaklaşımı kurulamayacağı için)
    // en yakın yol noktasına çekilir. Geometri DEĞİŞTİRİLMEZ; yalnızca
    // kullanılacak çarpışma noktası döndürülür.
    // Nokta ancak gerçekten yol YÜZEYİNDEYSE aynen korunur; refüj/çimen
    // gibi yol dışı tıklamalar en yakın yol eksenine oturtulur.
    const SERBEST_ESIK = enYakinGenislik / 2 + 1.5;
    const tamNokta = enYakinMesafe <= SERBEST_ESIK;
    return {
        nokta: tamNokta ? { x: H.x, z: H.z } : enYakin,
        kaymaMetre: tamNokta ? 0 : enYakinMesafe,
        tam: tamNokta,
    };
}

// Overpass'a ulaşılamazsa: standart dört kollu kavşak
export function varsayilanCevre() {
    const u = 170;
    return {
        yollar: [
            { ad: 'Kuzey-Güney yolu', sinif: 'secondary', genislik: 9, tekYon: false, seritSayisi: 2, hizLimiti: null, yuzey: null, id: 1, noktalar: [{ x: 0, z: -u }, { x: 0, z: u }] },
            { ad: 'Doğu-Batı yolu',   sinif: 'secondary', genislik: 9, tekYon: false, seritSayisi: 2, hizLimiti: null, yuzey: null, id: 2, noktalar: [{ x: -u, z: 0 }, { x: u, z: 0 }] },
        ],
        binalar: [],
        isaretler: [],
        varsayilan: true,
    };
}
