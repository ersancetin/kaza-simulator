// Uygulama akışı: harita ekranı ↔ simülasyon ekranı, form yönetimi,
// hesaplama, kusur analizi ve rapor üretimi.
// Taraflar araç veya yaya olabilir; kaza noktası sahneden taşınabilir.

import { haritayiBaslat, aramaKur, konumaGit, cevreVerisiGetir, varsayilanCevre, yolaHizala } from './map.js?v=2.7';
import { YUZEYLER, kmh2ms, ms2kmh, izdenHiz, frenMesafesi, durusMesafesi, siddetEtiketi } from './physics.js?v=2.7';
import { IHLALLER, YAYA_IHLALLERI, kusurHesapla } from './kusur.js?v=2.7';
import { Simulasyon, ARAC_TURLERI } from './sim3d.js?v=2.7';

const SURUM = 'v2.7';
const $ = (id) => document.getElementById(id);
$('surum').textContent = SURUM;

// Satır içi SVG ikonlar (tutarlı çizgi stili, dış bağımlılık yok)
const IKON = {
    oynat: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.04 1.04 0 0 0 0-1.76l-11-6.86A1.04 1.04 0 0 0 8 5.14z"/></svg>',
    duraklat: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    foto: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    hedef: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    kapat: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const oynatDugmesi = (oynuyor) => { $('btn-oynat').innerHTML = oynuyor ? IKON.duraklat : IKON.oynat; };

// Düğmelere ikonları yerleştir
$('btn-foto').innerHTML = IKON.foto + '<span>Fotoğraf</span>';
$('btn-hesapla').innerHTML = IKON.oynat + '<span>Hesapla ve Canlandır</span>';
$('btn-nokta-tasi').innerHTML = IKON.hedef + '<span>Çarpışma Noktasını Sahneden Seç</span>';
oynatDugmesi(false);

let secilenKonum = null;
let sim = null;
let sonSonuc = null;    // { fizik, kusur, girdiler }
let cevreVeri = null;   // yüklü çevre (yol/bina/işaret) verisi
let kazaNoktasi = { x: 0, z: 0 };
const secenekListeleri = { A: [], B: [] };  // katılımcıya göre yaklaşım listeleri
const katilimciTipi = { A: 'arac', B: 'arac' };

const RENKLER = { A: 0x3b82f6, B: 0xf97316 };
const RENK_CSS = { A: '#3b82f6', B: '#f97316' };

// ================= HARİTA EKRANI =================
function konumGuncelle(k) {
    secilenKonum = k;
    $('konum-kart').classList.remove('gizli');
    $('konum-kart-adres').textContent = k.adres;
    $('konum-kart-koordinat').textContent = `${k.lat.toFixed(6)}, ${k.lon.toFixed(6)}`;
}

haritayiBaslat(konumGuncelle);
aramaKur($('arama-girdi'), $('arama-sonuclar'), (lat, lon, adres) => konumaGit(lat, lon, adres, konumGuncelle));

// ================= SİMÜLASYONA GEÇİŞ =================
$('btn-simulasyona-git').addEventListener('click', async () => {
    if (!secilenKonum) return;
    $('ekran-harita').classList.remove('aktif');
    $('ekran-sim').classList.add('aktif');
    $('sim-konum-adi').textContent = secilenKonum.adres;
    $('sim-yukleniyor').classList.remove('gizli');

    if (!sim) sim = new Simulasyon($('sahne-kap'));

    // Gerçek yol verisini çek; başarısızlık nedenini ayırt ederek bildir
    let cevre = null, durumNotu = '', nokta = { x: 0, z: 0 };
    try {
        cevre = await cevreVerisiGetir(secilenKonum.lat, secilenKonum.lon);
        if (!cevre.yollar.length) {
            cevre = null;
            durumNotu = ' (900 m çevrede kayıtlı yol bulunamadı — temsili kavşak)';
        }
    } catch (e) {
        console.error('Overpass hatası:', e);
        durumNotu = ' (yol verisi sunucusuna ulaşılamadı — temsili kavşak)';
    }
    if (cevre) {
        // Seçilen nokta yol üzerinde olmayabilir; yalnızca uzaksa en yakın yola alınır
        const hiza = yolaHizala(cevre);
        if (!hiza) {
            cevre = null;
            durumNotu = ' (seçilen nokta yollardan çok uzak — temsili kavşak)';
        } else {
            nokta = hiza.nokta;
            if (!hiza.tam) durumNotu = ` (seçilen nokta yola uzak olduğundan ${Math.round(hiza.kaymaMetre)} m ötedeki en yakın yol noktası kullanıldı)`;
        }
    }
    if (!cevre) { cevre = varsayilanCevre(); nokta = { x: 0, z: 0 }; }
    cevreVeri = cevre;

    sim.cevreKur(cevre);
    noktayiUygula(nokta);
    if (!secenekListeleri.A.length) {
        // Kullanılabilir yaklaşım yoksa jenerik kavşağa düş
        cevreVeri = varsayilanCevre();
        sim.cevreKur(cevreVeri);
        noktayiUygula({ x: 0, z: 0 });
        durumNotu = ' (yol geometrisi simülasyona uygun değil — temsili kavşak)';
    }
    $('sim-yukleniyor').classList.add('gizli');
    $('sim-konum-adi').textContent = secilenKonum.adres + durumNotu;
});

// Kaza noktasını uygula: işaret oraya gider, yaklaşım listeleri yenilenir.
// Dünya SABİT kalır — geometri kaydırılmaz.
function noktayiUygula(p) {
    kazaNoktasi = { x: p.x, z: p.z };
    sim.kazaNoktasiAyarla(kazaNoktasi);
    listeleriYenile();
}

function listeleriYenile() {
    const hepsi = sim.yaklasimlar();
    const yayaEkstra = sim.yayaGecisleri();
    for (const ad of ['A', 'B']) {
        secenekListeleri[ad] = katilimciTipi[ad] === 'yaya'
            ? [...yayaEkstra, ...hepsi]
            : hepsi.filter(y => !y.yaya);
        const sel = $(`${ad}-yaklasim`);
        const onceki = sel.value;
        sel.innerHTML = secenekListeleri[ad].map((y, i) => `<option value="${i}">${y.etiket}</option>`).join('');
        if (onceki && parseInt(onceki) < secenekListeleri[ad].length) sel.value = onceki;
    }
    // Araç-araç ise mümkünse farklı yollardan gelsinler
    if (katilimciTipi.B === 'arac' && secenekListeleri.B.length > 1) {
        const ilkAnahtar = secenekListeleri.B[0].anahtar.split('-')[0];
        const farkli = secenekListeleri.B.findIndex(y => y.anahtar.split('-')[0] !== ilkAnahtar);
        $('B-yaklasim').value = farkli > 0 ? farkli : 1;
    }
    yolVerileriniUygula();
}

$('btn-haritaya-don').addEventListener('click', () => {
    $('ekran-sim').classList.remove('aktif');
    $('ekran-harita').classList.add('aktif');
});

// ============ ÇARPIŞMA NOKTASINI SAHNEDEN TAŞIMA ============
let noktaSecimAktif = false;
const noktaTasiSifirla = () => {
    noktaSecimAktif = false;
    $('btn-nokta-tasi').innerHTML = IKON.hedef + '<span>Çarpışma Noktasını Sahneden Seç</span>';
    if (sim) sim.sahneSecimBitir();
};
$('btn-nokta-tasi').addEventListener('click', () => {
    if (!sim || !cevreVeri) return;
    isaretModuSifirla();
    cizimSifirla();
    if (noktaSecimAktif) { noktaTasiSifirla(); return; }
    noktaSecimAktif = true;
    $('btn-nokta-tasi').innerHTML = IKON.kapat + '<span>İptal — sahnede yeni noktaya tıklayın</span>';
    sim.sahneSecimBaslat((p) => {
        noktaTasiSifirla();
        const hiza = yolaHizala(cevreVeri, 400, p);
        if (!hiza) {
            $('sim-konum-adi').textContent = secilenKonum.adres + ' (tıklanan noktanın yakınında yol yok — nokta değişmedi)';
            return;
        }
        noktayiUygula(hiza.nokta);
        if (!secenekListeleri.A.length && !secenekListeleri.B.length) {
            $('sim-konum-adi').textContent = secilenKonum.adres + ' (bu noktada uygun yaklaşım yok — başka nokta seçin)';
            return;
        }
        $('zaman-bar').classList.add('gizli');
        $('sim-konum-adi').textContent = secilenKonum.adres + (hiza.tam
            ? ' (çarpışma noktası tıklanan yere taşındı)'
            : ` (çarpışma noktası taşındı — tıklanan yer yola uzak olduğundan ${Math.round(hiza.kaymaMetre)} m ötedeki yol noktası kullanıldı)`);
    });
});

$('btn-panel-gizle').addEventListener('click', () => {
    const p = $('panel');
    p.classList.toggle('kapali');
    $('btn-panel-gizle').textContent = p.classList.contains('kapali') ? 'Paneli Göster' : 'Paneli Gizle';
});

// ============ ELLE İŞARET EKLEME ============
let aktifIsaretTipi = null;
function isaretModuSifirla() {
    aktifIsaretTipi = null;
    document.querySelectorAll('.isaret-btn').forEach(b => b.classList.remove('secili'));
    if (sim && !noktaSecimAktif) sim.sahneSecimBitir();
}

document.querySelectorAll('.isaret-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!sim || !cevreVeri) return;
        noktaTasiSifirla();
        cizimSifirla();
        const tip = btn.dataset.isaret;
        if (aktifIsaretTipi === tip) { isaretModuSifirla(); return; }
        isaretModuSifirla();
        // Yazılı/hız tabelaları için içerik önceden sorulur
        let meta = {};
        if (tip === 'ozel-tabela') {
            const metin = prompt('Tabela üzerinde ne yazsın?', 'OKUL BÖLGESİ');
            if (!metin) return;
            meta.metin = metin;
        } else if (tip === 'hiz-tabela') {
            const deger = parseInt(prompt('Hız limiti (km/s):', '50'));
            if (!deger) return;
            meta.deger = deger;
        }
        aktifIsaretTipi = tip;
        btn.classList.add('secili');
        sim.sahneSecimBaslat((p) => {
            // Mod açık kalır: aynı tipten arka arkaya (yan yana) yerleştirilebilir;
            // bitirmek için düğmeye tekrar basılır veya başka mod seçilir.
            cevreVeri.isaretler = cevreVeri.isaretler || [];
            let kayit = { tip, x: p.x, z: p.z, elle: true, ...meta };
            if (DIREKLILER.includes(tip)) {
                const yer = sim.kenaraYerlestir(p);
                kayit = { ...kayit, x: yer.x, z: yer.z, aci: yer.aci };
            } else if (tip === 'bariyer') {
                // Zincirleme: yakında bariyer varsa üstüne binme, ucuna eklen
                const BARIYER_BOY = 3.2;
                const eskiler = cevreVeri.isaretler.filter(i => i.elle && i.tip === 'bariyer');
                let enYakinB = null, dMin = Infinity;
                for (const b of eskiler) {
                    const d = Math.hypot(b.x - p.x, b.z - p.z);
                    if (d < dMin) { dMin = d; enYakinB = b; }
                }
                if (enYakinB && dMin < BARIYER_BOY * 2) {
                    const aci = enYakinB.aci ?? sim.yolAcisi(enYakinB);
                    const dir = { x: Math.sin(aci), z: Math.cos(aci) };
                    const taraf = ((p.x - enYakinB.x) * dir.x + (p.z - enYakinB.z) * dir.z) >= 0 ? 1 : -1;
                    // Zincirin o yöndeki en uç bariyerini bul, onun ucuna ekle
                    let uc = enYakinB;
                    for (const b of eskiler) {
                        const iler = (b.x - enYakinB.x) * dir.x + (b.z - enYakinB.z) * dir.z;
                        const ucIler = (uc.x - enYakinB.x) * dir.x + (uc.z - enYakinB.z) * dir.z;
                        if (taraf * iler > taraf * ucIler && Math.abs(iler) < 200) uc = b;
                    }
                    kayit = { ...kayit, x: uc.x + dir.x * BARIYER_BOY * taraf, z: uc.z + dir.z * BARIYER_BOY * taraf, aci };
                } else {
                    kayit.aci = sim.yolAcisi(p);
                }
            }
            cevreVeri.isaretler.push(kayit);
            sim.isaretleriYenile();
            elleIsaretListesiCiz();
            yolVerileriniUygula();
        });
    });
});

