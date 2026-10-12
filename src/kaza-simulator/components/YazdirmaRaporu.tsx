'use client';

// Yalnızca yazdırırken görünen A4 rapor (Yazdır / PDF olarak kaydet).

import { ARAC_TURLERI, AYDINLATMA_ADI, GIZLILIK_NOTU, HAVA_ADI, ISIK_ADI, MARKA, YASAL_UYARI } from '../data/kazaData.ts';
import type { GenelKosullar, KatilimciGirdi, KusurSonuc, SimSonuc, TarafId } from '../types/kazaTypes.ts';

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

const kmh = (v: number): string => (v * 3.6).toFixed(1);
const td = 'border border-[#bbb] px-2 py-1 text-left align-top';

export function YazdirmaRaporu({ sonuc, kusur, katilimcilar, tarafAdlari, kosullar, konum, kroki, gelisler }: YazdirmaRaporuProps) {
    return (
        <div id="yazdirma-alani" className="bg-white text-[10.5pt] leading-snug text-black">
            {sonuc && kusur && (
                <>
                    <div className="flex items-center justify-between gap-4 border-b-2 border-[#C81D25] pb-3">
                        <div>
                            <div className="text-[9pt] font-bold tracking-[0.14em]">{MARKA.kurumBuyuk}</div>
                            <h1 className="text-[17pt] font-bold">Trafik Kazası Simülasyon Özeti</h1>
                            <div className="text-[9pt] text-[#C81D25]">{MARKA.uygulama} · meslektaşlarımızın faydasına hazırlanmıştır</div>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={MARKA.logo} alt="" className="h-[22mm] w-[22mm]" />
                    </div>
                    <p className="mt-3 border-[1.5px] border-[#C81D25] px-3 py-2 text-[9.5pt] text-[#8b0000]">
                        <b>SİMÜLASYON ÇIKTISIDIR — HUKUKİ GÖRÜŞ VEYA BİLİRKİŞİ RAPORU DEĞİLDİR.</b> Bu belge basitleştirilmiş fizik modelleriyle çalışan bir simülasyon aracının çıktısıdır;
                        bilirkişi raporu, kusur tespiti veya delil niteliği taşımaz, resmî ya da adli işlemlerde bu nitelikle kullanılamaz.
                    </p>
                    <p className="mt-2 text-[9.5pt] text-[#444]">
                        Konum: {konum || '—'}<br />
                        Rapor tarihi: {new Date().toLocaleString('tr-TR')}<br />
                        {AYDINLATMA_ADI[kosullar.aydinlatma]} · {HAVA_ADI[kosullar.hava]}{kosullar.isik.A !== 'yok' || kosullar.isik.B !== 'yok' ? ` · Işık (çarpışma anı): A ${ISIK_ADI[kosullar.isik.A]}, B ${ISIK_ADI[kosullar.isik.B]}` : ''}<br />
                        Yol yüzeyi sürtünme katsayısı µ = {kosullar.mu.toFixed(2)} · Hız sınırı {kosullar.limitKmh} km/s · Çarpışma: {sonuc.tip} · Temas anı t = {sonuc.tCarpisma.toFixed(2)} sn
                    </p>
                    {kroki && <img src={kroki} alt="Kaza krokisi" className="mt-3 w-full border border-[#ccc]" style={{ breakInside: 'avoid' }} />}

                    <h2 className="mt-4 border-b border-[#999] pb-1 text-[12.5pt] font-bold">Hesaplama sonuçları</h2>
                    <table className="mt-2 w-full border-collapse text-[9.5pt]">
                        <thead>
                            <tr>
                                {['Taraf', 'Geliş', 'Kaza öncesi hız', 'Çarpma hızı', 'Fren izi', 'Duruş mesafesi', 'ΔV', 'Savrulma', 'Olası kusur payı'].map((b) => <th key={b} className={td}>{b}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {(['A', 'B'] as const).map((id) => {
                                const s = sonuc.taraflar[id];
                                const yaya = s.tip === 'yaya';
                                return (
                                    <tr key={id}>
                                        <td className={td}>{tarafAdlari[id]}<br /><span className="text-[8.5pt] text-[#555]">{yaya ? `${katilimcilar[id].kutleKg} kg` : `${ARAC_TURLERI[s.tur].ad}, ${Math.round(s.kutle)} kg`}</span></td>
                                        <td className={td}>{gelisler[id]}</td>
                                        <td className={td}>{kmh(s.v0)} km/s</td>
                                        <td className={td}>{yaya ? '—' : `${kmh(s.vi)} km/s`}</td>
                                        <td className={td}>{yaya ? '—' : `${s.izEtkin.toFixed(1)} m`}</td>
                                        <td className={td}>{yaya ? '—' : `${s.durusMesafesi.toFixed(1)} m`}</td>
                                        <td className={td}>{kmh(s.deltaV)} km/s</td>
                                        <td className={td}>{s.savrulmaMesafesi.toFixed(1)} m</td>
                                        <td className={td}>{kusur[id].sekizlik} (%{kusur[id].yuzdeMetin})<br />{kusur[id].etiket.ad}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {(['A', 'B'] as const).map((id) => {
                        const k = sonuc.taraflar[id].kacinilabilirlik;
                        const sr = sonuc.taraflar[id].searleAsgariHiz;
                        if (!k && sr === null) return null;
                        return (
                            <p key={id} className="mt-2 text-[9.5pt]">
                                <b>{tarafAdlari[id]}:</b>{' '}
                                {k && (k.kacinilabilir
                                    ? `Hız sınırında (${Math.round(k.limitHizi * 3.6)} km/s) seyretseydi, ${k.algilamaMesafesi.toFixed(1)} m önceki algılama noktasından ${k.limitteDurusMesafesi.toFixed(1)} m'de durarak çarpışma noktasına ulaşmadan durabilmesi mümkün görünmektedir.`
                                    : `Hız sınırında (${Math.round(k.limitHizi * 3.6)} km/s) seyretseydi de durması mümkün görünmemektedir; çarpma hızı yaklaşık ${kmh(k.limitteCarpmaHizi)} km/s olabilirdi.`)}
                                {sr !== null && ` Fırlatma mesafesinden (${sonuc.taraflar[id].savrulmaMesafesi.toFixed(1)} m) Searle bağıntısıyla asgari çarpma hızı ≈ ${kmh(sr)} km/s.`}
                            </p>
                        );
                    })}

                    {(['A', 'B'] as const).map((id) => (
                        <div key={id} style={{ breakInside: 'avoid' }}>
                            <h2 className="mt-4 border-b border-[#999] pb-1 text-[12pt] font-bold">{tarafAdlari[id]} — olası kusur gerekçeleri</h2>
                            {kusur[id].gerekceler.length ? (
                                <ul className="mt-1 list-disc pl-5">
                                    {kusur[id].gerekceler.map((g) => <li key={g.ad}>{g.ad} söz konusu olabilir <span className="text-[8.5pt] text-[#555]">({g.dayanak})</span></li>)}
                                </ul>
                            ) : <p className="mt-1 text-[9.5pt] text-[#555]">İşaretlenen olası ihlal yok.</p>}
                        </div>
                    ))}

                    {sonuc.uyarilar.length > 0 && (
                        <>
                            <h2 className="mt-4 border-b border-[#999] pb-1 text-[12pt] font-bold">Notlar</h2>
                            <ul className="mt-1 list-disc pl-5 text-[9.5pt]">{sonuc.uyarilar.map((u) => <li key={u}>{u}</li>)}</ul>
                        </>
                    )}

                    <h2 className="mt-4 border-b border-[#999] pb-1 text-[12pt] font-bold">Yöntem</h2>
                    <p className="mt-1 text-[9pt] text-[#444]">
                        Fren izinden hız: v = √(v<sub>son</sub>² + 2µgd). Çarpışma öncesi hareket: seyir → algılama/tepki → frenleme (sabit µg yavaşlama).
                        Çarpışma: iki boyutlu katı cisim itki modeli (doğrusal ve açısal momentum korunumu, çarpma katsayısı e ≈ 0,12, Coulomb temas sürtünmesi).
                        Çarpışma sonrası: boyuna/yanal lastik sürtünmesi ve sapma sönümü ile sayısal entegrasyon; ikincil temaslar yönlendirilmiş kutu (SAT) ile çözülür.
                        Yaya: Searle fırlatma modeli (µ ≈ 0,66). Olası kusur dağılımı: kullanıcının işaretlediği ihlallerle ilgili olabilecek 2918 sayılı KTK hükümleri (m.84 asli kusur hâlleri; yayalar için m.68) esas alınarak ağırlıklandırılmış puanlama, 8'lik dilim. Bu dağılım bir kusur tespiti değil, olasılık değerlendirmesidir.
                        Anılan mevzuat hükümleri örneklendirme amaçlıdır; güncel ve bağlayıcı metin için resmî kaynaklara başvurulmalıdır.
                    </p>

                    <div style={{ breakInside: 'avoid' }}>
                        <h2 className="mt-4 border-b border-[#999] pb-1 text-[12pt] font-bold">Yasal uyarı</h2>
                        <div className="mt-1 space-y-1 text-[8.5pt] text-[#444]">
                            {YASAL_UYARI.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
                        </div>
                        <p className="mt-3 text-[8pt] text-[#777]">© {new Date().getFullYear()} {MARKA.kurum} · {GIZLILIK_NOTU}</p>
                    </div>
                </>
            )}
        </div>
    );
}
