'use client';

// Presenter hook: uygulamanın tüm durumu ve iş mantığı burada toplanır.
// Bileşenler yalnızca bu hook'un döndürdüğü veriyi gösterir ve eylemleri çağırır.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ARAC_TURLERI, ISARET_KATALOGU, OSM_YUZEY_ESLEME, SABLONLAR, VARSAYILAN_KOSULLAR, YUZEYLER,
    temsiliKavsak, varsayilanKatilimci,
} from '../data/kazaData.ts';
import { kenaraYerlestir, yolAcisi, yolaHizala, uzaklik } from '../lib/geometry.ts';
import { kusurHesapla } from '../lib/kusur.ts';
import { baslangicHizi, sablonKur, simGirdisiKur, yaklasimListesi } from '../lib/senaryo.ts';
import { seritRotasi, simuleEt } from '../lib/simulate.ts';
import { cevreVerisiGetir } from '../lib/osm.ts';
import { guvenliKaydet, guvenliYukle } from '../lib/depo.ts';
import type { SahneMotoru, TarafGorunum } from '../lib/three/sahneMotoru.ts';
import type { VideoSecenek } from '../lib/video.ts';
import type {
    Cevre, CevreDurumu, DuzenlemeModu, GenelKosullar, Isaret, IsaretTipi, KameraModu, KatilimciGirdi,
    KayitliTercihler, KusurSonuc, SecilenKonum, SimSonuc, TarafId, Vec2, Yaklasim,
} from '../types/kazaTypes.ts';

export type Ekran = 'baslangic' | 'sahne';
export type PanelSekmesi = 'sahne' | 'taraflar' | 'sonuc';

export interface VideoDurumu {
    aktif: boolean;
    ilerleme: number;
    hata: string | null;
}

export interface KazaMotoruSecenek {
    isAuthenticated: boolean;
    isProtected: boolean;
    onRequestLogin?: () => void;
}

const TARAFLAR: readonly TarafId[] = ['A', 'B'];

function dosyaAdi(uzanti: string, ek = ''): string {
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    return `kaza-simulasyon${ek}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${uzanti}`;
}

