'use client';

// Alt zaman çubuğu: oynat/duraklat, sarma, hız; çarpışma anı işaretli.
// Mobilde çubuk üzerinde sağa/sola kaydırma ±0,5 sn atlar.

import { Pause, Play, SkipBack, StepBack, StepForward } from 'lucide-react';
import { useKaydirma } from '../hooks/useKaydirma.ts';
import { Buton, cn } from './ui/temel.tsx';

export interface ZamanCubuguProps {
    t: number;
    sure: number;
    tCarpisma: number;
    oynuyor: boolean;
    hiz: number;
    oynatDuraklat: () => void;
    zamanaGit: (t: number) => void;
    adimAt: (dt: number) => void;
    setHiz: (h: number) => void;
    etkin: boolean;
}

const HIZLAR = [0.1, 0.25, 0.5, 1];

export function ZamanCubugu(p: ZamanCubuguProps) {
    const kaydir = useKaydirma({ sola: () => p.adimAt(-0.5), saga: () => p.adimAt(0.5) });
    const oran = p.sure > 0 ? p.t / p.sure : 0;
    const carpOran = p.sure > 0 ? p.tCarpisma / p.sure : 0;
    return (
        <div {...kaydir} className={cn('flex items-center gap-2 rounded-full border border-border/80 bg-white/95 p-1.5 pr-3 shadow-lg backdrop-blur md:gap-3', !p.etkin && 'opacity-60')}>
            <Buton tur="birincil" boy="ikon" aria-label={p.oynuyor ? 'Duraklat (Boşluk)' : 'Oynat (Boşluk)'} title="Oynat / duraklat (Boşluk)" disabled={!p.etkin} onClick={p.oynatDuraklat}>
                {p.oynuyor ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
            </Buton>
            <div className="hidden items-center sm:flex">
                <Buton tur="hayalet" boy="ikon-sm" aria-label="Başa sar (Home)" title="Başa sar (Home)" disabled={!p.etkin} onClick={() => p.zamanaGit(0)}><SkipBack className="h-3.5 w-3.5" /></Buton>
                <Buton tur="hayalet" boy="ikon-sm" aria-label="0,1 sn geri (←)" title="0,1 sn geri (←)" disabled={!p.etkin} onClick={() => p.adimAt(-0.1)}><StepBack className="h-3.5 w-3.5" /></Buton>
                <Buton tur="hayalet" boy="ikon-sm" aria-label="0,1 sn ileri (→)" title="0,1 sn ileri (→)" disabled={!p.etkin} onClick={() => p.adimAt(0.1)}><StepForward className="h-3.5 w-3.5" /></Buton>
            </div>
            <div className="relative flex-1">
                <input
                    type="range"
                    className="zaman relative z-10 w-full cursor-pointer"
                    aria-label="Zaman"
                    min={0}
                    max={1000}
                    value={Math.round(oran * 1000)}
                    disabled={!p.etkin}
                    style={{ ['--dolu' as string]: `${oran * 100}%` }}
                    onChange={(e) => p.zamanaGit((parseFloat(e.target.value) / 1000) * p.sure)}
                />
                {p.etkin && (
                    <span className="pointer-events-none absolute top-1/2 z-0 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70" style={{ left: `${carpOran * 100}%` }} title="Çarpışma anı" />
                )}
            </div>
            <span className="w-[86px] shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-foreground">
                {p.t.toFixed(1)} / {p.sure.toFixed(1)} sn
            </span>
            <select
                aria-label="Oynatma hızı"
                value={p.hiz}
                onChange={(e) => p.setHiz(parseFloat(e.target.value))}
                className="hidden shrink-0 cursor-pointer rounded-full bg-muted px-3 py-1.5 text-[12px] font-semibold outline-none focus:ring-2 focus:ring-aha-red/20 sm:block"
            >
                {HIZLAR.map((h) => <option key={h} value={h}>{h}×</option>)}
            </select>
        </div>
    );
}
