'use client';

// Masaüstü klavye kısayolları. Dinleyici bileşen kaldırıldığında temizlenir.
//   Space: oynat/duraklat · ←/→: 0,1 sn (Shift: 1 sn) · Home/End: başa/sona
//   1–6: kamera modları · Esc: düzenleme modundan / tam ekrandan çıkış
//   P: paneli aç/kapat · F: tam ekran

import { useEffect, useRef } from 'react';

export interface KlavyeIsleyicileri {
    oynatDuraklat: () => void;
    adim: (dt: number) => void;
    basaSona: (son: boolean) => void;
    kamera: (n: number) => void;
    kacis: () => void;
    panel: () => void;
    tamEkran: () => void;
}

const yaziAlani = (h: EventTarget | null): boolean => {
    const el = h as HTMLElement | null;
    if (!el) return false;
    const etiket = el.tagName;
    return etiket === 'INPUT' || etiket === 'TEXTAREA' || etiket === 'SELECT' || el.isContentEditable;
};

export function useKlavyeKisayollari(isleyiciler: KlavyeIsleyicileri, etkin: boolean): void {
    const ref = useRef(isleyiciler);
    ref.current = isleyiciler;

    useEffect(() => {
        if (!etkin) return;
        const dinle = (e: KeyboardEvent): void => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const h = ref.current;
            if (e.key === 'Escape') {
                h.kacis();
                return;
            }
            if (yaziAlani(e.target)) return;
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    h.oynatDuraklat();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    h.adim(e.shiftKey ? 1 : 0.1);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    h.adim(e.shiftKey ? -1 : -0.1);
                    break;
                case 'Home':
                    h.basaSona(false);
                    break;
                case 'End':
                    h.basaSona(true);
                    break;
                case 'p':
                case 'P':
                    h.panel();
                    break;
                case 'f':
                case 'F':
                    h.tamEkran();
                    break;
                default:
                    if (/^[1-6]$/.test(e.key)) h.kamera(parseInt(e.key, 10));
            }
        };
        window.addEventListener('keydown', dinle);
        return () => window.removeEventListener('keydown', dinle);
    }, [etkin]);
}