function elleIsaretListesiCiz() {
    const kap = $('elle-isaret-liste');
    const elle = (cevreVeri && cevreVeri.isaretler ? cevreVeri.isaretler : []).filter(i => i.elle);
    kap.innerHTML = elle.length
        ? elle.map((i, n) => `<div class="ekli-satir">
            <span>${ISARET_ADLARI[i.tip] || i.tip}${i.metin ? ' — "' + i.metin + '"' : ''}${i.deger ? ' — ' + i.deger : ''}</span>
            <span class="ekli-eylemler">
                <button type="button" class="mini-btn isaret-dondur" data-n="${n}" title="45° döndür">Döndür</button>
                <button type="button" class="mini-btn mini-btn--sil isaret-sil" data-n="${n}">Sil</button>
            </span>
          </div>`).join('')
        : '<span class="ekli-bos">Eklenen öge yok. Yukarıdan tip seçip sahneye tıklayın.</span>';
    const elleKayitlar = () => cevreVeri.isaretler.filter(i => i.elle);
    kap.querySelectorAll('.isaret-sil').forEach(b => b.addEventListener('click', () => {
        const hedef = elleKayitlar()[parseInt(b.dataset.n)];
        cevreVeri.isaretler = cevreVeri.isaretler.filter(i => i !== hedef);
        sim.isaretleriYenile();
        elleIsaretListesiCiz();
        yolVerileriniUygula();
    }));
    kap.querySelectorAll('.isaret-dondur').forEach(b => b.addEventListener('click', () => {
        const hedef = elleKayitlar()[parseInt(b.dataset.n)];
        if (!hedef) return;
        hedef.aci = ((hedef.aci ?? 0) + Math.PI / 4) % (Math.PI * 2);
        sim.isaretleriYenile();
    }));
}
elleIsaretListesiCiz();

