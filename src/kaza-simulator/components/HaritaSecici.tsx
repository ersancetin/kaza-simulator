'use client';

// Leaflet + OpenStreetMap harita: konum seçimi. Leaflet tarayıcı nesnelerine
// eriştiği için yalnızca istemcide, dinamik içe aktarmayla yüklenir.

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Map as LMap, Marker } from 'leaflet';
import type { SecilenKonum } from '../types/kazaTypes.ts';
import { tersAdres } from '../lib/osm.ts';

const TR_MERKEZ: [number, number] = [39.0, 35.3];

export interface HaritaSeciciProps {
    secilen: SecilenKonum | null;
    secildi: (k: SecilenKonum) => void;
    /** Dışarıdan (arama sonucu) gidilecek konum */
    hedef: SecilenKonum | null;
    zoomDegisti?: (z: number) => void;
}

const PIN = `<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
<path d="M18 47s15-15.6 15-28.5C33 9.9 26.3 3 18 3S3 9.9 3 18.5C3 31.4 18 47 18 47z" fill="#C81D25" stroke="#fff" stroke-width="3"/>
<circle cx="18" cy="18.5" r="6" fill="#fff"/></svg>`;

export function HaritaSecici({ secilen, secildi, hedef, zoomDegisti }: HaritaSeciciProps) {
    const kapRef = useRef<HTMLDivElement>(null);
    const haritaRef = useRef<LMap | null>(null);
    const isaretRef = useRef<Marker | null>(null);
    const LRef = useRef<typeof import('leaflet') | null>(null);
    const secildiRef = useRef(secildi);
    secildiRef.current = secildi;
    const zoomRef = useRef(zoomDegisti);
    zoomRef.current = zoomDegisti;

    useEffect(() => {
        let iptal = false;
        const denetleyici = new AbortController();
        void import('leaflet').then((mod) => {
            const L = (mod as unknown as { default?: typeof import('leaflet') }).default ?? mod;
            if (iptal || !kapRef.current) return;
            LRef.current = L;
            const sinir = L.latLngBounds([35.6, 25.5], [42.4, 45.0]);
            const harita = L.map(kapRef.current, {
                center: TR_MERKEZ, zoom: 6, minZoom: 5, maxBounds: sinir.pad(0.4), zoomControl: false,
            });
            L.control.zoom({ position: 'bottomright' }).addTo(harita);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
            }).addTo(harita);
            harita.on('click', (e) => {
                if (!sinir.contains(e.latlng)) return;
                if (harita.getZoom() < 15) {
                    harita.setView(e.latlng, Math.min(17, Math.max(harita.getZoom() + 3, 15)));
                    return;
                }
                const { lat, lng } = e.latlng;
                const k: SecilenKonum = { lat, lon: lng, adres: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
                secildiRef.current(k);
                void tersAdres(lat, lng, denetleyici.signal).then((adres) => {
                    if (adres && !iptal) secildiRef.current({ ...k, adres });
                });
            });
            harita.on('zoomend', () => zoomRef.current?.(harita.getZoom()));
            zoomRef.current?.(harita.getZoom());
            haritaRef.current = harita;
        });
        return () => {
            iptal = true;
            denetleyici.abort();
            haritaRef.current?.remove();
            haritaRef.current = null;
            isaretRef.current = null;
        };
    }, []);

    // Seçili konum işaretçisi
    useEffect(() => {
        const L = LRef.current;
        const harita = haritaRef.current;
        if (!L || !harita) return;
        isaretRef.current?.remove();
        isaretRef.current = null;
        if (!secilen) return;
        isaretRef.current = L.marker([secilen.lat, secilen.lon], {
            icon: L.divIcon({ html: PIN, className: '', iconSize: [36, 48], iconAnchor: [18, 47] }),
            keyboard: false,
        }).addTo(harita);
    }, [secilen]);

    // Arama sonucuna uç
    useEffect(() => {
        if (hedef && haritaRef.current) haritaRef.current.setView([hedef.lat, hedef.lon], 17);
    }, [hedef]);

    return <div ref={kapRef} className="absolute inset-0 z-0" role="application" aria-label="Kaza konumu seçme haritası" />;
}
