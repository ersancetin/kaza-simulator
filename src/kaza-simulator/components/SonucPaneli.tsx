'use client';

// Hesaplama sonuçları ve kusur ön değerlendirmesi.

import { CircleHelp, FileImage, Printer, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { siddetEtiketi } from '../lib/physics.ts';
import type { KatilimciGirdi, KusurSonuc, SimSonuc, TarafId, TarafSonuc } from '../types/kazaTypes.ts';
import { Baslik, Buton, Kart, Rozet, TarafNokta, cn } from './ui/temel.tsx';

const TIP_ADI: Record<SimSonuc['tip'], string> = {
    yandan: 'Önden-yana (yandan) çarpışma',
    'kafa-kafaya': 'Kafa kafaya çarpışma',
    arkadan: 'Arkadan çarpma',
    siyirma: 'Sıyırma',
    yaya: 'Yayaya çarpma',
};

const kmh = (v: number): string => (v * 3.6).toFixed(1);

function Satir({ ad, deger, vurgu }: { ad: ReactNode; deger: ReactNode; vurgu?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]">
            <span className="text-muted-foreground">{ad}</span>
            <span className={cn('text-right font-semibold tabular-nums', vurgu && 'text-aha-red')}>{deger}</span>
        </div>
    );
}

function TarafBlogu({ s, ad }: { s: TarafSonuc; ad: string }) {
    const yaya = s.tip === 'yaya';
    const siddet = siddetEtiketi(s.deltaV);
    const k = s.kacinilabilirlik;
    return (
        <Kart className="p-4">
            <div className="mb-2 flex items-center gap-2.5">
                <TarafNokta id={s.id} className="h-7 w-7" />
                <div className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{ad}</div>
                <Rozet className="shrink-0" renk={siddet.ad === 'Hafif' ? 'yesil' : siddet.ad === 'Orta' ? 'sari' : 'kirmizi'}>{siddet.ad}</Rozet>
            </div>
            <div className="divide-y divide-border/60">
                <Satir ad="Kaza öncesi hız" deger={`${kmh(s.v0)} km/s`} />
                {!yaya && <Satir ad="Çarpma anı hızı" deger={`${kmh(s.vi)} km/s`} vurgu />}
                {!yaya && s.izGirilen > 0 && <Satir ad="Fren izi (etkin)" deger={`${s.izEtkin.toFixed(1)} m`} />}
                {!yaya && <Satir ad="Tam durma fren mesafesi" deger={`${s.frenMesafesi.toFixed(1)} m`} />}
                {!yaya && <Satir ad={`Duruş mesafesi (${s.reaksiyon.toFixed(1)} sn tepki dâhil)`} deger={`${s.durusMesafesi.toFixed(1)} m`} />}
                {!yaya && s.algilamaMesafesi > 0 && <Satir ad="Tehlikeyi algılama noktası" deger={`çarpışmadan ${s.algilamaMesafesi.toFixed(1)} m önce`} />}
                <Satir ad="Hız değişimi (ΔV)" deger={`${kmh(s.deltaV)} km/s`} />
                <Satir ad={yaya ? 'Fırlatma mesafesi' : 'Çarpışma sonrası savrulma'} deger={`${s.savrulmaMesafesi.toFixed(1)} m${!yaya && s.donmeDerece > 3 ? ` · ${s.donmeDerece.toFixed(0)}° dönme` : ''}`} />
                {s.searleAsgariHiz !== null && (
                    <Satir ad="Fırlatmadan asgari çarpma hızı (Searle)" deger={`${kmh(s.searleAsgariHiz)} km/s`} />
                )}
            </div>
            {k && (
                <div className={cn('mt-3 rounded-2xl px-3.5 py-3 text-[12.5px] leading-relaxed', k.kacinilabilir ? 'bg-emerald-50 text-emerald-900' : 'bg-muted/80')}>
                    <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
                        Kaçınılabilirlik (hız sınırı {Math.round(k.limitHizi * 3.6)} km/s)
                        <span title="Sürücü hız sınırında seyretseydi, tehlikeyi aynı noktada algılayıp aynı tepki süresiyle frene bassaydı ne olurdu?"><CircleHelp className="h-3.5 w-3.5 opacity-60" /></span>
                    </div>
                    {k.kacinilabilir
                        ? <>Sınırda seyretseydi {k.limitteDurusMesafesi.toFixed(1)} m’de durarak çarpışma noktasına <b>ulaşmadan durabilirdi</b>.</>
                        : <>Sınırda seyretseydi de duramazdı; çarpma hızı yaklaşık <b>{kmh(k.limitteCarpmaHizi)} km/s</b> olurdu.</>}
                </div>
            )}
        </Kart>
    );
}

