'use client';

// Dışa aktarım: fotoğraf, kroki, video ve rapor — tümü tarayıcıda üretilir.

import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Camera, Clapperboard, Download, FileImage, Image, Printer, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { videoDestekleniyor, type VideoSecenek } from '../lib/video.ts';
import { Alan, Buton, Segment } from './ui/temel.tsx';

export interface DisaAktarMenusuProps {
    sonucVar: boolean;
    fotoIndir: (hudlu: boolean) => void;
    krokiIndir: () => void;
    videoKaydet: (s: VideoSecenek) => void;
    yazdir: () => void;
    videoHata: string | null;
}

function Oge({ ikon, baslik, aciklama, onSelect, disabled }: { ikon: ReactNode; baslik: string; aciklama: string; onSelect: () => void; disabled?: boolean }) {
    return (
        <Menu.Item disabled={disabled} onSelect={onSelect}
            className="flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-muted">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">{ikon}</span>
            <span>
                <span className="block text-[13px] font-semibold">{baslik}</span>
                <span className="block text-[11.5px] leading-snug text-muted-foreground">{aciklama}</span>
            </span>
        </Menu.Item>
    );
}

export function DisaAktarMenusu(p: DisaAktarMenusuProps) {
    const [videoAcik, setVideoAcik] = useState(false);
    const [cozunurluk, setCozunurluk] = useState<'720' | '1080'>('720');
    const [hiz, setHiz] = useState<'0.5' | '1'>('0.5');
    const [destek, setDestek] = useState(true);
    useEffect(() => setDestek(videoDestekleniyor()), []);

    return (
        <>
            <Menu.Root>
                <Menu.Trigger asChild>
                    <Buton tur="birincil" boy="sm"><Download className="h-4 w-4" /> <span className="hidden sm:inline">Dışa aktar</span></Buton>
                </Menu.Trigger>
                <Menu.Portal>
                    <Menu.Content align="end" sideOffset={8} className="z-[2500] w-80 rounded-3xl border border-border/80 bg-white p-2 shadow-2xl animate-giris">
                        <Oge ikon={<Camera className="h-4 w-4" />} baslik="Fotoğraf (bilgi katmanlı)" aciklama="Görünüm + zaman, hızlar, evreler · PNG" onSelect={() => p.fotoIndir(true)} />
                        <Oge ikon={<Image className="h-4 w-4" />} baslik="Fotoğraf (sade)" aciklama="Yalnızca 3B görünüm · PNG" onSelect={() => p.fotoIndir(false)} />
                        <Oge ikon={<FileImage className="h-4 w-4" />} baslik="Kaza krokisi" aciklama="Ölçekli kuşbakışı, kuzey oku, A1/A2 konumları · PNG" onSelect={p.krokiIndir} />
                        <Oge ikon={<Clapperboard className="h-4 w-4" />} baslik="Video" aciklama={destek ? 'Canlandırmanın tamamı · MP4/WebM' : 'Bu tarayıcı video kaydını desteklemiyor'} disabled={!p.sonucVar || !destek} onSelect={() => setVideoAcik(true)} />
                        <Oge ikon={<Printer className="h-4 w-4" />} baslik="Rapor yazdır / PDF" aciklama="Kroki ve hesap özetiyle A4 rapor" disabled={!p.sonucVar} onSelect={p.yazdir} />
                    </Menu.Content>
                </Menu.Portal>
            </Menu.Root>

            <Dialog.Root open={videoAcik} onOpenChange={setVideoAcik}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[2000] bg-foreground/30 backdrop-blur-[2px]" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-[2001] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl animate-giris">
                        <div className="flex items-start justify-between">
                            <Dialog.Title className="text-lg font-bold">Video olarak kaydet</Dialog.Title>
                            <Dialog.Close asChild><Buton tur="hayalet" boy="ikon-sm" aria-label="Kapat"><X className="h-4 w-4" /></Buton></Dialog.Close>
                        </div>
                        <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                            Canlandırma baştan sona, seçili kamera açısıyla ve bilgi katmanıyla kaydedilir. Kayıt tamamen tarayıcınızda yapılır; kayıt süresince sekmeyi açık tutun.
                        </Dialog.Description>
                        <div className="mt-5 space-y-4">
                            <Alan etiket="Çözünürlük">
                                <Segment ad="Çözünürlük" secenekler={[{ deger: '720', etiket: '1280×720' }, { deger: '1080', etiket: '1920×1080' }] as const} deger={cozunurluk} degisti={setCozunurluk} />
                            </Alan>
                            <Alan etiket="Oynatma hızı" ipucu="0,5× ağır çekim, çarpışma anını daha anlaşılır gösterir.">
                                <Segment ad="Oynatma hızı" secenekler={[{ deger: '0.5', etiket: '0,5× ağır çekim' }, { deger: '1', etiket: '1× gerçek zaman' }] as const} deger={hiz} degisti={setHiz} />
                            </Alan>
                            {p.videoHata && <p className="rounded-xl bg-aha-red/10 px-3 py-2 text-[12px] text-aha-red">{p.videoHata}</p>}
                            <Buton tur="birincil" className="w-full justify-center" onClick={() => {
                                setVideoAcik(false);
                                p.videoKaydet({
                                    genislik: cozunurluk === '1080' ? 1920 : 1280,
                                    yukseklik: cozunurluk === '1080' ? 1080 : 720,
                                    fps: 30,
                                    hiz: parseFloat(hiz),
                                });
                            }}>
                                <Clapperboard className="h-4 w-4" /> Kaydı başlat
                            </Buton>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
