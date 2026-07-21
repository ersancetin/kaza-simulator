// Three.js 3B kaza canlandırması.
// Overpass'tan gelen gerçek yol/bina geometrisi üzerinde iki aracın
// yaklaşma → reaksiyon → frenleme → çarpışma → savrulma evrelerini,
// kapalı-form kinematikle (zaman çubuğunda ileri-geri sarılabilir) oynatır.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { G, frenSonrasiHiz, carpisma2B } from './physics.js';

const ARAC_OFSET = 2.15;   // araç merkezi ile burnu arasındaki mesafe (m)

// ---- yardımcı geometri ----
function sag(d) { return { x: -d.z, z: d.x }; } // gidiş yönünün sağı (sağdan trafik)

function seritGeometri(pts, genislik, y = 0.02, birlesim = false) {
    // Polyline boyunca sabit genişlikte şerit. Her parça KENDİ dikmesiyle
    // ayrı dörtgen olarak üretilir: ortalama-yön yaklaşımı, geri katlanan
    // OSM geometrilerinde (bölünmüş yol, U dönüşü) dev "papyon" yüzeyler
    // doğuruyordu. birlesim=true ise dönemeç noktaları yuvarlak birleşim
    // diskleriyle doldurulur (yollar için).
    const konumlar = [], indeksler = [];
    let v = 0;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        let dx = b.x - a.x, dz = b.z - a.z;
        const l = Math.hypot(dx, dz);
        if (l < 0.005) { dx = 1; dz = 0; } else { dx /= l; dz /= l; }
        const r = sag({ x: dx, z: dz });
        konumlar.push(
            a.x + r.x * genislik / 2, y, a.z + r.z * genislik / 2,
            a.x - r.x * genislik / 2, y, a.z - r.z * genislik / 2,
            b.x + r.x * genislik / 2, y, b.z + r.z * genislik / 2,
            b.x - r.x * genislik / 2, y, b.z - r.z * genislik / 2
        );
        indeksler.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        v += 4;
    }
    if (birlesim) {
        // İç köşe boşluklarını dolduran yuvarlak birleşimler
        const dilim = 8, yaricap = genislik / 2;
        for (let i = 1; i < pts.length - 1; i++) {
            const merkez = v;
            konumlar.push(pts[i].x, y, pts[i].z);
            for (let k = 0; k <= dilim; k++) {
                const aci = (k / dilim) * Math.PI * 2;
                konumlar.push(pts[i].x + Math.cos(aci) * yaricap, y, pts[i].z + Math.sin(aci) * yaricap);
            }
            for (let k = 0; k < dilim; k++) {
                indeksler.push(merkez, merkez + 1 + k, merkez + 2 + k);
            }
            v += dilim + 2;
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(konumlar, 3));
    g.setIndex(indeksler);
    g.computeVertexNormals();
    return g;
}

// Çok sayıda küçük ağ (yol parçası, bina) tek çizim çağrısında toplanır;
// 2 km yarıçaplı yoğun kent verisi ancak böyle akıcı kalır.
function geometrileriBirlestir(geometriler, renkler = null) {
    const duz = geometriler.map(g => (g.index ? g.toNonIndexed() : g));
    let toplam = 0;
    for (const g of duz) toplam += g.attributes.position.count;
    const konum = new Float32Array(toplam * 3);
    const normal = new Float32Array(toplam * 3);
    const renk = renkler ? new Float32Array(toplam * 3) : null;
    let of = 0;
    duz.forEach((g, i) => {
        konum.set(g.attributes.position.array, of * 3);
        normal.set(g.attributes.normal.array, of * 3);
        if (renk) {
            const c = renkler[i], n = g.attributes.position.count;
            for (let k = 0; k < n; k++) {
                renk[(of + k) * 3] = c.r; renk[(of + k) * 3 + 1] = c.g; renk[(of + k) * 3 + 2] = c.b;
            }
        }
        of += g.attributes.position.count;
    });
    const sonuc = new THREE.BufferGeometry();
    sonuc.setAttribute('position', new THREE.BufferAttribute(konum, 3));
    sonuc.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    if (renk) sonuc.setAttribute('color', new THREE.BufferAttribute(renk, 3));
    return sonuc;
}

// Yaklaşım yolu: uç noktadan (çarpışma) geriye doğru yay uzunluğuyla örnekleme
function yolParametrele(pts) {
    const s = [0];
    for (let i = 1; i < pts.length; i++) {
        s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    }
    const L = s[s.length - 1];
    return {
        uzunluk: L,
        // sSondan: bitiş noktasından geriye mesafe; dönüş: konum + gidiş yönü
        konum(sSondan) {
            const hedef = L - sSondan;
            if (hedef <= 0) {
                // Yol yetmezse başlangıç yönünde düz uzat
                let dx = pts[1].x - pts[0].x, dz = pts[1].z - pts[0].z;
                const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
                return { x: pts[0].x + dx * hedef, z: pts[0].z + dz * hedef, yon: { x: dx, z: dz } };
            }
            for (let i = 1; i < pts.length; i++) {
                if (s[i] >= hedef) {
                    const t = (hedef - s[i - 1]) / ((s[i] - s[i - 1]) || 1);
                    let dx = pts[i].x - pts[i - 1].x, dz = pts[i].z - pts[i - 1].z;
                    const l = Math.hypot(dx, dz) || 1;
                    return {
                        x: pts[i - 1].x + dx * t,
                        z: pts[i - 1].z + dz * t,
                        yon: { x: dx / l, z: dz / l },
                    };
                }
            }
            const n = pts.length - 1;
            let dx = pts[n].x - pts[n - 1].x, dz = pts[n].z - pts[n - 1].z;
            const l = Math.hypot(dx, dz) || 1;
            return { x: pts[n].x, z: pts[n].z, yon: { x: dx / l, z: dz / l } };
        },
    };
}

// Polyline'ı gidiş yönünün sağına doğru sabit mesafe kaydırır
function ofsetliNoktalar(pts, lateral) {
    return pts.map((p, i, dizi) => {
        const a = dizi[Math.max(0, i - 1)], b = dizi[Math.min(dizi.length - 1, i + 1)];
        let dx = b.x - a.x, dz = b.z - a.z;
        const l = Math.hypot(dx, dz) || 1;
        const r = sag({ x: dx / l, z: dz / l });
        return { x: p.x + r.x * lateral, z: p.z + r.z * lateral };
    });
}

// Bir noktaya en yakın araç yolunu, o noktadaki yol yönünü ve mesafeyi bulur
function enYakinYol(yollar, p, yayaHaric = true) {
    const YAYA = new Set(['pedestrian', 'footway', 'path', 'cycleway', 'track']);
    let sonuc = null, enKisa = Infinity;
    for (const yol of yollar) {
        if (yayaHaric && YAYA.has(yol.sinif)) continue;
        const n = yol.noktalar;
        for (let i = 1; i < n.length; i++) {
            const a = n[i - 1], b = n[i];
            const abx = b.x - a.x, abz = b.z - a.z;
            const l2 = abx * abx + abz * abz || 1;
            let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2;
            t = Math.max(0, Math.min(1, t));
            const px = a.x + abx * t, pz = a.z + abz * t;
            const d = Math.hypot(px - p.x, pz - p.z);
            if (d < enKisa) {
                const l = Math.sqrt(l2);
                enKisa = d;
                sonuc = { yol, mesafe: d, konum: { x: px, z: pz }, yon: { x: abx / l, z: abz / l } };
            }
        }
    }
    return sonuc;
}

// Sağdan trafik: aracın kendi yönündeki en sağ şeridin merkezine ofset
function seritOfseti(yaklasim) {
    const N = Math.max(1, yaklasim.seritSayisi || (yaklasim.tekYon ? 1 : 2));
    if (yaklasim.tekYon && N === 1) return 0;
    const seritGen = yaklasim.genislik / N;
    return Math.min(3.2, Math.max(1.2, yaklasim.genislik / 2 - seritGen / 2));
}