// ================= FORMLAR =================
function yuzeyleriDoldur() {
    const sel = $('g-yuzey');
    sel.innerHTML = YUZEYLER.map(y => `<option value="${y.id}">${y.ad} (µ≈${y.mu})</option>`).join('');
    sel.addEventListener('change', () => {
        const y = YUZEYLER.find(v => v.id === sel.value);
        if (y) $('g-mu').value = y.mu;
    });
    $('g-mu').value = YUZEYLER[0].mu;
}
yuzeyleriDoldur();

function katilimciFormuOlustur(ad, varsayilanHiz) {
    const kap = $(`bolum-arac-${ad}`);
    kap.innerHTML = `
        <h3><span class="renk" style="background:${RENK_CSS[ad]}"></span>Taraf ${ad}</h3>
        <div class="mod-secim">
            <button type="button" id="${ad}-tip-arac" class="secili">Araç</button>
            <button type="button" id="${ad}-tip-yaya">Yaya</button>
        </div>
        <div class="alan-satir" id="${ad}-tur-plaka">
            <label class="alan">
                <span>Araç türü</span>
                <select id="${ad}-tur">
                    ${Object.entries(ARAC_TURLERI).map(([k, t]) => `<option value="${k}">${t.ad}</option>`).join('')}
                </select>
            </label>
            <label class="alan">
                <span>Plaka (opsiyonel)</span>
                <input id="${ad}-plaka" type="text" maxlength="10" placeholder="34 ABC 123">
            </label>
        </div>
        <label class="alan">
            <span>Geliş yönü / yol</span>
            <select id="${ad}-yaklasim"></select>
        </label>
        <div class="mod-secim" id="${ad}-hiz-mod">
            <button type="button" id="${ad}-mod-hiz" class="secili">Hız biliniyor</button>
            <button type="button" id="${ad}-mod-iz">Fren izinden hesapla</button>
        </div>
        <div class="alan-satir">
            <label class="alan" id="${ad}-hiz-alan">
                <span>Hız (km/s)</span>
                <input id="${ad}-hiz" type="number" min="1" max="220" step="1" value="${varsayilanHiz}">
            </label>
            <label class="alan" id="${ad}-iz-alan">
                <span>Fren izi (m)</span>
                <input id="${ad}-iz" type="number" min="0" max="150" step="0.5" value="10">
            </label>
        </div>
        <div class="alan-satir">
            <label class="alan gizli" id="${ad}-ees-alan">
                <span>İz sonu hızı / EES (km/s)</span>
                <input id="${ad}-ees" type="number" min="0" max="150" step="5" value="0">
            </label>
        </div>
        <div class="alan-satir">
            <label class="alan">
                <span id="${ad}-kutle-etiket">Araç kütlesi (kg)</span>
                <input id="${ad}-kutle" type="number" min="20" max="40000" step="5" value="1300">
            </label>
            <label class="alan" id="${ad}-reaksiyon-alan">
                <span>Reaksiyon süresi (s)</span>
                <input id="${ad}-reaksiyon" type="number" min="0" max="3" step="0.1" value="1.0">
            </label>
        </div>
        <div class="alan"><span>Kural ihlalleri (kusur değerlendirmesi için)</span></div>
        <div id="${ad}-ihlaller-arac">
            ${IHLALLER.map(i => `<label class="onay"><input type="checkbox" id="${ad}-ihlal-${i.id}"> ${i.ad}</label>`).join('')}
        </div>
        <div id="${ad}-ihlaller-yaya" class="gizli">
            ${YAYA_IHLALLERI.map(i => `<label class="onay"><input type="checkbox" id="${ad}-ihlal-${i.id}"> ${i.ad}</label>`).join('')}
        </div>
    `;
    $(`${ad}-mod-hiz`).addEventListener('click', () => modAyarla(ad, 'hiz'));
    $(`${ad}-mod-iz`).addEventListener('click', () => modAyarla(ad, 'iz'));
    $(`${ad}-tip-arac`).addEventListener('click', () => tipAyarla(ad, 'arac'));
    $(`${ad}-tip-yaya`).addEventListener('click', () => tipAyarla(ad, 'yaya'));
    $(`${ad}-tur`).addEventListener('change', () => {
        const t = ARAC_TURLERI[$(`${ad}-tur`).value];
        if (t) $(`${ad}-kutle`).value = t.kutle;
    });
}

