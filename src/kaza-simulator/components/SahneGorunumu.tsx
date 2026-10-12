'use client';

import { Crosshair, Eye, Loader2, MousePointerClick, Pencil, RotateCw, Video, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ISARET_ADI, MARKA } from '../data/kazaData.ts';
import { anlikDurum } from '../lib/hud.ts';
import type { SahneMotoru } from '../lib/three/sahneMotoru.ts';
import type { CevreDurumu, DuzenlemeModu, KameraModu, SimSonuc, TarafId } from '../types/kazaTypes.ts';
import { Buton, Segment, TarafNokta, cn } from './ui/temel.tsx';

export interface SahneGorunumuProps {
    motorBagla: (m: SahneMotoru | null) => void;
    durum: CevreDurumu;
    duzenleme: DuzenlemeModu;
    duzenlemeBitir: () => void;
    sonuc: SimSonuc | null;
    sonucEski: boolean;
    t: number;
    tarafAdlari: Record<TarafId, string>;
    kamera: KameraModu;
    setKamera: (k: KameraModu) => void;
    kameraSifirla: () => void;
    videoAktif: boolean;
    videoIlerleme: number;
    videoIptal: () => void;
}

export const KAMERA_SECENEKLERI: ReadonlyArray<{ deger: KameraModu; etiket: string; baslik: string }> = [
    { deger: 'serbest', etiket: 'Serbest', baslik: 'Serbest kamera (1)' },
    { deger: 'ustten', etiket: 'Üstten', baslik: 'Kuşbakışı (2)' },
    { deger: 'A', etiket: 'A takip', baslik: 'A tarafını takip et (3)' },
    { deger: 'B', etiket: 'B takip', baslik: 'B tarafını takip et (4)' },
    { deger: 'A-surucu', etiket: 'A gözü', baslik: 'A sürücüsünün görüşü (5)' },
    { deger: 'B-surucu', etiket: 'B gözü', baslik: 'B sürücüsünün / yayanın görüşü (6)' },
];

function duzenlemeMetni(d: DuzenlemeModu): string | null {
    switch (d.tur) {
        case 'nokta': return 'Çarpışma noktası için sahnede yol üzerine tıklayın';
        case 'isaret': return `${ISARET_ADI(d.tip)}: yerleştirmek için tıklayın (arka arkaya eklenebilir)`;
        case 'ciz': return `${d.yaya ? 'Yaya yolu' : 'Yol'} çizimi: güzergâh noktalarına tıklayın (${d.noktalar.length} nokta)`;
        default: return null;
    }
}

