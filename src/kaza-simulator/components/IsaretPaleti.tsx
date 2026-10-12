'use client';

// Levha ve öge paleti: küçük resimler sahnedeki levhalarla aynı çizim kodundan üretilir.

import * as Dialog from '@radix-ui/react-dialog';
import { Car, Cat, Container, Construction, Dog, RotateCw, Trash2, TrafficCone, TreePine, UtilityPole, X } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { ISARET_ADI, ISARET_GRUPLARI, ISARET_KATALOGU } from '../data/kazaData.ts';
import { levhaKucukResim } from '../lib/levhaCizim.ts';
import type { DuzenlemeModu, Isaret, IsaretTipi } from '../types/kazaTypes.ts';
import { Alan, Buton, Girdi, SayiGirdi, cn } from './ui/temel.tsx';

function ZebraIkon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <rect x="1" y="3" width="22" height="18" rx="3" fill="#4a4d52" />
            {[4, 8.5, 13, 17.5].map((x) => <rect key={x} x={x} y="5" width="2.6" height="14" rx="0.6" fill="#fff" />)}
        </svg>
    );
}

function KasisIkon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <rect x="1" y="3" width="22" height="18" rx="3" fill="#4a4d52" />
            <rect x="1" y="9" width="22" height="6" fill="#f2c300" />
            {[3, 9, 15].map((x) => <path key={x} d={`M${x} 9h3l-3 6h-3z`} fill="#1b1b1d" />)}
        </svg>
    );
}

const CEVRE_IKON: Partial<Record<IsaretTipi, ComponentType<{ className?: string }>>> = {
    agac: TreePine, direk: UtilityPole, bariyer: Construction, duba: TrafficCone,
    konteyner: Container, 'park-arac': Car, kedi: Cat, kopek: Dog, traffic_calming: KasisIkon, crossing: ZebraIkon,
};

export interface IsaretPaletiProps {
    duzenleme: DuzenlemeModu;
    sec: (tip: IsaretTipi, ek?: { metin?: string; deger?: number }) => void;
    elleIsaretler: Isaret[];
    dondur: (id: string) => void;
    sil: (id: string) => void;
}

export function IsaretPaleti({ duzenleme, sec, elleIsaretler, dondur, sil }: IsaretPaletiProps) {
    const [resimler, setResimler] = useState<Partial<Record<IsaretTipi, string>>>({});
    const [sor, setSor] = useState<IsaretTipi | null>(null);
    const [metin, setMetin] = useState('OKUL BÖLGESİ');
    const [deger, setDeger] = useState(50);

    useEffect(() => {
        // Montserrat yüklendikten sonra çiz ki yazılar doğru fontla görünsün
        let iptal = false;
        void document.fonts.ready.then(() => {
            if (iptal) return;
            const r: Partial<Record<IsaretTipi, string>> = {};
            for (const k of ISARET_KATALOGU) {
                if (k.direkli) r[k.tip] = levhaKucukResim(k.tip, { metin: 'YAZI', deger: 50 }, 72);
            }
            setResimler(r);
        });
        return () => { iptal = true; };
    }, []);

    const aktif = duzenleme.tur === 'isaret' ? duzenleme.tip : null;
    const tikla = (tip: IsaretTipi): void => {
        if (aktif !== tip && (tip === 'ozel-tabela' || tip === 'hiz-tabela')) {
            setSor(tip);
            return;
        }
        sec(tip);
    };

    return (
        <div className="space-y-4">
            {ISARET_GRUPLARI.map((g) => (
                <div key={g.id}>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{g.ad}</div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {ISARET_KATALOGU.filter((k) => k.grup === g.id).map((k) => {
                            const Ikon = CEVRE_IKON[k.tip];
                            const resim = resimler[k.tip];
                            return (
                                <button
                                    key={k.tip}
                                    type="button"
                                    title={k.ad}
                                    aria-pressed={aktif === k.tip}
                                    onClick={() => tikla(k.tip)}
                                    className={cn(
                                        'flex flex-col items-center gap-1 rounded-2xl border p-2 text-center text-[10.5px] font-semibold leading-tight transition outline-none focus-visible:ring-2 focus-visible:ring-aha-red/30',
                                        aktif === k.tip ? 'border-aha-red bg-aha-red/5 text-aha-red' : 'border-border/80 bg-white text-foreground hover:border-foreground/30',
                                    )}
                                >
                                    <span className="flex h-9 w-9 items-center justify-center">
                                        {resim ? <img src={resim} alt="" className="max-h-9 max-w-9 object-contain" /> : Ikon ? <Ikon className="h-6 w-6" /> : <span className="h-6 w-6 rounded-full bg-muted" />}
                                    </span>
                                    <span className="line-clamp-2">{k.ad}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {elleIsaretler.length > 0 && (
                <div>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Eklenenler ({elleIsaretler.length})</div>
                    <ul className="divide-y divide-border/70 rounded-2xl border border-border/80 bg-white">
                        {elleIsaretler.map((i) => (
                            <li key={i.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                                <span className="min-w-0 truncate">
                                    {ISARET_ADI(i.tip)}
                                    {i.metin ? ` — “${i.metin}”` : ''}
                                    {i.deger ? ` — ${i.deger}` : ''}
                                </span>
                                <span className="flex shrink-0 gap-1">
                                    <Buton tur="hayalet" boy="ikon-sm" aria-label="45° döndür" title="45° döndür" onClick={() => dondur(i.id)}><RotateCw className="h-3.5 w-3.5" /></Buton>
                                    <Buton tur="hayalet" boy="ikon-sm" aria-label="Sil" title="Sil" className="hover:text-aha-red" onClick={() => sil(i.id)}><Trash2 className="h-3.5 w-3.5" /></Buton>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <Dialog.Root open={sor !== null} onOpenChange={(a) => !a && setSor(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[2000] bg-foreground/30 backdrop-blur-[2px]" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-[2001] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl animate-giris">
                        <div className="flex items-start justify-between">
                            <Dialog.Title className="text-lg font-bold">{sor === 'hiz-tabela' ? 'Hız sınırı levhası' : 'Yazılı levha'}</Dialog.Title>
                            <Dialog.Close asChild><Buton tur="hayalet" boy="ikon-sm" aria-label="Kapat"><X className="h-4 w-4" /></Buton></Dialog.Close>
                        </div>
                        <Dialog.Description className="mt-1 text-[12.5px] text-muted-foreground">Ardından sahnede yol kenarına tıklayarak yerleştirin.</Dialog.Description>
                        <form
                            className="mt-4 space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!sor) return;
                                sec(sor, sor === 'hiz-tabela' ? { deger: Math.round(deger) } : { metin: metin.trim() || 'LEVHA' });
                                setSor(null);
                            }}
                        >
                            {sor === 'hiz-tabela'
                                ? <Alan etiket="Hız sınırı"><SayiGirdi deger={deger} degisti={setDeger} min={5} max={150} adim={5} birim="km/s" autoFocus /></Alan>
                                : <Alan etiket="Levha metni"><Girdi value={metin} maxLength={24} onChange={(e) => setMetin(e.target.value)} autoFocus /></Alan>}
                            <Buton type="submit" tur="birincil" className="w-full justify-center">Yerleştirmeye başla</Buton>
                        </form>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