function tipAyarla(ad, tip) {
    if (katilimciTipi[ad] === tip) return;
    katilimciTipi[ad] = tip;
    const yaya = tip === 'yaya';
    $(`${ad}-tip-arac`).classList.toggle('secili', !yaya);
    $(`${ad}-tip-yaya`).classList.toggle('secili', yaya);
    // Yayada fren izi / EES / reaksiyon alanları anlamsız
    $(`${ad}-hiz-mod`).classList.toggle('gizli', yaya);
    $(`${ad}-iz-alan`).classList.toggle('gizli', yaya);
    $(`${ad}-ees-alan`).classList.add('gizli');
    $(`${ad}-reaksiyon-alan`).classList.toggle('gizli', yaya);
    $(`${ad}-ihlaller-arac`).classList.toggle('gizli', yaya);
    $(`${ad}-ihlaller-yaya`).classList.toggle('gizli', !yaya);
    if (yaya) { modAyarla(ad, 'hiz'); }
    $(`${ad}-tur-plaka`).classList.toggle('gizli', yaya);
    $(`${ad}-kutle-etiket`).textContent = yaya ? 'Yaya kütlesi (kg)' : 'Araç kütlesi (kg)';
    $(`${ad}-kutle`).value = yaya ? 75 : (ARAC_TURLERI[$(`${ad}-tur`).value] || ARAC_TURLERI.otomobil).kutle;
    $(`${ad}-hiz`).value = yaya ? 5 : (ad === 'A' ? 60 : 50);
    if (sim && cevreVeri) listeleriYenile();
}

function modAyarla(ad, mod) {
    $(`${ad}-mod-hiz`).classList.toggle('secili', mod === 'hiz');
    $(`${ad}-mod-iz`).classList.toggle('secili', mod === 'iz');
    $(`${ad}-hiz-alan`).classList.toggle('gizli', mod === 'iz');
    $(`${ad}-ees-alan`).classList.toggle('gizli', mod === 'hiz' || katilimciTipi[ad] === 'yaya');
}

function katilimciModu(ad) {
    return $(`${ad}-mod-iz`).classList.contains('secili') && katilimciTipi[ad] === 'arac' ? 'iz' : 'hiz';
}

katilimciFormuOlustur('A', 60);
katilimciFormuOlustur('B', 50);
$('A-yaklasim').addEventListener('change', yolVerileriniUygula);

