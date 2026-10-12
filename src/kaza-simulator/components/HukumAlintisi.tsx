// KTK hükmünden birebir alıntı bloğu (ekran ve yazdırma için).

import type { ReactNode } from 'react';
import type { KtkHukum } from '../data/ktkMetinleri.ts';
import { cn } from './ui/temel.tsx';

export interface HukumAlintisiProps {
    hukum: KtkHukum;
    /** Yazdırma görünümü: sabit renkler, pt ölçüleri */
    baski?: boolean;
    className?: string;
    ek?: ReactNode;
}

export function HukumAlintisi({ hukum, baski, className, ek }: HukumAlintisiProps) {
    return (
        <figure className={cn(
            'm-0 border-l-[3px]',
            baski ? 'rounded-r-[2mm] border-[#C81D25] bg-[#f7f5f4] px-[3.5mm] py-[2mm]' : 'rounded-r-xl border-aha-red/60 bg-muted/60 px-3 py-2',
            className,
        )} style={{ breakInside: 'avoid' }}>
            <figcaption className={cn('flex flex-wrap items-baseline gap-x-2 font-bold', baski ? 'text-[8.5pt] text-[#C81D25]' : 'text-[11px] text-aha-red')}>
                <span>{hukum.atif}</span>
                <span className={cn('font-semibold', baski ? 'text-[#666]' : 'text-muted-foreground')}>{hukum.baslik}</span>
                {ek}
            </figcaption>
            <blockquote className={cn('m-0 mt-0.5', baski ? 'text-[8.8pt] leading-[1.45] text-[#222]' : 'text-[11.5px] leading-relaxed text-foreground/85')}>
                “{hukum.parcalar.map((p, i) => (
                    <span key={i}>{i > 0 && <span className={baski ? 'text-[#999]' : 'text-muted-foreground'}> … </span>}{p}</span>
                ))}”
            </blockquote>
        </figure>
    );
}
