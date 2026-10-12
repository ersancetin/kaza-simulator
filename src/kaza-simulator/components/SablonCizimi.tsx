'use client';

// Şablon senaryonun kuşbakışı mini çizimi: yollar, iki tarafın geliş okları ve
// çarpışma noktası — doğrudan şablonun gerçek geometrisinden üretilir.

import { useMemo } from 'react';
import { TARAF_RENK, YAYA_SINIFLARI } from '../data/kazaData.ts';
import { Rota } from '../lib/geometry.ts';
import { sablonKur, yaklasimListesi } from '../lib/senaryo.ts';
import { seritRotasi } from '../lib/simulate.ts';
import type { SablonSenaryo, TarafId, Vec2 } from '../types/kazaTypes.ts';

const BOY = 64;
const YARICAP = 30; // çizimde görünen yarıçap (m)

export function SablonCizimi({ sablon }: { sablon: SablonSenaryo }) {
    const ciz = useMemo(() => {
        const k = sablonKur(sablon);
        const P = k.P;
        const olcek = BOY / 2 / YARICAP;
        const px = (p: Vec2): string => `${(BOY / 2 + (p.x - P.x) * olcek).toFixed(1)},${(BOY / 2 + (p.z - P.z) * olcek).toFixed(1)}`;
        const yollar = k.cevre.yollar
            .filter((y) => !YAYA_SINIFLARI.has(y.sinif))
            .map((y) => ({ d: 'M' + y.noktalar.map(px).join('L'), w: y.genislik * olcek }));
        const oklar = (['A', 'B'] as const).map((id: TarafId) => {
            const g = k[id];
            const y = yaklasimListesi(k.cevre, P, g.tip).find((v) => v.anahtar === g.yaklasimAnahtar);
            if (!y) return null;
            const rota = new Rota(seritRotasi(y, g.tip === 'yaya'));
            const pts: Vec2[] = [];
            for (let s = Math.max(0, rota.uzunluk - 26); s <= rota.uzunluk - 3; s += 1.5) pts.push(rota.konum(s));
            return { id, d: 'M' + pts.map(px).join('L') };
        });
        return { yollar, oklar };
    }, [sablon]);

    return (
        <svg viewBox={`0 0 ${BOY} ${BOY}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl" aria-hidden="true">
            <defs>
                {(['A', 'B'] as const).map((id) => (
                    <marker key={id} id={`ok-${sablon.id}-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                        <path d="M0,0L10,5L0,10z" fill={TARAF_RENK[id]} />
                    </marker>
                ))}
            </defs>
            <rect width={BOY} height={BOY} fill="#dfe8d3" />
            {ciz.yollar.map((y, i) => <path key={`k${i}`} d={y.d} stroke="#e7e5df" strokeWidth={y.w + 3.5} fill="none" strokeLinejoin="round" />)}
            {ciz.yollar.map((y, i) => <path key={`a${i}`} d={y.d} stroke="#5a5e65" strokeWidth={y.w} fill="none" strokeLinejoin="round" />)}
            {ciz.oklar.map((o) => o && (
                <path key={o.id} d={o.d} stroke={TARAF_RENK[o.id]} strokeWidth={2.4} fill="none" strokeLinecap="round" markerEnd={`url(#ok-${sablon.id}-${o.id})`} />
            ))}
            <circle cx={BOY / 2} cy={BOY / 2} r={3.2} fill="#fff" stroke="#C81D25" strokeWidth={1.6} />
        </svg>
    );
}