// OSM yüzey etiketi → yüzey seçimimiz
const YUZEY_ESLEME = {
    asphalt: 'kuru-asfalt', paved: 'kuru-asfalt', concrete: 'kuru-beton',
    'concrete:plates': 'kuru-beton', paving_stones: 'kuru-beton',
    gravel: 'stabilize', fine_gravel: 'stabilize', compacted: 'stabilize',
    dirt: 'stabilize', ground: 'stabilize', earth: 'stabilize', unpaved: 'stabilize',
};

const ISARET_ADLARI = {
    traffic_signals: 'Trafik ışığı', stop: 'Dur levhası',
    give_way: 'Yol ver levhası', crossing: 'Yaya geçidi', traffic_calming: 'Kasis',
    agac: 'Ağaç', kedi: 'Kedi', kopek: 'Köpek',
    duba: 'Duba', bariyer: 'Bariyer', direk: 'Elektrik direği', konteyner: 'Konteyner',
    'ozel-tabela': 'Yazılı levha', 'hiz-tabela': 'Hız limiti levhası',
    'sollama-yasak': 'Sollama yasağı levhası', 'park-yasak': 'Park yasağı levhası',
    'giris-yok': 'Girişi olmayan yol levhası',
};
const ORTAM_OGELERI = ['agac', 'kedi', 'kopek', 'duba', 'bariyer', 'direk', 'konteyner'];
// Direk + levha ile kurulanlar: yol kenarına, trafiğe dönük yerleştirilir
const DIREKLILER = ['traffic_signals', 'stop', 'give_way', 'hiz-tabela', 'ozel-tabela',
    'sollama-yasak', 'park-yasak', 'giris-yok'];

// Seçili yaklaşımın OSM verilerini forma uygula ve bilgi kutusunu doldur
function yolVerileriniUygula() {
    const liste = secenekListeleri.A;
    const sec = liste[parseInt($('A-yaklasim').value) || 0];
    if (!sec) { $('bolum-yol-bilgi').classList.add('gizli'); return; }

    if (sec.hizLimiti) $('g-limit').value = sec.hizLimiti;
    if (sec.yuzey && YUZEY_ESLEME[sec.yuzey]) {
        $('g-yuzey').value = YUZEY_ESLEME[sec.yuzey];
        $('g-yuzey').dispatchEvent(new Event('change'));
    }

    const satirlar = [];
    satirlar.push(`<b>${sec.etiket.split(' — ')[0]}</b>: ${sec.seritSayisi || '?'} şerit${sec.tekYon ? ', tek yön' : ''}` +
        (sec.hizLimiti ? `, limit ${sec.hizLimiti} km/s` : '') +
        (sec.yuzey ? `, yüzey: ${sec.yuzey}` : ''));

    const isaretler = (cevreVeri && cevreVeri.isaretler ? cevreVeri.isaretler : [])
        .map(i => ({ ...i, uzaklik: Math.hypot(i.x - kazaNoktasi.x, i.z - kazaNoktasi.z) }))
        .filter(i => i.uzaklik < 150 && !ORTAM_OGELERI.includes(i.tip))
        .sort((a, b) => a.uzaklik - b.uzaklik)
        .slice(0, 6);
    for (const i of isaretler) {
        satirlar.push(`${ISARET_ADLARI[i.tip] || i.tip} — ${Math.round(i.uzaklik)} m`);
    }
    if (!sec.hizLimiti && !sec.yuzey && !isaretler.length) {
        satirlar.push('<span style="color:var(--metin-soluk)">Bu nokta için OSM\'de ayrıntılı veri kaydı yok.</span>');
    }
    $('yol-bilgi-icerik').innerHTML = satirlar.join('<br>');
    $('bolum-yol-bilgi').classList.remove('gizli');
}

// ================= HESAPLAMA =================
function katilimciVerisiOku(ad, mu) {
    const tip = katilimciTipi[ad];
    const iz = tip === 'yaya' ? 0 : (parseFloat($(`${ad}-iz`).value) || 0);
    const mod = katilimciModu(ad);
    let v0;
    if (mod === 'iz') {
        const ees = kmh2ms(parseFloat($(`${ad}-ees`).value) || 0);
        v0 = izdenHiz(mu, iz, ees);
    } else {
        v0 = kmh2ms(parseFloat($(`${ad}-hiz`).value) || (tip === 'yaya' ? 5 : 50));
    }
    const ihlalListesi = tip === 'yaya' ? YAYA_IHLALLERI : IHLALLER;
    return {
        tip, mod, v0, mu,
        tur: $(`${ad}-tur`).value || 'otomobil',
        plaka: ($(`${ad}-plaka`).value || '').trim(),
        izUzunlugu: iz,
        kutle: parseFloat($(`${ad}-kutle`).value) || (tip === 'yaya' ? 75 : 1300),
        reaksiyon: tip === 'yaya' ? 0.7 : (parseFloat($(`${ad}-reaksiyon`).value) || 1.0),
        yaklasim: secenekListeleri[ad][parseInt($(`${ad}-yaklasim`).value) || 0],
        renk: RENKLER[ad],
        ihlaller: ihlalListesi.filter(i => $(`${ad}-ihlal-${i.id}`)?.checked).map(i => i.id),
    };
}

