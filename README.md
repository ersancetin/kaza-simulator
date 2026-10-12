# Kaza Simülatörü — Cumhuriyet Avukatları

<img src="public/logo.png" alt="Cumhuriyet Avukatları" width="96" align="right">

Meslektaşlarımızın faydasına, ücretsiz olarak hazırlanmış bir trafik kazası **simülatörüdür**.
Hukuki görüş, bilirkişi raporu veya delil niteliği taşımaz.

Tarayıcıda çalışan, fizik tabanlı trafik kazası canlandırma ve ön analiz aracı.
GateOS In-Browser Micro-App kılavuzuna (`GATEOS-APP-DEV-MANUAL`) göre yeniden yazılmıştır:
Next.js 16 (statik dışa aktarım) · React 19 · strict TypeScript · Tailwind CSS v4 (OKLCH) ·
Radix UI · Lucide · Three.js.

## Özellikler

- **İnternetsiz şablon senaryolar** — ışıklı kavşakta yandan çarpma, DUR levhalı T kavşak,
  kırsal yolda kafa kafaya, duran araca arkadan çarpma, yaya geçidinde yayaya çarpma.
- **Gerçek konum (isteğe bağlı)** — haritadan nokta seçilince OpenStreetMap yol, bina, ağaç,
  ışık/levha verisi alınır; yanıtlar IndexedDB'de önbelleklenir (aynı bölge ikinci kez anında açılır).
- **Fizik motoru** (`lib/simulate.ts`)
  - Çarpışma öncesi: seyir → algılama/tepki → frenleme (µg), şerit ortasından, köşeleri yumuşatılmış güzergâh.
  - Çarpışma: 2B katı cisim itki modeli — doğrusal + açısal momentum korunumu, temas noktası moment kolu,
    çarpma katsayısı, Coulomb temas sürtünmesi. Çarpışma tipi (yandan / kafa kafaya / arkadan / sıyırma)
    ve çarpılan bölgeye göre doğru temas pozu: çarpışma tam işaretlenen noktada olur.
  - Çarpışma sonrası: boyuna/yanal lastik sürtünmesi (sürtünme dairesi), sapma sönümü, ikincil temaslar
    (OBB/SAT), direk/ağaç/bariyer gibi sabit engeller, devrilen iki tekerli.
  - Yaya: Searle fırlatma modeli (sarılma / ileri savrulma), düşme ve kayma.
  - Sonuç 60 kare/sn kare dizisi: zaman çubuğunda ileri-geri sarma anlık ve tutarlı.
- **Raporlama** — fren izinden hız, çarpma hızı, ΔV ve şiddet, duruş mesafesi, algılama noktası,
  **kaçınılabilirlik** (hız sınırında seyretseydi durabilir miydi), Searle ters hesabı, sönümlenen enerji,
  KTK temelli 8'lik dilim olası kusur dağılımı.
- **Görseller** — profil ekstrüzyonlu araç gövdeleri (otomobil, SUV, pikap, panelvan, kamyon, otobüs, TIR,
  motosiklet, bisiklet, traktör), eklemli yürüyen yaya, Türkiye standardında levhalar (DUR, yol ver, ana yol,
  hız sınırı, sollama yasağı, park yasağı, girişi olmayan yol, yaya/okul geçidi, ada etrafında dönünüz),
  kaldırım, bordür, kavşakta kesilen şerit çizgileri, dur çizgileri, zebra, pencereli binalar, lastik izleri,
  enkaz ve çarpışma parlaması.
- **Kameralar** — serbest, kuşbakışı, A/B takip, A/B sürücü gözü (görüş analizi).
- **Çıktılar (tamamen tarayıcıda)** — bilgi katmanlı veya sade fotoğraf (PNG), ölçekli kaza krokisi
  (kuzey oku, ölçek çubuğu, A1/B1 çarpışma konumu, A2/B2 son duruş), video (MP4/WebM, 720p/1080p,
  MediaRecorder), A4 rapor yazdır / PDF.

## Kılavuz uyumu

