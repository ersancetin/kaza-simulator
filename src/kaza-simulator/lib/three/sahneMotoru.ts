// Three.js sahne motoru: çevre, taraflar, efektler, kamera, seçim ve dışa aktarım.
// Görüntü yalnızca bir şey değiştiğinde çizilir (isteğe bağlı çizim): boşta
// GPU/CPU harcanmaz; oynatma, kamera hareketi veya kayıt sırasında sürekli çizilir.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARAC_TURLERI, TARAF_RENK } from '../../data/kazaData.ts';
import type { Aydinlatma, AracTuruId, Cevre, Hava, IsikDurumu, IsikRengi, IzSerisi, KameraModu, KatilimciTipi, SimSonuc, TarafId, Vec2 } from '../../types/kazaTypes.ts';
import { KANAL_SAYISI } from '../../types/kazaTypes.ts';
import { hudCiz, logoGorseli, logoYukle, type HudMetin } from '../hud.ts';
import { KISA_UYARI, MARKA } from '../../data/kazaData.ts';
import { videoDestekleniyor, videoTuru, type VideoSecenek, type VideoSonuc } from '../video.ts';
import { kareOku } from '../simulate.ts';
import { Rota, uzaklik } from '../geometry.ts';
import { isaretleriKur, serbestBirak, seritGeometri, statikCevreKur } from './cevreKur.ts';
import { dokular, etiketDokusu } from './dokular.ts';
import { aracOlustur, modelGeceModu, yayaAnimasyonu, yayaOlustur, type YayaModeli } from './modeller.ts';
import { isikAkisDurumu, isikRengi, type IsikTarafBilgisi } from '../isik.ts';

export interface TarafGorunum {
    tip: KatilimciTipi;
    tur: AracTuruId;
    plaka: string;
}

interface TarafNesnesi {
    kok: THREE.Group;
    govde: THREE.Object3D;
    yaya: YayaModeli | null;
    etiket: THREE.Sprite;
    iki: boolean;
    tekerler: THREE.Object3D[];
    stop: THREE.MeshStandardMaterial | null;
}

interface IzNesnesi {
    mesh: THREE.Mesh;
    zamanlar: number[];
}

const KARE = new Float32Array(KANAL_SAYISI);
const YUKARI = new THREE.Vector3(0, 1, 0);

export class SahneMotoru {
    private readonly kap: HTMLElement;
    private readonly cizici: THREE.WebGLRenderer;
    private readonly sahne = new THREE.Scene();
    private readonly kamera: THREE.PerspectiveCamera;
    private readonly kontrol: OrbitControls;
    private readonly gunes: THREE.DirectionalLight;
    private readonly hemi: THREE.HemisphereLight;
    private readonly zeminMat: THREE.MeshStandardMaterial;
    private readonly gokDokulari = new Map<string, THREE.CanvasTexture>();
    private aydinlatma: Aydinlatma = 'gunduz';
    private hava: Hava = 'acik';
    private yagis: THREE.Points | THREE.LineSegments | null = null;
    private yagisHizi = 0;
    private farlar: THREE.SpotLight[] = [];
    private isikBilgi: Record<TarafId, IsikTarafBilgisi> = { A: { yon: null, durum: 'yok' }, B: { yon: null, durum: 'yok' } };
    private isikDirekleri: Array<{ lambalar: THREE.MeshBasicMaterial[]; durum: IsikDurumu }> = [];
    private readonly gozlemci: ResizeObserver;
    private readonly isin = new THREE.Raycaster();
    private readonly zeminDuzlem = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    private statik: THREE.Group | null = null;
    private isaretGrup: THREE.Group | null = null;
    private readonly dinamik = new THREE.Group();
    private readonly onizleme = new THREE.Group();
    private readonly isaretci: THREE.Group;
    private readonly imlec: THREE.Mesh;

    private cevre: Cevre | null = null;
    private P: Vec2 = { x: 0, z: 0 };
    private sonuc: SimSonuc | null = null;
    private taraflar: Partial<Record<TarafId, TarafNesnesi>> = {};
    private izler: IzNesnesi[] = [];
    private enkaz: THREE.InstancedMesh | null = null;
    private enkazVeri: Float32Array | null = null;
    private parlama: THREE.Sprite | null = null;
    private tozlar: THREE.Sprite[] = [];
    private guzergahlar: THREE.Group | null = null;
    private guzergahGorunur = true;

    private t = 0;
    private oynuyor = false;
    oynatmaHizi = 0.5;
    private kameraModu: KameraModu = 'serbest';
    /** Serbest kameranın kaza noktasına göre yatay yönü (yol koridoru boyunca) */
    private odakYonu: Vec2 = { x: 0.64, z: 0.77 };
    private kirli = true;
    private sonAn = performance.now();
    private sonBildirim = -1;
    private kayit: { bitir: () => void; kare: (dt: number) => void } | null = null;

    private secimCb: ((p: Vec2) => void) | null = null;
    private basilan: [number, number] | null = null;
    private hud: HudMetin = {
        baslik: 'Kaza Simülatörü',
        konum: '',
        taraflar: { A: { ad: 'A', renk: TARAF_RENK.A }, B: { ad: 'B', renk: TARAF_RENK.B } },
    };

    onZaman: ((t: number, sure: number) => void) | null = null;
    onOynatma: ((oynuyor: boolean) => void) | null = null;

    constructor(kap: HTMLElement) {
        this.kap = kap;
        this.cizici = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.cizici.outputColorSpace = THREE.SRGBColorSpace;
        this.cizici.toneMapping = THREE.ACESFilmicToneMapping;
        this.cizici.toneMappingExposure = 1.05;
        this.cizici.shadowMap.enabled = true;
        // Shader hatalarının eşzamanlı denetimi kapalı: derleme paralel yürür, sahne açılışında takılma olmaz
        this.cizici.debug.checkShaderErrors = false;
        this.cizici.shadowMap.type = THREE.PCFShadowMap;
        this.cizici.domElement.style.display = 'block';
        this.cizici.domElement.style.touchAction = 'none';
        kap.appendChild(this.cizici.domElement);

        const d = dokular();
        this.sahne.background = d.gokyuzu;
        this.sahne.fog = new THREE.Fog(0xdce7ef, 380, 1500);
        const pmrem = new THREE.PMREMGenerator(this.cizici);
        this.sahne.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.sahne.environmentIntensity = 0.55;
        pmrem.dispose();

        this.kamera = new THREE.PerspectiveCamera(50, 1, 0.3, 4000);
        this.kamera.position.set(40, 34, 46);
        this.kontrol = new OrbitControls(this.kamera, this.cizici.domElement);
        this.kontrol.enableDamping = true;
        this.kontrol.dampingFactor = 0.09;
        this.kontrol.maxPolarAngle = Math.PI / 2.08;
        this.kontrol.minDistance = 3;
        this.kontrol.maxDistance = 900;
        this.kontrol.addEventListener('change', this.kirlet);

        this.hemi = new THREE.HemisphereLight(0xe3eeff, 0x6f7d5c, 0.75);
        this.sahne.add(this.hemi);
        this.gunes = new THREE.DirectionalLight(0xfff1dc, 2.4);
        this.gunes.position.set(60, 110, 40);
        this.gunes.castShadow = true;
        this.gunes.shadow.mapSize.set(2048, 2048);
        this.gunes.shadow.bias = -0.0004;
        this.gunes.shadow.normalBias = 0.03;
        const sc = 75;
        Object.assign(this.gunes.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 10, far: 320 });
        this.sahne.add(this.gunes, this.gunes.target);