function pusula(dx, dz) {
    // Vektörün geldiği yönün adı (kuzey = -z, doğu = +x)
    const aci = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const adlar = ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'];
    return adlar[Math.round(aci / 45) % 8];
}

// ---- araç modelleri ----
export const ARAC_TURLERI = {
    otomobil:   { ad: 'Otomobil',        boy: 4.35, en: 1.78, yuk: 1.4,  kutle: 1300 },
    kamyonet:   { ad: 'Kamyonet (Pikap)', boy: 5.2, en: 1.9,  yuk: 1.85, kutle: 2100 },
    minibus:    { ad: 'Minibüs',         boy: 5.4,  en: 1.95, yuk: 2.35, kutle: 2600 },
    kamyon:     { ad: 'Kamyon',          boy: 8.0,  en: 2.35, yuk: 3.0,  kutle: 8000 },
    otobus:     { ad: 'Otobüs',          boy: 11.5, en: 2.5,  yuk: 3.1,  kutle: 11500 },
    cekici:     { ad: 'Çekici (TIR)',    boy: 15.5, en: 2.5,  yuk: 3.5,  kutle: 16000 },
    motosiklet: { ad: 'Motosiklet',      boy: 2.2,  en: 0.8,  yuk: 1.45, kutle: 300 },
    traktor:    { ad: 'Traktör',         boy: 4.4,  en: 1.9,  yuk: 2.7,  kutle: 3500 },
};

// TR plakası dokusu (beyaz zemin, mavi şerit, siyah yazı)
function plakaDoku(plaka) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 64);
    x.fillStyle = '#003399'; x.fillRect(0, 0, 32, 64);
    x.fillStyle = '#ffffff'; x.font = 'bold 17px sans-serif';
    x.fillText('TR', 5, 40);
    x.fillStyle = '#111111'; x.font = 'bold 32px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(plaka.toUpperCase().slice(0, 10), 144, 34);
    return new THREE.CanvasTexture(c);
}

function plakaEkle(grup, plaka, boy) {
    if (!plaka) return;
    const mat = new THREE.MeshBasicMaterial({ map: plakaDoku(plaka) });
    const geo = new THREE.PlaneGeometry(0.66, 0.165);
    const on = new THREE.Mesh(geo, mat);
    on.position.set(0, 0.45, boy / 2 + 0.03);
    grup.add(on);
    const arka = new THREE.Mesh(geo, mat);
    arka.position.set(0, 0.55, -boy / 2 - 0.03);
    arka.rotation.y = Math.PI;
    grup.add(arka);
}

// ---- trafik levhaları ----
// Direk + levha ile kurulan işaret tipleri
export const LEVHALILAR = new Set([
    'stop', 'give_way', 'hiz-tabela', 'sollama-yasak', 'park-yasak', 'giris-yok', 'ozel-tabela',
]);

// Standart görünümlü levha yüzeyleri (kanvas dokulu)
function levhaOlustur(is) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const x = c.getContext('2d');
    const daire = (dolgu) => { x.fillStyle = dolgu; x.beginPath(); x.arc(80, 80, 76, 0, 7); x.fill(); };
    const halka = () => { x.strokeStyle = '#d21f26'; x.lineWidth = 16; x.beginPath(); x.arc(80, 80, 66, 0, 7); x.stroke(); };
    let genislik = 0.95, yukseklik = 0.95;

    if (is.tip === 'hiz-tabela') {
        daire('#ffffff'); halka();
        x.fillStyle = '#111'; x.font = 'bold 60px sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(is.deger || 50), 80, 84);
    } else if (is.tip === 'sollama-yasak') {
        daire('#ffffff'); halka();
        x.fillStyle = '#d21f26';
        x.beginPath(); x.roundRect(34, 62, 34, 40, 6); x.fill();
        x.fillStyle = '#111';
        x.beginPath(); x.roundRect(88, 62, 34, 40, 6); x.fill();
    } else if (is.tip === 'park-yasak') {
        daire('#1560bd'); halka();
        x.strokeStyle = '#d21f26'; x.lineWidth = 14;
        x.beginPath(); x.moveTo(36, 124); x.lineTo(124, 36); x.stroke();
    } else if (is.tip === 'giris-yok') {
        daire('#d21f26');
        x.fillStyle = '#ffffff';
        x.beginPath(); x.roundRect(28, 68, 104, 26, 8); x.fill();
    } else if (is.tip === 'stop') {
        // Sekizgen DUR levhası
        x.fillStyle = '#c0221f';
        x.beginPath();
        for (let k = 0; k < 8; k++) {
            const a = Math.PI / 8 + k * Math.PI / 4;
            const px = 80 + 76 * Math.cos(a), py = 80 + 76 * Math.sin(a);
            k === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        }
        x.closePath(); x.fill();
        x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke();
        x.fillStyle = '#fff'; x.font = 'bold 52px sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('DUR', 80, 84);
    } else if (is.tip === 'give_way') {
        // Tepesi aşağı üçgen (yol ver)
        x.fillStyle = '#d21f26';
        x.beginPath(); x.moveTo(10, 24); x.lineTo(150, 24); x.lineTo(80, 148); x.closePath(); x.fill();
        x.fillStyle = '#fff';
        x.beginPath(); x.moveTo(38, 40); x.lineTo(122, 40); x.lineTo(80, 118); x.closePath(); x.fill();
    } else { // ozel-tabela: yazılı mavi levha
        const metin = (is.metin || 'TABELA').slice(0, 24);
        c.width = 70 + metin.length * 28; c.height = 88;
        const x2 = c.getContext('2d');
        x2.fillStyle = '#1560bd'; x2.fillRect(0, 0, c.width, c.height);
        x2.strokeStyle = '#fff'; x2.lineWidth = 5; x2.strokeRect(4, 4, c.width - 8, c.height - 8);
        x2.fillStyle = '#fff'; x2.font = 'bold 40px sans-serif';
        x2.textAlign = 'center'; x2.textBaseline = 'middle';
        x2.fillText(metin, c.width / 2, c.height / 2 + 2);
        genislik = c.width / 95; yukseklik = c.height / 95;
    }

    const levha = new THREE.Mesh(
        new THREE.PlaneGeometry(genislik, yukseklik),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, side: THREE.DoubleSide })
    );
    // Direğin ÖN yüzüne monte: hafif öne alınır ki direk levhanın
    // arkasında kalsın, içinden geçmesin
    levha.position.set(0, 2.35, 0.1);
    return levha;
}

// Araç üstünde süzülen kimlik etiketi (taraf adı + plaka) — her mesafeden okunur
function etiketSprite(metin, renkHex) {
    const c = document.createElement('canvas');
    c.width = 60 + metin.length * 30; c.height = 72;
    const x = c.getContext('2d');
    x.fillStyle = '#' + renkHex.toString(16).padStart(6, '0');
    x.beginPath();
    x.roundRect(2, 2, c.width - 4, c.height - 4, 14);
    x.fill();
    x.fillStyle = '#ffffff'; x.font = 'bold 40px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(metin, c.width / 2, c.height / 2 + 2);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c), depthTest: false,
    }));
    sprite.scale.set(c.width / 55, c.height / 55, 1);
    return sprite;
}

