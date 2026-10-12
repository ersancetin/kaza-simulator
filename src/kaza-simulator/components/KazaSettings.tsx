'use client';

// Genel koşullar ve çarpışma kurgusu ayarları.

import { CloudFog, CloudRain, Moon, Snowflake, Sun, Sunset } from 'lucide-react';
import type { ReactNode } from 'react';
import { YUZEYLER } from '../data/kazaData.ts';
import type { CarpismaTipi, CarpmaBolgesi, GenelKosullar, IsikDurumu, KatilimciGirdi, TarafId } from '../types/kazaTypes.ts';
import { Alan, Baslik, Kart, SayiGirdi, Secim, Segment } from './ui/temel.tsx';

export interface KazaSettingsProps {
    kosullar: GenelKosullar;
    guncelle: (p: Partial<GenelKosullar>) => void;
    katilimcilar: Record<TarafId, KatilimciGirdi>;
    ihlalEkle: (id: TarafId, ihlal: string) => void;
}

const ISIK_SECENEK: ReadonlyArray<{ deger: IsikDurumu; etiket: ReactNode }> = [
    { deger: 'yok', etiket: 'Işık yok' },
    { deger: 'yesil', etiket: <><span className="h-2.5 w-2.5 rounded-full bg-[#1FA34A]" /> Yeşil</> },
    { deger: 'sari', etiket: <><span className="h-2.5 w-2.5 rounded-full bg-[#F6C400]" /> Sarı</> },
    { deger: 'kirmizi', etiket: <><span className="h-2.5 w-2.5 rounded-full bg-[#C8102E]" /> Kırmızı</> },
];

const TIPLER: ReadonlyArray<{ deger: CarpismaTipi; etiket: string; baslik: string }> = [
    { deger: 'otomatik', etiket: 'Otomatik', baslik: 'Geliş açılarına göre belirlenir' },
    { deger: 'yandan', etiket: 'Yandan', baslik: 'Önden-yana (T) çarpma' },
    { deger: 'kafa-kafaya', etiket: 'Kafa kafaya', baslik: 'Önden-öne çarpma' },
    { deger: 'arkadan', etiket: 'Arkadan', baslik: 'Önden-arkaya çarpma' },
    { deger: 'siyirma', etiket: 'Sıyırma', baslik: 'Yan yana sürtünerek çarpma' },
];

const BOLGELER: ReadonlyArray<{ deger: CarpmaBolgesi; etiket: string }> = [
    { deger: 'on', etiket: 'Ön kısım' },
    { deger: 'orta', etiket: 'Orta' },
    { deger: 'arka', etiket: 'Arka kısım' },
];