export function SahneGorunumu(p: SahneGorunumuProps) {
    const kapRef = useRef<HTMLDivElement>(null);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [hata, setHata] = useState<string | null>(null);
    const bagla = useRef(p.motorBagla);
    bagla.current = p.motorBagla;

    useEffect(() => {
        let motor: SahneMotoru | null = null;
        let iptal = false;
        void import('../lib/three/sahneMotoru.ts')
            .then(({ SahneMotoru: Sinif }) => {
                if (iptal || !kapRef.current) return;
                try {
                    motor = new Sinif(kapRef.current);
                    bagla.current(motor);
                } catch {
                    setHata('3B görünüm başlatılamadı. Tarayıcınızda WebGL etkin olmalıdır.');
                }
                setYukleniyor(false);
            })
            .catch(() => {
                setHata('3B motor yüklenemedi.');
                setYukleniyor(false);
            });
        return () => {
            iptal = true;
            bagla.current(null);
            motor?.yokEt();
        };
    }, []);

    const anlik = useMemo(() => (p.sonuc ? anlikDurum(p.sonuc, p.t) : null), [p.sonuc, p.t]);
    const mesaj = duzenlemeMetni(p.duzenleme);
    const DuzenIkon = p.duzenleme.tur === 'ciz' ? Pencil : p.duzenleme.tur === 'nokta' ? Crosshair : MousePointerClick;

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#dce7ef]">
            <div ref={kapRef} className="absolute inset-0" aria-label="3B kaza sahnesi" />

            {(yukleniyor || p.durum.tur === 'yukleniyor') && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-white/80 to-white/50 backdrop-blur-[3px]">
                    <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-10 py-7 shadow-xl animate-giris">
                        <span className="relative flex h-20 w-20 items-center justify-center">
                            <span className="absolute inset-0 animate-ping rounded-full bg-aha-red/15" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={MARKA.logo} alt="" className="relative h-20 w-20 rounded-full shadow-md" />
                        </span>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Loader2 className="h-4 w-4 animate-spin text-aha-red" />
                            {p.durum.tur === 'yukleniyor' ? p.durum.mesaj : '3B sahne hazırlanıyor…'}
                        </div>
                    </div>
                </div>
            )}
            {hata && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
                    <div className="max-w-sm rounded-2xl bg-white p-5 text-center text-sm shadow-lg">{hata}</div>
                </div>
            )}

            {/* Üst sol: anlık durum */}
            {anlik && (
                <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5 md:left-4 md:top-4">
                    {(['A', 'B'] as const).map((id) => (
                        <div key={id} className="flex items-center gap-2 rounded-full bg-white/92 py-1 pl-1 pr-3.5 text-[12.5px] shadow-sm backdrop-blur">
                            <TarafNokta id={id} />
                            <span className="hidden max-w-40 truncate font-semibold sm:inline">{p.tarafAdlari[id]}</span>
                            <span className="font-bold tabular-nums">{anlik[id].hizKmh.toFixed(0)} km/s</span>
                            <span className={cn('font-medium', anlik[id].faz === 'ÇARPIŞMA' ? 'text-aha-red' : 'text-muted-foreground')}>{anlik[id].faz}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Üst sağ: kamera */}
            <div className="absolute right-3 top-3 z-10 hidden items-center gap-2 lg:flex md:right-4 md:top-4">
                <div className="rounded-full bg-white/92 shadow-sm backdrop-blur">
                    <Segment ad="Kamera modu" kucuk secenekler={KAMERA_SECENEKLERI.map((k) => ({ deger: k.deger, etiket: k.etiket, baslik: k.baslik }))} deger={p.kamera} degisti={p.setKamera} />
                </div>
                <Buton tur="ikincil" boy="ikon" className="bg-white/92 shadow-sm" aria-label="Kamerayı sıfırla" title="Kamerayı kaza noktasına odakla" onClick={p.kameraSifirla}>
                    <RotateCw className="h-4 w-4" />
                </Buton>
            </div>

            {/* Düzenleme modu bandı */}
            {mesaj && (
                <div className="absolute left-1/2 top-16 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground py-1.5 pl-4 pr-1.5 text-[12.5px] font-semibold text-white shadow-lg animate-giris md:top-4">
                    <DuzenIkon className="h-4 w-4" />
                    <span className="max-w-[60vw] truncate">{mesaj}</span>
                    <button type="button" onClick={p.duzenlemeBitir} className="ml-1 flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[12px] hover:bg-white/25">
                        <X className="h-3.5 w-3.5" /> Bitir <kbd className="hidden text-[10px] opacity-70 sm:inline">Esc</kbd>
                    </button>
                </div>
            )}

            {p.sonucEski && !mesaj && (
                <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-amber-100 px-4 py-1.5 text-[12.5px] font-semibold text-amber-900 shadow-sm md:top-4">
                    Girdiler değişti — güncel sonuç için yeniden hesaplayın
                </div>
            )}

            {p.durum.tur === 'hazir' && !p.sonuc && !mesaj && (
                <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[70%] items-center gap-2 rounded-full bg-white/92 px-4 py-2 text-[12px] font-medium text-muted-foreground shadow-sm md:left-4 md:top-4">
                    <Eye className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.durum.not}</span>
                </div>
            )}

            {p.videoAktif && (
                <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/10 p-6">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Video className="h-4 w-4 text-aha-red" /> Video kaydediliyor… %{Math.round(p.videoIlerleme * 100)}
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-aha-red transition-[width]" style={{ width: `${p.videoIlerleme * 100}%` }} />
                        </div>
                        <Buton tur="ikincil" boy="sm" className="mt-3" onClick={p.videoIptal}>İptal</Buton>
                    </div>
                </div>
            )}
        </div>
    );
}
