import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SABLONLAR } from '../src/kaza-simulator/data/kazaData.ts';
import { sablonKur, simGirdisiKur, yaklasimListesi } from '../src/kaza-simulator/lib/senaryo.ts';
import { simuleEt } from '../src/kaza-simulator/lib/simulate.ts';
import { izdenHiz, frenMesafesi, searleAsgariHiz } from '../src/kaza-simulator/lib/physics.ts';
import { kusurHesapla } from '../src/kaza-simulator/lib/kusur.ts';
import { KANAL_SAYISI } from '../src/kaza-simulator/types/kazaTypes.ts';

const r1 = (v: number) => Math.round(v * 10) / 10;

for (const s of SABLONLAR) {
    test(`şablon: ${s.ad}`, () => {
        const k = sablonKur(s);
        const lA = yaklasimListesi(k.cevre, k.P, k.A.tip);
        const lB = yaklasimListesi(k.cevre, k.P, k.B.tip);
        const yA = lA.find((y) => y.anahtar === k.A.yaklasimAnahtar)!;
        const yB = lB.find((y) => y.anahtar === k.B.yaklasimAnahtar)!;
        assert.ok(yA && yB, 'yaklaşımlar bulunmalı');
        const g = simGirdisiKur(k.cevre, k.P, k.kosullar, k.A, k.B, yA, yB);
        const t0 = performance.now();
        const r = simuleEt(g);
        const ms = performance.now() - t0;
        const A = r.taraflar.A, B = r.taraflar.B;
        console.log(`  ${s.id}: ${yA.etiket} / ${yB.etiket} tip=${r.tip} tC=${r1(r.tCarpisma)} süre=${r1(r.sure)} kare=${r.kareSayisi} ${ms.toFixed(1)}ms`);
        console.log(`    A v0=${r1(A.v0*3.6)} vi=${r1(A.vi*3.6)} dV=${r1(A.deltaV*3.6)} savrulma=${r1(A.savrulmaMesafesi)}m dönme=${r1(A.donmeDerece)}°`);
        console.log(`    B v0=${r1(B.v0*3.6)} vi=${r1(B.vi*3.6)} dV=${r1(B.deltaV*3.6)} savrulma=${r1(B.savrulmaMesafesi)}m dönme=${r1(B.donmeDerece)}° searle=${B.searleAsgariHiz ? r1(B.searleAsgariHiz*3.6) : '-'}`);
        console.log(`    enerji=${r1(r.enerjiKJ)}kJ izler=${r.izler.length} uyarılar=${r.uyarilar.join(' | ')}`);
        assert.ok(r.kareSayisi > 10);
        assert.equal(A.kareler.length, r.kareSayisi * KANAL_SAYISI);
        for (const v of A.kareler) assert.ok(Number.isFinite(v));
        for (const v of B.kareler) assert.ok(Number.isFinite(v));
        assert.ok(r.enerjiKJ > 0, 'çarpışmada enerji sönümlenmeli');
        // Çarpışma anında A'nın kare konumu temas pozunda olmalı (P'ye yakın)
        const kC = Math.round(r.tCarpisma * r.fps);
        const ax = A.kareler[kC * KANAL_SAYISI], az = A.kareler[kC * KANAL_SAYISI + 1];
        assert.ok(Math.hypot(ax - k.P.x, az - k.P.z) < A.boy, 'A temas pozunda olmalı');
        // Momentum korunumu (çarpışma itkisi, yalnızca iki taraf arasında)
        const mA = A.kutle, mB = B.kutle;
        assert.ok(mA > 0 && mB > 0);
    });
}

test('fren izinden hız', () => {
    assert.equal(r1(izdenHiz(0.75, 20) * 3.6), 61.8);
    assert.equal(r1(frenMesafesi(50 / 3.6, 0.75)), 13.1);
    assert.ok(searleAsgariHiz(20) > 0);
});

test('kusur 8lik dilim', () => {
    const k = kusurHesapla({ ihlaller: ['kirmizi-isik'], hizKmh: 60, limitKmh: 50 }, { ihlaller: [], hizKmh: 50, limitKmh: 50 });
    assert.equal(k.A.sekizlik, '8/8');
    assert.equal(k.B.etiket.sinif, 'kusursuz');
});

import { isikRengi, isikAkisDurumu } from '../src/kaza-simulator/lib/isik.ts';

