'use client';

// Yalnızca yazdırırken görünen A4 rapor (Yazdır / PDF olarak kaydet).
// Renkler sabit (yazdırmada tema değişkenlerinden bağımsız), ölçüler pt/mm.

import type { ReactNode } from 'react';
import {
    ANA_UYARI, ARAC_TURLERI, AYDINLATMA_ADI, CARPISMA_TIP_ADI, GIZLILIK_NOTU, HAVA_ADI, ISIK_ADI, MARKA, MEVZUAT_KAYNAGI, TARAF_RENK, YASAL_UYARI,
} from '../data/kazaData.ts';
import { hukumListesi } from '../data/ktkMetinleri.ts';
import { siddetEtiketi } from '../lib/physics.ts';
import type { GenelKosullar, KatilimciGirdi, KusurSonuc, SimSonuc, TarafId, TarafSonuc } from '../types/kazaTypes.ts';
import { HukumAlintisi } from './HukumAlintisi.tsx';

export interface YazdirmaRaporuProps {
    sonuc: SimSonuc | null;
    kusur: KusurSonuc | null;
    katilimcilar: Record<TarafId, KatilimciGirdi>;
    tarafAdlari: Record<TarafId, string>;
    kosullar: GenelKosullar;
    konum: string;
    kroki: string | null;
    gelisler: Record<TarafId, string>;
}

const KIRMIZI = '#C81D25';
const TARAFLAR = ['A', 'B'] as const;
const kmh = (v: number): string => (v * 3.6).toFixed(1).replace('.', ',');
const m = (v: number): string => v.toFixed(1).replace('.', ',');

function Bolum({ no, baslik, children, bolunmesin }: { no: number; baslik: string; children: ReactNode; bolunmesin?: boolean }) {
    return (
        <section className="mt-[5mm]" style={bolunmesin ? { breakInside: 'avoid' } : undefined}>
            <h2 className="flex items-center gap-[2.5mm] text-[11.5pt] font-bold tracking-[-0.01em]" style={{ breakAfter: 'avoid' }}>
                <span className="inline-flex h-[6mm] w-[6mm] items-center justify-center rounded-full text-[8.5pt] text-white" style={{ background: KIRMIZI }}>{no}</span>
                {baslik}
                <span className="h-px flex-1 bg-[#e3dcda]" />
            </h2>
            <div className="mt-[2.5mm]">{children}</div>
        </section>
    );
}

function Bilgi({ ad, deger }: { ad: string; deger: ReactNode }) {
    return (
        <div className="rounded-[2mm] border border-[#e6e1df] px-[3mm] py-[1.4mm]">
            <div className="text-[7pt] font-semibold uppercase tracking-[0.08em] text-[#8a8280]">{ad}</div>
            <div className="mt-[0.5mm] text-[9.5pt] font-semibold leading-tight">{deger}</div>
        </div>
    );
}

function TarafEtiketi({ id, ad }: { id: TarafId; ad: string }) {
    return (
        <span className="inline-flex items-center gap-[1.5mm]">
            <span className="inline-flex h-[4.6mm] w-[4.6mm] items-center justify-center rounded-full text-[7.5pt] font-bold text-white" style={{ background: TARAF_RENK[id] }}>{id}</span>
            <span className="font-bold">{ad}</span>
        </span>
    );
}

type Olcum = { ad: string; deger: (s: TarafSonuc) => string; vurgu?: boolean };

