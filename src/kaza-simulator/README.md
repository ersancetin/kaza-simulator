# kaza-simulator (GateOS micro-app)

Ana istemci bileşeni: `components/KazaClient.tsx`.

```tsx
import { KazaClient } from '@/kaza-simulator/components/KazaClient';

<KazaClient isProtected isAuthenticated={oturumAcik} onRequestLogin={girisSayfasinaGit} />
```

Bağımlılıklar: `three`, `leaflet`, `lucide-react`, `@radix-ui/react-{dialog,tabs,tooltip,dropdown-menu}`,
`@fontsource-variable/montserrat`. Tasarım tokenları `src/app/globals.css` içindeki `@theme` bloğundadır
(`aha-red`, `foreground`, `muted`, `border`, `taraf-a`, `taraf-b`, `bordo`).

## Test talimatları

1. `npm test` — beş şablon senaryo simüle edilir; sonlu kareler, temas pozu, enerji sönümü, kusur dilimleri doğrulanır.
2. `npm run build && npx serve out` — tarayıcıda:
   - Bir şablon seçin → **Hesapla ve Canlandır** → Boşluk/←/→ ile sarın, 1–6 ile kamera değiştirin.
   - **Dışa aktar** → fotoğraf, kroki, video ve rapor (PDF) üretimini deneyin.
   - Ağ bağlantısını kesin: şablonlar ve tüm hesaplar çalışmaya devam etmelidir.
   - Mobil genişlikte panel alt sayfa olur; tutamaçta yukarı/aşağı, zaman çubuğunda sağa/sola kaydırın.