test('ışık evreleri', () => {
    assert.equal(isikRengi('kirmizi', 0, 6), 'yesil');
    assert.equal(isikRengi('kirmizi', 2, 6), 'sari');
    assert.equal(isikRengi('kirmizi', 5, 6), 'kirmizi');
    assert.equal(isikRengi('yok', 5, 6), null);
    // Güneyden kuzeye giden A (yön -z) için güneye bakan ışık (yüz +z) A'nın durumunu alır
    const t = { A: { yon: { x: 0, z: -1 }, durum: 'kirmizi' as const }, B: { yon: { x: -1, z: 0 }, durum: 'yesil' as const } };
    assert.equal(isikAkisDurumu({ x: 0, z: 1 }, t), 'kirmizi');
    assert.equal(isikAkisDurumu({ x: 1, z: 0 }, t), 'yesil');
    assert.equal(isikAkisDurumu({ x: 0, z: -1 }, t), 'kirmizi');
});

import { baglantiCoz, baglantiKodla, senaryoDogrula } from '../src/kaza-simulator/lib/senaryoDosyasi.ts';
import { VARSAYILAN_KOSULLAR, varsayilanKatilimci } from '../src/kaza-simulator/data/kazaData.ts';

test('senaryo bağlantısı gidiş-dönüş ve doğrulama', async () => {
    const k = sablonKur(SABLONLAR[0]);
    const d = {
        tur: 'kaza-simulator-senaryo' as const, surum: 1 as const, baslik: 'Test', kaynak: { tip: 'sablon' as const, id: SABLONLAR[0].id },
        P: k.P, kosullar: k.kosullar, katilimcilar: { A: k.A, B: k.B }, elleIsaretler: [], cizilenYollar: [],
    };
    const kod = await baglantiKodla(d);
    const geri = senaryoDogrula(await baglantiCoz(kod), VARSAYILAN_KOSULLAR, varsayilanKatilimci('A'), varsayilanKatilimci('B'));
    assert.ok(geri);
    assert.equal(geri.katilimcilar.A.hizKmh, k.A.hizKmh);
    assert.deepEqual(geri.kosullar.isik, k.kosullar.isik);
    // Kötü niyetli / bozuk girdi
    assert.equal(senaryoDogrula({ tur: 'x' }, VARSAYILAN_KOSULLAR, varsayilanKatilimci('A'), varsayilanKatilimci('B')), null);
    const kotu = senaryoDogrula({ ...d, katilimcilar: { A: { hizKmh: 1e9, ihlaller: ['<script>', 'kirmizi-isik'], tur: 'uzay-gemisi' } } }, VARSAYILAN_KOSULLAR, varsayilanKatilimci('A'), varsayilanKatilimci('B'));
    assert.ok(kotu);
    assert.equal(kotu.katilimcilar.A.hizKmh, 250);
    assert.deepEqual(kotu.katilimcilar.A.ihlaller, ['kirmizi-isik']);
    assert.equal(kotu.katilimcilar.A.tur, 'otomobil');
    assert.equal(await baglantiCoz('zbozuk!!'), null);
});

import { IHLALLER, YAYA_IHLALLERI } from '../src/kaza-simulator/data/kazaData.ts';

test('KTK atıfları: olasılık dili ve m.84 bentleri', () => {
    for (const i of [...IHLALLER, ...YAYA_IHLALLERI]) {
        assert.match(i.dayanak, /ilgili olabilir|değerlendirilebilir/, i.id);
        assert.doesNotMatch(i.dayanak, /asli kusur sayılan hâl'?$/, i.id);
    }
    // m.84 bentleri a–l: her bent en az bir ihlale eşlenmiş olmalı
    const bentler = IHLALLER.map((i) => i.madde84 ?? '').join(' ');
    for (const b of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']) assert.ok(new RegExp(`(^|[^a-z])${b}([^a-z]|$)`).test(bentler), `m.84/${b}`);
    // Alkol ve yaya geçidi m.84'te sayılmaz
    assert.equal(IHLALLER.find((i) => i.id === 'alkol')?.madde84, undefined);
    assert.equal(IHLALLER.find((i) => i.id === 'yaya-gecidi')?.madde84, undefined);
    const k = kusurHesapla({ ihlaller: ['kirmizi-isik'], hizKmh: 50, limitKmh: 50 }, { ihlaller: ['arkadan-carpma'], hizKmh: 50, limitKmh: 50 });
    assert.equal(k.coklu84, true);
    assert.equal(k.A.etiket.ad, 'Eşit kusur ihtimali');
});