$('btn-hesapla').addEventListener('click', () => {
    if (!sim || !secenekListeleri.A.length || !secenekListeleri.B.length) return;
    const mu = parseFloat($('g-mu').value) || 0.75;
    const limit = parseFloat($('g-limit').value) || 50;

    const girdiA = katilimciVerisiOku('A', mu);
    const girdiB = katilimciVerisiOku('B', mu);
    if (!girdiA.yaklasim || !girdiB.yaklasim) return;
    if (girdiA.yaklasim.anahtar === girdiB.yaklasim.anahtar) {
        alert('İki taraf için aynı geliş yönü seçildi. Farklı yönler seçin (aksi halde üst üste binerler).');
        return;
    }

    const fizik = sim.kur({ A: girdiA, B: girdiB });
    const kusur = kusurHesapla(
        { ihlaller: girdiA.ihlaller, hizKmh: girdiA.tip === 'yaya' ? null : ms2kmh(girdiA.v0), limitKmh: girdiA.tip === 'yaya' ? null : limit },
        { ihlaller: girdiB.ihlaller, hizKmh: girdiB.tip === 'yaya' ? null : ms2kmh(girdiB.v0), limitKmh: girdiB.tip === 'yaya' ? null : limit }
    );
    sonSonuc = { fizik, kusur, girdiler: { A: girdiA, B: girdiB, mu, limit } };

    raporCiz(sonSonuc);
    $('bolum-rapor').classList.remove('gizli');
    $('zaman-bar').classList.remove('gizli');
    sim.oynat();
    oynatDugmesi(true);
});

// ================= RAPOR =================
function tarafAdi(ad, girdi) {
    if (girdi.tip === 'yaya') return `Yaya ${ad}`;
    const tur = (ARAC_TURLERI[girdi.tur] || ARAC_TURLERI.otomobil).ad;
    return `${tur} ${ad}${girdi.plaka ? ' (' + girdi.plaka.toUpperCase() + ')' : ''}`;
}

function katilimciRaporBloku(ad, fizik, girdi) {
    const f = fizik[ad];
    const siddet = siddetEtiketi(f.deltaV);
    const yaya = girdi.tip === 'yaya';
    const hizNotu = girdi.mod === 'iz'
        ? `<div class="gerekce">Hız, ${f.izUzunlugu.toFixed(1)} m fren izinden hesaplanmıştır (v = √(v<sub>son</sub>² + 2µgd) — minimum hız tahmini).</div>`
        : '';
    const aracSatirlari = yaya ? '' : `
            <tr><td>Çarpma anındaki hız</td><td>${ms2kmh(f.vi).toFixed(1)} km/s</td></tr>
            <tr><td>Fren izi uzunluğu</td><td>${f.izUzunlugu.toFixed(1)} m</td></tr>
            <tr><td>Tam durma için fren mesafesi</td><td>${frenMesafesi(f.v0, f.mu).toFixed(1)} m</td></tr>
            <tr><td>Toplam duruş mesafesi (reaksiyon dâhil)</td><td>${durusMesafesi(f.v0, f.mu, f.reaksiyon).toFixed(1)} m</td></tr>`;
    return `
    <div class="rapor-blok">
        <h4><span class="renk" style="background:${RENK_CSS[ad]};display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px"></span>${tarafAdi(ad, girdi)} <span style="color:var(--metin-soluk);font-weight:400">— ${f.etiket}</span></h4>
        <table class="rapor-tablo">
            <tr><td>Kaza öncesi hız</td><td>${ms2kmh(f.v0).toFixed(1)} km/s</td></tr>
            ${aracSatirlari}
            <tr><td>Hız değişimi (ΔV)</td><td>${ms2kmh(f.deltaV).toFixed(1)} km/s</td></tr>
            <tr><td>Çarpışma şiddeti</td><td style="color:${siddet.renk}">${siddet.ad}</td></tr>
        </table>
        ${hizNotu}
    </div>`;
}

function kusurBloku(kusur, girdiler) {
    const gerekceler = (veriler) => veriler.gerekceler.length
        ? veriler.gerekceler.map(g => `<div class="gerekce">• ${g.ad} <i>(${g.dayanak})</i></div>`).join('')
        : `<div class="gerekce">• Tespit edilen kural ihlali yok</div>`;
    return `
    <div class="rapor-blok">
        <h4>Kusur Değerlendirmesi (Bilgilendirme Amaçlı)</h4>
        <div class="yasal-uyari">Bu bölüm yalnızca bilgilendirme amaçlıdır; hukuki görüş, bilirkişi incelemesi veya kusur tespiti niteliği taşımaz. Gerçek kusur değerlendirmesi somut olayın tüm delilleriyle yetkili merciler ve bilirkişilerce yapılır.</div>
        ${kusur.belirsiz ? '<div class="gerekce">İki taraf için de ihlal işaretlenmediğinden kusur dağılımı belirlenememiştir; %50-%50 varsayılmıştır.</div>' : ''}
        <div class="kusur-cubuk">
            <div class="kusur-A" style="flex:${Math.max(kusur.A.yuzde, 8)}">A %${kusur.A.yuzdeMetin}</div>
            <div class="kusur-B" style="flex:${Math.max(kusur.B.yuzde, 8)}">B %${kusur.B.yuzdeMetin}</div>
        </div>
        <table class="rapor-tablo">
            <tr>
                <td>${tarafAdi('A', girdiler.A)}</td>
                <td><span class="etiket etiket--${kusur.A.etiket.sinif}">${kusur.A.etiket.ad}</span> &nbsp;${kusur.A.sekizlik} (%${kusur.A.yuzdeMetin})</td>
            </tr>
            <tr>
                <td>${tarafAdi('B', girdiler.B)}</td>
                <td><span class="etiket etiket--${kusur.B.etiket.sinif}">${kusur.B.etiket.ad}</span> &nbsp;${kusur.B.sekizlik} (%${kusur.B.yuzdeMetin})</td>
            </tr>
        </table>
        <div style="margin-top:8px;font-size:12px"><b>${tarafAdi('A', girdiler.A)} gerekçeleri:</b></div>
        ${gerekceler(kusur.A)}
        <div style="margin-top:6px;font-size:12px"><b>${tarafAdi('B', girdiler.B)} gerekçeleri:</b></div>
        ${gerekceler(kusur.B)}
    </div>`;
}