function aracOlustur(renk, tur = 'otomobil', plaka = '') {
    const T = ARAC_TURLERI[tur] || ARAC_TURLERI.otomobil;
    const grup = new THREE.Group();
    const govdeMat = new THREE.MeshStandardMaterial({ color: renk, metalness: 0.4, roughness: 0.45 });
    const camMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, metalness: 0.2, roughness: 0.15 });
    const kasaMat = new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.7 });
    const lastikMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.9 });

    const kutu = (w, h, d, mat, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); m.castShadow = true;
        grup.add(m); return m;
    };

    if (tur === 'otomobil') {
        kutu(T.en, 0.55, T.boy, govdeMat, 0, 0.55, 0);
        kutu(T.en - 0.16, 0.52, 2.1, camMat, 0, 1.03, -0.25);
    } else if (tur === 'kamyonet') {
        kutu(T.en, 0.6, T.boy, govdeMat, 0, 0.6, 0);                 // şasi
        kutu(T.en - 0.1, 0.75, 1.7, camMat, 0, 1.35, T.boy / 2 - 1.6); // kabin
        kutu(T.en, 0.45, T.boy / 2, govdeMat, 0, 1.05, -T.boy / 4);  // kasa duvarları
    } else if (tur === 'motosiklet') {
        kutu(0.32, 0.45, 1.6, govdeMat, 0, 0.75, 0);                 // gövde/depo
        kutu(0.5, 0.12, 0.5, camMat, 0, 1.02, 0.55);                 // gidon
        // Sürücü figürü
        kutu(0.42, 0.6, 0.4, new THREE.MeshStandardMaterial({ color: 0x333a45 }), 0, 1.25, -0.2);
        const kask = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
            new THREE.MeshStandardMaterial({ color: renk }));
        kask.position.set(0, 1.68, -0.2);
        grup.add(kask);
    } else if (tur === 'traktor') {
        kutu(T.en - 0.5, 0.9, T.boy - 1.2, govdeMat, 0, 1.1, 0.3);   // motor/gövde
        kutu(T.en - 0.4, 1.1, 1.4, camMat, 0, 2.05, -1.0);           // kabin
    } else if (tur === 'minibus') {
        kutu(T.en, 1.9, T.boy, govdeMat, 0, 1.25, 0);
        kutu(T.en + 0.02, 0.55, T.boy - 1.6, camMat, 0, 1.75, -0.5);
    } else if (tur === 'kamyon') {
        kutu(T.en, 1.9, 2.0, govdeMat, 0, 1.35, T.boy / 2 - 1.0);   // kabin önde
        kutu(T.en + 0.02, 0.5, 1.2, camMat, 0, 1.9, T.boy / 2 - 0.7);
        kutu(T.en, 2.5, T.boy - 2.6, kasaMat, 0, 1.65, -1.4);        // kasa
    } else if (tur === 'otobus') {
        kutu(T.en, 2.7, T.boy, govdeMat, 0, 1.65, 0);
        kutu(T.en + 0.02, 0.8, T.boy - 1.2, camMat, 0, 2.25, 0);
    } else if (tur === 'cekici') {
        kutu(T.en, 2.2, 2.2, govdeMat, 0, 1.5, T.boy / 2 - 1.2);     // çekici kabini
        kutu(T.en + 0.02, 0.55, 1.4, camMat, 0, 2.1, T.boy / 2 - 0.9);
        kutu(T.en, 2.9, T.boy - 3.6, kasaMat, 0, 1.95, -1.9);        // dorse
    }

    // Tekerlekler
    if (tur === 'motosiklet') {
        const mtGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 14);
        mtGeo.rotateZ(Math.PI / 2);
        for (const z of [0.75, -0.75]) {
            const t = new THREE.Mesh(mtGeo, lastikMat);
            t.position.set(0, 0.32, z);
            grup.add(t);
        }
    } else if (tur === 'traktor') {
        const arkaGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.4, 16);
        arkaGeo.rotateZ(Math.PI / 2);
        const onGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 14);
        onGeo.rotateZ(Math.PI / 2);
        for (const x of [-T.en / 2 + 0.2, T.en / 2 - 0.2]) {
            const arka = new THREE.Mesh(arkaGeo, lastikMat);
            arka.position.set(x, 0.85, -T.boy / 2 + 1.1);
            grup.add(arka);
            const on = new THREE.Mesh(onGeo, lastikMat);
            on.position.set(x, 0.42, T.boy / 2 - 0.8);
            grup.add(on);
        }
    } else {
        const tekerGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16);
        tekerGeo.rotateZ(Math.PI / 2);
        const aksZ = T.boy > 7
            ? [T.boy / 2 - 1.2, -T.boy / 2 + 2.6, -T.boy / 2 + 1.1]
            : [T.boy / 2 - 1.0, -T.boy / 2 + 1.0];
        for (const z of aksZ) {
            for (const x of [-T.en / 2 + 0.15, T.en / 2 - 0.15]) {
                const t = new THREE.Mesh(tekerGeo, lastikMat);
                t.position.set(x, 0.36, z);
                grup.add(t);
            }
        }
    }

    const farMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xfff2b0, emissiveIntensity: 0.9 });
    for (const x of [-T.en / 2 + 0.35, T.en / 2 - 0.35]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.06), farMat);
        f.position.set(x, 0.7, T.boy / 2 + 0.01); // burun +z yönünde
        grup.add(f);
    }

    plakaEkle(grup, plaka, T.boy);
    return grup;
}

// Basit yaya figürü (gövde + baş + bacaklar)
function yayaOlustur(renk) {
    const grup = new THREE.Group();
    const govdeMat = new THREE.MeshStandardMaterial({ color: renk, roughness: 0.7 });
    const tenMat = new THREE.MeshStandardMaterial({ color: 0xd9a679, roughness: 0.8 });
    const pantolonMat = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.8 });

    for (const x of [-0.09, 0.09]) {
        const bacak = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), pantolonMat);
        bacak.position.set(x, 0.4, 0);
        grup.add(bacak);
    }
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.65, 10), govdeMat);
    govde.position.y = 1.12; govde.castShadow = true;
    grup.add(govde);
    const bas = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), tenMat);
    bas.position.y = 1.62;
    grup.add(bas);
    return grup;
}

