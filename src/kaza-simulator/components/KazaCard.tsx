'use client';

// Taraf (araç veya yaya) bilgi kartı.

import { Car, ChevronDown, PersonStanding } from 'lucide-react';
import { ARAC_TURLERI, IHLALLER, YAYA_IHLALLERI } from '../data/kazaData.ts';
import { baslangicHizi } from '../lib/senaryo.ts';
import { frenMesafesi } from '../lib/physics.ts';
import type { AracTuruId, KatilimciGirdi, TarafId, Yaklasim } from '../types/kazaTypes.ts';
import { Alan, Girdi, Kart, Onay, Rozet, SayiGirdi, Secim, Segment, TarafNokta, cn } from './ui/temel.tsx';

export interface KazaCardProps {
    id: TarafId;
    k: KatilimciGirdi;
    liste: Yaklasim[];
    mu: number;
    guncelle: (p: Partial<KatilimciGirdi>) => void;
}

export function KazaCard({ id, k, liste, mu, guncelle }: KazaCardProps) {
    const yaya = k.tip === 'yaya';
    const ihlaller = yaya ? YAYA_IHLALLERI : IHLALLER;
    const v0 = baslangicHizi(k, mu) * 3.6;
    const durmaMesafesi = frenMesafesi(v0 / 3.6, mu);
    const izUzun = !yaya && k.mod === 'hiz' && k.izM > durmaMesafesi + 0.3;
    const secili = liste.find((y) => y.anahtar === k.yaklasimAnahtar);

    return (
        <Kart className="overflow-hidden">
            <div className={cn('flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3', id === 'A' ? 'bg-taraf-a/[0.04]' : 'bg-taraf-b/[0.05]')}>
                <div className="flex min-w-0 items-center gap-2.5">
                    <TarafNokta id={id} className="h-8 w-8 text-sm" />
                    <div className="min-w-0">
                        <div className="text-[13px] font-bold uppercase tracking-[0.08em]">Taraf {id}</div>
                        <div className="truncate text-[12px] text-muted-foreground">{yaya ? 'Yaya' : ARAC_TURLERI[k.tur].ad}{k.plaka ? ` · ${k.plaka.toLocaleUpperCase('tr-TR')}` : ''} · {v0.toFixed(0)} km/s</div>
                    </div>
                </div>
                <div className="w-40 shrink-0">
                    <Segment ad={`Taraf ${id} tipi`} kucuk
                        secenekler={[
                            { deger: 'arac', etiket: <><Car className="h-3.5 w-3.5" /> Araç</> },
                            { deger: 'yaya', etiket: <><PersonStanding className="h-3.5 w-3.5" /> Yaya</> },
                        ] as const}
                        deger={k.tip} degisti={(v) => guncelle({ tip: v })} />
                </div>
            </div>

            <div className="space-y-3 p-4">
                {!yaya && (
                    <div className="grid grid-cols-2 gap-3">
                        <Alan etiket="Araç türü">
                            <Secim value={k.tur} onChange={(e) => guncelle({ tur: e.target.value as AracTuruId })}>
                                {Object.values(ARAC_TURLERI).map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
                            </Secim>
                        </Alan>
                        <Alan etiket="Plaka (isteğe bağlı)">
                            <Girdi value={k.plaka} maxLength={11} placeholder="34 ABC 123" onChange={(e) => guncelle({ plaka: e.target.value })} />
                        </Alan>
                    </div>
                )}

                <Alan etiket={yaya ? 'Geçiş / geliş güzergâhı' : 'Geliş yönü / yol'}>
                    {liste.length ? (
                        <Secim value={k.yaklasimAnahtar} onChange={(e) => guncelle({ yaklasimAnahtar: e.target.value })}>
                            {liste.map((y) => <option key={y.anahtar} value={y.anahtar}>{y.etiket}</option>)}
                        </Secim>
                    ) : (
                        <div className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Bu noktada uygun güzergâh yok; çarpışma noktasını bir yol üzerine taşıyın.</div>
                    )}
                </Alan>
                {secili?.tersYon && <Rozet renk="kirmizi">Tek yönlü yolda ters yön</Rozet>}

                {yaya ? (
                    <>
                        <Alan etiket="Yürüme hızı">
                            <div className="flex gap-2">
                                <div className="flex-1"><SayiGirdi deger={k.hizKmh} degisti={(v) => guncelle({ hizKmh: v })} min={0} max={30} adim={0.5} birim="km/s" /></div>
                                {[{ v: 5, e: 'Yürüyüş' }, { v: 8, e: 'Hızlı' }, { v: 14, e: 'Koşu' }].map((s) => (
                                    <button key={s.v} type="button" onClick={() => guncelle({ hizKmh: s.v })}
                                        className={cn('rounded-full px-2.5 text-[11.5px] font-semibold transition', k.hizKmh === s.v ? 'bg-foreground text-white' : 'bg-muted hover:bg-border')}>
                                        {s.e}
                                    </button>
                                ))}
                            </div>
                        </Alan>
                        <Alan etiket="Yaya kütlesi">
                            <SayiGirdi deger={k.kutleKg} degisti={(v) => guncelle({ kutleKg: v })} min={10} max={200} adim={1} birim="kg" />
                        </Alan>
                    </>
                ) : (
                    <>
                        <Segment ad="Hız belirleme" kucuk
                            secenekler={[{ deger: 'hiz', etiket: 'Hız biliniyor' }, { deger: 'iz', etiket: 'Fren izinden hesapla' }] as const}
                            deger={k.mod} degisti={(v) => guncelle({ mod: v })} />
                        <div className="grid grid-cols-2 gap-3">
                            {k.mod === 'hiz' ? (
                                <Alan etiket="Seyir hızı">
                                    <SayiGirdi deger={k.hizKmh} degisti={(v) => guncelle({ hizKmh: v })} min={0} max={250} birim="km/s" />
                                </Alan>
                            ) : (
                                <Alan etiket="İz sonu (çarpma) hızı" ipucu="Durarak bittiyse 0">
                                    <SayiGirdi deger={k.izSonuKmh} degisti={(v) => guncelle({ izSonuKmh: v })} min={0} max={200} adim={1} birim="km/s" />
                                </Alan>
                            )}
                            <Alan etiket="Fren izi" ipucu={k.mod === 'hiz' ? '0 → fren yapılmadı' : undefined}>
                                <SayiGirdi deger={k.izM} degisti={(v) => guncelle({ izM: v })} min={0} max={200} adim={0.5} birim="m" />
                            </Alan>
                        </div>
                        {k.mod === 'iz' && (
                            <div className="rounded-2xl bg-muted/70 px-3.5 py-2.5 text-[12.5px]">
                                Hesaplanan kaza öncesi hız: <b className="tabular-nums">{v0.toFixed(1)} km/s</b>
                                <span className="block text-[11px] text-muted-foreground">v = √(v<sub>son</sub>² + 2·µ·g·d) — asgari hız tahmini</span>
                            </div>
                        )}
                        {izUzun && (
                            <div className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                                {v0.toFixed(0)} km/s hızda tam durma mesafesi {durmaMesafesi.toFixed(1)} m; araç çarpışmadan önce durmuş kabul edilir.
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <Alan etiket="Kütle (yüklü)">
                                <SayiGirdi deger={k.kutleKg} degisti={(v) => guncelle({ kutleKg: v })} min={50} max={44000} adim={10} birim="kg" />
                            </Alan>
                            <Alan etiket="Algılama-tepki süresi">
                                <SayiGirdi deger={k.reaksiyonS} degisti={(v) => guncelle({ reaksiyonS: v })} min={0} max={3} adim={0.1} birim="sn" />
                            </Alan>
                        </div>
                    </>
                )}

                <details className="group rounded-2xl border border-border/80">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[12.5px] font-semibold">
                        <span>Olası kural ihlalleri {k.ihlaller.length > 0 && <Rozet renk="kirmizi" className="ml-1">{k.ihlaller.length}</Rozet>}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-0.5 px-1.5 pb-2">
                        {ihlaller.map((i) => (
                            <Onay key={i.id} secili={k.ihlaller.includes(i.id)}
                                degisti={(v) => guncelle({ ihlaller: v ? [...k.ihlaller, i.id] : k.ihlaller.filter((x) => x !== i.id) })}>
                                {i.ad}
                                <span className="block text-[11px] text-muted-foreground">{i.dayanak}</span>
                            </Onay>
                        ))}
                    </div>
                </details>
            </div>
        </Kart>
    );
}