function raporCiz(sonuc) {
    $('rapor-icerik').innerHTML =
        katilimciRaporBloku('A', sonuc.fizik, sonuc.girdiler.A) +
        katilimciRaporBloku('B', sonuc.fizik, sonuc.girdiler.B) +
        kusurBloku(sonuc.kusur, sonuc.girdiler);
}

// ================= YAZDIRMA =================
$('btn-yazdir').addEventListener('click', () => {
    if (!sonSonuc) return;
    const { fizik, kusur, girdiler } = sonSonuc;
    const satir = (ad) => {
        const f = fizik[ad];
        const yaya = girdiler[ad].tip === 'yaya';
        return `<tr>
            <td>${tarafAdi(ad, girdiler[ad])}</td>
            <td>${f.etiket}</td>
            <td>${ms2kmh(f.v0).toFixed(1)}</td>
            <td>${yaya ? '—' : ms2kmh(f.vi).toFixed(1)}</td>
            <td>${yaya ? '—' : f.izUzunlugu.toFixed(1)}</td>
            <td>${ms2kmh(f.deltaV).toFixed(1)}</td>
            <td>${kusur[ad].sekizlik} (%${kusur[ad].yuzdeMetin}) — ${kusur[ad].etiket.ad}</td>
        </tr>`;
    };
    const gerekceListesi = (ad) => kusur[ad].gerekceler.length
        ? `<ul>${kusur[ad].gerekceler.map(g => `<li>${g.ad} <span class="kucuk">(${g.dayanak})</span></li>`).join('')}</ul>`
        : '<p class="kucuk">Tespit edilen ihlal yok.</p>';

    $('yazdirma-alani').innerHTML = `
        <h1>Trafik Kazası Simülasyon Özeti</h1>
        <p style="border:1.5px solid #c00;padding:8px 12px;font-size:10.5pt;color:#900">
        <b>BİLGİLENDİRME AMAÇLIDIR.</b> Bu belge, basitleştirilmiş fizik modelleriyle çalışan bir simülasyon aracının çıktısıdır.
        Hukuki görüş, bilirkişi raporu, kusur tespiti veya delil niteliği taşımaz; resmî ya da adli hiçbir işlemde bu nitelikle kullanılamaz.</p>
        <p class="kucuk">Konum: ${secilenKonum ? secilenKonum.adres : '—'}<br>
        Koordinat: ${secilenKonum ? secilenKonum.lat.toFixed(6) + ', ' + secilenKonum.lon.toFixed(6) : '—'}<br>
        Rapor tarihi: ${new Date().toLocaleString('tr-TR')}<br>
        Yol yüzeyi sürtünme katsayısı: µ = ${girdiler.mu} — Hız limiti: ${girdiler.limit} km/s</p>
        <h2>Hesaplama Sonuçları</h2>
        <table>
            <tr><th>Taraf</th><th>Geliş yönü</th><th>Kaza öncesi hız (km/s)</th><th>Çarpma hızı (km/s)</th><th>Fren izi (m)</th><th>ΔV (km/s)</th><th>Kusur (bilgilendirme amaçlı)</th></tr>
            ${satir('A')}${satir('B')}
        </table>
        <h2>${tarafAdi('A', girdiler.A)} — Kusur Gerekçeleri</h2>${gerekceListesi('A')}
        <h2>${tarafAdi('B', girdiler.B)} — Kusur Gerekçeleri</h2>${gerekceListesi('B')}
        <h2>Yöntem</h2>
        <p class="kucuk">Fren izinden hız: v = √(v<sub>son</sub>² + 2µgd). Çarpışma: iki boyutlu momentum korunumu (kısmen esnek, e≈0.22).
        Kusur dağılımı: 2918 sayılı KTK (m.84 asli kusur halleri; yayalar için m.68-69, sürücüler için m.74) esas alınarak ağırlıklandırılmış puanlama.</p>
        <p class="kucuk"><b>Uyarı:</b> Bu belge basitleştirilmiş fizik modelleriyle üretilmiş, yalnızca bilgilendirme
        amaçlı bir simülasyon özetidir; resmî bilirkişi raporu, hukuki görüş, kusur tespiti veya delil niteliği taşımaz.
        Anılan mevzuat hükümleri örneklendirme amaçlıdır; güncel ve bağlayıcı metin için resmî kaynaklara başvurulmalıdır.</p>
    `;
    window.print();
});

// ============ KULLANICI YOL ÇİZİMİ ============
let cizimModu = null;   // 'yol' | 'yaya'
let cizimNoktalari = [];
let cizilenYolSayaci = 0;