const OLCUMLER: readonly Olcum[] = [
    { ad: 'Kaza öncesi hız', deger: (s) => `${kmh(s.v0)} km/s` },
    { ad: 'Çarpma anı hızı', deger: (s) => (s.tip === 'yaya' ? '—' : `${kmh(s.vi)} km/s`), vurgu: true },
    { ad: 'Fren izi (etkin)', deger: (s) => (s.tip === 'yaya' || s.izGirilen <= 0 ? '—' : `${m(s.izEtkin)} m`) },
    { ad: 'Tam durma fren mesafesi', deger: (s) => (s.tip === 'yaya' ? '—' : `${m(s.frenMesafesi)} m`) },
    { ad: 'Duruş mesafesi (tepki dâhil)', deger: (s) => (s.tip === 'yaya' ? '—' : `${m(s.durusMesafesi)} m · ${s.reaksiyon.toFixed(1).replace('.', ',')} sn`) },
    { ad: 'Tehlikeyi algılama noktası', deger: (s) => (s.tip === 'yaya' || s.algilamaMesafesi <= 0 ? '—' : `çarpışmadan ${m(s.algilamaMesafesi)} m önce`) },
    { ad: 'Hız değişimi (ΔV)', deger: (s) => `${kmh(s.deltaV)} km/s · ${siddetEtiketi(s.deltaV).ad}` },
    { ad: 'Savrulma / fırlatma', deger: (s) => `${m(s.savrulmaMesafesi)} m${s.tip !== 'yaya' && s.donmeDerece > 3 ? ` · ${s.donmeDerece.toFixed(0)}° dönme` : ''}` },
    { ad: 'Asgari çarpma hızı (Searle)', deger: (s) => (s.searleAsgariHiz === null ? '—' : `${kmh(s.searleAsgariHiz)} km/s`) },
];