export function KazaSettings({ kosullar, guncelle, katilimcilar, ihlalEkle }: KazaSettingsProps) {
    const yayaVar = katilimcilar.A.tip === 'yaya' || katilimcilar.B.tip === 'yaya';
    const carpilan: TarafId = kosullar.carpan === 'A' ? 'B' : 'A';
    return (
        <>
            <Kart className="p-3.5 md:p-4">
                <Baslik>Yol ve hava koşulları</Baslik>
                <div className="space-y-3">
                    <Alan etiket="Yol yüzeyi">
                        <Secim value={kosullar.yuzeyId} onChange={(e) => guncelle({ yuzeyId: e.target.value })}>
                            {YUZEYLER.map((y) => <option key={y.id} value={y.id}>{y.ad} (µ ≈ {y.mu})</option>)}
                        </Secim>
                    </Alan>
                    <div className="grid grid-cols-2 gap-3">
                        <Alan etiket="Sürtünme katsayısı µ">
                            <SayiGirdi deger={kosullar.mu} degisti={(v) => guncelle({ mu: Math.max(0.05, v) })} min={0.05} max={1.2} adim={0.01} />
                        </Alan>
                        <Alan etiket="Hız sınırı">
                            <SayiGirdi deger={kosullar.limitKmh} degisti={(v) => guncelle({ limitKmh: v })} min={10} max={150} adim={5} birim="km/s" />
                        </Alan>
                    </div>
                </div>
            </Kart>

            <Kart className="p-3.5 md:p-4">
                <Baslik>Işık, görüş ve hava</Baslik>
                <div className="space-y-3">
                    <Alan etiket="Aydınlatma">
                        <Segment ad="Aydınlatma" kucuk secenekler={[{ deger: 'gunduz', etiket: <><Sun className="h-3.5 w-3.5" /> Gündüz</> }, { deger: 'aksam', etiket: <><Sunset className="h-3.5 w-3.5" /> Alacakaranlık</> }, { deger: 'gece', etiket: <><Moon className="h-3.5 w-3.5" /> Gece</> }] as const}
                            deger={kosullar.aydinlatma} degisti={(v) => guncelle({ aydinlatma: v })} />
                    </Alan>
                    <Alan etiket="Hava" ipucu="Yağmur ve kar seçilince kuru yüzey ıslak/karlı yapılır (µ güncellenir).">
                        <Segment ad="Hava" kucuk secenekler={[{ deger: 'acik', etiket: 'Açık' }, { deger: 'yagmur', etiket: <><CloudRain className="h-3.5 w-3.5" /> Yağmur</> }, { deger: 'sis', etiket: <><CloudFog className="h-3.5 w-3.5" /> Sis</> }, { deger: 'kar', etiket: <><Snowflake className="h-3.5 w-3.5" /> Kar</> }] as const}
                            deger={kosullar.hava} degisti={(v) => guncelle({ hava: v })} />
                    </Alan>
                    {(['A', 'B'] as const).map((id) => {
                        const yaya = katilimcilar[id].tip === 'yaya';
                        const ihlal = yaya ? 'yaya-kirmizi' : 'kirmizi-isik';
                        const oneri = kosullar.isik[id] === 'kirmizi' && !katilimcilar[id].ihlaller.includes(ihlal);
                        return (
                            <Alan key={id} etiket={`${id} tarafının ışığı (çarpışma anında)`}>
                                <Segment ad={`${id} ışığı`} kucuk secenekler={ISIK_SECENEK} deger={kosullar.isik[id]} degisti={(v) => guncelle({ isik: { ...kosullar.isik, [id]: v } })} />
                                {oneri && (
                                    <button type="button" onClick={() => ihlalEkle(id, ihlal)}
                                        className="mt-1.5 rounded-full bg-aha-red/10 px-3 py-1 text-[11.5px] font-semibold text-aha-red hover:bg-aha-red/15">
                                        + “Kırmızı ışık ihlali”ni {id} tarafına ekle
                                    </button>
                                )}
                            </Alan>
                        );
                    })}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">Canlandırmada ışık çarpışma anındaki renge göre yeşil → sarı (3 sn) → kırmızı akışıyla gösterilir; kesişen yöndeki ışık tamamlayıcı renkte yanar.</p>
                </div>
            </Kart>

            <Kart className="p-3.5 md:p-4">
                <Baslik>Çarpışma kurgusu</Baslik>
                {yayaVar ? (
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                        Yaya çarpmasında aracın ön yüzü yayaya temas eder; yaya, araç ön yüksekliğine göre sarılma veya ileri savrulma ile fırlatılır (Searle modeli).
                    </p>
                ) : (
                    <div className="space-y-3">
                        <Alan etiket="Çarpışma tipi">
                            <Segment ad="Çarpışma tipi" kucuk secenekler={TIPLER} deger={kosullar.carpismaTipi} degisti={(v) => guncelle({ carpismaTipi: v })} />
                        </Alan>
                        <Alan etiket="Çarpan (vuran) taraf" ipucu="Çarpan tarafın ön yüzü çarpışma noktasına gelir.">
                            <Segment ad="Çarpan taraf" secenekler={[{ deger: 'A', etiket: 'A çarpar' }, { deger: 'B', etiket: 'B çarpar' }] as const} deger={kosullar.carpan} degisti={(v) => guncelle({ carpan: v })} />
                        </Alan>
                        {(kosullar.carpismaTipi === 'yandan' || kosullar.carpismaTipi === 'otomatik') && (
                            <Alan etiket={`${carpilan} tarafının çarpılan bölgesi (yandan çarpmada)`}>
                                <Segment ad="Çarpma bölgesi" kucuk secenekler={BOLGELER} deger={kosullar.bolge} degisti={(v) => guncelle({ bolge: v })} />
                            </Alan>
                        )}
                    </div>
                )}
            </Kart>
        </>
    );
}