function cizimSifirla() {
    cizimModu = null;
    cizimNoktalari = [];
    $('btn-yol-ciz').classList.remove('secili');
    $('btn-yaya-ciz').classList.remove('secili');
    $('btn-yol-ciz').textContent = 'Yol Çiz';
    $('btn-yaya-ciz').textContent = 'Yaya Yolu Çiz';
    $('cizim-ipucu').classList.add('gizli');
    if (sim) { sim.cizimTemizle(); sim.sahneSecimBitir(); }
}

function cizimBaslatVeyaBitir(mod, btnId) {
    if (!sim || !cevreVeri) return;
    if (cizimModu === mod) {
        // Bitir: en az 2 nokta varsa yol olarak kaydet
        if (cizimNoktalari.length >= 2) {
            const varsayilanAd = mod === 'yol' ? `Çizilen Yol ${++cizilenYolSayaci}` : `Yaya Yolu ${++cizilenYolSayaci}`;
            const ad = (prompt('Yol adı (sahnede etiket olarak yazılır):', varsayilanAd) || varsayilanAd).trim();
            cevreVeri.yollar.push({
                ad,
                sinif: mod === 'yol' ? 'residential' : 'footway',
                genislik: mod === 'yol' ? 7 : 2,
                tekYon: false,
                seritSayisi: mod === 'yol' ? 2 : 1,
                hizLimiti: null, yuzey: null,
                elle: true,
                id: 'cizim-' + Date.now(),
                noktalar: cizimNoktalari.slice(),
            });
            sim.cevreKur(cevreVeri);
            noktayiUygula(kazaNoktasi);
            $('zaman-bar').classList.add('gizli');
            cizilenYolListesiCiz();
        }
        cizimSifirla();
        return;
    }
    noktaTasiSifirla(); isaretModuSifirla(); cizimSifirla();
    cizimModu = mod;
    $(btnId).classList.add('secili');
    $(btnId).textContent = 'Bitir ve Kaydet';
    $('cizim-ipucu').classList.remove('gizli');
    sim.sahneSecimBaslat((p) => {
        cizimNoktalari.push({ x: p.x, z: p.z });
        sim.cizimOnizle(cizimNoktalari, cizimModu === 'yol' ? 7 : 2);
    });
}

$('btn-yol-ciz').addEventListener('click', () => {
    const bitiriliyor = cizimModu === 'yol';
    cizimBaslatVeyaBitir('yol', 'btn-yol-ciz');
    if (bitiriliyor) $('btn-yol-ciz').textContent = 'Yol Çiz';
});
$('btn-yaya-ciz').addEventListener('click', () => {
    const bitiriliyor = cizimModu === 'yaya';
    cizimBaslatVeyaBitir('yaya', 'btn-yaya-ciz');
    if (bitiriliyor) $('btn-yaya-ciz').textContent = 'Yaya Yolu Çiz';
});

function cizilenYolListesiCiz() {
    const kap = $('cizilen-yol-liste');
    const cizilenler = cevreVeri.yollar.filter(y => y.elle);
    kap.innerHTML = cizilenler.map(y => `<div class="ekli-satir">
        <span>${y.ad} <i style="color:var(--metin-soluk)">(${y.sinif === 'footway' ? 'yaya yolu' : 'yol'})</i></span>
        <button type="button" class="mini-btn mini-btn--sil yol-sil" data-id="${y.id}">Sil</button>
    </div>`).join('');
    kap.querySelectorAll('.yol-sil').forEach(b => b.addEventListener('click', () => {
        cevreVeri.yollar = cevreVeri.yollar.filter(y => y.id !== b.dataset.id);
        sim.cevreKur(cevreVeri);
        noktayiUygula(kazaNoktasi);
        $('zaman-bar').classList.add('gizli');
        cizilenYolListesiCiz();
    }));
}

// ================= FOTOĞRAF =================
$('btn-foto').addEventListener('click', () => {
    if (!sim) return;
    const url = sim.fotoCek();
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kaza-simulasyon-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') + '.png';
    a.click();
});

// ================= ZAMAN ÇİZELGESİ =================
$('btn-oynat').addEventListener('click', () => {
    if (!sim || !sim.kurulum) return;
    if (sim.oynuyor) { sim.duraklat(); oynatDugmesi(false); }
    else { sim.oynat(); oynatDugmesi(true); }
});

$('zaman-kaydirici').addEventListener('input', (e) => {
    if (!sim || !sim.kurulum) return;
    sim.duraklat();
    oynatDugmesi(false);
    sim.zaman((parseFloat(e.target.value) / 1000) * sim.sure);
});

$('oynatma-hizi').addEventListener('change', (e) => {
    if (sim) sim.oynatmaHizi = parseFloat(e.target.value);
});

$('kamera-modu').addEventListener('change', (e) => {
    if (sim) sim.kameraModuAyarla(e.target.value);
});

// Simülasyondan zaman geri bildirimi
$('btn-simulasyona-git').addEventListener('click', () => setTimeout(() => {
    if (!sim) return;
    sim.onZaman = (t, sure) => {
        $('zaman-kaydirici').value = Math.round((t / sure) * 1000);
        $('zaman-metin').textContent = t.toFixed(1) + ' s';
        if (!sim.oynuyor && t >= sure - 0.01) oynatDugmesi(false);
    };
}, 100));