        const cim = d.cim.clone();
        cim.repeat.set(700, 700);
        cim.needsUpdate = true;
        this.zeminMat = new THREE.MeshStandardMaterial({ color: 0xc9d2b8, map: cim, roughness: 1 });
        const zemin = new THREE.Mesh(new THREE.PlaneGeometry(5600, 5600).rotateX(-Math.PI / 2), this.zeminMat);
        zemin.receiveShadow = true;
        this.sahne.add(zemin);
        this.sahne.add(this.dinamik, this.onizleme);
        this.bulutlarKur();

        // Kaza noktası işaretçisi
        this.isaretci = new THREE.Group();
        const halka = new THREE.Mesh(
            new THREE.RingGeometry(1.1, 1.55, 48).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xc81d25, transparent: true, opacity: 0.9, depthWrite: false }),
        );
        halka.position.y = 0.06;
        halka.renderOrder = 3;
        const nokta = new THREE.Mesh(
            new THREE.CircleGeometry(0.28, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xc81d25, depthWrite: false }),
        );
        nokta.position.y = 0.065;
        nokta.renderOrder = 3;
        const igne = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 16).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0xc81d25, emissive: 0x5a0a0e, roughness: 0.4 }));
        igne.position.y = 3.2;
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), igne.material);
        top.position.y = 3.85;
        this.isaretci.add(halka, nokta, igne, top);
        this.sahne.add(this.isaretci);

        this.imlec = new THREE.Mesh(
            new THREE.RingGeometry(0.6, 0.9, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x2d3039, transparent: true, opacity: 0.75, depthWrite: false }),
        );
        this.imlec.position.y = 0.08;
        this.imlec.visible = false;
        this.imlec.renderOrder = 4;
        this.sahne.add(this.imlec);

        const el = this.cizici.domElement;
        el.addEventListener('pointerdown', this.basildi);
        el.addEventListener('pointerup', this.birakildi);
        el.addEventListener('pointermove', this.hareket);
        el.addEventListener('pointerleave', this.ayrildi);

        this.gozlemci = new ResizeObserver(() => this.boyutlandir());
        this.gozlemci.observe(kap);
        this.boyutlandir();
        this.cizici.setAnimationLoop(this.dongu);
    }

    /** Uzak gökyüzünde yumuşak bulutlar (sis etkilemez) */
    private bulutlarKur(): void {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 128;
        const x = c.getContext('2d');
        if (!x) return;
        for (const [cx, cy, r] of [[70, 80, 46], [120, 62, 58], [175, 78, 44], [140, 92, 40], [95, 95, 36]] as const) {
            const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, 'rgba(255,255,255,0.95)');
            g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(0, 0, 256, 128);
        }
        const doku = new THREE.CanvasTexture(c);
        doku.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.SpriteMaterial({ map: doku, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.3;
            const r = 1100 + (i % 4) * 160;
            const sp = new THREE.Sprite(mat);
            sp.position.set(Math.cos(a) * r, 230 + (i % 5) * 45, Math.sin(a) * r);
            const o = 260 + (i % 3) * 90;
            sp.scale.set(o, o / 2, 1);
            sp.renderOrder = -1;
            this.sahne.add(sp);
        }
    }

    // ================= Genel =================
    private kirlet = (): void => {
        this.kirli = true;
    };

    private boyutlandir(): void {
        if (this.kayit) return;
        const w = this.kap.clientWidth || 1;
        const h = this.kap.clientHeight || 1;
        this.cizici.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        this.cizici.setSize(w, h);
        this.kamera.aspect = w / h;
        this.kamera.updateProjectionMatrix();
        this.kirli = true;
    }

    hudAyarla(h: HudMetin): void {
        this.hud = h;
    }

    yokEt(): void {
        this.cizici.setAnimationLoop(null);
        this.gozlemci.disconnect();
        const el = this.cizici.domElement;
        el.removeEventListener('pointerdown', this.basildi);
        el.removeEventListener('pointerup', this.birakildi);
        el.removeEventListener('pointermove', this.hareket);
        el.removeEventListener('pointerleave', this.ayrildi);
        this.kontrol.removeEventListener('change', this.kirlet);
        this.kontrol.dispose();
        serbestBirak(this.sahne);
        this.sahne.environment?.dispose();
        this.cizici.dispose();
        el.remove();
    }

    // ================= Çevre =================
    cevreAyarla(cevre: Cevre, merkez: Vec2): void {
        this.cevre = cevre;
        if (this.statik) {
            this.sahne.remove(this.statik);
            serbestBirak(this.statik);
        }
        this.statik = statikCevreKur(cevre, merkez);
        this.sahne.add(this.statik);
        this.isaretleriYenile();
        this.ortamUygula(this.aydinlatma, this.hava);
        this.kirli = true;
    }

    isaretleriYenile(cevre?: Cevre): void {
        if (cevre) this.cevre = cevre;
        if (!this.cevre) return;
        if (this.isaretGrup) {
            this.sahne.remove(this.isaretGrup);
            serbestBirak(this.isaretGrup);
        }
        this.isaretGrup = isaretleriKur(this.cevre, this.P);
        this.sahne.add(this.isaretGrup);
        this.isikDirekleriTara();
        this.kirli = true;
    }

    // ================= Trafik ışıkları =================
    /** Taraf başına çarpışma anı ışık durumu ve (hesaplama öncesi) geliş yönleri */
    isikAyarla(bilgi: Record<TarafId, IsikTarafBilgisi>): void {
        this.isikBilgi = bilgi;
        this.isikDirekleriTara();
    }

    private isikDirekleriTara(): void {
        this.isikDirekleri = [];
        if (!this.isaretGrup) return;
        const s = this.sonuc;
        // Hesaplama varsa yönler çarpışma anı karelerinden alınır
        const bilgi: Record<TarafId, IsikTarafBilgisi> = { ...this.isikBilgi };
        if (s) {
            const k = Math.round(s.tCarpisma * s.fps) * KANAL_SAYISI + 2;
            for (const id of ['A', 'B'] as const) {
                const psi = s.taraflar[id].kareler[k];
                bilgi[id] = { durum: this.isikBilgi[id].durum, yon: { x: Math.sin(psi), z: Math.cos(psi) } };
            }
        }
        for (const o of this.isaretGrup.children) {
            const lambalar = o.userData.lambalar as THREE.MeshBasicMaterial[] | undefined;
            if (!lambalar) continue;
            if (uzaklik({ x: o.position.x, z: o.position.z }, this.P) > 60) {
                this.isikDirekleri.push({ lambalar, durum: 'yok' });
                continue;
            }
            const yuz = { x: Math.sin(o.rotation.y), z: Math.cos(o.rotation.y) };
            this.isikDirekleri.push({ lambalar, durum: isikAkisDurumu(yuz, bilgi) });
        }
        this.isiklariBoya();
    }

    private isiklariBoya(): void {
        const s = this.sonuc;
        for (const d of this.isikDirekleri) {
            // Hesaplama yoksa çarpışma anındaki renk gösterilir
            const renk = s ? isikRengi(d.durum, this.t, s.tCarpisma) : isikRengi(d.durum, 1, 1);
            const sira: Array<IsikRengi> = ['kirmizi', 'sari', 'yesil'];
            d.lambalar.forEach((m, i) => {
                const parlaklik = renk === null ? 0.45 : renk === sira[i] ? 1.6 : 0.12;
                m.color.set(m.userData.renk as number).multiplyScalar(parlaklik);
            });
        }
        this.kirli = true;
    }

    // ================= Aydınlatma ve hava =================
    private gokDokusu(anahtar: string, renkler: [string, string, string]): THREE.CanvasTexture {
        const var_ = this.gokDokulari.get(anahtar);
        if (var_) return var_;
        const c = document.createElement('canvas');
        c.width = 4;
        c.height = 512;
        const x = c.getContext('2d');
        if (x) {
            const g = x.createLinearGradient(0, 0, 0, 512);
            g.addColorStop(0, renkler[0]);
            g.addColorStop(0.55, renkler[1]);
            g.addColorStop(1, renkler[2]);
            x.fillStyle = g;
            x.fillRect(0, 0, 4, 512);
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        this.gokDokulari.set(anahtar, t);
        return t;
    }

    /** Gündüz/akşam/gece ve açık/yağmur/sis/kar görünümünü uygular */
    ortamAyarla(aydinlatma: Aydinlatma, hava: Hava): void {
        this.aydinlatma = aydinlatma;
        this.hava = hava;
        this.ortamUygula(aydinlatma, hava);
    }

    private ortamUygula(aydinlatma: Aydinlatma, hava: Hava): void {
        const gece = aydinlatma === 'gece';
        const aksam = aydinlatma === 'aksam';
        const kapali = hava !== 'acik';
        // Gökyüzü
        let sisRengi: number;
        if (gece) {
            this.sahne.background = this.gokDokusu('gece', ['#050a18', '#111d38', '#26334f']);
            sisRengi = 0x141d33;
        } else if (aksam) {
            this.sahne.background = kapali ? this.gokDokusu('aksam-kapali', ['#4a4f63', '#9a8c8a', '#c7b8ad']) : this.gokDokusu('aksam', ['#33457a', '#e48f68', '#f7d09d']);
            sisRengi = kapali ? 0xa59a98 : 0xe9b993;
        } else {
            this.sahne.background = kapali ? this.gokDokusu('kapali', ['#8a95a1', '#b7c0c8', '#d6dbe0']) : dokular().gokyuzu;
            sisRengi = kapali ? 0xc9d0d6 : 0xdce7ef;
        }
        if (hava === 'sis') this.sahne.background = new THREE.Color(sisRengi);
        const [yakin, uzak] = hava === 'sis' ? [8, 95] : hava === 'yagmur' ? [50, 420] : hava === 'kar' ? [40, 320] : gece ? [120, 900] : [380, 1500];
        this.sahne.fog = new THREE.Fog(sisRengi, yakin, uzak);

        // Işıklar
        const zayiflama = kapali ? 0.45 : 1;
        if (gece) {
            this.hemi.color.set(0x7d8fc2);
            this.hemi.groundColor.set(0x1a1f2a);
            this.hemi.intensity = 0.22;
            this.gunes.color.set(0xa9bbff);
            this.gunes.intensity = 0.25;
            this.sahne.environmentIntensity = 0.1;
        } else if (aksam) {
            this.hemi.color.set(0xffd9b8);
            this.hemi.groundColor.set(0x5a4a3c);
            this.hemi.intensity = 0.5;
            this.gunes.color.set(0xffb27a);
            this.gunes.intensity = 1.5 * zayiflama;
            this.sahne.environmentIntensity = 0.35;
        } else {
            this.hemi.color.set(0xe3eeff);
            this.hemi.groundColor.set(0x6f7d5c);
            this.hemi.intensity = kapali ? 0.95 : 0.75;
            this.gunes.color.set(0xfff1dc);
            this.gunes.intensity = 2.4 * zayiflama;
            this.sahne.environmentIntensity = 0.55;
        }
        const yukseklik = aksam ? 28 : 110;
        this.gunes.position.set(this.P.x + 90, yukseklik, this.P.z + 30);
        this.cizici.toneMappingExposure = gece ? 1.25 : 1.05;

        // Zemin ve asfalt
        this.zeminMat.color.set(hava === 'kar' ? 0xf4f6f8 : 0xc9d2b8);
        this.statik?.traverse((o) => {
            const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (!m || Array.isArray(m)) return;
            if (m.name === 'asfalt') {
                m.roughness = hava === 'yagmur' ? 0.32 : 0.95;
                m.metalness = hava === 'yagmur' ? 0.15 : 0;
                m.color.set(hava === 'yagmur' ? 0xb4b8bd : hava === 'kar' ? 0xdfe3e7 : 0xffffff);
            } else if (m.name === 'lamba-basi') {
                m.emissiveIntensity = gece ? 3 : aksam ? 1.2 : 0.35;
            }
            if (o.name === 'isik-havuzu') o.visible = gece || aksam;
        });
        modelGeceModu(gece || aksam);
        for (const f of this.farlar) {
            f.visible = gece || aksam || hava === 'sis';
            f.intensity = gece ? 900 : 350;
        }
        this.yagisKur(hava);
        this.kirli = true;
    }

    private yagisKur(hava: Hava): void {
        if (this.yagis) {
            this.sahne.remove(this.yagis);
            this.yagis.geometry.dispose();
            (this.yagis.material as THREE.Material).dispose();
            this.yagis = null;
        }
        if (hava !== 'yagmur' && hava !== 'kar') return;
        const kar = hava === 'kar';
        const n = kar ? 2500 : 3500;
        const R = 60;
        const H = 40;
        const p = new Float32Array(n * (kar ? 3 : 6));
        for (let i = 0; i < n; i++) {
            const x = (Math.random() - 0.5) * 2 * R;
            const y = Math.random() * H;
            const z = (Math.random() - 0.5) * 2 * R;
            if (kar) p.set([x, y, z], i * 3);
            else p.set([x, y, z, x + 0.05, y + 0.7, z + 0.02], i * 6);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        this.yagis = kar
            ? new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false }))
            : new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc4ccd6, transparent: true, opacity: 0.45, depthWrite: false }));
        this.yagis.frustumCulled = false;
        this.yagis.userData = { R, H };
        this.yagisHizi = kar ? 1.4 : 14;
        this.sahne.add(this.yagis);
    }

    /** Yağış parçacıklarını kameranın baktığı bölgede, gerçek zamanla düşürür */
    private yagisGuncelle(dt: number): void {
        const y = this.yagis;
        if (!y) return;
        const { R, H } = y.userData as { R: number; H: number };
        const a = y.geometry.attributes.position as THREE.BufferAttribute;
        const dizi = a.array as Float32Array;
        const adim = y instanceof THREE.Points ? 3 : 6;
        const dus = this.yagisHizi * dt;
        const zaman = performance.now() / 1000;
        for (let i = 0; i < dizi.length; i += adim) {
            dizi[i + 1] -= dus;
            if (adim === 6) dizi[i + 4] -= dus;
            else dizi[i] += Math.sin(zaman + i) * 0.01;
            if (dizi[i + 1] < 0) {
                dizi[i + 1] += H;
                if (adim === 6) dizi[i + 4] += H;
            }
        }
        a.needsUpdate = true;
        y.position.set(this.kontrol.target.x, 0, this.kontrol.target.z);
        void R;
        this.kirli = true;
    }

    kazaNoktasiAyarla(P: Vec2, kameraOdakla = true): void {
        this.P = { ...P };
        this.isaretci.position.set(P.x, 0, P.z);
        this.gunes.position.set(P.x + 90, this.aydinlatma === 'aksam' ? 28 : 110, P.z + 30);
        this.gunes.target.position.set(P.x, 0, P.z);
        if (kameraOdakla) {
            const fark = new THREE.Vector3().subVectors(this.kamera.position, this.kontrol.target);
            this.kontrol.target.set(P.x, 0, P.z);
            this.kamera.position.copy(this.kontrol.target).add(fark);
        }
        this.kirli = true;
    }

    /** Hesaplamadan önce geliş yönlerini renkli oklarla gösterir */
    yaklasimOnizle(rotalar: Partial<Record<TarafId, Vec2[] | null>>): void {
        this.onizlemeTemizle('yaklasim');
        const grup = new THREE.Group();
        grup.name = 'yaklasim';
        for (const id of ['A', 'B'] as const) {
            const pts = rotalar[id];
            if (!pts || pts.length < 2) continue;
            // Son ~70 m, 1,5 m aralıkla örneklenir
            const rota = new Rota(pts);
            const kisa: Vec2[] = [];
            for (let sMesafe = Math.max(0, rota.uzunluk - 70); sMesafe <= rota.uzunluk; sMesafe += 1.5) kisa.push(rota.konum(sMesafe));
            kisa.push(rota.konum(rota.uzunluk));
            if (kisa.length < 3) continue;
            const mat = new THREE.MeshBasicMaterial({ color: TARAF_RENK[id], transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16 });
            const m = new THREE.Mesh(seritGeometri(kisa.slice(0, -2), 0.9, 0.07, true), mat);
            m.renderOrder = 2;
            grup.add(m);
            const son = kisa[kisa.length - 3];
            const uc = kisa[kisa.length - 1];
            const ok = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.4, 3).rotateX(Math.PI / 2), mat);
            ok.scale.y = 0.05;
            ok.position.set(son.x, 0.08, son.z);
            ok.rotation.y = Math.atan2(uc.x - son.x, uc.z - son.z);
            grup.add(ok);
        }
        this.onizleme.add(grup);
        this.kirli = true;
    }

    cizimOnizle(pts: Vec2[], genislik: number): void {
        this.onizlemeTemizle('cizim');
        const g = new THREE.Group();
        g.name = 'cizim';
        const mat = new THREE.MeshBasicMaterial({ color: 0xc81d25, transparent: true, opacity: 0.45, depthWrite: false });
        if (pts.length >= 2) g.add(new THREE.Mesh(seritGeometri(pts, genislik, 0.09, true), mat));
        for (const p of pts) {
            const n = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshBasicMaterial({ color: 0xc81d25 }));
            n.position.set(p.x, 0.45, p.z);
            g.add(n);
        }
        this.onizleme.add(g);
        this.kirli = true;
    }

    onizlemeTemizle(ad?: string): void {
        for (const c of [...this.onizleme.children]) {
            if (ad && c.name !== ad) continue;
            this.onizleme.remove(c);
            serbestBirak(c);
        }
        this.kirli = true;
    }

    // ================= Sahne seçimi =================
    secimBaslat(cb: (p: Vec2) => void): void {
        this.secimCb = cb;
        this.cizici.domElement.style.cursor = 'crosshair';
        this.kontrol.enableRotate = false;
    }

    secimBitir(): void {
        this.secimCb = null;
        this.cizici.domElement.style.cursor = '';
        this.kontrol.enableRotate = this.kameraModu !== 'ustten';
        this.imlec.visible = false;
        this.kirli = true;
    }

    private zeminNoktasi(e: PointerEvent): Vec2 | null {
        const k = this.cizici.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - k.left) / k.width) * 2 - 1, -((e.clientY - k.top) / k.height) * 2 + 1);
        this.isin.setFromCamera(ndc, this.kamera);
        const n = new THREE.Vector3();
        return this.isin.ray.intersectPlane(this.zeminDuzlem, n) ? { x: n.x, z: n.z } : null;
    }

    private basildi = (e: PointerEvent): void => {
        this.basilan = e.button === 0 || e.pointerType === 'touch' ? [e.clientX, e.clientY] : null;
    };

    private birakildi = (e: PointerEvent): void => {
        if (!this.secimCb || !this.basilan) return;
        if (Math.hypot(e.clientX - this.basilan[0], e.clientY - this.basilan[1]) > 12) return;
        const p = this.zeminNoktasi(e);
        if (p) this.secimCb(p);
    };

    private hareket = (e: PointerEvent): void => {
        if (!this.secimCb || e.pointerType === 'touch') return;
        const p = this.zeminNoktasi(e);
        if (!p) return;
        this.imlec.visible = true;
        this.imlec.position.set(p.x, 0.08, p.z);
        this.kirli = true;
    };

    private ayrildi = (): void => {
        if (this.imlec.visible) {
            this.imlec.visible = false;
            this.kirli = true;
        }
    };

    // ================= Simülasyon =================
    simulasyonAyarla(sonuc: SimSonuc | null, gorunum: Record<TarafId, TarafGorunum> | null): void {
        serbestBirak(this.dinamik);
        this.dinamik.clear();
        this.taraflar = {};
        this.izler = [];
        this.enkaz = null;
        this.parlama = null;
        this.guzergahlar = null;
        this.sonuc = sonuc;
        this.tozlar = [];
        this.oynuyor = false;
        if (!sonuc || !gorunum) {
            this.isaretci.visible = true;
            this.kirli = true;
            return;
        }
        this.onizlemeTemizle('yaklasim');

        for (const id of ['A', 'B'] as const) {
            const g = gorunum[id];
            const renk = TARAF_RENK[id];
            const kok = new THREE.Group();
            let govde: THREE.Object3D;
            let yaya: YayaModeli | null = null;
            if (g.tip === 'yaya') {
                yaya = yayaOlustur(renk);
                govde = yaya.kok;
            } else {
                govde = aracOlustur(renk, g.tur, g.plaka);
            }
            kok.add(govde);
            const etiketYazi = id + (g.plaka && g.tip === 'arac' ? ` · ${g.plaka.toLocaleUpperCase('tr-TR')}` : '');
            const { doku, oran } = etiketDokusu(etiketYazi, renk);
            const etiket = new THREE.Sprite(new THREE.SpriteMaterial({ map: doku, depthTest: false, transparent: true }));
            const yuk = g.tip === 'yaya' ? 1.8 : ARAC_TURLERI[g.tur].yukseklik;
            etiket.scale.set(0.95 * oran, 0.95, 1);
            etiket.position.y = yuk + 1.25;
            etiket.renderOrder = 10;
            kok.add(etiket);
            this.dinamik.add(kok);
            this.taraflar[id] = {
                kok, govde, yaya, etiket,
                iki: g.tip === 'arac' && ARAC_TURLERI[g.tur].profil === 'iki-teker',
                tekerler: (govde.userData.tekerler as THREE.Object3D[] | undefined) ?? [],
                stop: (govde.userData.stop as THREE.MeshStandardMaterial | undefined) ?? null,
            };
        }

        // Lastik izleri: zaman sırasıyla kademeli görünür
        for (const iz of sonuc.izler) this.izEkle(iz);

        // Güzergâh çizgileri
        this.guzergahlar = new THREE.Group();
        for (const id of ['A', 'B'] as const) {
            const k = sonuc.taraflar[id].kareler;
            const pts: Vec2[] = [];
            for (let i = 0; i < sonuc.kareSayisi; i += 3) pts.push({ x: k[i * KANAL_SAYISI], z: k[i * KANAL_SAYISI + 1] });
            if (pts.length < 2) continue;
            const m = new THREE.Mesh(
                seritGeometri(pts, 0.16, 0.075),
                new THREE.MeshBasicMaterial({ color: TARAF_RENK[id], transparent: true, opacity: 0.7, depthWrite: false }),
            );
            m.renderOrder = 2;
            this.guzergahlar.add(m);
        }
        this.guzergahlar.visible = this.guzergahGorunur;
        this.dinamik.add(this.guzergahlar);

        this.enkazKur(sonuc);

        // Farlar: akşam/gece ve siste yol üzerine ışık konisi
        this.farlar = [];
        for (const id of ['A', 'B'] as const) {
            const g = gorunum[id];
            const n = this.taraflar[id];
            if (!n || g.tip === 'yaya') continue;
            const T = ARAC_TURLERI[g.tur];
            const far = new THREE.SpotLight(0xfff1d6, 900, 70, 0.55, 0.65, 1.6);
            far.position.set(0, 0.8, T.boy / 2);
            far.target.position.set(0, 0, T.boy / 2 + 18);
            n.kok.add(far, far.target);
            this.farlar.push(far);
        }
        this.isikDirekleriTara();
        this.ortamUygula(this.aydinlatma, this.hava);
        const parlamaDoku = this.parlamaDokusu();
        this.parlama = new THREE.Sprite(new THREE.SpriteMaterial({ map: parlamaDoku, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.parlama.position.set(sonuc.P.x, 1.0, sonuc.P.z);
        this.parlama.visible = false;
        this.dinamik.add(this.parlama);

        // Toz/duman bulutu: çarpışma noktasından genişleyip sönen yumuşak lekeler
        const tozDoku = this.tozDokusu();
        this.tozlar = [];
        for (let i = 0; i < 9; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tozDoku, transparent: true, depthWrite: false, color: 0xd9d4c8 }));
            const a = (i / 9) * Math.PI * 2 + 0.4;
            sp.userData = { dx: Math.cos(a), dz: Math.sin(a), v: 1.2 + (i % 3) * 0.6, y: 0.5 + (i % 2) * 0.5 };
            sp.visible = false;
            this.tozlar.push(sp);
            this.dinamik.add(sp);
        }

        this.isaretci.visible = true;
        this.zamanAyarla(0);
    }

    guzergahGoster(gorunur: boolean): void {
        this.guzergahGorunur = gorunur;
        if (this.guzergahlar) this.guzergahlar.visible = gorunur;
        this.kirli = true;
    }

    private izEkle(iz: IzSerisi): void {
        const fren = iz.tur === 'fren';
        const mat = new THREE.MeshBasicMaterial({
            color: fren ? 0x0e0f11 : 0x23262b, transparent: true, opacity: fren ? 0.8 : 0.55, depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -14,
        });
        const mesh = new THREE.Mesh(seritGeometri(iz.noktalar, fren ? 0.22 : 0.2, 0.05), mat);
        mesh.renderOrder = 1;
        mesh.geometry.setDrawRange(0, 0);
        this.dinamik.add(mesh);
        this.izler.push({ mesh, zamanlar: iz.zamanlar });
    }

    private tozDokusu(): THREE.CanvasTexture {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const x = c.getContext('2d');
        if (x) {
            const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255,255,255,0.75)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g;
            x.fillRect(0, 0, 128, 128);
        }
        const t = new THREE.CanvasTexture(c);
        t.userData.tekil = true;
        return t;
    }

    private parlamaDokusu(): THREE.CanvasTexture {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const x = c.getContext('2d');
        if (x) {
            const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, 'rgba(255,255,240,1)');
            g.addColorStop(0.25, 'rgba(255,214,120,0.9)');
            g.addColorStop(0.6, 'rgba(255,120,40,0.35)');
            g.addColorStop(1, 'rgba(255,80,20,0)');
            x.fillStyle = g;
            x.fillRect(0, 0, 128, 128);
        }
        const t = new THREE.CanvasTexture(c);
        t.userData.tekil = true;
        return t;
    }

    /** Çarpışmada saçılan cam/plastik parçaları: kapalı formda, sarılabilir */
    private enkazKur(s: SimSonuc): void {
        const n = s.tip === 'yaya' ? 14 : 70;
        const geo = new THREE.BoxGeometry(0.09, 0.025, 0.07);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 });
        const enkaz = new THREE.InstancedMesh(geo, mat, n);
        enkaz.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const veri = new Float32Array(n * 6);
        const A = s.taraflar.A;
        const B = s.taraflar.B;
        // Ortak ağırlık merkezi hızı yönünde saçılma
        const kA = Math.round(s.tCarpisma * s.fps) * KANAL_SAYISI;
        const yonA = A.kareler[kA + 2];
        const yonB = B.kareler[kA + 2];
        const vmx = (A.kutle * A.vi * Math.sin(yonA) + B.kutle * B.vi * Math.sin(yonB)) / (A.kutle + B.kutle);
        const vmz = (A.kutle * A.vi * Math.cos(yonA) + B.kutle * B.vi * Math.cos(yonB)) / (A.kutle + B.kutle);
        const renkler = [new THREE.Color(0xdbe9f2), new THREE.Color(0xc9dbe6), new THREE.Color(0x1d1f22), new THREE.Color(TARAF_RENK.A), new THREE.Color(TARAF_RENK.B)];
        let tohum = 12345;
        const r = (): number => {
            tohum = (tohum * 1664525 + 1013904223) >>> 0;
            return tohum / 4294967296;
        };
        for (let i = 0; i < n; i++) {
            const a = r() * Math.PI * 2;
            const v = 1.5 + r() * 5.5;
            veri[i * 6] = vmx * (0.6 + r() * 0.5) + Math.cos(a) * v;
            veri[i * 6 + 1] = vmz * (0.6 + r() * 0.5) + Math.sin(a) * v;
            veri[i * 6 + 2] = 1 + r() * 3;
            veri[i * 6 + 3] = 0.4 + r() * 0.8;
            veri[i * 6 + 4] = r() * 10;
            veri[i * 6 + 5] = 0.6 + r() * 1.2;
            enkaz.setColorAt(i, renkler[Math.floor(r() * renkler.length)]);
        }
        enkaz.visible = false;
        this.enkaz = enkaz;
        this.enkazVeri = veri;
        this.dinamik.add(enkaz);
    }

    private enkazGuncelle(tau: number): void {
        if (!this.enkaz || !this.enkazVeri || !this.sonuc) return;
        if (tau < 0) {
            this.enkaz.visible = false;
            return;
        }
        this.enkaz.visible = true;
        const v = this.enkazVeri;
        const P = this.sonuc.P;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const olcek = new THREE.Vector3();
        const g = 9.81;
        const yavas = 7;
        for (let i = 0; i < this.enkaz.count; i++) {
            const vx = v[i * 6];
            const vz = v[i * 6 + 1];
            const vy = v[i * 6 + 2];
            const y0 = v[i * 6 + 3];
            const ucus = (vy + Math.sqrt(vy * vy + 2 * g * y0)) / g;
            let x: number;
            let z: number;
            let y: number;
            const hiz = Math.hypot(vx, vz) * 0.5;
            if (tau < ucus) {
                x = vx * tau;
                z = vz * tau;
                y = y0 + vy * tau - 0.5 * g * tau * tau;
            } else {
                const ts = Math.min(tau - ucus, hiz / yavas);
                const kayma = hiz * ts - 0.5 * yavas * ts * ts;
                const hl = Math.hypot(vx, vz) || 1;
                x = vx * ucus + (vx / hl) * kayma;
                z = vz * ucus + (vz / hl) * kayma;
                y = 0.03;
            }
            const don = Math.min(tau, ucus) * v[i * 6 + 4];
            e.set(don, don * 0.7, 0);
            q.setFromEuler(e);
            olcek.setScalar(v[i * 6 + 5]);
            m.compose(new THREE.Vector3(P.x + x, Math.max(0.03, y), P.z + z), q, olcek);
            this.enkaz.setMatrixAt(i, m);
        }
        this.enkaz.instanceMatrix.needsUpdate = true;
    }

    // ================= Zaman =================
    get sure(): number {
        return this.sonuc ? this.sonuc.sure : 0;
    }

    get zaman(): number {
        return this.t;
    }

    zamanAyarla(t: number): void {
        const s = this.sonuc;
        if (!s) return;
        this.t = Math.max(0, Math.min(s.sure, t));
        for (const id of ['A', 'B'] as const) {
            const n = this.taraflar[id];
            if (!n) continue;
            kareOku(s, id, this.t, KARE);
            n.kok.position.set(KARE[0], KARE[3], KARE[1]);
            n.govde.rotation.set(0, 0, 0);
            n.govde.position.set(0, 0, 0);
            const psi = KARE[2];
            const devrilme = KARE[4];
            if (n.yaya) {
                n.kok.rotation.set(0, 0, 0);
                if (devrilme > 0.001) {
                    // Yaya fırlatıldığı yöne doğru devrilir
                    const son = s.taraflar[id].sonKonum;
                    const yon = new THREE.Vector3(son.x - s.P.x, 0, son.z - s.P.z);
                    if (yon.lengthSq() < 1e-4) yon.set(Math.sin(psi), 0, Math.cos(psi));
                    yon.normalize();
                    const eksen = new THREE.Vector3().crossVectors(YUKARI, yon).normalize();
                    const qd = new THREE.Quaternion().setFromAxisAngle(eksen, devrilme);
                    const qy = new THREE.Quaternion().setFromAxisAngle(YUKARI, psi);
                    n.govde.quaternion.copy(qd.multiply(qy));
                    n.govde.position.y = Math.sin(devrilme) * 0.12;
                } else {
                    n.govde.rotation.y = psi;
                }
                yayaAnimasyonu(n.yaya, KARE[5], devrilme < 0.01 && KARE[6] > 0.05);
            } else {
                n.kok.rotation.set(0, psi, 0);
                // Tekerler katedilen yola göre döner; frende ve çarpışma sonrası stoplar parlar
                for (const t of n.tekerler) t.rotation.x = KARE[5] / (t.userData.tekerR as number);
                if (n.stop) {
                    const ts = s.taraflar[id];
                    const frende = (ts.izEtkin > 0 && this.t >= ts.tFrenBaslangic) || this.t > s.tCarpisma + 1;
                    n.stop.emissiveIntensity = frende ? 3.2 : 0.6;
                }
                if (n.iki && devrilme > 0) {
                    n.govde.rotation.z = devrilme;
                    n.govde.position.y = Math.sin(devrilme) * 0.25;
                }
            }
            n.etiket.visible = devrilme < 0.5 || !n.yaya;
        }
        for (const iz of this.izler) {
            let adet = 0;
            const z = iz.zamanlar;
            while (adet < z.length && z[adet] <= this.t) adet++;
            iz.mesh.geometry.setDrawRange(0, Math.max(0, adet - 1) * 6);
        }
        const tau = this.t - s.tCarpisma;
        if (this.isikDirekleri.length) this.isiklariBoya();
        this.enkazGuncelle(tau);
        if (this.parlama) {
            const gorunur = tau >= -0.02 && tau < 0.32;
            this.parlama.visible = gorunur;
            if (gorunur) {
                const o = 2 + Math.max(0, tau) * 14;
                this.parlama.scale.set(o, o, 1);
                (this.parlama.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - Math.max(0, tau) / 0.32);
            }
        }
        for (const sp of this.tozlar) {
            const omur = 1.6;
            const gorunur = tau >= 0 && tau < omur;
            sp.visible = gorunur;
            if (!gorunur) continue;
            const u = sp.userData as { dx: number; dz: number; v: number; y: number };
            const k = tau / omur;
            const yol = u.v * omur * (1 - (1 - k) * (1 - k)) / 2;
            sp.position.set(s.P.x + u.dx * yol, u.y + k * 1.2, s.P.z + u.dz * yol);
            const o = 1.2 + k * 3.5;
            sp.scale.set(o, o, 1);
            (sp.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - k);
        }
        this.kirli = true;
        if (this.onZaman && (Math.abs(this.t - this.sonBildirim) > 0.04 || !this.oynuyor)) {
            this.sonBildirim = this.t;
            this.onZaman(this.t, s.sure);
        }
    }

    oynat(): void {
        if (!this.sonuc) return;
        if (this.t >= this.sonuc.sure - 0.01) this.zamanAyarla(0);
        this.oynuyor = true;
        this.sonAn = performance.now();
        this.onOynatma?.(true);
    }

    duraklat(): void {
        if (!this.oynuyor) return;
        this.oynuyor = false;
        this.onOynatma?.(false);
        if (this.sonuc) this.onZaman?.(this.t, this.sonuc.sure);
    }

    get oynatiliyor(): boolean {
        return this.oynuyor;
    }

    // ================= Kamera =================
    kameraModuAyarla(mod: KameraModu): void {
        this.kameraModu = mod;
        const P = this.P;
        this.kontrol.enabled = mod === 'serbest' || mod === 'ustten';
        this.kontrol.enableRotate = mod === 'serbest' && !this.secimCb;
        if (mod === 'ustten') {
            this.kontrol.minPolarAngle = 0;
            this.kontrol.maxPolarAngle = 0.0001;
            this.kontrol.target.set(P.x, 0, P.z);
            this.kamera.position.set(P.x, 62, P.z + 0.01);
        } else if (mod === 'serbest') {
            this.kontrol.minPolarAngle = 0;
            this.kontrol.maxPolarAngle = Math.PI / 2.08;
            this.kontrol.target.set(P.x, 0, P.z);
            // Dikey (mobil) ekranda yatay görüş dar: kamera uzaklaşır
            const u = this.kamera.aspect < 1 ? 24 / Math.max(0.5, this.kamera.aspect) : 24;
            this.kamera.position.set(P.x + this.odakYonu.x * u, u * 0.6, P.z + this.odakYonu.z * u);
        }
        this.kamera.fov = mod.endsWith('surucu') ? 65 : 50;
        this.kamera.updateProjectionMatrix();
        this.kontrol.update();
        this.kirli = true;
    }

    /** Serbest kameranın bakış yönünü ayarlar (bina arkasında kalmaması için yol boyunca) */
    odakYonuAyarla(yon: Vec2): void {
        const l = Math.hypot(yon.x, yon.z);
        if (l > 1e-6) this.odakYonu = { x: yon.x / l, z: yon.z / l };
    }

    /** Kamerayı kaza noktasına göre varsayılan açıya getirir */
    kameraSifirla(): void {
        this.kameraModuAyarla(this.kameraModu === 'ustten' ? 'ustten' : 'serbest');
    }

    private takipKamerasi(): void {
        const mod = this.kameraModu;
        if (!this.sonuc) return;
        const id: TarafId = mod.startsWith('A') ? 'A' : 'B';
        const n = this.taraflar[id];
        if (!n) return;
        kareOku(this.sonuc, id, this.t, KARE);
        const psi = KARE[2];
        const ileri = new THREE.Vector3(Math.sin(psi), 0, Math.cos(psi));
        const konum = new THREE.Vector3(KARE[0], 0, KARE[1]);
        if (mod.endsWith('surucu')) {
            const s = this.sonuc.taraflar[id];
            const gozY = s.tip === 'yaya' ? 1.62 : Math.min(2.6, ARAC_TURLERI[s.tur].yukseklik * 0.82);
            const sol = new THREE.Vector3(ileri.z, 0, -ileri.x);
            const yan = s.tip === 'yaya' || n.iki ? 0 : 0.36;
            const goz = konum.clone().addScaledVector(sol, yan).addScaledVector(ileri, s.tip === 'yaya' ? 0.15 : -0.1);
            goz.y = gozY;
            this.kamera.position.copy(goz);
            this.kamera.lookAt(goz.clone().addScaledVector(ileri, 20).setY(gozY * 0.85));
        } else {
            const hedef = konum.clone().addScaledVector(ileri, -14).setY(7);
            this.kamera.position.lerp(hedef, 0.12);
            this.kamera.lookAt(konum.clone().setY(1));
        }
    }

    // ================= Döngü =================
    private dongu = (): void => {
        const simdi = performance.now();
        const dt = Math.min(0.05, (simdi - this.sonAn) / 1000);
        this.sonAn = simdi;
        this.yagisGuncelle(dt);
        if (this.kayit) {
            this.kayit.kare(dt);
            return;
        }
        if (this.oynuyor && this.sonuc) {
            this.zamanAyarla(this.t + dt * this.oynatmaHizi);
            if (this.t >= this.sonuc.sure) this.duraklat();
        }
        const takip = this.kameraModu !== 'serbest' && this.kameraModu !== 'ustten';
        if (takip) {
            this.takipKamerasi();
            this.kirli = true;
        } else this.kontrol.update();
        if (!this.kirli) return;
        this.kirli = false;
        this.ciz();
    };

    private ciz(): void {
        const surucu = this.kameraModu.endsWith('surucu');
        const id: TarafId = this.kameraModu.startsWith('A') ? 'A' : 'B';
        const gizli = surucu ? this.taraflar[id] : undefined;
        if (gizli) gizli.kok.visible = false;
        this.cizici.render(this.sahne, this.kamera);
        if (gizli) gizli.kok.visible = true;
    }

    // ================= Dışa aktarım =================
    private kanvasaBlob(c: HTMLCanvasElement, tur = 'image/png'): Promise<Blob> {
        return new Promise((coz, reddet) => c.toBlob((b) => (b ? coz(b) : reddet(new Error('Görüntü üretilemedi'))), tur, 0.95));
    }

    /** Geçerli görünümün yüksek çözünürlüklü fotoğrafı (isteğe bağlı bilgi katmanıyla) */
    async fotoAl(hudlu: boolean): Promise<Blob> {
        if (hudlu) await logoYukle();
        const w = this.kap.clientWidth || 1;
        const h = this.kap.clientHeight || 1;
        const olcek = Math.min(2, 2560 / w);
        const W = Math.round(w * olcek);
        const H = Math.round(h * olcek);
        const oncekiOran = this.cizici.getPixelRatio();
        this.cizici.setPixelRatio(1);
        this.cizici.setSize(W, H, false);
        this.ciz();
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d');
        if (!x) throw new Error('2B kanvas yok');
        x.drawImage(this.cizici.domElement, 0, 0);
        this.cizici.setPixelRatio(oncekiOran);
        this.cizici.setSize(w, h, false);
        this.kirli = true;
        if (hudlu) hudCiz(x, W, H, this.hud, this.sonuc, this.t);
        return this.kanvasaBlob(c);
    }

    /** Ölçekli kuşbakışı kaza krokisi (A4 yatay oranında) */
    async krokiAl(bilgi: { baslik: string; altSatirlar: string[] }): Promise<Blob> {
        await logoYukle();
        const s = this.sonuc;
        // Sınırlar: güzergâhlar + kaza noktası
        let minX = this.P.x - 25, maxX = this.P.x + 25, minZ = this.P.z - 18, maxZ = this.P.z + 18;
        if (s) {
            const kC = Math.round(s.tCarpisma * s.fps);
            const bas = Math.max(0, kC - Math.round(2.0 * s.fps));
            for (const id of ['A', 'B'] as const) {
                const k = s.taraflar[id].kareler;
                for (let i = bas; i < s.kareSayisi; i++) {
                    minX = Math.min(minX, k[i * KANAL_SAYISI] - 4);
                    maxX = Math.max(maxX, k[i * KANAL_SAYISI] + 4);
                    minZ = Math.min(minZ, k[i * KANAL_SAYISI + 1] - 4);
                    maxZ = Math.max(maxZ, k[i * KANAL_SAYISI + 1] + 4);
                }
            }
        }
        const W = 2000;
        const H = 1414;
        const bilgiH = 230;
        const haritaH = H - bilgiH;
        const oran = W / haritaH;
        let gx = maxX - minX;
        let gz = maxZ - minZ;
        if (gx / gz > oran) gz = gx / oran;
        else gx = gz * oran;
        gx *= 1.08;
        gz *= 1.08;
        const cx = (minX + maxX) / 2;
        const cz = (minZ + maxZ) / 2;
        const ortho = new THREE.OrthographicCamera(-gx / 2, gx / 2, gz / 2, -gz / 2, 1, 600);
        ortho.position.set(cx, 300, cz);
        ortho.up.set(0, 0, -1);
        ortho.lookAt(cx, 0, cz);

        const oncekiT = this.t;
        if (s) this.zamanAyarla(s.sure);
        const etiketler = Object.values(this.taraflar).map((n) => n?.etiket).filter((e): e is THREE.Sprite => !!e);
        etiketler.forEach((e) => (e.visible = false));
        const isaretciGorunur = this.isaretci.visible;
        this.isaretci.visible = false;
        // Kroki her zaman gündüz ışığında, yağışsız ve sissiz çizilir
        const oncekiOrtam: [Aydinlatma, Hava] = [this.aydinlatma, this.hava];
        this.ortamUygula('gunduz', 'acik');
        this.sahne.fog = null;
        const oncekiOran = this.cizici.getPixelRatio();
        const w = this.kap.clientWidth || 1;
        const h = this.kap.clientHeight || 1;
        this.cizici.setPixelRatio(1);
        this.cizici.setSize(W, haritaH, false);
        this.cizici.render(this.sahne, ortho);

        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d');
        if (!x) throw new Error('2B kanvas yok');
        x.fillStyle = '#ffffff';
        x.fillRect(0, 0, W, H);
        x.drawImage(this.cizici.domElement, 0, 0);

        // Geri yükle
        this.cizici.setPixelRatio(oncekiOran);
        this.cizici.setSize(w, h, false);
        this.ortamUygula(oncekiOrtam[0], oncekiOrtam[1]);
        this.isaretci.visible = isaretciGorunur;
        etiketler.forEach((e) => (e.visible = true));
        if (s) this.zamanAyarla(oncekiT);
        this.kirli = true;

        const px = (wx: number): number => ((wx - (cx - gx / 2)) / gx) * W;
        const pz = (wz: number): number => ((wz - (cz - gz / 2)) / gz) * haritaH;
        const olcekPx = W / gx; // piksel / metre
        const FONT = '"Montserrat Variable", Montserrat, Arial, sans-serif';

        if (s) {
            const kC = Math.round(s.tCarpisma * s.fps);
            for (const id of ['A', 'B'] as const) {
                const t = s.taraflar[id];
                const k = t.kareler;
                // Güzergâh
                x.strokeStyle = TARAF_RENK[id];
                x.lineWidth = 4;
                x.setLineDash([]);
                x.beginPath();
                for (let i = Math.max(0, kC - Math.round(2.0 * s.fps)); i < s.kareSayisi; i += 2) {
                    const X = px(k[i * KANAL_SAYISI]);
                    const Z = pz(k[i * KANAL_SAYISI + 1]);
                    if (i === Math.max(0, kC - Math.round(2.0 * s.fps))) x.moveTo(X, Z);
                    else x.lineTo(X, Z);
                }
                x.stroke();
                // Çarpışma anı konumu: kesikli dış hat
                const ax = k[kC * KANAL_SAYISI];
                const az = k[kC * KANAL_SAYISI + 1];
                const psi = k[kC * KANAL_SAYISI + 2];
                x.save();
                x.translate(px(ax), pz(az));
                x.rotate(-psi + Math.PI);
                x.setLineDash([10, 7]);
                x.lineWidth = 3;
                x.strokeRect((-t.en / 2) * olcekPx, (-t.boy / 2) * olcekPx, t.en * olcekPx, t.boy * olcekPx);
                x.restore();
                // Etiketler: çarpışma anı (A1) ve son duruş (A2)
                const etiket = (yazi: string, X: number, Z: number): void => {
                    x.setLineDash([]);
                    x.font = `800 26px ${FONT}`;
                    const ww = x.measureText(yazi).width + 22;
                    x.fillStyle = TARAF_RENK[id];
                    x.beginPath();
                    x.roundRect(X - ww / 2, Z - 18, ww, 36, 18);
                    x.fill();
                    x.fillStyle = '#fff';
                    x.textAlign = 'center';
                    x.textBaseline = 'middle';
                    x.fillText(yazi, X, Z + 1);
                };
                etiket(`${id}1`, px(ax) + 40, pz(az) - 40);
                etiket(`${id}2`, px(t.sonKonum.x) + 40, pz(t.sonKonum.z) + 40);
            }
            // Çarpışma noktası
            x.setLineDash([]);
            x.strokeStyle = '#C81D25';
            x.lineWidth = 5;
            const X = px(s.P.x);
            const Z = pz(s.P.z);
            x.beginPath();
            x.moveTo(X - 16, Z - 16); x.lineTo(X + 16, Z + 16);
            x.moveTo(X + 16, Z - 16); x.lineTo(X - 16, Z + 16);
            x.stroke();
            x.beginPath();
            x.arc(X, Z, 24, 0, Math.PI * 2);
            x.stroke();
        }

        // Kuzey oku
        x.save();
        x.translate(W - 80, 90);
        x.fillStyle = 'rgba(255,255,255,0.92)';
        x.beginPath();
        x.arc(0, 0, 52, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#2D3039';
        x.beginPath();
        x.moveTo(0, -38); x.lineTo(16, 18); x.lineTo(0, 8); x.lineTo(-16, 18);
        x.closePath();
        x.fill();
        x.font = `800 22px ${FONT}`;
        x.textAlign = 'center';
        x.fillText('K', 0, 40);
        x.restore();

        // Ölçek çubuğu
        const adaylar = [5, 10, 20, 25, 50, 100];
        const metre = adaylar.find((m) => m * olcekPx > 180) ?? 100;
        const cubuk = metre * olcekPx;
        x.fillStyle = 'rgba(255,255,255,0.92)';
        x.beginPath();
        x.roundRect(30, haritaH - 86, cubuk + 60, 62, 14);
        x.fill();
        x.fillStyle = '#2D3039';
        x.fillRect(60, haritaH - 46, cubuk, 8);
        x.fillStyle = '#ffffff';
        x.fillRect(60 + cubuk / 2, haritaH - 44, cubuk / 2, 4);
        x.font = `700 20px ${FONT}`;
        x.textAlign = 'center';
        x.fillStyle = '#2D3039';
        x.fillText('0', 60, haritaH - 60);
        x.fillText(`${metre} m`, 60 + cubuk, haritaH - 60);

        // Bilgi bandı
        x.fillStyle = '#ffffff';
        x.fillRect(0, haritaH, W, bilgiH);
        x.fillStyle = '#C81D25';
        x.fillRect(0, haritaH, W, 6);
        x.textAlign = 'left';
        x.textBaseline = 'alphabetic';
        x.fillStyle = '#2D3039';
        x.font = `800 38px ${FONT}`;
        x.fillText(bilgi.baslik, 40, haritaH + 62);
        x.font = `500 24px ${FONT}`;
        x.fillStyle = '#4a4d55';
        bilgi.altSatirlar.slice(0, 3).forEach((satir, i) => x.fillText(satir.length > 95 ? satir.slice(0, 93) + '…' : satir, 40, haritaH + 104 + i * 34));
        x.font = `500 18px ${FONT}`;
        x.fillStyle = '#7F828A';
        x.fillText(`A1/B1: çarpışma anı konumu (kesikli) · A2/B2: son duruş · ✕: çarpışma noktası · ${KISA_UYARI}`, 40, H - 26);
        // Kurum logosu ve adı (sağ)
        const lg = logoGorseli();
        if (lg) x.drawImage(lg, W - 40 - 130, haritaH + 30, 130, 130);
        x.textAlign = 'right';
        x.fillStyle = '#2D3039';
        x.font = `700 18px ${FONT}`;
        x.fillText(MARKA.kurumBuyuk, W - 190, haritaH + 80);
        x.fillStyle = '#C81D25';
        x.font = `600 20px ${FONT}`;
        x.fillText(MARKA.uygulama, W - 190, haritaH + 108);
        x.fillStyle = '#7F828A';
        x.font = `400 16px ${FONT}`;
        x.fillText('Meslektaşlarımızın faydasına hazırlanmıştır', W - 190, haritaH + 134);
        x.textAlign = 'left';
        return this.kanvasaBlob(c);
    }

    /** Canlandırmayı baştan sona tarayıcıda video olarak kaydeder */
    videoKaydet(sec: VideoSecenek, ilerleme: (oran: number) => void): Promise<VideoSonuc> {
        const s = this.sonuc;
        if (!s) return Promise.reject(new Error('Önce simülasyonu hesaplayın.'));
        if (!videoDestekleniyor()) return Promise.reject(new Error('Bu tarayıcı video kaydını desteklemiyor.'));
        const tur = videoTuru();
        if (!tur) return Promise.reject(new Error('Desteklenen video biçimi bulunamadı.'));

        void logoYukle();
        const W = sec.genislik;
        const H = sec.yukseklik;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d');
        if (!x) return Promise.reject(new Error('2B kanvas yok'));
        const akim = c.captureStream(sec.fps);
        const kaydedici = new MediaRecorder(akim, { mimeType: tur.mime, videoBitsPerSecond: 8_000_000 });
        const parcalar: Blob[] = [];
        kaydedici.ondataavailable = (e) => {
            if (e.data.size > 0) parcalar.push(e.data);
        };

        this.duraklat();
        const oncekiOran = this.cizici.getPixelRatio();
        const w0 = this.kap.clientWidth || 1;
        const h0 = this.kap.clientHeight || 1;
        this.cizici.setPixelRatio(1);
        this.cizici.setSize(W, H, false);
        this.kamera.aspect = W / H;
        this.kamera.updateProjectionMatrix();
        this.zamanAyarla(0);

        return new Promise<VideoSonuc>((coz, reddet) => {
            let bitisBekleme = 0;
            const bitir = (): void => {
                this.kayit = null;
                this.cizici.setPixelRatio(oncekiOran);
                this.cizici.setSize(w0, h0, false);
                this.kamera.aspect = w0 / h0;
                this.kamera.updateProjectionMatrix();
                this.kirli = true;
                if (kaydedici.state !== 'inactive') kaydedici.stop();
            };
            kaydedici.onstop = () => {
                akim.getTracks().forEach((tr) => tr.stop());
                if (!parcalar.length) {
                    reddet(new Error('Video verisi oluşmadı.'));
                    return;
                }
                coz({ blob: new Blob(parcalar, { type: tur.mime.split(';')[0] }), uzanti: tur.uzanti });
            };
            kaydedici.onerror = () => {
                bitir();
                reddet(new Error('Video kaydı başarısız oldu.'));
            };
            this.kayit = {
                bitir,
                kare: (dt: number) => {
                    if (this.t < s.sure) this.zamanAyarla(this.t + dt * sec.hiz);
                    else bitisBekleme += dt;
                    const takip = this.kameraModu !== 'serbest' && this.kameraModu !== 'ustten';
                    if (takip) this.takipKamerasi();
                    else this.kontrol.update();
                    this.ciz();
                    x.drawImage(this.cizici.domElement, 0, 0, W, H);
                    hudCiz(x, W, H, this.hud, s, this.t);
                    ilerleme(Math.min(1, this.t / s.sure));
                    if (bitisBekleme > 1.0) bitir();
                },
            };
            kaydedici.start(250);
        });
    }

    videoIptal(): void {
        this.kayit?.bitir();
    }
}
