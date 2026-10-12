'use client';

// Ana istemci arayüzü (Dumb UI): tüm durum ve mantık useKazaEngine'dedir.

import * as Tabs from '@radix-ui/react-tabs';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import {
    ArrowLeft, Car, Crosshair, Info, Map as HaritaIkon, PanelLeftClose, PanelLeftOpen, Pencil, Play, Route, Trash2,
    TriangleAlert, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ISARET_ADI, SURUM } from '../data/kazaData.ts';
import { tarafAdi, useKazaEngine, type PanelSekmesi } from '../hooks/useKazaEngine.ts';
import { useKaydirma } from '../hooks/useKaydirma.ts';
import { useKlavyeKisayollari } from '../hooks/useKlavyeKisayollari.ts';
import type { TarafId } from '../types/kazaTypes.ts';
import { BaslangicEkrani } from './BaslangicEkrani.tsx';
import { DisaAktarMenusu } from './DisaAktarMenusu.tsx';
import { IsaretPaleti } from './IsaretPaleti.tsx';
import { KazaCard } from './KazaCard.tsx';
import { KazaSettings } from './KazaSettings.tsx';
import { KilitModali } from './KilitModali.tsx';
import { KAMERA_SECENEKLERI, SahneGorunumu } from './SahneGorunumu.tsx';
import { SonucPaneli } from './SonucPaneli.tsx';
import { Baslik, Buton, Girdi, Kart, Onay, Rozet, Secim, cn } from './ui/temel.tsx';
import { YazdirmaRaporu } from './YazdirmaRaporu.tsx';
import { ZamanCubugu } from './ZamanCubugu.tsx';

export interface KazaClientProps {
    /** Oturum açık mı (GateOS oturum katmanından) */
    isAuthenticated?: boolean;
    /** Eylemler üyelik gerektiriyor mu */
    isProtected?: boolean;
    onRequestLogin?: () => void;
}

const SEKMELER: ReadonlyArray<{ deger: PanelSekmesi; etiket: string }> = [
    { deger: 'sahne', etiket: 'Sahne' },
    { deger: 'taraflar', etiket: 'Taraflar' },
    { deger: 'sonuc', etiket: 'Sonuç' },
];

