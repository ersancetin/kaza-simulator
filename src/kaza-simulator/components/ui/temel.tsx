'use client';

// Shadcn standartlarında, Pill-UI kurallarına uygun temel arayüz bileşenleri.

import * as RadixTooltip from '@radix-ui/react-tooltip';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

export function cn(...siniflar: Array<string | false | null | undefined>): string {
    return siniflar.filter(Boolean).join(' ');
}

type ButonTuru = 'birincil' | 'ikincil' | 'hayalet' | 'sessiz' | 'koyu';
type ButonBoyu = 'md' | 'sm' | 'ikon' | 'ikon-sm';

const BUTON_TUR: Record<ButonTuru, string> = {
    birincil: 'bg-aha-red text-white shadow-sm hover:bg-aha-red-dark active:bg-aha-red-dark',
    ikincil: 'bg-white text-foreground border border-border hover:border-foreground/30 hover:bg-muted/60',
    hayalet: 'bg-transparent text-foreground hover:bg-muted',
    sessiz: 'bg-muted text-foreground hover:bg-border/70',
    koyu: 'bg-foreground text-white hover:bg-foreground/90',
};

const BUTON_BOY: Record<ButonBoyu, string> = {
    md: 'px-6 py-3 text-sm gap-2',
    sm: 'px-4 py-2 text-[13px] gap-1.5',
    ikon: 'h-10 w-10 justify-center',
    'ikon-sm': 'h-8 w-8 justify-center',
};

export interface ButonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    tur?: ButonTuru;
    boy?: ButonBoyu;
}

export const Buton = forwardRef<HTMLButtonElement, ButonProps>(function Buton({ tur = 'ikincil', boy = 'md', className, type = 'button', ...p }, ref) {
    return (
        <button
            ref={ref}
            type={type}
            className={cn(
                'inline-flex shrink-0 items-center rounded-full font-semibold transition-colors outline-none',
                'focus-visible:ring-2 focus-visible:ring-aha-red/30 disabled:pointer-events-none disabled:opacity-45',
                BUTON_TUR[tur], BUTON_BOY[boy], className,
            )}
            {...p}
        />
    );
});

export function Kart({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cn('rounded-2xl border border-border/80 bg-card shadow-sm', className)}>{children}</div>;
}

export function Baslik({ children, sag }: { children: ReactNode; sag?: ReactNode }) {
    return (
        <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">{children}</h3>
            {sag}
        </div>
    );
}

export function Alan({ etiket, ipucu, children, className }: { etiket: string; ipucu?: string; children: ReactNode; className?: string }) {
    return (
        <label className={cn('block', className)}>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{etiket}</span>
            {children}
            {ipucu && <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{ipucu}</span>}
        </label>
    );
}

const GIRDI = 'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-aha-red focus:ring-2 focus:ring-aha-red/20';

export const Girdi = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Girdi({ className, ...p }, ref) {
    return <input ref={ref} className={cn(GIRDI, className)} {...p} />;
});

export function SayiGirdi({ deger, degisti, min, max, adim = 1, birim, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    deger: number; degisti: (v: number) => void; min?: number; max?: number; adim?: number; birim?: string;
}) {
    return (
        <div className="relative">
            <input
                type="number"
                inputMode="decimal"
                className={cn(GIRDI, birim && 'pr-14')}
                value={Number.isFinite(deger) ? deger : ''}
                min={min}
                max={max}
                step={adim}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    degisti(Number.isFinite(v) ? Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v)) : 0);
                }}
                {...p}
            />
            {birim && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{birim}</span>}
        </div>
    );
}

export function Secim({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select className={cn(GIRDI, 'cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)}
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237F828A' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
            {...p}>
            {children}
        </select>
    );
}

export interface SegmentSecenek<T extends string> {
    deger: T;
    etiket: ReactNode;
    baslik?: string;
}

export function Segment<T extends string>({ secenekler, deger, degisti, ad, kucuk }: {
    secenekler: readonly SegmentSecenek<T>[]; deger: T; degisti: (v: T) => void; ad: string; kucuk?: boolean;
}) {
    return (
        <div role="radiogroup" aria-label={ad} className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
            {secenekler.map((s) => (
                <button
                    key={s.deger}
                    type="button"
                    role="radio"
                    aria-checked={deger === s.deger}
                    title={s.baslik}
                    onClick={() => degisti(s.deger)}
                    className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-aha-red/30',
                        kucuk ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3 py-2 text-[12.5px]',
                        deger === s.deger ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {s.etiket}
                </button>
            ))}
        </div>
    );
}

export function Rozet({ children, renk = 'gri', className }: { children: ReactNode; renk?: 'gri' | 'kirmizi' | 'sari' | 'yesil' | 'mavi'; className?: string }) {
    const r = {
        gri: 'bg-muted text-muted-foreground',
        kirmizi: 'bg-aha-red/10 text-aha-red',
        sari: 'bg-amber-100 text-amber-800',
        yesil: 'bg-emerald-50 text-emerald-700',
        mavi: 'bg-taraf-b/10 text-taraf-b',
    }[renk];
    return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', r, className)}>{children}</span>;
}

export function Ipucu({ metin, children, yan = 'top' }: { metin: string; children: ReactNode; yan?: 'top' | 'bottom' | 'left' | 'right' }) {
    return (
        <RadixTooltip.Root delayDuration={250}>
            <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
            <RadixTooltip.Portal>
                <RadixTooltip.Content side={yan} sideOffset={6} className="z-[3000] max-w-64 rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-white shadow-lg animate-giris">
                    {metin}
                    <RadixTooltip.Arrow className="fill-foreground" />
                </RadixTooltip.Content>
            </RadixTooltip.Portal>
        </RadixTooltip.Root>
    );
}

export function TarafNokta({ id, className }: { id: 'A' | 'B'; className?: string }) {
    return (
        <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white', id === 'A' ? 'bg-taraf-a' : 'bg-taraf-b', className)}>
            {id}
        </span>
    );
}

export function Onay({ secili, degisti, children }: { secili: boolean; degisti: (v: boolean) => void; children: ReactNode }) {
    return (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 text-[13px] leading-snug hover:bg-muted/70">
            <input type="checkbox" checked={secili} onChange={(e) => degisti(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[#C81D25]" />
            <span>{children}</span>
        </label>
    );
}
