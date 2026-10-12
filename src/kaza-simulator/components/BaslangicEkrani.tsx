'use client';

import { Car, ChevronRight, FolderOpen, HeartHandshake, Loader2, MapPin, PersonStanding, Route, Search, Waypoints, WifiOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SABLONLAR } from '../data/kazaData.ts';
import { Altbilgi, MarkaBasligi, SimulasyonUyarisi } from './Marka.tsx';
import { SablonCizimi } from './SablonCizimi.tsx';
import { adresAra } from '../lib/osm.ts';
import type { SecilenKonum } from '../types/kazaTypes.ts';
import { HaritaSecici } from './HaritaSecici.tsx';
import { Buton, Rozet } from './ui/temel.tsx';

const SABLON_IKON = { Kavşak: Waypoints, Şehirlerarası: Route, 'Şehir içi': Car, Yaya: PersonStanding } as const;

export interface BaslangicEkraniProps {
    secilen: SecilenKonum | null;
    konumSec: (k: SecilenKonum | null) => void;
    kur: () => void;
    sablonYukle: (id: string) => void;
    uyariAc: () => void;
    senaryoAc: (f: File) => void;
}

export function BaslangicEkrani({ secilen, konumSec, kur, sablonYukle, uyariAc, senaryoAc }: BaslangicEkraniProps) {
    const [sorgu, setSorgu] = useState('');
    const [sonuclar, setSonuclar] = useState<SecilenKonum[]>([]);
    const [araniyor, setAraniyor] = useState(false);
    const [hedef, setHedef] = useState<SecilenKonum | null>(null);
    const [zoom, setZoom] = useState(6);
    const [cevrimdisi, setCevrimdisi] = useState(false);
    const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const g = (): void => setCevrimdisi(!navigator.onLine);
        g();
        window.addEventListener('online', g);
        window.addEventListener('offline', g);
        return () => {
            window.removeEventListener('online', g);
            window.removeEventListener('offline', g);
        };
    }, []);

    useEffect(() => {
        if (zamanlayici.current) clearTimeout(zamanlayici.current);
        const q = sorgu.trim();
        if (q.length < 3) {
            setSonuclar([]);
            return;
        }
        const d = new AbortController();
        zamanlayici.current = setTimeout(() => {
            setAraniyor(true);
            adresAra(q, d.signal)
                .then(setSonuclar)
                .catch(() => setSonuclar([]))
                .finally(() => setAraniyor(false));
        }, 450);
        return () => {
            d.abort();
            if (zamanlayici.current) clearTimeout(zamanlayici.current);
        };
    }, [sorgu]);

    return (
        <div className="fixed inset-0 overflow-hidden bg-background">
            <HaritaSecici secilen={secilen} secildi={konumSec} hedef={hedef} zoomDegisti={setZoom} />

            <aside className="pointer-events-none absolute inset-x-3 bottom-3 top-auto z-[1000] flex max-h-[58dvh] flex-col md:inset-y-4 md:left-4 md:right-auto md:max-h-none md:w-[420px]">
                <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/80 bg-white/95 shadow-xl backdrop-blur">
                    <div className="border-b border-border/70 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-6">
                        <h1 className="sr-only">Cumhuriyet Avukatları — Kaza Simülatörü</h1>
                        <MarkaBasligi />
                        <SimulasyonUyarisi tur="serit" className="mt-3 rounded-full sm:hidden" tikla={uyariAc} />
                        <p className="mt-3 hidden text-[12.5px] font-light sm:block leading-relaxed text-muted-foreground">
                            Trafik kazasını gerçek yol üzerinde fizik tabanlı canlandırın; hız, kaçınılabilirlik ve olası kusur dağılımıni görün; kroki, fotoğraf ve video alın.
                        </p>

                        <div className="relative mt-3 sm:mt-5">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={sorgu}
                                onChange={(e) => setSorgu(e.target.value)}
                                placeholder="Türkiye'de adres arayın (ör. Kızılay, Ankara)"
                                aria-label="Adres ara"
                                className="w-full rounded-full border border-border bg-white py-2.5 pl-11 sm:py-3 pr-10 text-sm outline-none transition focus:border-aha-red focus:ring-2 focus:ring-aha-red/20"
                            />
                            {araniyor && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                            {!araniyor && sorgu && (
                                <button type="button" aria-label="Aramayı temizle" onClick={() => setSorgu('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                            {sonuclar.length > 0 && (
                                <ul className="absolute inset-x-0 top-[calc(100%+6px)] z-10 overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
                                    {sonuclar.map((s) => (
                                        <li key={`${s.lat},${s.lon}`}>
                                            <button
                                                type="button"
                                                className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-[13px] leading-snug hover:bg-muted"
                                                onClick={() => {
                                                    setSonuclar([]);
                                                    setSorgu(s.adres.split(',')[0]);
                                                    setHedef(s);
                                                    konumSec(s);
                                                }}
                                            >
                                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-aha-red" />
                                                {s.adres}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {secilen ? (
                            <div className="mt-4 rounded-2xl bg-muted/70 p-4 animate-giris">
                                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Seçilen kaza noktası</div>
                                <div className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug">{secilen.adres}</div>
                                <div className="mt-0.5 text-[11.5px] tabular-nums text-muted-foreground">{secilen.lat.toFixed(6)}, {secilen.lon.toFixed(6)}</div>
                                <div className="mt-3 flex gap-2">
                                    <Buton tur="birincil" className="flex-1 justify-center" onClick={kur}>
                                        Simülasyonu Kur <ChevronRight className="h-4 w-4" />
                                    </Buton>
                                    <Buton tur="hayalet" boy="ikon" aria-label="Seçimi kaldır" onClick={() => konumSec(null)}>
                                        <X className="h-4 w-4" />
                                    </Buton>
                                </div>
                            </div>
                        ) : (
                            <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground sm:mt-3 sm:text-[12.5px]">
                                {zoom < 15
                                    ? 'Haritaya tıklayarak yakınlaşın, ardından kazanın olduğu yol üzerine tıklayın.'
                                    : 'Kazanın gerçekleştiği noktaya, yol üzerine tıklayın.'}
                            </p>
                        )}
                    </div>

                    <div className="ince-kaydirma min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                        <ol className="mb-5 hidden grid-cols-3 gap-2 sm:grid">
                            {[
                                { no: 1, baslik: 'Konum', metin: 'Haritadan seçin veya hazır senaryo açın' },
                                { no: 2, baslik: 'Taraflar', metin: 'Hız, fren izi, yön ve ihlalleri girin' },
                                { no: 3, baslik: 'Sonuç', metin: 'Canlandırın; kroki, rapor ve video alın' },
                            ].map((a) => (
                                <li key={a.no} className="rounded-2xl bg-muted/70 p-3">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aha-red text-[11px] font-bold text-white">{a.no}</span>
                                    <div className="mt-1.5 text-[12.5px] font-bold">{a.baslik}</div>
                                    <div className="text-[11px] font-light leading-snug text-muted-foreground">{a.metin}</div>
                                </li>
                            ))}
                        </ol>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em]">Hazır senaryolar</h2>
                            <Rozet renk="yesil"><WifiOff className="h-3 w-3" /> İnternetsiz</Rozet>
                        </div>
                        <ul className="space-y-2">
                            {SABLONLAR.map((s) => {
                                const Ikon = SABLON_IKON[s.etiket as keyof typeof SABLON_IKON] ?? Waypoints;
                                return (
                                    <li key={s.id}>
                                        <button
                                            type="button"
                                            onClick={() => sablonYukle(s.id)}
                                            className="group flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-white p-3 text-left transition hover:border-aha-red/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aha-red/25"
                                        >
                                            <span className="relative shrink-0 transition group-hover:scale-[1.04]">
                                                <SablonCizimi sablon={s} />
                                                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-foreground shadow-sm ring-1 ring-border/80 transition group-hover:bg-aha-red group-hover:text-white">
                                                    <Ikon className="h-3 w-3" />
                                                </span>
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-aha-red">{s.etiket}</span>
                                                <span className="block text-[13.5px] font-semibold leading-tight">{s.ad}</span>
                                                <span className="mt-0.5 block text-[12px] font-light leading-snug text-muted-foreground">{s.aciklama}</span>
                                            </span>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-aha-red" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-border px-4 py-2.5 text-[12.5px] font-semibold text-muted-foreground transition hover:border-aha-red/50 hover:text-aha-red">
                            <FolderOpen className="h-4 w-4" /> Kayıtlı senaryo aç (.kaza.json)
                            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) senaryoAc(f); e.target.value = ''; }} />
                        </label>
                        {cevrimdisi && (
                            <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800">
                                Çevrimdışısınız: harita ve gerçek yol verisi yüklenemez; hazır senaryolar ve tüm hesaplamalar çalışmaya devam eder.
                            </p>
                        )}
                        <div className="mt-5 rounded-2xl border border-aha-red/25 bg-aha-red/[0.04] p-4">
                            <div className="flex items-center gap-2 text-[12.5px] font-bold text-aha-red">
                                <HeartHandshake className="h-4 w-4" /> Meslektaşlarımızın faydasına
                            </div>
                            <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/80">
                                Bu uygulama bir <b>simülasyondur</b>; <b>hukuki görüş, bilirkişi raporu veya kusur tespiti değildir</b>, delil niteliği taşımaz.
                                Dosya hazırlığında olayı görselleştirmek ve ön değerlendirme yapmak için ücretsiz sunulmuştur.
                            </p>
                            <button type="button" onClick={uyariAc} className="mt-2 text-[12px] font-semibold text-aha-red underline-offset-2 hover:underline">Yasal uyarının tamamını okuyun →</button>
                        </div>
                        <Altbilgi className="mt-4" />
                    </div>
                </div>
            </aside>
        </div>
    );
}