export function YazdirmaRaporu({ sonuc, kusur, katilimcilar, tarafAdlari, kosullar, konum, kroki, gelisler }: YazdirmaRaporuProps) {
    if (!sonuc || !kusur) return <div id="yazdirma-alani" />;

    const simdi = new Date();
    const raporNo = `KS-${simdi.getFullYear()}${String(simdi.getMonth() + 1).padStart(2, '0')}${String(simdi.getDate()).padStart(2, '0')}-${String(simdi.getHours()).padStart(2, '0')}${String(simdi.getMinutes()).padStart(2, '0')}`;
    const isikVar = kosullar.isik.A !== 'yok' || kosullar.isik.B !== 'yok';
    const olcumler = OLCUMLER.filter((o) => TARAFLAR.some((id) => o.deger(sonuc.taraflar[id]) !== '—'));

    // Her hükmün hangi tarafın hangi ihlaliyle ilgili olabileceği (tekrarsız)
    const hukumIliskisi = new Map<string, Set<TarafId>>();
    for (const id of TARAFLAR) for (const g of kusur[id].gerekceler) for (const h of g.hukumler) {
        if (!hukumIliskisi.has(h)) hukumIliskisi.set(h, new Set());
        hukumIliskisi.get(h)?.add(id);
    }
    const hukumler = hukumListesi([...hukumIliskisi.keys(), ...(kusur.coklu84 ? ['84/son'] : [])]);
    const atifNo = new Map(hukumler.map((h, i) => [h.anahtar, i + 1]));
    let bolumNo = 0;
    const no = (): number => ++bolumNo;

    return (
        <div id="yazdirma-alani" className="bg-white text-[9.8pt] leading-[1.45] text-[#1d1a19]">
            {/* Başlık */}
            <header className="flex items-stretch gap-[5mm] overflow-hidden rounded-[3mm] text-white" style={{ background: `linear-gradient(120deg, #7a0f15 0%, ${KIRMIZI} 70%)` }}>
                <div className="flex items-center bg-white px-[4mm]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={MARKA.logo} alt="" className="h-[20mm] w-[20mm] object-contain" />
                </div>
                <div className="flex-1 py-[4mm]">
                    <div className="flex items-center gap-[2.5mm] text-[7.5pt] font-bold tracking-[0.18em]">
                        <span className="opacity-85">{MARKA.kurumBuyuk}</span>
                        <span className="rounded-full bg-white px-[2mm] py-[0.3mm] text-[6.5pt] tracking-[0.12em]" style={{ color: KIRMIZI }}>SİMÜLASYON</span>
                    </div>
                    <h1 className="mt-[1mm] text-[17pt] font-extrabold leading-tight tracking-[-0.01em]">Trafik Kazası Simülasyon Raporu</h1>
                    <div className="mt-[1mm] text-[8.5pt] opacity-90">{MARKA.uygulama} · Meslektaşlarımızın faydasına hazırlanmıştır</div>
                </div>
                <div className="flex flex-col justify-center gap-[1mm] border-l border-white/25 px-[5mm] text-[7.5pt] leading-tight">
                    <div><span className="opacity-70">Rapor no</span><br /><b className="text-[9pt]">{raporNo}</b></div>
                    <div><span className="opacity-70">Tarih</span><br /><b className="text-[9pt]">{simdi.toLocaleDateString('tr-TR')} {simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b></div>
                </div>
            </header>

            <div className="mt-[4mm] flex gap-[3mm] rounded-[2.5mm] border-[1.5px] px-[4mm] py-[2.5mm] text-[8.8pt] leading-snug" style={{ borderColor: KIRMIZI, background: '#fdf3f3', color: '#6d0c11' }}>
                <span className="mt-[0.3mm] text-[12pt] font-black leading-none">!</span>
                <p className="m-0"><b className="block text-[10pt]">{ANA_UYARI.baslik.toLocaleUpperCase('tr-TR')} — {ANA_UYARI.metin.split(';')[0].toLocaleUpperCase('tr-TR')}.</b> Basitleştirilmiş fizik modelleriyle çalışan bir simülasyon aracının çıktısıdır; delil niteliği taşımaz, resmî ya da adli işlemlerde bu nitelikle kullanılamaz. Kusur oranlarına ve kanun hükümlerine ilişkin tüm ifadeler <b>olasılık</b> bildirir.</p>
            </div>

            <Bolum no={no()} baslik="Olay bilgileri" bolunmesin>
                <div className="grid grid-cols-4 gap-[2mm]">
                    <div className="col-span-2"><Bilgi ad="Konum" deger={konum || '—'} /></div>
                    <Bilgi ad="Çarpışma" deger={CARPISMA_TIP_ADI[sonuc.tip]} />
                    <Bilgi ad="Temas anı" deger={`t = ${sonuc.tCarpisma.toFixed(2).replace('.', ',')} sn`} />
                    <Bilgi ad="Aydınlatma · hava" deger={`${AYDINLATMA_ADI[kosullar.aydinlatma]} · ${HAVA_ADI[kosullar.hava]}`} />
                    <Bilgi ad="Yol yüzeyi" deger={`µ = ${kosullar.mu.toFixed(2).replace('.', ',')}`} />
                    <Bilgi ad="Hız sınırı" deger={`${kosullar.limitKmh} km/s`} />
                    <Bilgi ad="Sönümlenen enerji" deger={`≈ ${sonuc.enerjiKJ.toFixed(0)} kJ`} />
                    {isikVar && <div className="col-span-4"><Bilgi ad="Trafik ışığı (çarpışma anı)" deger={`A: ${ISIK_ADI[kosullar.isik.A]} · B: ${ISIK_ADI[kosullar.isik.B]}`} /></div>}
                </div>
                <div className="mt-[2mm] grid grid-cols-2 gap-[2mm]">
                    {TARAFLAR.map((id) => {
                        const s = sonuc.taraflar[id];
                        const yaya = s.tip === 'yaya';
                        return (
                            <div key={id} className="rounded-[2mm] px-[3mm] py-[2mm]" style={{ background: id === 'A' ? '#fbf1f1' : '#eef3fb' }}>
                                <TarafEtiketi id={id} ad={tarafAdlari[id]} />
                                <div className="mt-[0.8mm] text-[8.5pt] text-[#555]">
                                    {yaya ? `Yaya · ${katilimcilar[id].kutleKg} kg` : `${ARAC_TURLERI[s.tur].ad} · ${Math.round(s.kutle)} kg`}{katilimcilar[id].plaka ? ` · ${katilimcilar[id].plaka.toLocaleUpperCase('tr-TR')}` : ''}
                                    <br />{gelisler[id]}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Bolum>

            {kroki && (
                <Bolum no={no()} baslik="Kaza krokisi" bolunmesin>
                    <figure className="m-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={kroki} alt="Kaza krokisi" className="mx-auto block max-h-[98mm] w-auto max-w-full rounded-[2mm] border border-[#ddd]" />
                        <figcaption className="mt-[1mm] text-center text-[7.5pt] text-[#888]">Şekil 1 — Ölçekli kuşbakışı kroki (simülasyon). Kesikli çizgiler geliş güzergâhlarını, işaret çarpışma noktasını gösterir.</figcaption>
                    </figure>
                </Bolum>
            )}

            <Bolum no={no()} baslik="Hesaplama sonuçları" bolunmesin>
                <table className="w-full border-collapse text-[9pt]">
                    <thead>
                        <tr>
                            <th className="w-[40%] border-b-2 border-[#1d1a19] py-[1.5mm] text-left text-[7.5pt] font-semibold uppercase tracking-[0.08em] text-[#8a8280]">Büyüklük</th>
                            {TARAFLAR.map((id) => <th key={id} className="border-b-2 py-[1.5mm] text-left" style={{ borderColor: TARAF_RENK[id] }}><TarafEtiketi id={id} ad={tarafAdlari[id]} /></th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {olcumler.map((o, i) => (
                            <tr key={o.ad} style={{ background: i % 2 ? '#faf8f7' : undefined }}>
                                <td className="border-b border-[#eee] px-[1mm] py-[1.3mm] text-[#555]">{o.ad}</td>
                                {TARAFLAR.map((id) => <td key={id} className={`border-b border-[#eee] py-[1.3mm] tabular-nums ${o.vurgu ? 'font-bold' : 'font-semibold'}`}>{o.deger(sonuc.taraflar[id])}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {TARAFLAR.map((id) => {
                    const k = sonuc.taraflar[id].kacinilabilirlik;
                    if (!k) return null;
                    return (
                        <p key={id} className="mt-[2mm] rounded-[2mm] px-[3mm] py-[1.8mm] text-[8.8pt]" style={{ background: k.kacinilabilir ? '#eef8f1' : '#f5f3f2' }}>
                            <b>Kaçınılabilirlik — {tarafAdlari[id]}:</b>{' '}
                            {k.kacinilabilir
                                ? `Hız sınırında (${Math.round(k.limitHizi * 3.6)} km/s) seyretseydi, ${m(k.algilamaMesafesi)} m önceki algılama noktasından ${m(k.limitteDurusMesafesi)} m'de durarak çarpışma noktasına ulaşmadan durabilmesi mümkün görünmektedir.`
                                : `Hız sınırında (${Math.round(k.limitHizi * 3.6)} km/s) seyretseydi de durması mümkün görünmemektedir; çarpma hızı yaklaşık ${kmh(k.limitteCarpmaHizi)} km/s olabilirdi.`}
                        </p>
                    );
                })}
            </Bolum>

            <Bolum no={no()} baslik="Olası kusur dağılımı">
                <div style={{ breakInside: 'avoid' }}>
                    <div className="flex h-[9mm] overflow-hidden rounded-full text-[9.5pt] font-bold text-white">
                        {TARAFLAR.map((id) => (
                            <div key={id} className="flex items-center justify-center" style={{ flex: Math.max(kusur[id].yuzde, 12), background: TARAF_RENK[id] }}>
                                {id} · {kusur[id].sekizlik} · %{kusur[id].yuzdeMetin}
                            </div>
                        ))}
                    </div>
                    <div className="mt-[2mm] grid grid-cols-2 gap-[2mm]">
                        {TARAFLAR.map((id) => (
                            <div key={id} className="flex items-center justify-between rounded-[2mm] border border-[#e6e1df] px-[3mm] py-[1.8mm]">
                                <TarafEtiketi id={id} ad={tarafAdlari[id]} />
                                <span className="text-[8.5pt] font-semibold" style={{ color: kusur[id].etiket.sinif === 'asli' ? KIRMIZI : kusur[id].etiket.sinif === 'tali' ? '#a16207' : '#15803d' }}>{kusur[id].etiket.ad}</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-[2mm] text-[8.5pt] text-[#666]">
                        Oranlar yalnızca kullanıcının işaretlediği olası ihlaller ve hız bilgisi üzerinden 8’lik dilimle hesaplanmış bir <b>ön değerlendirmedir</b>; kusur tespiti değildir ve somut olayda farklı sonuç çıkabilir.
                        {kusur.belirsiz && ' İki taraf için de ihlal işaretlenmediğinden %50–%50 varsayılmıştır.'}
                    </p>
                    {kusur.coklu84 && (
                        <p className="mt-[2mm] rounded-[2mm] px-[3mm] py-[1.8mm] text-[8.8pt]" style={{ background: '#fdf6e3', color: '#6b4a00' }}>
                            <b>Not:</b> Her iki tarafta da KTK m.84’te sayılan hâllerden biri işaretlenmiştir. Maddenin son cümlesine göre [{atifNo.get('84/son')}] bu durumda kusur oranı yönetmelikte belirtilen esaslara göre belirlenir; yukarıdaki dağılım yalnızca bir ön fikirdir.
                        </p>
                    )}
                </div>

                {TARAFLAR.map((id) => (
                    <div key={id} className="mt-[3mm]" style={{ breakInside: 'avoid' }}>
                        <div className="border-b pb-[1mm] text-[9.5pt]" style={{ borderColor: TARAF_RENK[id] }}>
                            <TarafEtiketi id={id} ad={tarafAdlari[id]} /> <span className="text-[#777]">— olası kusur gerekçeleri</span>
                        </div>
                        {kusur[id].gerekceler.length ? (
                            <ol className="m-0 mt-[1.5mm] list-none space-y-[1.5mm] p-0">
                                {kusur[id].gerekceler.map((g, i) => (
                                    <li key={g.ad} className="flex gap-[2mm]">
                                        <span className="w-[4mm] shrink-0 text-right font-bold text-[#999]">{i + 1}.</span>
                                        <div>
                                            <b>{g.ad}</b> söz konusu olabilir.
                                            {g.madde84 && <span className="ml-[1.5mm] rounded-full px-[1.8mm] py-[0.2mm] text-[7.5pt] font-bold text-white" style={{ background: KIRMIZI }}>m.84/{g.madde84}</span>}
                                            <div className="text-[8.3pt] text-[#666]">{g.dayanak}.</div>
                                            {g.hukumler.length > 0 && (
                                                <div className="mt-[0.5mm] text-[7.8pt] text-[#8a8280]">
                                                    İlgili olabilecek hükümler: {hukumListesi(g.hukumler).map((h, j) => (
                                                        <span key={h.anahtar}>{j > 0 && ', '}<b className="text-[#444]">{h.hukum.atif}</b> [{atifNo.get(h.anahtar)}]</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        ) : <p className="mt-[1.5mm] text-[8.8pt] text-[#777]">İşaretlenen olası ihlal yok.</p>}
                    </div>
                ))}
            </Bolum>

            {hukumler.length > 0 && (
                <Bolum no={no()} baslik="İlgili olabilecek kanun hükümleri — birebir alıntı">
                    <p className="mb-[2mm] text-[8.3pt] text-[#666]">
                        Aşağıdaki metinler {MEVZUAT_KAYNAGI.ad} resmî metninden <b>birebir</b> aktarılmıştır; “…” atlanan kısımları gösterir, değişiklik ibareleri gösterilmemiştir.
                        Aynı davranış birden fazla hükümle ilgili olabileceğinden her hüküm bir kez listelenmiş, ilgili olabileceği taraf belirtilmiştir.
                    </p>
                    <div className="space-y-[2mm]">
                        {hukumler.map(({ anahtar, hukum }, i) => (
                            <HukumAlintisi key={anahtar} hukum={hukum} baski
                                ek={(
                                    <span className="ml-auto flex items-center gap-[1mm] text-[7.5pt] font-semibold text-[#8a8280]">
                                        [{i + 1}]
                                        {[...(hukumIliskisi.get(anahtar) ?? [])].map((t) => (
                                            <span key={t} className="inline-flex h-[4mm] w-[4mm] items-center justify-center rounded-full text-[6.5pt] font-bold text-white" style={{ background: TARAF_RENK[t] }}>{t}</span>
                                        ))}
                                    </span>
                                )} />
                        ))}
                    </div>
                </Bolum>
            )}

            {sonuc.uyarilar.length > 0 && (
                <Bolum no={no()} baslik="Notlar" bolunmesin>
                    <ul className="m-0 list-disc space-y-[0.8mm] pl-[5mm] text-[8.8pt]">{sonuc.uyarilar.map((u) => <li key={u}>{u}</li>)}</ul>
                </Bolum>
            )}

            <Bolum no={no()} baslik="Yöntem ve varsayımlar" bolunmesin>
                <ul className="m-0 list-disc space-y-[0.8mm] pl-[5mm] text-[8.5pt] text-[#444]">
                    <li><b>Fren izinden hız:</b> v = √(v<sub>son</sub>² + 2·µ·g·d) — asgari hız tahmini.</li>
                    <li><b>Çarpışma öncesi:</b> seyir → algılama/tepki → frenleme (sabit µ·g yavaşlama).</li>
                    <li><b>Çarpışma:</b> iki boyutlu katı cisim itki modeli; doğrusal ve açısal momentum korunumu, çarpma katsayısı e ≈ 0,12, Coulomb temas sürtünmesi.</li>
                    <li><b>Çarpışma sonrası:</b> boyuna/yanal lastik sürtünmesi ve sapma sönümüyle sayısal entegrasyon; ikincil temaslar yönlendirilmiş kutu (SAT) ile çözülür. Yaya için Searle fırlatma modeli (µ ≈ 0,66).</li>
                    <li><b>Olası kusur dağılımı:</b> işaretlenen ihlallerle ilgili olabilecek KTK hükümleri (araç sürücüleri için m.84 asli kusur hâlleri; yayalar için m.68) esas alınarak ağırlıklandırılmış puanlama, 8’lik dilim. Kusur tespiti değil, olasılık değerlendirmesidir.</li>
                    <li><b>Mevzuat:</b> {MEVZUAT_KAYNAGI.ad} — {MEVZUAT_KAYNAGI.url}. {MEVZUAT_KAYNAGI.dogrulama} Güncel ve bağlayıcı metin için resmî kaynağa başvurulmalıdır.</li>
                </ul>
            </Bolum>

            <Bolum no={no()} baslik="Yasal uyarı" bolunmesin>
                <div className="space-y-[1.2mm] text-[8pt] leading-[1.5] text-[#555]">
                    {YASAL_UYARI.map((p) => <p key={p.slice(0, 24)} className="m-0">{p}</p>)}
                </div>
            </Bolum>

            <footer className="mt-[6mm] border-t border-[#e3dcda] pt-[2mm] text-center text-[7.5pt] leading-relaxed text-[#8a8280]">
                <div><b className="text-[#555]">© {simdi.getFullYear()} {MARKA.kurum}</b> · <span className="whitespace-nowrap">{raporNo}</span></div>
                <div>{GIZLILIK_NOTU}</div>
            </footer>
        </div>
    );
}