function indir(blob: Blob, ad: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ad;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function tercihMi(v: unknown): v is KayitliTercihler {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    return typeof o.oynatmaHizi === 'number' && typeof o.kamera === 'string' && typeof o.yuzeyId === 'string';
}

let isaretSayac = 0;
const yeniId = (): string => `elle-${Date.now().toString(36)}-${(isaretSayac += 1)}`;

export function tarafAdi(id: TarafId, k: KatilimciGirdi): string {
    if (k.tip === 'yaya') return `Yaya ${id}`;
    return `${ARAC_TURLERI[k.tur].ad} ${id}${k.plaka.trim() ? ` (${k.plaka.trim().toLocaleUpperCase('tr-TR')})` : ''}`;
}

export function useKazaEngine(sec: KazaMotoruSecenek) {
    const motorRef = useRef<SahneMotoru | null>(null);
    const [motorHazirMi, setMotorHazirMi] = useState(false);

    const [ekran, setEkran] = useState<Ekran>('baslangic');
    const [sekme, setSekme] = useState<PanelSekmesi>('sahne');
    const [secilenKonum, setSecilenKonum] = useState<SecilenKonum | null>(null);
    const [baslik, setBaslik] = useState('');
    const [cevre, setCevre] = useState<Cevre | null>(null);
    const [yolSurum, setYolSurum] = useState(0);
    const [cevreDurumu, setCevreDurumu] = useState<CevreDurumu>({ tur: 'bos' });
    const [P, setP] = useState<Vec2>({ x: 0, z: 0 });
    const [kosullar, setKosullar] = useState<GenelKosullar>(VARSAYILAN_KOSULLAR);
    const [katilimcilar, setKatilimcilar] = useState<Record<TarafId, KatilimciGirdi>>({ A: varsayilanKatilimci('A'), B: varsayilanKatilimci('B') });
    const [duzenleme, setDuzenleme] = useState<DuzenlemeModu>({ tur: 'yok' });
    const [sonuc, setSonuc] = useState<SimSonuc | null>(null);
    const [kusur, setKusur] = useState<KusurSonuc | null>(null);
    const [sonucImzasi, setSonucImzasi] = useState('');
    const [bildirim, setBildirim] = useState<{ metin: string; tur: 'bilgi' | 'uyari' | 'hata' } | null>(null);
    const [zaman, setZaman] = useState({ t: 0, sure: 0 });
    const [oynuyor, setOynuyor] = useState(false);
    const [oynatmaHizi, setOynatmaHiziDurum] = useState(0.5);
    const [kamera, setKameraDurum] = useState<KameraModu>('serbest');
    const [guzergah, setGuzergahDurum] = useState(true);
    const [video, setVideo] = useState<VideoDurumu>({ aktif: false, ilerleme: 0, hata: null });
    const [kilitAcik, setKilitAcik] = useState(false);
    const [yazdirmaKroki, setYazdirmaKroki] = useState<string | null>(null);
    const istekRef = useRef<AbortController | null>(null);
    const cevreRef = useRef(cevre);
    cevreRef.current = cevre;
    const PRef = useRef(P);
    PRef.current = P;
    const kameraRef = useRef(kamera);
    kameraRef.current = kamera;

    const bildir = useCallback((metin: string, tur: 'bilgi' | 'uyari' | 'hata' = 'bilgi') => setBildirim({ metin, tur }), []);

    useEffect(() => {
        if (!bildirim) return;
        const z = setTimeout(() => setBildirim(null), 6000);
        return () => clearTimeout(z);
    }, [bildirim]);

    // ---- Tercihler (yerel, karmalı) ----
    useEffect(() => {
        let iptal = false;
        void guvenliYukle('tercihler', tercihMi).then((t) => {
            if (!t || iptal) return;
            setOynatmaHiziDurum(t.oynatmaHizi);
            setKameraDurum(t.kamera);
            const y = YUZEYLER.find((v) => v.id === t.yuzeyId);
            if (y) setKosullar((k) => ({ ...k, yuzeyId: y.id, mu: y.mu }));
        });
        return () => { iptal = true; };
    }, []);

    useEffect(() => {
        void guvenliKaydet<KayitliTercihler>('tercihler', { oynatmaHizi, kamera, yuzeyId: kosullar.yuzeyId });
    }, [oynatmaHizi, kamera, kosullar.yuzeyId]);

    // ---- Yetki kalkanı ----
    const korumali = useCallback((eylem: () => void) => {
        if (sec.isProtected && !sec.isAuthenticated) {
            setKilitAcik(true);
            return;
        }
        eylem();
    }, [sec.isAuthenticated, sec.isProtected]);

    // ---- Yaklaşım listeleri ----
    const listeler = useMemo<Record<TarafId, Yaklasim[]>>(() => {
        if (!cevre) return { A: [], B: [] };
        void yolSurum;
        return {
            A: yaklasimListesi(cevre, P, katilimcilar.A.tip),
            B: yaklasimListesi(cevre, P, katilimcilar.B.tip),
        };
    }, [cevre, yolSurum, P, katilimcilar.A.tip, katilimcilar.B.tip]);

    // Seçili yaklaşım listede yoksa makul varsayılan seç (A ile B farklı yollardan)
    useEffect(() => {
        setKatilimcilar((onceki) => {
            let degisti = false;
            const yeni = { ...onceki };
            for (const id of TARAFLAR) {
                const liste = listeler[id];
                if (!liste.length) continue;
                if (liste.some((y) => y.anahtar === onceki[id].yaklasimAnahtar)) continue;
                let secim = liste[0];
                if (id === 'B') {
                    const aYol = (yeni.A.yaklasimAnahtar || '').replace(/-\d$/, '');
                    secim = liste.find((y) => !y.anahtar.startsWith(aYol + '-')) ?? liste[Math.min(1, liste.length - 1)];
                }
                yeni[id] = { ...onceki[id], yaklasimAnahtar: secim.anahtar };
                degisti = true;
            }
            return degisti ? yeni : onceki;
        });
    }, [listeler]);

    const secilenYaklasim = useCallback((id: TarafId): Yaklasim | null =>
        listeler[id].find((y) => y.anahtar === katilimcilar[id].yaklasimAnahtar) ?? null, [listeler, katilimcilar]);

    // A'nın yolundaki OSM hız sınırı ve yüzey bilgisi forma uygulanır
    const aYaklasim = secilenYaklasim('A');
    useEffect(() => {
        if (!aYaklasim) return;
        setKosullar((k) => {
            let yeni = k;
            if (aYaklasim.hizLimiti && aYaklasim.hizLimiti !== k.limitKmh) yeni = { ...yeni, limitKmh: aYaklasim.hizLimiti };
            const yz = aYaklasim.yuzey ? OSM_YUZEY_ESLEME[aYaklasim.yuzey] : undefined;
            const y = YUZEYLER.find((v) => v.id === yz);
            if (y && y.id !== k.yuzeyId && cevre?.kaynak === 'osm') yeni = { ...yeni, yuzeyId: y.id, mu: y.mu };
            return yeni;
        });
    }, [aYaklasim, cevre?.kaynak]);

    // ---- Girdi imzası: hesaplamadan sonra girdi değiştiyse sonuç "eski" işaretlenir ----
    const girdiImzasi = useMemo(() => JSON.stringify({ P, kosullar, katilimcilar, yolSurum, isaret: cevre?.isaretler.length ?? 0 }), [P, kosullar, katilimcilar, yolSurum, cevre?.isaretler.length]);
    const sonucEski = sonuc !== null && sonucImzasi !== girdiImzasi;

    // ---- Motor senkronizasyonu ----
    const motorBagla = useCallback((m: SahneMotoru | null) => {
        motorRef.current = m;
        setMotorHazirMi(!!m);
        if (!m) return;
        m.onZaman = (t, sure) => setZaman({ t, sure });
        m.onOynatma = (o) => setOynuyor(o);
    }, []);

    // Yol geometrisi değiştiğinde (yeni senaryo, çizilen/silinen yol) statik çevre yeniden kurulur
    useEffect(() => {
        const m = motorRef.current;
        const c = cevreRef.current;
        if (!m || !c) return;
        m.cevreAyarla(c, PRef.current);
        m.kazaNoktasiAyarla(PRef.current);
        const k = kameraRef.current;
        m.kameraModuAyarla(k === 'ustten' ? 'ustten' : 'serbest');
    }, [motorHazirMi, yolSurum]);

    // Levha/öge eklenip silindiğinde yalnızca işaret katmanı yenilenir
    useEffect(() => {
        const c = cevreRef.current;
        if (c) motorRef.current?.isaretleriYenile(c);
    }, [cevre?.isaretler]);

    useEffect(() => {
        if (motorRef.current) motorRef.current.oynatmaHizi = oynatmaHizi;
    }, [oynatmaHizi, motorHazirMi]);

    useEffect(() => {
        motorRef.current?.guzergahGoster(guzergah);
    }, [guzergah, motorHazirMi]);

    useEffect(() => {
        const m = motorRef.current;
        if (!m) return;
        m.hudAyarla({
            baslik: 'Kaza Simülatörü',
            konum: baslik,
            taraflar: { A: { ad: tarafAdi('A', katilimcilar.A), renk: '#C81D25' }, B: { ad: tarafAdi('B', katilimcilar.B), renk: '#1F5FBF' } },
        });
    }, [baslik, katilimcilar, motorHazirMi]);

    // Hesaplamadan önce geliş yönü önizlemesi
    const bYaklasim = secilenYaklasim('B');
    useEffect(() => {
        const m = motorRef.current;
        if (!m || sonuc) return;
        const rA = aYaklasim ? seritRotasi(aYaklasim, katilimcilar.A.tip === 'yaya') : null;
        const rB = bYaklasim ? seritRotasi(bYaklasim, katilimcilar.B.tip === 'yaya') : null;
        m.yaklasimOnizle({ A: rA, B: rB });
        // Kamera A'nın geldiği yol koridorundan, B'nin geldiği yana hafif dönük bakar
        const geri = (r: Vec2[] | null): Vec2 | null => {
            if (!r || r.length < 2) return null;
            let kalan = 35;
            for (let i = r.length - 1; i > 0; i--) {
                kalan -= uzaklik(r[i], r[i - 1]);
                if (kalan <= 0 || i === 1) {
                    const d = { x: r[i - 1].x - P.x, z: r[i - 1].z - P.z };
                    const l = Math.hypot(d.x, d.z) || 1;
                    return { x: d.x / l, z: d.z / l };
                }
            }
            return null;
        };
        const a = geri(rA);
        const b = geri(rB);
        if (a) {
            m.odakYonuAyarla({ x: a.x + (b ? b.x * 0.35 : 0) - a.z * 0.3, z: a.z + (b ? b.z * 0.35 : 0) + a.x * 0.3 });
            if (kameraRef.current === 'serbest') m.kameraModuAyarla('serbest');
        }
    }, [aYaklasim, bYaklasim, sonuc, motorHazirMi, katilimcilar.A.tip, katilimcilar.B.tip, yolSurum, P]);

    const simSifirla = useCallback(() => {
        setSonuc(null);
        setKusur(null);
        setZaman({ t: 0, sure: 0 });
        setOynuyor(false);
        motorRef.current?.simulasyonAyarla(null, null);
    }, []);

    // ---- Düzenleme modları ----
    const duzenlemeBitir = useCallback(() => {
        setDuzenleme({ tur: 'yok' });
        const m = motorRef.current;
        if (m) {
            m.secimBitir();
            m.onizlemeTemizle('cizim');
        }
    }, []);


    const noktaSecimiBaslat = useCallback(() => {
        const m = motorRef.current;
        if (!m || !cevreRef.current) return;
        if (duzenleme.tur === 'nokta') {
            duzenlemeBitir();
            return;
        }
        duzenlemeBitir();
        setDuzenleme({ tur: 'nokta' });
        m.secimBaslat((p) => {
            const c = cevreRef.current;
            if (!c) return;
            const h = yolaHizala(c, p, 120);
            if (!h) {
                bildir('Tıklanan noktanın yakınında araç yolu yok; nokta değişmedi.', 'uyari');
                return;
            }
            setP(h.nokta);
            m.kazaNoktasiAyarla(h.nokta, false);
            simSifirla();
            bildir(h.tam ? 'Çarpışma noktası taşındı.' : `Tıklanan yer yol dışında; ${Math.round(h.kaymaMetre)} m ötedeki yol eksenine yerleştirildi.`);
            setDuzenleme({ tur: 'yok' });
            m.secimBitir();
        });
    }, [bildir, duzenleme.tur, duzenlemeBitir, simSifirla]);

    const isaretModu = useCallback((tip: IsaretTipi, ek: { metin?: string; deger?: number } = {}) => {
        const m = motorRef.current;
        if (!m || !cevreRef.current) return;
        if (duzenleme.tur === 'isaret' && duzenleme.tip === tip) {
            duzenlemeBitir();
            return;
        }
        duzenlemeBitir();
        setDuzenleme({ tur: 'isaret', tip, ...ek });
        const katalog = ISARET_KATALOGU.find((k) => k.tip === tip);
        m.secimBaslat((p) => {
            const c = cevreRef.current;
            if (!c) return;
            let kayit: Isaret = { id: yeniId(), tip, x: p.x, z: p.z, elle: true, ...ek };
            if (katalog?.direkli) {
                const yer = kenaraYerlestir(c.yollar, p);
                kayit = { ...kayit, x: yer.x, z: yer.z, aci: yer.aci };
            } else if (tip === 'bariyer') {
                // Zincirleme: yakındaki bariyerin ucuna eklen
                const BOY = 3.2;
                const eskiler = c.isaretler.filter((i) => i.elle && i.tip === 'bariyer');
                const enYakin = eskiler.reduce<Isaret | null>((en, b) => (!en || uzaklik(b, p) < uzaklik(en, p) ? b : en), null);
                if (enYakin && uzaklik(enYakin, p) < BOY * 2) {
                    const aci = enYakin.aci ?? yolAcisi(c.yollar, enYakin);
                    const d = { x: Math.sin(aci), z: Math.cos(aci) };
                    const taraf = (p.x - enYakin.x) * d.x + (p.z - enYakin.z) * d.z >= 0 ? 1 : -1;
                    let uc = enYakin;
                    for (const b of eskiler) {
                        const i1 = (b.x - enYakin.x) * d.x + (b.z - enYakin.z) * d.z;
                        const i2 = (uc.x - enYakin.x) * d.x + (uc.z - enYakin.z) * d.z;
                        if (taraf * i1 > taraf * i2 && Math.abs(i1) < 200) uc = b;
                    }
                    kayit = { ...kayit, x: uc.x + d.x * BOY * taraf, z: uc.z + d.z * BOY * taraf, aci };
                } else kayit.aci = yolAcisi(c.yollar, p);
            } else if (tip !== 'crossing' && tip !== 'traffic_calming') {
                kayit.aci = tip === 'park-arac' || tip === 'konteyner' ? yolAcisi(c.yollar, p) : undefined;
            }
            setCevre({ ...c, isaretler: [...c.isaretler, kayit] });
            simSifirla();
        });
    }, [duzenleme, duzenlemeBitir, simSifirla]);

    const isaretDondur = useCallback((id: string) => {
        setCevre((c) => (c ? { ...c, isaretler: c.isaretler.map((i) => (i.id === id ? { ...i, aci: ((i.aci ?? 0) + Math.PI / 4) % (Math.PI * 2) } : i)) } : c));
        simSifirla();
    }, [simSifirla]);

    const isaretSil = useCallback((id: string) => {
        setCevre((c) => (c ? { ...c, isaretler: c.isaretler.filter((i) => i.id !== id) } : c));
        simSifirla();
    }, [simSifirla]);

    const cizimBaslat = useCallback((yaya: boolean) => {
        const m = motorRef.current;
        if (!m || !cevreRef.current) return;
        duzenlemeBitir();
        setDuzenleme({ tur: 'ciz', yaya, noktalar: [] });
        m.secimBaslat((p) => {
            setDuzenleme((d) => {
                if (d.tur !== 'ciz') return d;
                const noktalar = [...d.noktalar, p];
                m.cizimOnizle(noktalar, d.yaya ? 2 : 7);
                return { ...d, noktalar };
            });
        });
    }, [duzenlemeBitir]);

    const cizimKaydet = useCallback((ad: string) => {
        if (duzenleme.tur !== 'ciz') return;
        const c = cevreRef.current;
        if (c && duzenleme.noktalar.length >= 2) {
            const yaya = duzenleme.yaya;
            const sayi = c.yollar.filter((y) => y.elle).length + 1;
            setCevre({
                ...c,
                yollar: [...c.yollar, {
                    id: `cizim-${Date.now()}`,
                    ad: ad.trim() || (yaya ? `Yaya Yolu ${sayi}` : `Çizilen Yol ${sayi}`),
                    sinif: yaya ? 'footway' : 'residential',
                    genislik: yaya ? 2 : 7,
                    tekYon: false,
                    seritSayisi: yaya ? 1 : 2,
                    hizLimiti: null,
                    yuzey: null,
                    elle: true,
                    noktalar: duzenleme.noktalar,
                }],
            });
            setYolSurum((s) => s + 1);
            simSifirla();
        }
        duzenlemeBitir();
    }, [duzenleme, duzenlemeBitir, simSifirla]);

    const yolSil = useCallback((id: string) => {
        setCevre((c) => (c ? { ...c, yollar: c.yollar.filter((y) => y.id !== id) } : c));
        setYolSurum((s) => s + 1);
        simSifirla();
    }, [simSifirla]);

    // ---- Senaryo yükleme ----
    const sahneyeGec = useCallback((yeniCevre: Cevre, nokta: Vec2, ad: string, not: string) => {
        duzenlemeBitir();
        setCevre(yeniCevre);
        setYolSurum((s) => s + 1);
        setP(nokta);
        setBaslik(ad);
        simSifirla();
        setCevreDurumu({ tur: 'hazir', not });
        setEkran('sahne');
        setSekme('sahne');
    }, [duzenlemeBitir, simSifirla]);

    const sablonYukle = useCallback((id: string) => {
        const s = SABLONLAR.find((v) => v.id === id);
        if (!s) return;
        const k = sablonKur(s);
        setKosullar(k.kosullar);
        setKatilimcilar({ A: k.A, B: k.B });
        setSecilenKonum(null);
        sahneyeGec(k.cevre, k.P, s.ad, 'Şablon senaryo — internetsiz çalışır');
    }, [sahneyeGec]);

    const konumSec = useCallback((k: SecilenKonum | null) => setSecilenKonum(k), []);

    const konumdanKur = useCallback(async () => {
        if (!secilenKonum) return;
        istekRef.current?.abort();
        const d = new AbortController();
        istekRef.current = d;
        setEkran('sahne');
        setBaslik(secilenKonum.adres);
        setCevreDurumu({ tur: 'yukleniyor', mesaj: 'Yol verileri yükleniyor…' });
        let c: Cevre | null = null;
        let not = 'OpenStreetMap verisi';
        let nokta: Vec2 = { x: 0, z: 0 };
        try {
            c = await cevreVerisiGetir(secilenKonum.lat, secilenKonum.lon, d.signal);
            if (!c.yollar.length) {
                c = null;
                not = 'Yakında kayıtlı yol bulunamadı — temsili kavşak kullanıldı';
            }
        } catch {
            if (d.signal.aborted) return;
            not = 'Yol verisine ulaşılamadı (çevrimdışı?) — temsili kavşak kullanıldı';
        }
        if (c) {
            const h = yolaHizala(c, { x: 0, z: 0 });
            if (!h) {
                c = null;
                not = 'Seçilen nokta yollardan çok uzak — temsili kavşak kullanıldı';
            } else {
                nokta = h.nokta;
                if (!h.tam) not = `Nokta yol dışındaydı; ${Math.round(h.kaymaMetre)} m ötedeki yol eksenine alındı`;
            }
        }
        if (!c) {
            c = temsiliKavsak();
            nokta = { x: 2.25, z: -3.95 };
        } else if (!yaklasimListesi(c, nokta, 'arac').length) {
            c = temsiliKavsak();
            nokta = { x: 2.25, z: -3.95 };
            not = 'Yol geometrisi simülasyona uygun değil — temsili kavşak kullanıldı';
        }
        setKatilimcilar((k) => ({ A: { ...k.A, yaklasimAnahtar: '' }, B: { ...k.B, yaklasimAnahtar: '' } }));
        setKosullar((k) => ({ ...k, carpismaTipi: 'otomatik' }));
        sahneyeGec(c, nokta, secilenKonum.adres, not);
    }, [secilenKonum, sahneyeGec]);

    const baslangicaDon = useCallback(() => {
        istekRef.current?.abort();
        duzenlemeBitir();
        motorRef.current?.duraklat();
        setEkran('baslangic');
    }, [duzenlemeBitir]);

    const sahneyeDon = useCallback(() => {
        if (cevreRef.current) setEkran('sahne');
    }, []);

    // ---- Form güncellemeleri ----
    const katilimciGuncelle = useCallback((id: TarafId, parca: Partial<KatilimciGirdi>) => {
        setKatilimcilar((k) => {
            const eski = k[id];
            let yeni: KatilimciGirdi = { ...eski, ...parca };
            if (parca.tip && parca.tip !== eski.tip) {
                const yaya = parca.tip === 'yaya';
                yeni = {
                    ...yeni,
                    mod: 'hiz',
                    hizKmh: yaya ? 5 : id === 'A' ? 60 : 50,
                    kutleKg: yaya ? 75 : ARAC_TURLERI[yeni.tur].kutle,
                    izM: yaya ? 0 : yeni.izM,
                    ihlaller: [],
                    yaklasimAnahtar: '',
                };
            }
            if (parca.tur && parca.tur !== eski.tur) yeni.kutleKg = ARAC_TURLERI[parca.tur].kutle;
            const diger: TarafId = id === 'A' ? 'B' : 'A';
            if (yeni.tip === 'yaya' && k[diger].tip === 'yaya') {
                bildir('Her iki taraf da yaya olamaz; diğer taraf araç olarak kalmalı.', 'uyari');
                return k;
            }
            return { ...k, [id]: yeni };
        });
    }, [bildir]);

    const kosulGuncelle = useCallback((parca: Partial<GenelKosullar>) => {
        setKosullar((k) => {
            const yeni = { ...k, ...parca };
            if (parca.yuzeyId) {
                const y = YUZEYLER.find((v) => v.id === parca.yuzeyId);
                if (y) yeni.mu = y.mu;
            }
            return yeni;
        });
    }, []);

    // ---- Hesaplama ----
    const hesapla = useCallback((): boolean => {
        const c = cevreRef.current;
        const m = motorRef.current;
        const yA = secilenYaklasim('A');
        const yB = secilenYaklasim('B');
        if (!c || !yA || !yB) {
            bildir('Her iki taraf için geliş yönü seçilmelidir.', 'uyari');
            return false;
        }
        const ayniYon = yA.anahtar === yB.anahtar;
        if (ayniYon && (kosullar.carpismaTipi === 'yandan' || kosullar.carpismaTipi === 'kafa-kafaya')) {
            bildir('Aynı geliş yönünde yandan veya kafa kafaya çarpışma kurulamaz. Arkadan/sıyırma seçin ya da yönü değiştirin.', 'uyari');
            return false;
        }
        try {
            const girdi = simGirdisiKur(c, P, kosullar, katilimcilar.A, katilimcilar.B, yA, yB);
            const s = simuleEt(girdi);
            const k = kusurHesapla(
                { ihlaller: katilimcilar.A.ihlaller, hizKmh: katilimcilar.A.tip === 'yaya' ? null : baslangicHizi(katilimcilar.A, kosullar.mu) * 3.6, limitKmh: katilimcilar.A.tip === 'yaya' ? null : kosullar.limitKmh },
                { ihlaller: katilimcilar.B.ihlaller, hizKmh: katilimcilar.B.tip === 'yaya' ? null : baslangicHizi(katilimcilar.B, kosullar.mu) * 3.6, limitKmh: katilimcilar.B.tip === 'yaya' ? null : kosullar.limitKmh },
            );
            setSonuc(s);
            setKusur(k);
            setSonucImzasi(girdiImzasi);
            duzenlemeBitir();
            if (m) {
                const gorunum: Record<TarafId, TarafGorunum> = {
                    A: { tip: katilimcilar.A.tip, tur: katilimcilar.A.tur, plaka: katilimcilar.A.plaka },
                    B: { tip: katilimcilar.B.tip, tur: katilimcilar.B.tur, plaka: katilimcilar.B.plaka },
                };
                m.simulasyonAyarla(s, gorunum);
                m.oynatmaHizi = oynatmaHizi;
                m.oynat();
            }
            return true;
        } catch (e) {
            bildir(e instanceof Error ? e.message : 'Simülasyon hesaplanamadı.', 'hata');
            return false;
        }
    }, [P, bildir, duzenlemeBitir, girdiImzasi, katilimcilar, kosullar, oynatmaHizi, secilenYaklasim]);

    // ---- Oynatma ----
    const oynatDuraklat = useCallback(() => {
        const m = motorRef.current;
        if (!m || !sonuc) return;
        if (m.oynatiliyor) m.duraklat();
        else m.oynat();
    }, [sonuc]);

    const zamanaGit = useCallback((t: number) => {
        const m = motorRef.current;
        if (!m || !sonuc) return;
        m.duraklat();
        m.zamanAyarla(t);
    }, [sonuc]);

    const adimAt = useCallback((dt: number) => {
        const m = motorRef.current;
        if (!m || !sonuc) return;
        m.duraklat();
        m.zamanAyarla(m.zaman + dt);
    }, [sonuc]);

    const setOynatmaHizi = useCallback((h: number) => setOynatmaHiziDurum(h), []);
    const setKamera = useCallback((k: KameraModu) => {
        setKameraDurum(k);
        motorRef.current?.kameraModuAyarla(k);
    }, []);
    const setGuzergah = useCallback((g: boolean) => setGuzergahDurum(g), []);
    const kameraSifirla = useCallback(() => motorRef.current?.kameraSifirla(), []);

    // ---- Dışa aktarım ----
    const krokiBilgisi = useCallback(() => ({
        baslik: 'Kaza Krokisi (Simülasyon — bilirkişi krokisi değildir)',
        altSatirlar: [
            `Konum: ${baslik || '—'}`,
            `${tarafAdi('A', katilimcilar.A)}  ·  ${tarafAdi('B', katilimcilar.B)}  ·  µ = ${kosullar.mu.toFixed(2)}  ·  Hız sınırı ${kosullar.limitKmh} km/s`,
            `Oluşturma: ${new Date().toLocaleString('tr-TR')}`,
        ],
    }), [baslik, katilimcilar, kosullar]);

    const fotoIndir = useCallback((hudlu: boolean) => korumali(() => {
        const m = motorRef.current;
        if (!m) return;
        void m.fotoAl(hudlu).then((b) => indir(b, dosyaAdi('png', '-foto'))).catch(() => bildir('Fotoğraf üretilemedi.', 'hata'));
    }), [bildir, korumali]);

    const krokiIndir = useCallback(() => korumali(() => {
        const m = motorRef.current;
        if (!m) return;
        void m.krokiAl(krokiBilgisi()).then((b) => indir(b, dosyaAdi('png', '-kroki'))).catch(() => bildir('Kroki üretilemedi.', 'hata'));
    }), [bildir, korumali, krokiBilgisi]);

    const videoKaydet = useCallback((s: VideoSecenek) => korumali(() => {
        const m = motorRef.current;
        if (!m || !sonuc) {
            bildir('Video için önce “Hesapla ve Canlandır”a basın.', 'uyari');
            return;
        }
        setVideo({ aktif: true, ilerleme: 0, hata: null });
        let son = 0;
        m.videoKaydet(s, (o) => {
            if (o - son > 0.01 || o >= 1) {
                son = o;
                setVideo((v) => ({ ...v, ilerleme: o }));
            }
        }).then((r) => {
            indir(r.blob, dosyaAdi(r.uzanti, '-video'));
            setVideo({ aktif: false, ilerleme: 1, hata: null });
        }).catch((e: unknown) => {
            setVideo({ aktif: false, ilerleme: 0, hata: e instanceof Error ? e.message : 'Video kaydedilemedi.' });
        });
    }), [bildir, korumali, sonuc]);

    const videoIptal = useCallback(() => {
        motorRef.current?.videoIptal();
        setVideo({ aktif: false, ilerleme: 0, hata: null });
    }, []);

    const yazdir = useCallback(() => korumali(() => {
        const m = motorRef.current;
        if (!sonuc || !m) {
            bildir('Rapor için önce hesaplama yapın.', 'uyari');
            return;
        }
        void m.krokiAl(krokiBilgisi()).then((b) => {
            const url = URL.createObjectURL(b);
            setYazdirmaKroki((eski) => {
                if (eski) URL.revokeObjectURL(eski);
                return url;
            });
            const img = new Image();
            img.src = url;
            void img.decode().catch(() => undefined).then(() => requestAnimationFrame(() => requestAnimationFrame(() => window.print())));
        });
    }), [bildir, korumali, krokiBilgisi, sonuc]);

    useEffect(() => () => {
        istekRef.current?.abort();
        if (yazdirmaKroki) URL.revokeObjectURL(yazdirmaKroki);
    }, [yazdirmaKroki]);

    const elleIsaretler = useMemo(() => (cevre?.isaretler ?? []).filter((i) => i.elle), [cevre?.isaretler]);
    const cizilenYollar = useMemo(() => (cevre?.yollar ?? []).filter((y) => y.elle), [cevre?.yollar]);
    const yakinIsaretler = useMemo(() => (cevre?.isaretler ?? [])
        .filter((i) => !i.elle && i.tip !== 'agac')
        .map((i) => ({ ...i, uzaklik: uzaklik(i, P) }))
        .filter((i) => i.uzaklik < 120)
        .sort((a, b) => a.uzaklik - b.uzaklik)
        .slice(0, 6), [cevre?.isaretler, P]);

    return {
        // durum
        ekran, sekme, secilenKonum, baslik, cevre, cevreDurumu, P, kosullar, katilimcilar, listeler,
        duzenleme, sonuc, kusur, sonucEski, bildirim, zaman, oynuyor, oynatmaHizi, kamera, guzergah,
        video, kilitAcik, yazdirmaKroki, elleIsaretler, cizilenYollar, yakinIsaretler, motorHazirMi,
        // eylemler
        setSekme, motorBagla, konumSec, konumdanKur, sablonYukle, baslangicaDon, sahneyeDon,
        katilimciGuncelle, kosulGuncelle, hesapla: () => { let ok = false; korumali(() => { ok = hesapla(); }); return ok; },
        noktaSecimiBaslat, isaretModu, isaretDondur, isaretSil, cizimBaslat, cizimKaydet, yolSil, duzenlemeBitir,
        oynatDuraklat, zamanaGit, adimAt, setOynatmaHizi, setKamera, setGuzergah, kameraSifirla,
        fotoIndir, krokiIndir, videoKaydet, videoIptal, yazdir,
        kilitKapat: () => setKilitAcik(false),
        girisIste: () => { setKilitAcik(false); sec.onRequestLogin?.(); },
        bildirimKapat: () => setBildirim(null),
        bildir,
    };
}

export type KazaMotoru = ReturnType<typeof useKazaEngine>;