| Kural | Uygulama |
|---|---|
| Sıfır sunucu yükü | `output: 'export'` — yalnızca statik dosyalar; tüm hesap, çizim, video tarayıcıda. |
| Veritabanı bağımsızlığı | Tercihler yalnızca `localStorage`'da, SHA-256 bütünlük karmalı (`lib/depo.ts`); OSM önbelleği IndexedDB. |
| Sıfır API bağımlılığı | Uygulama şablonlarla internetsiz tam çalışır. Harita/OSM yalnızca kullanıcı konum seçince, doğrudan tarayıcıdan istenir (zorunlu değil, telemetri yok). |
| Taşınabilirlik | 3B motor sahne açılınca yüklenir; sonrasında bağlantı kopsa da çalışmaya devam eder. |
| Güvenlik | `eval`, `new Function`, `dangerouslySetInnerHTML`, dış `<script>`/CDN yok; font npm paketiyle (`@fontsource-variable/montserrat`). Tüm dinleyiciler unmount'ta temizlenir. |
| Görsel kimlik | AHA Red / antrasit / gri OKLCH tokenları, Montserrat, kapsül düğmeler, `rounded-2xl/3xl` kartlar, kırmızı odak halkası. |
| Erişilebilirlik | Space oynat/duraklat · ←/→ 0,1 sn (Shift 1 sn) · Home/End · 1–6 kamera · P panel · F tam ekran · Esc iptal; mobilde panel ve zaman çubuğu kaydırma jestleri. |
| Auth Shield | `<KazaClient isProtected isAuthenticated onRequestLogin />` — oturumsuz kullanıcı önizler, eylemde bordo kilit modalı açılır. |

## Klasör düzeni