export function KazaClient({ isAuthenticated = true, isProtected = false, onRequestLogin }: KazaClientProps) {
    const m = useKazaEngine({ isAuthenticated, isProtected, onRequestLogin });
    const [panelAcik, setPanelAcik] = useState(true);
    const [sahneAcildi, setSahneAcildi] = useState(false);
    const [yolAdi, setYolAdi] = useState('');

    useEffect(() => {
        if (m.ekran === 'sahne') setSahneAcildi(true);
    }, [m.ekran]);

    const tarafAdlari = useMemo<Record<TarafId, string>>(() => ({ A: tarafAdi('A', m.katilimcilar.A), B: tarafAdi('B', m.katilimcilar.B) }), [m.katilimcilar]);
    const gelisler = useMemo<Record<TarafId, string>>(() => ({
        A: m.listeler.A.find((y) => y.anahtar === m.katilimcilar.A.yaklasimAnahtar)?.etiket ?? '—',
        B: m.listeler.B.find((y) => y.anahtar === m.katilimcilar.B.yaklasimAnahtar)?.etiket ?? '—',
    }), [m.listeler, m.katilimcilar]);
    const aYolu = useMemo(() => m.listeler.A.find((y) => y.anahtar === m.katilimcilar.A.yaklasimAnahtar) ?? null, [m.listeler, m.katilimcilar.A.yaklasimAnahtar]);

    const tamEkran = useCallback(() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }, []);

    const hesapla = (): void => {
        if (m.hesapla()) {
            m.setSekme('sonuc');
            if (window.innerWidth < 768) setPanelAcik(false);
        }
    };

    useKlavyeKisayollari({
        oynatDuraklat: m.oynatDuraklat,
        adim: m.adimAt,
        basaSona: (son) => m.zamanaGit(son ? m.zaman.sure : 0),
        kamera: (n) => {
            const k = KAMERA_SECENEKLERI[n - 1];
            if (k) m.setKamera(k.deger);
        },
        kacis: () => {
            if (m.duzenleme.tur !== 'yok') m.duzenlemeBitir();
        },
        panel: () => setPanelAcik((a) => !a),
        tamEkran,
    }, m.ekran === 'sahne');

    const sayfaKaydir = useKaydirma({ yukari: () => setPanelAcik(true), asagi: () => setPanelAcik(false) });
    const cizim = m.duzenleme.tur === 'ciz' ? m.duzenleme : null;

    return (
        <RadixTooltip.Provider>
            {m.ekran === 'baslangic' && (
                <BaslangicEkrani secilen={m.secilenKonum} konumSec={m.konumSec} kur={() => void m.konumdanKur()} sablonYukle={m.sablonYukle} />
            )}

            {sahneAcildi && (
                <div className={cn('fixed inset-0 flex flex-col bg-background', m.ekran !== 'sahne' && 'invisible')} aria-hidden={m.ekran !== 'sahne'}>
                    {/* Üst bar */}
                    <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border/80 bg-white px-3 md:gap-3 md:px-5">
                        <Buton tur="hayalet" boy="ikon" aria-label="Haritaya dön" title="Haritaya / senaryolara dön" onClick={m.baslangicaDon}>
                            <ArrowLeft className="h-5 w-5" />
                        </Buton>
                        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aha-red text-white sm:flex"><Car className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-[15px] font-bold leading-tight">Kaza Simülatörü</h1>
                                <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">{SURUM}</span>
                            </div>
                            <div className="truncate text-[12px] font-light text-muted-foreground">{m.baslik}</div>
                        </div>
                        <span className="hidden md:block">
                            <Buton tur="ikincil" boy="sm" onClick={() => setPanelAcik((a) => !a)} title="Paneli aç/kapat (P)">
                                {panelAcik ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />} Panel
                            </Buton>
                        </span>
                        <DisaAktarMenusu sonucVar={!!m.sonuc} fotoIndir={m.fotoIndir} krokiIndir={m.krokiIndir} videoKaydet={m.videoKaydet} yazdir={m.yazdir} videoHata={m.video.hata} />
                    </header>

                    <div className="relative flex min-h-0 flex-1">
                        {/* Sol panel / mobil alt sayfa */}
                        <aside
                            className={cn(
                                'fixed inset-x-0 bottom-0 z-30 flex h-[64vh] flex-col rounded-t-3xl border-t border-border/80 bg-background shadow-2xl transition-transform duration-300',
                                'md:static md:z-auto md:h-auto md:w-[400px] md:shrink-0 md:translate-y-0 md:rounded-none md:border-r md:border-t-0 md:shadow-none',
                                panelAcik ? 'translate-y-0' : 'translate-y-[calc(100%-60px)] md:hidden',
                            )}
                        >
                            <div {...sayfaKaydir} className="flex cursor-grab justify-center pb-1 pt-2.5 md:hidden" onClick={() => setPanelAcik((a) => !a)} role="button" aria-label="Paneli aç/kapat">
                                <span className="h-1.5 w-12 rounded-full bg-border" />
                            </div>
                            <Tabs.Root value={m.sekme} onValueChange={(v) => m.setSekme(v as PanelSekmesi)} className="flex min-h-0 flex-1 flex-col">
                                <Tabs.List className="mx-4 mt-1 flex gap-1 rounded-full bg-muted p-1 md:mt-4" aria-label="Panel bölümleri">
                                    {SEKMELER.map((s) => (
                                        <Tabs.Trigger key={s.deger} value={s.deger}
                                            className="flex-1 rounded-full px-3 py-2 text-[13px] font-semibold text-muted-foreground outline-none transition data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:ring-2 focus-visible:ring-aha-red/30">
                                            {s.etiket}
                                            {s.deger === 'sonuc' && m.sonuc && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-aha-red align-middle" />}
                                        </Tabs.Trigger>
                                    ))}
                                </Tabs.List>

                                <div className="ince-kaydirma min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
                                    <Tabs.Content value="sahne" className="space-y-3 outline-none">
                                        <Kart className="p-4">
                                            <Baslik sag={m.cevre?.kaynak === 'sablon' ? <Rozet renk="yesil">Şablon</Rozet> : m.cevre ? <Rozet renk="mavi">OSM</Rozet> : null}>Çarpışma noktası</Baslik>
                                            <Buton tur={m.duzenleme.tur === 'nokta' ? 'birincil' : 'ikincil'} className="w-full justify-center" onClick={m.noktaSecimiBaslat}>
                                                {m.duzenleme.tur === 'nokta' ? <><X className="h-4 w-4" /> Seçimi iptal et</> : <><Crosshair className="h-4 w-4" /> Sahneden yeniden seç</>}
                                            </Buton>
                                            {m.cevreDurumu.tur === 'hazir' && <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">{m.cevreDurumu.not}</p>}
                                        </Kart>

                                        <KazaSettings kosullar={m.kosullar} guncelle={m.kosulGuncelle} katilimcilar={m.katilimcilar} />

                                        {m.cevre?.kaynak === 'osm' && aYolu && (
                                            <Kart className="p-4">
                                                <Baslik>Konumdan okunan veriler</Baslik>
                                                <p className="text-[12.5px] leading-relaxed">
                                                    <b>{aYolu.yolAdi}</b>: {aYolu.seritSayisi} şerit{aYolu.tekYon ? ', tek yön' : ''}
                                                    {aYolu.hizLimiti ? `, sınır ${aYolu.hizLimiti} km/s` : ''}{aYolu.yuzey ? `, yüzey: ${aYolu.yuzey}` : ''}
                                                </p>
                                                {m.yakinIsaretler.length > 0 ? (
                                                    <ul className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
                                                        {m.yakinIsaretler.map((i) => <li key={i.id}>• {ISARET_ADI(i.tip)} — {Math.round(i.uzaklik)} m</li>)}
                                                    </ul>
                                                ) : <p className="mt-1 text-[12px] text-muted-foreground">Yakında OSM'de kayıtlı levha/ışık yok.</p>}
                                            </Kart>
                                        )}

                                        <Kart className="p-4">
                                            <Baslik>Levha ve öge ekle</Baslik>
                                            <p className="-mt-1 mb-3 text-[12px] leading-relaxed text-muted-foreground">Seçip sahneye tıklayın; levhalar en yakın yolun kenarına, trafiğe dönük dikilir. Ağaç, direk, bariyer gibi ögeler savrulan araç için engeldir.</p>
                                            <IsaretPaleti duzenleme={m.duzenleme} sec={m.isaretModu} elleIsaretler={m.elleIsaretler} dondur={m.isaretDondur} sil={m.isaretSil} />
                                        </Kart>

                                        <Kart className="p-4">
                                            <Baslik>Yol çiz</Baslik>
                                            {cizim ? (
                                                <div className="space-y-2.5">
                                                    <p className="text-[12px] text-muted-foreground">Sahnede güzergâh noktalarına tıklayın ({cizim.noktalar.length} nokta).</p>
                                                    <Girdi value={yolAdi} placeholder={cizim.yaya ? 'Yaya yolu adı' : 'Yol adı (ör. Gül Sokak)'} onChange={(e) => setYolAdi(e.target.value)} />
                                                    <div className="flex gap-2">
                                                        <Buton tur="birincil" boy="sm" className="flex-1 justify-center" disabled={cizim.noktalar.length < 2} onClick={() => { m.cizimKaydet(yolAdi); setYolAdi(''); }}>Kaydet</Buton>
                                                        <Buton tur="ikincil" boy="sm" onClick={m.duzenlemeBitir}>İptal</Buton>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Buton tur="ikincil" boy="sm" className="justify-center" onClick={() => m.cizimBaslat(false)}><Route className="h-4 w-4" /> Araç yolu</Buton>
                                                    <Buton tur="ikincil" boy="sm" className="justify-center" onClick={() => m.cizimBaslat(true)}><Pencil className="h-4 w-4" /> Yaya yolu</Buton>
                                                </div>
                                            )}
                                            {m.cizilenYollar.length > 0 && (
                                                <ul className="mt-3 divide-y divide-border/70 rounded-2xl border border-border/80 bg-white">
                                                    {m.cizilenYollar.map((y) => (
                                                        <li key={y.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                                                            <span className="truncate">{y.ad} <span className="text-muted-foreground">({y.sinif === 'footway' ? 'yaya yolu' : 'yol'})</span></span>
                                                            <Buton tur="hayalet" boy="ikon-sm" aria-label="Sil" className="hover:text-aha-red" onClick={() => m.yolSil(y.id)}><Trash2 className="h-3.5 w-3.5" /></Buton>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </Kart>

                                        <Kart className="p-4">
                                            <Baslik>Görünüm</Baslik>
                                            <Onay secili={m.guzergah} degisti={m.setGuzergah}>Güzergâh çizgilerini göster</Onay>
                                            <div className="mt-2 lg:hidden">
                                                <Secim aria-label="Kamera" value={m.kamera} onChange={(e) => m.setKamera(e.target.value as (typeof KAMERA_SECENEKLERI)[number]['deger'])}>
                                                    {KAMERA_SECENEKLERI.map((k) => <option key={k.deger} value={k.deger}>{k.baslik}</option>)}
                                                </Secim>
                                            </div>
                                            <p className="mt-3 hidden text-[11.5px] leading-relaxed text-muted-foreground md:block">
                                                <b>Kısayollar:</b> Boşluk oynat/duraklat · ←/→ 0,1 sn (Shift: 1 sn) · 1–6 kamera · P panel · F tam ekran · Esc iptal
                                            </p>
                                        </Kart>
                                    </Tabs.Content>

                                    <Tabs.Content value="taraflar" className="space-y-3 outline-none">
                                        {(['A', 'B'] as const).map((id) => (
                                            <KazaCard key={id} id={id} k={m.katilimcilar[id]} liste={m.listeler[id]} mu={m.kosullar.mu} guncelle={(p) => m.katilimciGuncelle(id, p)} />
                                        ))}
                                    </Tabs.Content>

                                    <Tabs.Content value="sonuc" className="outline-none">
                                        <SonucPaneli sonuc={m.sonuc} kusur={m.kusur} katilimcilar={m.katilimcilar} tarafAdlari={tarafAdlari} yazdir={m.yazdir} krokiIndir={m.krokiIndir} />
                                    </Tabs.Content>
                                </div>
                            </Tabs.Root>

                            <div className="border-t border-border/80 bg-white/90 p-3 backdrop-blur md:p-4">
                                <Buton tur="birincil" className="w-full justify-center" onClick={hesapla} disabled={!m.cevre}>
                                    <Play className="h-4 w-4" fill="currentColor" /> {m.sonuc && !m.sonucEski ? 'Yeniden Hesapla' : 'Hesapla ve Canlandır'}
                                </Buton>
                            </div>
                        </aside>

                        {/* 3B sahne */}
                        <main className="relative min-w-0 flex-1">
                            <SahneGorunumu
                                motorBagla={m.motorBagla}
                                durum={m.cevreDurumu}
                                duzenleme={m.duzenleme}
                                duzenlemeBitir={m.duzenlemeBitir}
                                sonuc={m.sonuc}
                                sonucEski={m.sonucEski}
                                t={m.zaman.t}
                                tarafAdlari={tarafAdlari}
                                kamera={m.kamera}
                                setKamera={m.setKamera}
                                kameraSifirla={m.kameraSifirla}
                                videoAktif={m.video.aktif}
                                videoIlerleme={m.video.ilerleme}
                                videoIptal={m.videoIptal}
                            />
                            <div className={cn('absolute inset-x-3 z-10 md:inset-x-6 md:bottom-5', panelAcik ? 'bottom-3 max-md:hidden' : 'bottom-[72px]')}>
                                <ZamanCubugu
                                    t={m.zaman.t} sure={m.zaman.sure} tCarpisma={m.sonuc?.tCarpisma ?? 0} oynuyor={m.oynuyor}
                                    hiz={m.oynatmaHizi} oynatDuraklat={m.oynatDuraklat} zamanaGit={m.zamanaGit} adimAt={m.adimAt}
                                    setHiz={m.setOynatmaHizi} etkin={!!m.sonuc}
                                />
                            </div>
                            {!panelAcik && (
                                <span className="absolute bottom-24 left-6 z-10 hidden md:block">
                                    <Buton tur="ikincil" boy="sm" className="shadow-sm" onClick={() => setPanelAcik(true)}>
                                        <PanelLeftOpen className="h-4 w-4" /> Panel
                                    </Buton>
                                </span>
                            )}
                        </main>
                    </div>
                </div>
            )}

            {m.bildirim && (
                <div role="status" className="fixed left-1/2 top-20 z-[3500] flex max-w-[92vw] -translate-x-1/2 items-start gap-2.5 rounded-2xl bg-foreground py-2.5 pl-4 pr-2 text-[13px] text-white shadow-xl animate-giris">
                    {m.bildirim.tur === 'bilgi' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
                    <span className="leading-snug">{m.bildirim.metin}</span>
                    <button type="button" aria-label="Kapat" onClick={m.bildirimKapat} className="rounded-full p-0.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
                </div>
            )}

            <KilitModali acik={m.kilitAcik} kapat={m.kilitKapat} girisIste={m.girisIste} />

            <YazdirmaRaporu sonuc={m.sonuc} kusur={m.kusur} katilimcilar={m.katilimcilar} tarafAdlari={tarafAdlari} kosullar={m.kosullar} konum={m.baslik} kroki={m.yazdirmaKroki} gelisler={gelisler} />

            {m.ekran === 'baslangic' && sahneAcildi && (
                <Buton tur="koyu" boy="sm" className="fixed bottom-4 right-16 z-[1200] shadow-lg" onClick={m.sahneyeDon}>
                    <HaritaIkon className="h-4 w-4" /> Sahneye dön
                </Buton>
            )}
        </RadixTooltip.Provider>
    );
}