export interface SonucPaneliProps {
    sonuc: SimSonuc | null;
    kusur: KusurSonuc | null;
    katilimcilar: Record<TarafId, KatilimciGirdi>;
    tarafAdlari: Record<TarafId, string>;
    yazdir: () => void;
    krokiIndir: () => void;
}

export function SonucPaneli({ sonuc, kusur, tarafAdlari, yazdir, krokiIndir }: SonucPaneliProps) {
    if (!sonuc || !kusur) {
        return (
            <Kart className="p-6 text-center">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Sonuçlar burada görünecek. Tarafları ve koşulları girip <b className="text-foreground">Hesapla ve Canlandır</b>’a basın.
                </p>
            </Kart>
        );
    }
    const yuzde = (id: TarafId): number => kusur[id].yuzde;
    return (
        <div className="space-y-3">
            <Kart className="p-4">
                <Baslik sag={<Rozet>{(sonuc.tCarpisma).toFixed(1)} sn’de temas</Rozet>}>Özet</Baslik>
                <div className="text-[14px] font-semibold">{TIP_ADI[sonuc.tip]}</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">
                    Çarpışmada sönümlenen kinetik enerji ≈ <b className="text-foreground tabular-nums">{sonuc.enerjiKJ.toFixed(0)} kJ</b>
                </div>
                {sonuc.uyarilar.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                        {sonuc.uyarilar.map((u) => (
                            <li key={u} className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
                                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {u}
                            </li>
                        ))}
                    </ul>
                )}
            </Kart>

            <TarafBlogu s={sonuc.taraflar.A} ad={tarafAdlari.A} />
            <TarafBlogu s={sonuc.taraflar.B} ad={tarafAdlari.B} />

            <Kart className="p-4">
                <Baslik>Kusur ön değerlendirmesi</Baslik>
                <div className="flex h-9 overflow-hidden rounded-full text-[12.5px] font-bold text-white">
                    <div className="flex min-w-14 items-center justify-center bg-taraf-a transition-all" style={{ flex: Math.max(yuzde('A'), 9) }}>A %{kusur.A.yuzdeMetin}</div>
                    <div className="flex min-w-14 items-center justify-center bg-taraf-b transition-all" style={{ flex: Math.max(yuzde('B'), 9) }}>B %{kusur.B.yuzdeMetin}</div>
                </div>
                {kusur.belirsiz && <p className="mt-2 text-[12px] text-muted-foreground">İki taraf için de ihlal işaretlenmediğinden dağılım belirlenemedi; %50–%50 varsayıldı.</p>}
                <div className="mt-3 space-y-3">
                    {(['A', 'B'] as const).map((id) => (
                        <div key={id}>
                            <div className="flex items-center justify-between gap-2 text-[12.5px]">
                                <span className="min-w-0 truncate font-semibold">{tarafAdlari[id]}</span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                    <Rozet renk={kusur[id].etiket.sinif === 'asli' ? 'kirmizi' : kusur[id].etiket.sinif === 'tali' ? 'sari' : 'yesil'}>{kusur[id].etiket.ad}</Rozet>
                                    <span className="font-bold tabular-nums">{kusur[id].sekizlik}</span>
                                </span>
                            </div>
                            <ul className="mt-1 space-y-0.5 pl-1 text-[12px] leading-snug text-muted-foreground">
                                {kusur[id].gerekceler.length
                                    ? kusur[id].gerekceler.map((g) => <li key={g.ad}>• {g.ad} <i className="opacity-80">({g.dayanak})</i></li>)
                                    : <li>• Kural ihlali işaretlenmedi</li>}
                            </ul>
                        </div>
                    ))}
                </div>
                <p className="mt-3 rounded-2xl border border-aha-red/25 bg-aha-red/[0.04] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-foreground/80">
                    <b>Simülasyon sonucudur.</b> Meslektaşlarımızın dosya hazırlığına yardımcı olmak için sunulan bir ön değerlendirmedir; hukuki görüş, bilirkişi raporu veya kusur tespiti niteliği taşımaz. Gerçek kusur değerlendirmesi somut olayın tüm delilleriyle bilirkişiler ve yargı mercilerince yapılır.
                </p>
            </Kart>

            <div className="grid grid-cols-2 gap-2">
                <Buton tur="ikincil" className="justify-center" onClick={krokiIndir}><FileImage className="h-4 w-4" /> Kroki</Buton>
                <Buton tur="koyu" className="justify-center" onClick={yazdir}><Printer className="h-4 w-4" /> Rapor / PDF</Buton>
            </div>
        </div>
    );
}