// ============================================================
export class Simulasyon {
    constructor(kap) {
        this.kap = kap;
        this.sahne = new THREE.Scene();
        this.sahne.background = new THREE.Color(0x9db8d2);
        this.sahne.fog = new THREE.Fog(0x9db8d2, 500, 2600);

        this.kamera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
        this.kamera.position.set(50, 48, 50);

        this.cizici = new THREE.WebGLRenderer({ antialias: true });
        this.cizici.shadowMap.enabled = true;
        this.cizici.shadowMap.type = THREE.PCFSoftShadowMap;
        kap.appendChild(this.cizici.domElement);

        this.kontrol = new OrbitControls(this.kamera, this.cizici.domElement);
        this.kontrol.maxPolarAngle = Math.PI / 2.05;
        this.kontrol.maxDistance = 1800;
        this.kontrol.enableDamping = true;

        const hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a6650, 0.85);
        this.sahne.add(hemi);
        const gunes = new THREE.DirectionalLight(0xfff3df, 1.6);
        gunes.position.set(90, 130, 60);
        gunes.castShadow = true;
        gunes.shadow.mapSize.set(2048, 2048);
        const sc = 180;
        Object.assign(gunes.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, far: 400 });
        this.sahne.add(gunes);

        const zemin = new THREE.Mesh(
            new THREE.CircleGeometry(2800, 64).rotateX(-Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x6f815f, roughness: 1 })
        );
        zemin.receiveShadow = true;
        this.sahne.add(zemin);

        this.cevreGrup = new THREE.Group();
        this.sahne.add(this.cevreGrup);
        this.dinamikGrup = new THREE.Group();
        this.sahne.add(this.dinamikGrup);

        this.t = 0;
        this.sure = 0;
        this.oynuyor = false;
        this.oynatmaHizi = 0.5;
        this.kameraModu = 'serbest';
        this.onZaman = null;
        this.kurulum = null;
        this.kazaNoktasi = { x: 0, z: 0 };

        // Sahneden çarpışma noktası seçimi: kısa tıklama (sürükleme değil)
        // zemin düzlemine ışın atarak dünya koordinatı üretir.
        this._secimCb = null;
        let basilan = null;
        this.cizici.domElement.addEventListener('pointerdown', (e) => {
            basilan = e.button === 0 || e.pointerType === 'touch' ? [e.clientX, e.clientY] : null;
        });
        this.cizici.domElement.addEventListener('pointerup', (e) => {
            if (!this._secimCb || !basilan) return;
            if (Math.hypot(e.clientX - basilan[0], e.clientY - basilan[1]) > 25) return;
            const kutu = this.cizici.domElement.getBoundingClientRect();
            const ndc = new THREE.Vector2(
                ((e.clientX - kutu.left) / kutu.width) * 2 - 1,
                -((e.clientY - kutu.top) / kutu.height) * 2 + 1
            );
            const isin = new THREE.Raycaster();
            isin.setFromCamera(ndc, this.kamera);
            const nokta = new THREE.Vector3();
            if (isin.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), nokta)) {
                this._secimCb({ x: nokta.x, z: nokta.z });
            }
        });

        this._boyutlandir();
        new ResizeObserver(() => this._boyutlandir()).observe(kap);
        this._sonAn = performance.now();
        this._dongu();
    }

    sahneSecimBaslat(cb) {
        this._secimCb = cb;
        this.cizici.domElement.style.cursor = 'crosshair';
        // Seçim sırasında döndürme kapatılır ki tıklama sürüklemeye
        // karışmasın — her tık kesin seçim olur (zoom/kaydırma açık kalır).
        this.kontrol.enableRotate = false;
    }
    sahneSecimBitir() {
        this._secimCb = null;
        this.cizici.domElement.style.cursor = '';
        this.kontrol.enableRotate = true;
    }

    // Noktaya en yakın yolun doğrultu açısı (bariyer vb. hizalamak için)
    yolAcisi(p) {
        const y = enYakinYol(this.cevre.yollar, p, true);
        return y ? Math.atan2(y.yon.x, y.yon.z) : 0;
    }

    // Tıklanan noktayı en yakın yolun KENARINA taşır ve levhayı o şeritteki
    // trafiğe (gelen araçlara) dönük açıyla döndürür. Trafik levhaları için.
    kenaraYerlestir(p) {
        const y = enYakinYol(this.cevre.yollar, p, true);
        if (!y || y.mesafe > 60) return { x: p.x, z: p.z, aci: 0 };
        const r = sag(y.yon);
        const yan = ((p.x - y.konum.x) * r.x + (p.z - y.konum.z) * r.z) >= 0 ? 1 : -1;
        const ofs = y.yol.genislik / 2 + 0.8;
        // Sağ kenardaki levha +yön trafiğine (arkaya), sol kenardaki -yön trafiğine bakar
        const aci = yan === 1
            ? Math.atan2(-y.yon.x, -y.yon.z)
            : Math.atan2(y.yon.x, y.yon.z);
        return { x: y.konum.x + r.x * ofs * yan, z: y.konum.z + r.z * ofs * yan, aci };
    }

    _boyutlandir() {
        const w = this.kap.clientWidth || 1, h = this.kap.clientHeight || 1;
        this.kamera.aspect = w / h;
        this.kamera.updateProjectionMatrix();
        this.cizici.setSize(w, h);
        this.cizici.setPixelRatio(Math.min(devicePixelRatio, 2));
    }

    // ---- çevre ----
    cevreKur(cevre) {
        this.cevre = cevre;
        this.cevreGrup.clear();
        this.dinamikGrup.clear();
        this.kurulum = null; // çevre değişti; eski kurulum geçersiz

        const YAYA = new Set(['pedestrian', 'footway', 'path', 'cycleway', 'track']);
        const asfaltMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95, side: THREE.DoubleSide });
        const yayaMat = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.95, side: THREE.DoubleSide });
        const cizgiMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d0, side: THREE.DoubleSide });

        const yolGeoms = [], yayaGeoms = [], cizgiGeoms = [], ortaGeoms = [];
        for (const yol of cevre.yollar) {
            const hedefListe = YAYA.has(yol.sinif) ? yayaGeoms : yolGeoms;
            hedefListe.push(seritGeometri(yol.noktalar, yol.genislik, YAYA.has(yol.sinif) ? 0.015 : 0.02, true));

            // Şerit çizgileri: OSM'deki şerit sayısına göre — yalnızca merkeze yakın,
            // ana yollarda (bağlantı/servis yollarında çizgi karmaşa yaratıyor)
            const yakinMi = yol.noktalar.some(p => Math.hypot(p.x, p.z) < 800);
            const cizgiUygun = !YAYA.has(yol.sinif) && !yol.sinif.endsWith('_link') && yol.sinif !== 'service';
            if (cizgiUygun && yol.genislik >= 5 && yakinMi) {
                const N = Math.max(1, yol.seritSayisi || (yol.tekYon ? 1 : 2));
                for (let k = 1; k < N; k++) {
                    const lateral = -yol.genislik / 2 + k * (yol.genislik / N);
                    const cizgiPts = ofsetliNoktalar(yol.noktalar, lateral);
                    const ortaCizgi = !yol.tekYon && N % 2 === 0 && k === N / 2;
                    if (ortaCizgi) {
                        // Karşı yönleri ayıran kesintisiz çizgi
                        ortaGeoms.push(seritGeometri(cizgiPts, 0.15, 0.035));
                    } else {
                        const p = yolParametrele(cizgiPts);
                        for (let s = 2; s < p.uzunluk - 2; s += 7) {
                            const a = p.konum(p.uzunluk - s), b = p.konum(p.uzunluk - Math.min(s + 3, p.uzunluk));
                            cizgiGeoms.push(seritGeometri([a, b], 0.14, 0.035));
                        }
                    }
                }
            }
        }
        if (yolGeoms.length) {
            const m = new THREE.Mesh(geometrileriBirlestir(yolGeoms), asfaltMat);
            m.receiveShadow = true;
            this.cevreGrup.add(m);
        }
        if (yayaGeoms.length) this.cevreGrup.add(new THREE.Mesh(geometrileriBirlestir(yayaGeoms), yayaMat));
        if (cizgiGeoms.length) this.cevreGrup.add(new THREE.Mesh(geometrileriBirlestir(cizgiGeoms), cizgiMat));
        if (ortaGeoms.length) {
            this.cevreGrup.add(new THREE.Mesh(
                geometrileriBirlestir(ortaGeoms),
                new THREE.MeshBasicMaterial({ color: 0xe8e4c8, side: THREE.DoubleSide })
            ));
        }

        this._isaretleriKur(cevre);
        this._yolAdlariKur(cevre);

        // Binalar: merkeze en yakın 8000 tanesi, tek birleşik ağ (köşe renkleriyle)
        const binalar = (cevre.binalar || [])
            .filter(b => b.noktalar.length >= 3)
            .map(b => {
                const cx = b.noktalar.reduce((s, p) => s + p.x, 0) / b.noktalar.length;
                const cz = b.noktalar.reduce((s, p) => s + p.z, 0) / b.noktalar.length;
                return { ...b, uzaklik: Math.hypot(cx, cz) };
            })
            .sort((a, b) => a.uzaklik - b.uzaklik)
            .slice(0, 8000);
        if (binalar.length) {
            const geoms = [], renkler = [];
            for (const bina of binalar) {
                const sekil = new THREE.Shape(bina.noktalar.map(p => new THREE.Vector2(p.x, -p.z)));
                const geo = new THREE.ExtrudeGeometry(sekil, { depth: bina.yukseklik, bevelEnabled: false });
                geo.rotateX(-Math.PI / 2);
                geoms.push(geo);
                const ton = 0.72 + ((bina.yukseklik * 7) % 10) / 60;
                renkler.push(new THREE.Color(ton, ton * 0.98, ton * 0.94));
            }
            const m = new THREE.Mesh(
                geometrileriBirlestir(geoms, renkler),
                new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })
            );
            m.castShadow = m.receiveShadow = true;
            this.cevreGrup.add(m);
        }

        // Kaza noktası işareti
        this.isaret = new THREE.Mesh(
            new THREE.RingGeometry(1.4, 2.0, 40).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 })
        );
        this.isaret.position.y = 0.05;
        this.cevreGrup.add(this.isaret);
    }

    // Kullanıcı işaret ekledi/sildi veya nokta taşındı: işaretleri yeniden kur
    isaretleriYenile() {
        if (this.cevre) this._isaretleriKur(this.cevre);
    }

    // Sokak/cadde adlarını yol yüzeyine yaz (harita etiketi gibi).
    // Her adlı yolda ~180 m aralıklarla tekrarlanır ki hangi mevkide
    // hangi cadde olduğu her karede okunabilsin.
    _yolAdlariKur(cevre) {
        const etiketler = [];
        for (const yol of cevre.yollar) {
            if (!yol.ad || yol.ad === 'İsimsiz yol') continue;
            const n = yol.noktalar;
            let birikim = 999; // ilk uygun parçaya hemen etiket koy
            for (let i = 1; i < n.length; i++) {
                const a = n[i - 1], b = n[i];
                const parca = Math.hypot(b.x - a.x, b.z - a.z);
                birikim += parca;
                if (birikim < 180) continue;
                const ox = (a.x + b.x) / 2, oz = (a.z + b.z) / 2;
                if (Math.hypot(ox, oz) > 500) continue;
                birikim = 0;
                const l = parca || 1;
                etiketler.push({ ad: yol.ad, x: ox, z: oz, yon: { x: (b.x - a.x) / l, z: (b.z - a.z) / l } });
            }
        }
        for (const k of etiketler.slice(0, 60)) {
            const ad = k.ad;
            const c = document.createElement('canvas');
            const olcum = 40 + ad.length * 26;
            c.width = Math.min(1024, Math.max(128, olcum));
            c.height = 72;
            const x = c.getContext('2d');
            x.font = 'bold 42px sans-serif';
            x.textAlign = 'center'; x.textBaseline = 'middle';
            x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,0.85)';
            x.strokeText(ad, c.width / 2, 38);
            x.fillStyle = '#ffffff';
            x.fillText(ad, c.width / 2, 38);
            const doku = new THREE.CanvasTexture(c);
            const genislikM = c.width / 34; // ≈ okunur ölçek
            const geo = new THREE.PlaneGeometry(genislikM, genislikM * c.height / c.width);
            geo.rotateX(-Math.PI / 2);
            const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
                map: doku, transparent: true, depthWrite: false, opacity: 0.92,
            }));
            m.position.set(k.x, 0.06, k.z);
            m.rotation.y = Math.atan2(-k.yon.z, k.yon.x);
            this.cevreGrup.add(m);
        }
    }

    // Sahnenin anlık fotoğrafı (PNG data URL)
    fotoCek() {
        this.cizici.render(this.sahne, this.kamera);
        return this.cizici.domElement.toDataURL('image/png');
    }

    // ---- kullanıcı yol çizimi önizlemesi ----
    cizimOnizle(pts, genislik = 7) {
        if (!this.onizlemeGrup) {
            this.onizlemeGrup = new THREE.Group();
            this.sahne.add(this.onizlemeGrup);
        }
        this.onizlemeGrup.clear();
        const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        if (pts.length >= 2) {
            this.onizlemeGrup.add(new THREE.Mesh(seritGeometri(pts, genislik, 0.08), mat));
        }
        for (const p of pts) {
            const nokta = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 10),
                new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
            nokta.position.set(p.x, 0.6, p.z);
            this.onizlemeGrup.add(nokta);
        }
    }
    cizimTemizle() {
        if (this.onizlemeGrup) this.onizlemeGrup.clear();
    }

    // OSM düğümlerinden + elle eklenenlerden trafik ışığı, dur/yol ver
    // tabelası, yaya geçidi, kasis nesneleri
    _isaretleriKur(cevre) {
        if (!this.isaretGrup) {
            this.isaretGrup = new THREE.Group();
            this.sahne.add(this.isaretGrup);
        }
        this.isaretGrup.clear();
        const K = this.kazaNoktasi || { x: 0, z: 0 };
        const yakinlar = (cevre.isaretler || [])
            .map(i => ({ ...i, uzaklik: Math.hypot(i.x - K.x, i.z - K.z) }))
            .filter(i => i.elle || i.uzaklik < 400)
            .sort((a, b) => a.uzaklik - b.uzaklik)
            .slice(0, 150);
        if (!yakinlar.length) return;

        const direkMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.6 });
        const direkGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8);
        const beyazMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ea, side: THREE.DoubleSide });

        for (const is of yakinlar) {
            const yakinYolBilgi = enYakinYol(cevre.yollar, is, true);

            // Ortam ögeleri: ağaç, kedi, köpek (elle eklenir)
            if (is.tip === 'agac') {
                const agac = new THREE.Group();
                const govde = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.18, 0.25, 2.6, 8),
                    new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 })
                );
                govde.position.y = 1.3; govde.castShadow = true;
                agac.add(govde);
                const tepe = new THREE.Mesh(
                    new THREE.SphereGeometry(1.7, 12, 12),
                    new THREE.MeshStandardMaterial({ color: 0x3e7d3a, roughness: 0.95 })
                );
                tepe.position.y = 3.6; tepe.castShadow = true;
                agac.add(tepe);
                agac.position.set(is.x, 0, is.z);
                this.isaretGrup.add(agac);
                continue;
            }
            if (is.tip === 'kedi' || is.tip === 'kopek') {
                const olcek = is.tip === 'kedi' ? 0.55 : 1;
                const hayvan = new THREE.Group();
                const kurkMat = new THREE.MeshStandardMaterial({
                    color: is.tip === 'kedi' ? 0x8a8a8a : 0x9c6b3f, roughness: 0.95,
                });
                const govde = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.75), kurkMat);
                govde.position.y = 0.35; govde.castShadow = true;
                hayvan.add(govde);
                const bas = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.26), kurkMat);
                bas.position.set(0, 0.55, 0.45);
                hayvan.add(bas);
                for (const [bx, bz] of [[-0.09, 0.28], [0.09, 0.28], [-0.09, -0.28], [0.09, -0.28]]) {
                    const bacak = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), kurkMat);
                    bacak.position.set(bx, 0.17, bz);
                    hayvan.add(bacak);
                }
                hayvan.scale.setScalar(olcek);
                hayvan.position.set(is.x, 0, is.z);
                hayvan.rotation.y = (is.aci !== undefined && is.aci !== null) ? is.aci : (is.x * 13 + is.z * 7) % 6.28;
                this.isaretGrup.add(hayvan);
                continue;
            }

            if (is.tip === 'duba') {
                const koni = new THREE.Mesh(
                    new THREE.ConeGeometry(0.22, 0.55, 12),
                    new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.7 })
                );
                koni.position.set(is.x, 0.28, is.z);
                koni.castShadow = true;
                this.isaretGrup.add(koni);
                continue;
            }
            if (is.tip === 'konteyner') {
                const kx = new THREE.Mesh(
                    new THREE.BoxGeometry(1.5, 1.25, 0.95),
                    new THREE.MeshStandardMaterial({ color: 0x3a5a40, roughness: 0.8 })
                );
                kx.position.set(is.x, 0.62, is.z);
                kx.castShadow = true;
                kx.rotation.y = (is.aci !== undefined && is.aci !== null) ? is.aci : (yakinYolBilgi ? Math.atan2(yakinYolBilgi.yon.x, yakinYolBilgi.yon.z) : 0);
                this.isaretGrup.add(kx);
                continue;
            }
            if (is.tip === 'bariyer') {
                const bariyer = new THREE.Group();
                const ray = new THREE.Mesh(
                    new THREE.BoxGeometry(0.08, 0.35, 3.2),
                    new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.6, roughness: 0.4 })
                );
                ray.position.y = 0.6; ray.castShadow = true;
                bariyer.add(ray);
                for (const z of [-1.2, 1.2]) {
                    const ayak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.12),
                        new THREE.MeshStandardMaterial({ color: 0x6b7280 }));
                    ayak.position.set(0, 0.3, z);
                    bariyer.add(ayak);
                }
                bariyer.rotation.y = (is.aci !== undefined && is.aci !== null) ? is.aci : (yakinYolBilgi ? Math.atan2(yakinYolBilgi.yon.x, yakinYolBilgi.yon.z) : 0);
                bariyer.position.set(is.x, 0, is.z);
                this.isaretGrup.add(bariyer);
                continue;
            }
            if (is.tip === 'direk') {
                const direkGrubu = new THREE.Group();
                const govde = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 8),
                    new THREE.MeshStandardMaterial({ color: 0x7a7f88, roughness: 0.8 }));
                govde.position.y = 3.75; govde.castShadow = true;
                direkGrubu.add(govde);
                const kol = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08),
                    new THREE.MeshStandardMaterial({ color: 0x555a63 }));
                kol.position.y = 7.1;
                direkGrubu.add(kol);
                direkGrubu.position.set(is.x, 0, is.z);
                this.isaretGrup.add(direkGrubu);
                continue;
            }
            // Levhalı işaretler (standart trafik levhaları + yazılı levha)
            if (LEVHALILAR.has(is.tip)) {
                const tGrup = new THREE.Group();
                // Direk levha merkezine kadar çıkar; tepesi levhayı aşmaz
                const tDirek = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.35, 8), direkMat);
                tDirek.position.y = 1.175;
                tDirek.castShadow = true;
                tGrup.add(tDirek);
                tGrup.add(levhaOlustur(is));
                tGrup.rotation.y = (is.aci !== undefined && is.aci !== null)
                    ? is.aci
                    : (yakinYolBilgi ? Math.atan2(yakinYolBilgi.yon.x, yakinYolBilgi.yon.z) : 0);
                tGrup.position.set(is.x, 0, is.z);
                this.isaretGrup.add(tGrup);
                continue;
            }

            // Yol yüzeyi işaretleri: yaya geçidi ve kasis yol eksenine dizilir
            if (is.tip === 'crossing' || is.tip === 'traffic_calming') {
                if (!yakinYolBilgi || yakinYolBilgi.mesafe > 15) continue;
                const merkez = yakinYolBilgi.konum, yon = yakinYolBilgi.yon;
                const w = yakinYolBilgi.yol.genislik;
                if (is.tip === 'crossing') {
                    // Zebra çizgileri: yol yönüne paralel kısa bantlar, genişlik boyunca dizili
                    const bantSayisi = Math.max(4, Math.floor(w / 0.9));
                    for (let b = 0; b < bantSayisi; b++) {
                        const lateral = -w / 2 + (b + 0.5) * (w / bantSayisi);
                        const r = sag(yon);
                        const orta = { x: merkez.x + r.x * lateral, z: merkez.z + r.z * lateral };
                        const a = { x: orta.x - yon.x * 1.6, z: orta.z - yon.z * 1.6 };
                        const c = { x: orta.x + yon.x * 1.6, z: orta.z + yon.z * 1.6 };
                        this.isaretGrup.add(new THREE.Mesh(seritGeometri([a, c], 0.45, 0.04), beyazMat));
                    }
                } else {
                    // Kasis: yol genişliğince koyu bant
                    const r = sag(yon);
                    const a = { x: merkez.x - r.x * w / 2, z: merkez.z - r.z * w / 2 };
                    const c = { x: merkez.x + r.x * w / 2, z: merkez.z + r.z * w / 2 };
                    this.isaretGrup.add(new THREE.Mesh(
                        seritGeometri([a, c], 0.6, 0.05),
                        new THREE.MeshStandardMaterial({ color: 0x2b2b30, side: THREE.DoubleSide })
                    ));
                }
                continue;
            }

            // Trafik ışığı
            if (is.tip === 'traffic_signals') {
                const grup = new THREE.Group();
                const direk = new THREE.Mesh(direkGeo, direkMat);
                direk.position.y = 1.3;
                direk.castShadow = true;
                grup.add(direk);
                const kutu = new THREE.Mesh(
                    new THREE.BoxGeometry(0.34, 0.95, 0.24),
                    new THREE.MeshStandardMaterial({ color: 0x1c1e22 })
                );
                kutu.position.y = 2.85;
                grup.add(kutu);
                const renkler = [0xef4444, 0xf5c542, 0x22c55e];
                renkler.forEach((renk, i) => {
                    const lamba = new THREE.Mesh(
                        new THREE.SphereGeometry(0.1, 10, 10),
                        new THREE.MeshStandardMaterial({ color: renk, emissive: renk, emissiveIntensity: 0.8 })
                    );
                    lamba.position.set(0, 3.13 - i * 0.28, 0.13);
                    grup.add(lamba);
                });
                grup.rotation.y = (is.aci !== undefined && is.aci !== null)
                    ? is.aci
                    : (yakinYolBilgi ? Math.atan2(yakinYolBilgi.yon.x, yakinYolBilgi.yon.z) : 0);
                grup.position.set(is.x, 0, is.z);
                this.isaretGrup.add(grup);
            }
        }
    }

    // Kaza noktasını taşı: dünya sabit kalır, yalnızca işaret ve
    // yaklaşım referansı değişir. Eski kurulum (araçlar, izler) temizlenir.
    kazaNoktasiAyarla(p) {
        this.kazaNoktasi = { x: p.x, z: p.z };
        this.dinamikGrup.clear();
        this.kurulum = null;
        if (this.isaret) this.isaret.position.set(p.x, 0.05, p.z);
        this.kontrol.target.set(p.x, 0, p.z);
        this.isaretleriYenile(); // görünür işaretler yeni noktaya göre süzülür
    }

    // Kaza noktasına yakın geçen yollardan yaklaşım seçenekleri üret.
    // Yaya yolları da listelenir ama `yaya: true` işaretiyle — araç
    // katılımcılar için arayüz bunları eler, yaya katılımcılar kullanabilir.
    yaklasimlar() {
        const secenekler = [];
        const K = this.kazaNoktasi || { x: 0, z: 0 };
        const YAYA = new Set(['pedestrian', 'footway', 'path', 'cycleway', 'track']);
        for (const yol of this.cevre.yollar) {
            const yayaYolu = YAYA.has(yol.sinif);
            // Kaza noktasına en yakın nokta (parça izdüşümü)
            let enYakin = null, enYakinMesafe = Infinity, enYakinIdx = 0;
            for (let i = 1; i < yol.noktalar.length; i++) {
                const a = yol.noktalar[i - 1], b = yol.noktalar[i];
                const abx = b.x - a.x, abz = b.z - a.z;
                const l2 = abx * abx + abz * abz || 1;
                let t = ((K.x - a.x) * abx + (K.z - a.z) * abz) / l2;
                t = Math.max(0, Math.min(1, t));
                const px = a.x + abx * t, pz = a.z + abz * t;
                const d = Math.hypot(px - K.x, pz - K.z);
                if (d < enYakinMesafe) {
                    enYakinMesafe = d; enYakin = { x: px, z: pz }; enYakinIdx = i;
                }
            }
            if (!enYakin || enYakinMesafe > (yayaYolu ? 60 : 40)) continue;

            // İki gidiş yönü: baştan → yakın nokta, sondan → yakın nokta
            const bastan = yol.noktalar.slice(0, enYakinIdx).concat([enYakin]);
            const sondan = [...yol.noktalar.slice(enYakinIdx)].reverse().concat([enYakin]);
            for (const [pts, yonEtiketi] of [[bastan, 0], [sondan, 1]]) {
                if (pts.length < 2) continue;
                let uz = 0;
                for (let i = 1; i < pts.length; i++) uz += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
                if (uz < 15) continue;
                const gelis = pusula(pts[0].x - enYakin.x, pts[0].z - enYakin.z);
                secenekler.push({
                    etiket: `${yol.ad}${yayaYolu ? ' (yaya yolu)' : ''} — ${gelis} yönünden`,
                    noktalar: pts,
                    genislik: yol.genislik,
                    seritSayisi: yol.seritSayisi,
                    tekYon: yol.tekYon,
                    hizLimiti: yol.hizLimiti,
                    yuzey: yol.yuzey,
                    yaya: yayaYolu,
                    anahtar: `${yol.id}-${yonEtiketi}`,
                });
            }
        }
        return secenekler;
    }

    // Yaya için ek seçenekler: kaza noktasındaki yolu dik kesen
    // "karşıdan karşıya geçiş" rotaları (iki taraftan).
    yayaGecisleri() {
        const K = this.kazaNoktasi || { x: 0, z: 0 };
        const yakin = enYakinYol(this.cevre.yollar, K, true);
        if (!yakin || yakin.mesafe > 40) return [];
        const r = sag(yakin.yon);
        const uzunluk = Math.max(25, yakin.yol.genislik + 15);
        const yap = (isaret, etiket) => ({
            etiket,
            noktalar: [
                { x: K.x + r.x * isaret * uzunluk, z: K.z + r.z * isaret * uzunluk },
                { x: K.x, z: K.z },
            ],
            genislik: 2, seritSayisi: 1, tekYon: true,
            hizLimiti: null, yuzey: null, yaya: true,
            anahtar: `gecis-${isaret > 0 ? 'sag' : 'sol'}`,
        });
        return [
            yap(1, `Karşıdan karşıya geçiş — ${pusula(r.x, r.z)} tarafından`),
            yap(-1, `Karşıdan karşıya geçiş — ${pusula(-r.x, -r.z)} tarafından`),
        ];
    }

    // ---- kaza kurulumu ----
    // cfg.A / cfg.B: { v0 (m/s), mu, izUzunlugu, reaksiyon, kutle, yaklasim (secenek nesnesi), renk }
    kur(cfg) {
        this.dinamikGrup.clear();
        const araclar = {};

        // Çarpışma noktası HER ZAMAN kullanıcının işaretlediği noktadır.
        // Yaklaşım yolları şerit ofsetini son metrelerde sıfıra indirerek
        // tam bu noktaya yakınsar — nokta yol dışına/ortalamaya kaymaz.
        const P = { x: this.kazaNoktasi.x, z: this.kazaNoktasi.z };

        for (const ad of ['A', 'B']) {
            const c = cfg[ad];
            const ofset = c.tip === 'yaya' ? 0 : seritOfseti(c.yaklasim);
            // Şeritten taşma sığ açıyla olur: geçiş mesafesi ofsetin ~10 katı
            // (≈6°) — araç 'düz gidip son anda 45° kırmaz', doğal kavisle gelir
            const OFSET_GECIS = Math.max(18, ofset * 10);
            const ham = c.yaklasim.noktalar;

            // Her noktanın yol sonuna (çarpışma ucuna) yay uzaklığı
            const sonaUzaklik = new Array(ham.length).fill(0);
            for (let i = ham.length - 2; i >= 0; i--) {
                sonaUzaklik[i] = sonaUzaklik[i + 1] +
                    Math.hypot(ham[i + 1].x - ham[i].x, ham[i + 1].z - ham[i].z);
            }

            const ptsP = ham.map((p, i, dizi) => {
                const q = dizi[Math.max(0, i - 1)], b = dizi[Math.min(dizi.length - 1, i + 1)];
                let dx = b.x - q.x, dz = b.z - q.z;
                const l = Math.hypot(dx, dz) || 1;
                const r = sag({ x: dx / l, z: dz / l });
                const etkinOfset = ofset * Math.min(1, sonaUzaklik[i] / OFSET_GECIS);
                return { x: p.x + r.x * etkinOfset, z: p.z + r.z * etkinOfset };
            });
            ptsP.push({ x: P.x, z: P.z }); // son parça işaretli noktaya bağlanır
            araclar[ad] = { ...c, yol: yolParametrele(ptsP) };
        }
        this.isaret.position.set(P.x, 0.05, P.z);

        // Zamanlama: iki araç da t = Timp anında çarpışma noktasında
        const TEMEL_SEYIR = 2.5;
        for (const ad of ['A', 'B']) {
            const a = araclar[ad];
            a.a = a.mu * G;
            // Etkin fren mesafesi fiziksel üst sınırla kısıtlanır: girilen iz,
            // o hızda durma mesafesinden uzunsa hareket denklemi süreksizleşip
            // araç 'ileri sıçrayıp geri geliyor' gibi görünüyordu.
            a.izEtkin = Math.min(a.izUzunlugu, (a.v0 * a.v0) / (2 * a.a));
            a.vi = frenSonrasiHiz(a.v0, a.mu, a.izEtkin);
            a.tFren = (a.v0 - a.vi) / a.a;
            a.dReak = a.v0 * a.reaksiyon;
            a.temelSure = a.tFren + a.reaksiyon + TEMEL_SEYIR;
        }
        const Timp = Math.max(araclar.A.temelSure, araclar.B.temelSure);
        for (const ad of ['A', 'B']) {
            const a = araclar[ad];
            a.tSeyir = TEMEL_SEYIR + (Timp - a.temelSure);
            // t' (çarpışmaya kalan süre) → çarpışma noktasından geri mesafe
            a.geriMesafe = (tk) => {
                if (tk <= a.tFren) return a.vi * tk + 0.5 * a.a * tk * tk;
                if (tk <= a.tFren + a.reaksiyon) return a.izEtkin + a.v0 * (tk - a.tFren);
                return a.izEtkin + a.dReak + a.v0 * (tk - a.tFren - a.reaksiyon);
            };
        }

        // Çarpma anı hız vektörleri ve çarpışma sonrası hareket
        for (const ad of ['A', 'B']) {
            const a = araclar[ad];
            a.onOfset = a.tip === 'yaya'
                ? 0.4
                : ((ARAC_TURLERI[a.tur] || ARAC_TURLERI.otomobil).boy / 2 + 0.05); // merkez-burun
            const k = a.yol.konum(0.01);
            a.carpYon = k.yon;
            a.carpVec = { x: k.yon.x * a.vi, z: k.yon.z * a.vi };
            a.carpKonum = a.yol.konum(a.onOfset); // merkez, burnu kadar geride
        }
        // Temas normali: A merkezinden B merkezine (çarpma anındaki konumlar)
        let nx = araclar.B.carpKonum.x - araclar.A.carpKonum.x;
        let nz = araclar.B.carpKonum.z - araclar.A.carpKonum.z;
        const nUzunluk = Math.hypot(nx, nz);
        const temasNormali = nUzunluk > 0.15
            ? { x: nx / nUzunluk, z: nz / nUzunluk }
            : araclar.A.carpYon;
        const carpisma = carpisma2B(araclar.A.kutle, araclar.A.carpVec, araclar.B.kutle, araclar.B.carpVec, 0.22, temasNormali);
        for (const [ad, vs, isaret] of [['A', carpisma.v1s, -1], ['B', carpisma.v2s, 1]]) {
            const a = araclar[ad];
            a.sonrasiHiz = Math.hypot(vs.x, vs.z);
            a.sonrasiYon = a.sonrasiHiz > 0.05
                ? { x: vs.x / a.sonrasiHiz, z: vs.z / a.sonrasiHiz }
                : a.carpYon;
            a.sonrasiIvme = 0.6 * a.mu * G;
            a.tDur = a.sonrasiHiz / a.sonrasiIvme;
            // Dönme fizikten gelir: itkinin araç merkezine göre moment kolu.
            // Merkezî kafa kafaya çarpmada ≈ 0; yandan/açılı çarpmada araç
            // gerçekçi biçimde savrulup döner. I: kutu atalet momenti.
            const T = a.tip === 'yaya' ? { boy: 0.6, en: 0.6 } : (ARAC_TURLERI[a.tur] || ARAC_TURLERI.otomobil);
            const atalet = a.kutle * (T.boy * T.boy + T.en * T.en) / 12;
            const J = { x: isaret * (carpisma.j || 0) * temasNormali.x, z: isaret * (carpisma.j || 0) * temasNormali.z };
            const r = { x: P.x - a.carpKonum.x, z: P.z - a.carpKonum.z };
            const omega = (r.z * J.x - r.x * J.z) / Math.max(atalet, 1);
            a.donmeHizi = Math.max(-2.8, Math.min(2.8, omega));
            a.deltaV = Math.hypot(vs.x - a.carpVec.x, vs.z - a.carpVec.z);
        }

        // Araç/yaya ve fren izi ağları
        for (const ad of ['A', 'B']) {
            const a = araclar[ad];
            a.mesh = a.tip === 'yaya' ? yayaOlustur(a.renk) : aracOlustur(a.renk, a.tur, a.plaka);
            // Üstte süzülen kimlik: "A • 34 ABC 123"
            const etiketMetni = ad + (a.plaka ? ' • ' + a.plaka.toUpperCase() : '');
            const sprite = etiketSprite(etiketMetni, a.renk);
            sprite.position.y = (a.tip === 'yaya' ? 2.0 : (ARAC_TURLERI[a.tur] || ARAC_TURLERI.otomobil).yuk) + 1.2;
            a.mesh.add(sprite);
            this.dinamikGrup.add(a.mesh);

            if (a.tip !== 'yaya' && a.izEtkin > 0.3) {
                const adim = 0.5;
                const sol = [], sagS = [];
                for (let s = a.izEtkin; s >= 0; s -= adim) {
                    const k = a.yol.konum(s + a.onOfset);
                    const r = sag(k.yon);
                    sol.push({ x: k.x - r.x * 0.75, z: k.z - r.z * 0.75 });
                    sagS.push({ x: k.x + r.x * 0.75, z: k.z + r.z * 0.75 });
                }
                const izMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1d, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
                a.izler = [sol, sagS].map(pts => {
                    const m = new THREE.Mesh(seritGeometri(pts, 0.3, 0.045), izMat);
                    this.dinamikGrup.add(m);
                    return m;
                });
                a.izAdim = adim;
            }
        }

        // Çarpışma efekti
        this.kivilcim = new THREE.Mesh(
            new THREE.SphereGeometry(1, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.9 })
        );
        this.kivilcim.position.set(P.x, 1, P.z);
        this.kivilcim.visible = false;
        this.dinamikGrup.add(this.kivilcim);

        const tDurMax = Math.max(araclar.A.tDur, araclar.B.tDur);
        this.kurulum = { araclar, P, Timp };
        this.sure = Timp + tDurMax + 1.5;
        this.kontrol.target.set(P.x, 0, P.z);
        this.zaman(0);
        return {
            Timp,
            sure: this.sure,
            P,
            A: this._aracOzet(araclar.A),
            B: this._aracOzet(araclar.B),
        };
    }

    _aracOzet(a) {
        return {
            v0: a.v0, vi: a.vi, izUzunlugu: a.izUzunlugu, mu: a.mu,
            reaksiyon: a.reaksiyon, kutle: a.kutle, deltaV: a.deltaV,
            sonrasiHiz: a.sonrasiHiz, etiket: a.yaklasim.etiket, tip: a.tip || 'arac',
        };
    }

    // ---- zaman kontrolü (kapalı form; ileri-geri sarılabilir) ----
    zaman(t) {
        if (!this.kurulum) return;
        this.t = Math.max(0, Math.min(this.sure, t));
        const { araclar, Timp } = this.kurulum;

        for (const ad of ['A', 'B']) {
            const a = araclar[ad];
            const tk = Timp - this.t;
            if (tk >= 0) {
                // Çarpışma öncesi: yol üzerinde
                const s = a.geriMesafe(tk);
                const k = a.yol.konum(s + a.onOfset);
                a.mesh.position.set(k.x, 0, k.z);
                a.mesh.rotation.set(0, Math.atan2(k.yon.x, k.yon.z), 0);
                // Fren izi: frenleme başladıysa aracın gerisinde kalan kısım görünür
                if (a.izler) {
                    const gorunen = Math.max(0, Math.min(a.izEtkin, a.izEtkin - s));
                    const kuadSayisi = Math.floor(gorunen / a.izAdim);
                    for (const iz of a.izler) iz.geometry.setDrawRange(0, kuadSayisi * 6);
                }
            } else {
                // Çarpışma sonrası: savrulma (kapalı form)
                const tp = Math.min(-tk, a.tDur);
                const mesafe = a.sonrasiHiz * tp - 0.5 * a.sonrasiIvme * tp * tp;
                a.mesh.position.set(
                    a.carpKonum.x + a.sonrasiYon.x * mesafe, 0,
                    a.carpKonum.z + a.sonrasiYon.z * mesafe
                );
                const donme = a.tDur > 0 ? a.donmeHizi * (tp - tp * tp / (2 * a.tDur)) : 0;
                // Yaya çarpışma sonrası yere düşer (kademeli yatma)
                const yatma = a.tip === 'yaya' && a.sonrasiHiz > 1
                    ? -(Math.PI / 2) * Math.min(1, tp / Math.max(a.tDur, 0.4)) : 0;
                a.mesh.rotation.set(yatma, Math.atan2(a.carpYon.x, a.carpYon.z) + donme, 0);
                if (a.izler) for (const iz of a.izler) iz.geometry.setDrawRange(0, Infinity);
            }
        }

        // Çarpışma parlaması
        const fark = this.t - Timp;
        this.kivilcim.visible = fark > -0.05 && fark < 0.35;
        if (this.kivilcim.visible) {
            const olcek = 1 + fark * 6;
            this.kivilcim.scale.setScalar(Math.max(0.3, olcek));
            this.kivilcim.material.opacity = Math.max(0, 0.9 - fark * 2.5);
        }

        if (this.onZaman) this.onZaman(this.t, this.sure);
    }

    oynat() { this.oynuyor = true; if (this.t >= this.sure - 0.01) this.zaman(0); }
    duraklat() { this.oynuyor = false; }

    _dongu() {
        requestAnimationFrame(() => this._dongu());
        const simdi = performance.now();
        const dt = Math.min(0.05, (simdi - this._sonAn) / 1000);
        this._sonAn = simdi;

        if (this.oynuyor && this.kurulum) {
            this.zaman(this.t + dt * this.oynatmaHizi);
            if (this.t >= this.sure) this.oynuyor = false;
        }

        // Kamera modları
        if (this.kurulum && (this.kameraModu === 'A' || this.kameraModu === 'B')) {
            const m = this.kurulum.araclar[this.kameraModu].mesh;
            const geri = new THREE.Vector3(0, 0, -1).applyQuaternion(m.quaternion);
            const hedefKonum = m.position.clone().addScaledVector(geri, 15).add(new THREE.Vector3(0, 8, 0));
            this.kamera.position.lerp(hedefKonum, 0.08);
            this.kontrol.target.lerp(m.position.clone().setY(1), 0.15);
        }
        this.kontrol.update();

        // Kaza noktası işareti nabız efekti
        if (this.isaret) {
            const p = 1 + 0.12 * Math.sin(simdi / 300);
            this.isaret.scale.setScalar(p);
        }

        this.cizici.render(this.sahne, this.kamera);
    }

    kameraModuAyarla(mod) {
        this.kameraModu = mod;
        const P = this.kurulum ? this.kurulum.P : this.kazaNoktasi;
        if (mod === 'ustten') {
            this.kamera.position.set(P.x, 130, P.z + 1);
            this.kontrol.target.set(P.x, 0, P.z);
        } else if (mod === 'serbest') {
            this.kamera.position.set(P.x + 45, 42, P.z + 45);
            this.kontrol.target.set(P.x, 0, P.z);
        }
    }
}
