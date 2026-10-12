'use client';

// Kurumsal kimlik ögeleri: marka başlığı, yasal uyarı penceresi ve altbilgi.

import * as Dialog from '@radix-ui/react-dialog';
import { HeartHandshake, Scale, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GIZLILIK_NOTU, KISA_UYARI, MARKA, SURUM, YASAL_UYARI } from '../data/kazaData.ts';
import { guvenliKaydet, guvenliYukle } from '../lib/depo.ts';
import { Buton, cn } from './ui/temel.tsx';

export function MarkaBasligi({ kucuk, className }: { kucuk?: boolean; className?: string }) {
    return (
        <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARKA.logo} alt={`${MARKA.kurum} logosu`} width={kucuk ? 36 : 46} height={kucuk ? 36 : 46} className={cn('shrink-0 rounded-full shadow-sm', kucuk ? 'h-9 w-9' : 'h-[46px] w-[46px]')} />
            <span className="flex min-w-0 flex-col leading-tight">
                <strong className={cn('truncate font-bold tracking-[0.12em] text-foreground', kucuk ? 'text-[10.5px]' : 'text-[11.5px]')}>{MARKA.kurumBuyuk}</strong>
                <span className={cn('truncate font-semibold text-aha-red', kucuk ? 'text-[14px]' : 'text-[17px]')}>
                    {MARKA.uygulama} <span className="text-[10.5px] font-medium text-muted-foreground">{SURUM}</span>
                </span>
            </span>
        </div>
    );
}

export function Altbilgi({ className, uyariAc }: { className?: string; uyariAc?: () => void }) {
    return (
        <p className={cn('text-[11px] font-light leading-relaxed text-muted-foreground', className)}>
            © {new Date().getFullYear()} {MARKA.kurum} · {KISA_UYARI}{' '}
            {uyariAc && <button type="button" onClick={uyariAc} className="font-semibold text-aha-red underline-offset-2 hover:underline">Yasal uyarı</button>}
            <br />
            {GIZLILIK_NOTU} Yol verileri ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline-offset-2 hover:underline">OpenStreetMap</a> katkıcıları ·{' '}
            <a href={MARKA.instagram} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">@{MARKA.instagramAd}</a>
        </p>
    );
}

export function YasalUyariMetni({ kompakt }: { kompakt?: boolean }) {
    return (
        <div className={cn('space-y-2.5 leading-relaxed text-foreground/85', kompakt ? 'text-[12px]' : 'text-[13px]')}>
            {YASAL_UYARI.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
        </div>
    );
}

function onayMi(v: unknown): v is { onay: true } {
    return !!v && typeof v === 'object' && (v as { onay?: unknown }).onay === true;
}

/** İlk girişte gösterilen, okunup onaylanan yasal uyarı penceresi */
export function UyariPenceresi({ acik, setAcik }: { acik: boolean; setAcik: (a: boolean) => void }) {
    const [ilk, setIlk] = useState(false);
    useEffect(() => {
        let iptal = false;
        void guvenliYukle('uyari-onayi-v1', onayMi).then((v) => {
            if (!iptal && !v) {
                setIlk(true);
                setAcik(true);
            }
        });
        return () => { iptal = true; };
    }, [setAcik]);

    const onayla = (): void => {
        void guvenliKaydet('uyari-onayi-v1', { onay: true });
        setIlk(false);
        setAcik(false);
    };

    return (
        <Dialog.Root open={acik} onOpenChange={(a) => { if (!a && !ilk) setAcik(false); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[4500] bg-foreground/40 backdrop-blur-sm" />
                <Dialog.Content
                    onEscapeKeyDown={(e) => { if (ilk) e.preventDefault(); }}
                    onPointerDownOutside={(e) => { if (ilk) e.preventDefault(); }}
                    className="ince-kaydirma fixed left-1/2 top-1/2 z-[4501] max-h-[90vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white shadow-2xl animate-giris"
                >
                    <div className="border-b border-border/70 px-6 pb-5 pt-6">
                        <MarkaBasligi />
                        <Dialog.Title className="mt-5 flex items-center gap-2 text-lg font-bold">
                            <Scale className="h-5 w-5 text-aha-red" /> Önemli uyarı
                        </Dialog.Title>
                        <Dialog.Description className="mt-1 text-[12.5px] text-muted-foreground">
                            Uygulamayı kullanmadan önce lütfen okuyun.
                        </Dialog.Description>
                    </div>
                    <div className="space-y-4 px-6 py-5">
                        <div className="grid gap-2 sm:grid-cols-3">
                            {[
                                { ikon: HeartHandshake, baslik: 'Meslektaş faydasına', metin: 'Ücretsiz, açık bir ön hazırlık aracı' },
                                { ikon: Scale, baslik: 'Hukuki görüş değildir', metin: 'Bilirkişi raporu yerine geçmez' },
                                { ikon: ShieldCheck, baslik: 'Veri toplanmaz', metin: 'Her şey tarayıcınızda kalır' },
                            ].map(({ ikon: Ikon, baslik, metin }) => (
                                <div key={baslik} className="rounded-2xl bg-muted/70 p-3">
                                    <Ikon className="h-4 w-4 text-aha-red" />
                                    <div className="mt-1.5 text-[12.5px] font-bold">{baslik}</div>
                                    <div className="text-[11.5px] font-light leading-snug text-muted-foreground">{metin}</div>
                                </div>
                            ))}
                        </div>
                        <YasalUyariMetni />
                    </div>
                    <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border/70 bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-[11.5px] text-muted-foreground">{GIZLILIK_NOTU.split(' — ')[0]}</span>
                        <Buton tur="birincil" className="justify-center" onClick={onayla}>
                            {ilk ? 'Okudum, anladım' : 'Kapat'}
                        </Buton>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
