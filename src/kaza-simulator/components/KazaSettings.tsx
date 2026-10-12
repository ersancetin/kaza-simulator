'use client';

// Genel koşullar ve çarpışma kurgusu ayarları.

import { YUZEYLER } from '../data/kazaData.ts';
import type { CarpismaTipi, CarpmaBolgesi, GenelKosullar, KatilimciGirdi, TarafId } from '../types/kazaTypes.ts';
import { Alan, Baslik, Kart, SayiGirdi, Secim, Segment } from './ui/temel.tsx';

export interface KazaSettingsProps {
    kosullar: GenelKosullar;
    guncelle: (p: Partial<GenelKosullar>) => void;
    katilimcilar: Record<TarafId, KatilimciGirdi>;
}

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

export function KazaSettings({ kosullar, guncelle, katilimcilar }: KazaSettingsProps) {
    const yayaVar = katilimcilar.A.tip === 'yaya' || katilimcilar.B.tip === 'yaya';
    const carpilan: TarafId = kosullar.carpan === 'A' ? 'B' : 'A';
    return (
        <>
            <Kart className="p-4">
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

            <Kart className="p-4">
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
