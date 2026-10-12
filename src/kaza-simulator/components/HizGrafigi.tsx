'use client';

// Hız–zaman grafiği: iki taraf (A/B) tek eksende, çarpışma anı işaretli.
// Üzerine gelince imleç her iki tarafın hızını gösterir; tıklayınca canlandırma o ana sarılır.

import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { TARAF_RENK } from '../data/kazaData.ts';
import { KANAL_SAYISI, type SimSonuc, type TarafId } from '../types/kazaTypes.ts';

const W = 360;
const H = 168;
const PAD = { sol: 34, sag: 14, ust: 20, alt: 24 };

export interface HizGrafigiProps {
    sonuc: SimSonuc;
    t: number;
    tarafAdlari: Record<TarafId, string>;
    zamanaGit: (t: number) => void;
}

function guzelAdim(max: number): number {
    for (const a of [5, 10, 20, 25, 50]) if (max / a <= 5) return a;
    return 100;
}

export function HizGrafigi({ sonuc, t, tarafAdlari, zamanaGit }: HizGrafigiProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [imlec, setImlec] = useState<number | null>(null);

    const veri = useMemo(() => {
        const adim = 2;
        const seri = (id: TarafId): number[] => {
            const k = sonuc.taraflar[id].kareler;
            const d: number[] = [];
            for (let i = 0; i < sonuc.kareSayisi; i += adim) d.push(k[i * KANAL_SAYISI + 6] * 3.6);
            return d;
        };
        const A = seri('A');
        const B = seri('B');
        const enCok = Math.max(10, ...A, ...B);
        const yAdim = guzelAdim(enCok);
        const yMax = Math.ceil(enCok / yAdim) * yAdim;
        return { A, B, adim, yMax, yAdim };
    }, [sonuc]);

    const iW = W - PAD.sol - PAD.sag;
    const iH = H - PAD.ust - PAD.alt;
    const x = (zaman: number): number => PAD.sol + (zaman / sonuc.sure) * iW;
    const y = (hiz: number): number => PAD.ust + iH - (hiz / veri.yMax) * iH;
    const yol = (d: number[]): string => d.map((v, i) => `${i ? 'L' : 'M'}${x((i * veri.adim) / sonuc.fps).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const deger = (d: number[], zaman: number): number => d[Math.min(d.length - 1, Math.max(0, Math.round((zaman * sonuc.fps) / veri.adim)))];

    const zamandan = (e: MouseEvent<SVGSVGElement>): number => {
        const k = svgRef.current?.getBoundingClientRect();
        if (!k) return 0;
        const px = ((e.clientX - k.left) / k.width) * W;
        return Math.max(0, Math.min(sonuc.sure, ((px - PAD.sol) / iW) * sonuc.sure));
    };

    const tC = sonuc.tCarpisma;
    const xEtiket = [0, tC, sonuc.sure];
    const yCizgiler: number[] = [];
    for (let v = 0; v <= veri.yMax; v += veri.yAdim) yCizgiler.push(v);
    const goster = imlec ?? null;

    return (
        <figure className="m-0">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground" aria-hidden="true">
                {(['A', 'B'] as const).map((id) => (
                    <span key={id} className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: TARAF_RENK[id] }} />
                        <span className="max-w-36 truncate font-medium text-foreground">{tarafAdlari[id]}</span>
                    </span>
                ))}
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-px border-l border-dashed border-foreground/60" /> Çarpışma
                </span>
            </div>
            <div className="relative">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    className="block w-full cursor-crosshair touch-none select-none"
                    role="img"
                    aria-label={`Hız–zaman grafiği. Çarpışma ${tC.toFixed(1)}. saniyede.`}
                    onPointerMove={(e) => setImlec(zamandan(e))}
                    onPointerLeave={() => setImlec(null)}
                    onClick={(e) => zamanaGit(zamandan(e))}
                >
                    {yCizgiler.map((v) => (
                        <g key={v}>
                            <line x1={PAD.sol} x2={W - PAD.sag} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-border" strokeWidth={v === 0 ? 1 : 0.6} />
                            <text x={PAD.sol - 6} y={y(v) + 3.5} textAnchor="end" className="fill-muted-foreground" fontSize="9.5">{v}</text>
                        </g>
                    ))}
                    <text x={PAD.sol - 6} y={PAD.ust - 9} textAnchor="end" className="fill-muted-foreground" fontSize="9">km/s</text>
                    {xEtiket.map((z, i) => (
                        <text key={i} x={x(z)} y={H - 7} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-muted-foreground" fontSize="9.5">{z.toFixed(1)} sn</text>
                    ))}
                    <line x1={x(tC)} x2={x(tC)} y1={PAD.ust} y2={PAD.ust + iH} stroke="currentColor" className="text-foreground/60" strokeDasharray="3 3" strokeWidth={1} />

                    {(['B', 'A'] as const).map((id) => (
                        <path key={id} d={yol(veri[id])} fill="none" stroke={TARAF_RENK[id]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    ))}

                    {/* Canlandırmanın o anki konumu */}
                    <line x1={x(t)} x2={x(t)} y1={PAD.ust} y2={PAD.ust + iH} stroke="#C81D25" strokeOpacity={0.35} strokeWidth={2} />

                    {goster !== null && (
                        <g pointerEvents="none">
                            <line x1={x(goster)} x2={x(goster)} y1={PAD.ust} y2={PAD.ust + iH} stroke="currentColor" className="text-foreground/50" strokeWidth={1} />
                            {(['A', 'B'] as const).map((id) => (
                                <circle key={id} cx={x(goster)} cy={y(deger(veri[id], goster))} r={4} fill={TARAF_RENK[id]} stroke="#fff" strokeWidth={2} />
                            ))}
                        </g>
                    )}
                    {/* Doğrudan etiketler: serilerin başında; değerler yakınsa dikeyde ayrılır */}
                    {(['A', 'B'] as const).map((id) => {
                        const yA = y(veri.A[0]);
                        const yB = y(veri.B[0]);
                        const yakin = Math.abs(yA - yB) < 12;
                        const yy = id === 'A' ? yA - 5 : yakin ? yB + 12 : yB - 5;
                        return <text key={id} x={PAD.sol + 4} y={yy} fontSize="10" fontWeight={700} className="fill-foreground">{id}</text>;
                    })}
                </svg>
                {goster !== null && (
                    <div
                        className="pointer-events-none absolute top-1 z-10 rounded-xl bg-foreground px-2.5 py-1.5 text-[11px] text-white shadow-lg"
                        style={{ left: `${Math.min(70, Math.max(0, (x(goster) / W) * 100 - 15))}%` }}
                    >
                        <div className="mb-0.5 text-white/70">t = {goster.toFixed(2)} sn</div>
                        {(['A', 'B'] as const).map((id) => (
                            <div key={id} className="flex items-center gap-1.5">
                                <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: TARAF_RENK[id] }} />
                                <b className="tabular-nums">{deger(veri[id], goster).toFixed(1)} km/s</b>
                                <span className="text-white/70">{id}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <details className="mt-2 text-[11.5px]">
                <summary className="cursor-pointer font-semibold text-muted-foreground">Tablo görünümü</summary>
                <table className="mt-1.5 w-full text-left tabular-nums">
                    <thead className="text-muted-foreground">
                        <tr><th className="py-1 font-medium">An</th><th className="font-medium">A (km/s)</th><th className="font-medium">B (km/s)</th></tr>
                    </thead>
                    <tbody>
                        {[
                            { ad: 'Başlangıç', z: 0 },
                            { ad: 'Çarpışma öncesi', z: Math.max(0, tC - 1 / sonuc.fps) },
                            { ad: 'Çarpışma sonrası', z: Math.min(sonuc.sure, tC + 2 / sonuc.fps) },
                            { ad: 'Son', z: sonuc.sure },
                        ].map((r) => (
                            <tr key={r.ad} className="border-t border-border/60">
                                <td className="py-1">{r.ad}</td>
                                <td>{deger(veri.A, r.z).toFixed(1)}</td>
                                <td>{deger(veri.B, r.z).toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </figure>
    );
}
