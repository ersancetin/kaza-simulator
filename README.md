# Kaza Simülatörü

Türkiye haritasında seçilen konumda trafik kazası canlandırması ve ön analiz aracı.
Tamamen statiktir; GitHub Pages üzerinde sunucu ve API anahtarı gerektirmeden çalışır.

## Özellikler

- **Konum seçimi** — Leaflet + OpenStreetMap ile Türkiye'de arama (Nominatim) veya haritaya tıklama.
- **Gerçek yol geometrisi** — Seçilen noktanın çevresindeki yollar ve binalar Overpass API'den alınır ve Three.js ile 3B sahneye dönüştürülür (veri alınamazsa temsili kavşak kullanılır).
- **3B kaza canlandırması** — İki araç için seyir → reaksiyon → frenleme → çarpışma → savrulma evreleri; ileri-geri sarılabilir zaman çubuğu, araç takip kamerası, kuşbakışı görünüm.
- **Hız tespiti** — Fren izi uzunluğundan hız hesabı: `v = √(v_son² + 2µgd)` (yüzeye göre sürtünme katsayısı, isteğe bağlı iz sonu/EES hızı). Fren mesafesi, reaksiyon dâhil duruş mesafesi, çarpma anı hızı ve ΔV hesaplanır.
- **Kusur oranı değerlendirmesi** — 2918 sayılı KTK (özellikle m.84'teki asli kusur halleri) esas alınarak ağırlıklandırılmış puanlama; %'lik ve 8'lik dilim (ör. 6/8 – 2/8) gösterimi, gerekçeli döküm, yazdırılabilir rapor.

## Dosyalar

| Dosya | Görev |
|---|---|
| `index.html` | İki ekranlı arayüz (harita + simülasyon) |
| `js/map.js` | Leaflet haritası, Nominatim arama, Overpass veri çekme |
| `js/sim3d.js` | Three.js sahnesi, kapalı-form kinematik, fren izleri, çarpışma |
| `js/physics.js` | Kaza rekonstrüksiyon formülleri |
| `js/kusur.js` | KTK temelli kusur puanlama motoru |
| `js/main.js` | Akış, formlar, rapor ve yazdırma |

## Uyarı

Bu araç **yalnızca bilgilendirme ve eğitim amaçlıdır**; basitleştirilmiş fizik
modellerine dayanır. Ürettiği sonuçlar hukuki görüş, bilirkişi raporu, kusur
tespiti veya delil niteliği **taşımaz**; resmî ya da adli işlemlerde kullanılamaz.
Mevzuat atıfları örneklendirme amaçlıdır; bağlayıcı metin için resmî kaynaklara
başvurulmalıdır.