```text
src/kaza-simulator/
├── types/kazaTypes.ts        # Tüm tipler
├── data/kazaData.ts          # Yüzeyler, araç türleri, ihlaller, levha kataloğu, şablon senaryolar
├── data/ktkMetinleri.ts      # KTK hükümlerinden birebir alıntılar
├── hooks/
│   ├── useKazaEngine.ts      # Presenter hook: durum, iş mantığı, dışa aktarım, yetki kalkanı
│   ├── useKlavyeKisayollari.ts
│   └── useKaydirma.ts        # Dokunmatik kaydırma
├── lib/                      # Saf motorlar (çizimden bağımsız)
│   ├── simulate.ts  physics.ts  kusur.ts  geometry.ts  senaryo.ts
│   ├── osm.ts  depo.ts  hud.ts  levhaCizim.ts  video.ts
│   └── three/  sahneMotoru.ts  cevreKur.ts  modeller.ts  dokular.ts
├── components/
│   ├── KazaClient.tsx        # Ana istemci arayüzü
│   ├── KazaCard.tsx          # Taraf kartı
│   ├── KazaSettings.tsx      # Koşullar ve çarpışma kurgusu
│   └── …                     # Harita, sahne, palet, sonuç, zaman çubuğu, dışa aktarım, rapor, kilit
└── README.md
```

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # fizik/kusur motoru testleri (node:test)
npm run typecheck
npm run build      # out/ — herhangi bir statik barındırıcıya kopyalanabilir
```

GitHub Pages için iş akışı `NEXT_PUBLIC_BASE_PATH=/kaza-simulator` ile derler ve `out/` içeriğini
`gh-pages` dalına yayınlar.

## Olası kusur dağılımı hakkında

Uygulama kusur **tespit etmez**. Kullanıcının işaretlediği olası ihlaller ve hız bilgisine göre, ilgili
olabilecek KTK hükümleri esas alınarak 8'lik dilimde bir **olası dağılım** gösterir. Etiketler bu nedenle
"Asli kusur ihtimali", "Tali kusur ihtimali", "Kusur ihtimali görünmüyor" biçimindedir; gerekçeler "… söz konusu
olabilir (KTK m.x ile ilgili olabilir)" diliyle yazılır. Madde atıfları örneklendirme amaçlıdır; güncel ve
bağlayıcı metin için mevzuat.gov.tr'ye başvurulmalıdır.

### KTK eşleştirme tablosu

Atıflar 2918 sayılı KTK'nın resmî metniyle (mevzuat.gov.tr, 19.08.2026 tarihli doğrulanmış derleme)
karşılaştırılmıştır. m.84 yalnızca **araç sürücüleri** için asli kusur sayılan hâlleri sayar; maddenin son
cümlesine göre bu hâllerden biri birden fazla sürücü tarafından yapılmışsa oran yönetmelik esaslarına göre
belirlenir (uygulama bu durumda ayrıca uyarı gösterir).

**Birebir alıntılar.** İlgili hükümlerin metinleri `data/ktkMetinleri.ts` dosyasında resmî metinden birebir
parçalar hâlinde tutulur (giriş cümlesi + ilgili bent + kapanış; atlanan kısımlar “…”). Sonuç panelinde her
gerekçenin altında "Kanun metni" olarak, PDF raporunda ise tekrarsız ve kanun sırasıyla numaralı bir
"birebir alıntı" bölümü olarak gösterilir. Bir davranış birden fazla hükümle ilgili olabildiğinden her ihlal
birden çok hükme bağlanabilir; testler her bağlantının var olduğunu ve m.84 bendinin alıntısının
eklendiğini denetler.

| İhlal (kullanıcı beyanı) | İlgili olabilecek hüküm | m.84 |
|---|---|---|
| Kırmızı ışıkta / yetkili memurun dur işaretinde geçme | m.47/1-b | a |
| Taşıt giremez yola / karşı yönün şeridine girme | m.46/1-a, h | b–c (iki şeritli yolda g) |
| Arkadan çarpma | m.56/1-c, m.52/1-c | d |
| Geçme yasağı olan yerde geçme | m.54/1-b | e |
| Doğrultu değiştirme / dönüş manevrası | m.53, m.67/1-a, c | f, j |
| Şeride tecavüz / kurala aykırı şerit değiştirme | m.46/1-b, c; m.56/1-a | g |
| Kavşakta geçiş önceliğine uymama | m.57/1-a, c | h |
| Dar kaplamada geçiş önceliğine uymama | m.56/1-b | i |
| Yerleşim dışı taşıt yolunda park/duraklama, tedbirsizlik | m.59/1 | k |
| Kurallara uygun park edilmiş araca çarpma | — | l |
| Alkol / uyuşturucu etkisinde sürme | m.48/1 | — |
| Yaya/okul geçidinde ilk geçiş hakkı vermeme | m.74/1, m.52/1-a, m.53 | — |
| Hızı şartlara uydurmama | m.52/1-a, b | — |
| Seyir hâlinde telefon / dikkatsiz sürüş | m.73/1 | — |
| Hız sınırını aşma (otomatik) | m.51/1, m.52/1-b | — |
| Yaya: ışığa uymama · geçit dışından geçme · taşıt yolunda yürüme · kontrolsüz geçme | m.68/1-b-1 & m.47/1-b · m.68/1-b · m.68/1-a · m.68/1-b (son cümle), c | — |

## Yasal uyarı

Kaza Simülatörü, Cumhuriyet Avukatları tarafından meslektaşlarımızın faydasına, trafik kazası dosyalarında
olayın görselleştirilmesi ve ön değerlendirmesine yardımcı olmak amacıyla ücretsiz olarak hazırlanmış bir
simülasyon aracıdır. Ürettiği canlandırma, kroki, hız, mesafe ve kusur dağılımları basitleştirilmiş fizik
modellerine ve kullanıcının girdiği verilere dayanır; **hukuki görüş, bilirkişi raporu, Adli Tıp/ATK veya kusur
raporu niteliği taşımaz**, delil olarak ya da bu raporların yerine kullanılamaz. Somut olayda kusur, hız ve
tazminat değerlendirmesi uzman bilirkişiler ve yetkili yargı mercilerince yapılır. Mevzuat atıfları
örneklendirme amaçlıdır. Uygulamanın kullanımından doğabilecek zararlardan Cumhuriyet Avukatları sorumlu
tutulamaz.

Uyarı, ilk girişte okunup onaylanan pencerede, uygulama altbilgisinde ve tüm çıktılarda (fotoğraf, video,
kroki, A4 rapor) yer alır. Üyelik yok, çerez yok, kişisel veri toplanmaz; harita, adres arama ve yol verisi için yalnızca arama metni ve seçilen konum OpenStreetMap hizmetlerine iletilir.

Yol verileri © [OpenStreetMap](https://www.openstreetmap.org/copyright) katkıcıları.
