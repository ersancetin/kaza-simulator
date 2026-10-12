'use client';

// Dokunmatik kaydırma (swipe) jestleri: onTouchStart / onTouchMove / onTouchEnd.
// Döndürülen işleyiciler doğrudan JSX öğesine verilir.

import { useRef, type TouchEvent } from 'react';

export interface KaydirmaIsleyicileri {
    sola?: () => void;
    saga?: () => void;
    yukari?: () => void;
    asagi?: () => void;
}

export function useKaydirma(h: KaydirmaIsleyicileri, esik = 40) {
    const bas = useRef<{ x: number; y: number; t: number } | null>(null);
    const son = useRef<{ x: number; y: number } | null>(null);
    return {
        onTouchStart: (e: TouchEvent) => {
            const d = e.touches[0];
            bas.current = { x: d.clientX, y: d.clientY, t: Date.now() };
            son.current = { x: d.clientX, y: d.clientY };
        },
        onTouchMove: (e: TouchEvent) => {
            const d = e.touches[0];
            son.current = { x: d.clientX, y: d.clientY };
        },
        onTouchEnd: () => {
            const b = bas.current;
            const s = son.current;
            bas.current = null;
            if (!b || !s || Date.now() - b.t > 700) return;
            const dx = s.x - b.x;
            const dy = s.y - b.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < esik) return;
            if (Math.abs(dx) > Math.abs(dy)) (dx < 0 ? h.sola : h.saga)?.();
            else (dy < 0 ? h.yukari : h.asagi)?.();
        },
    };
}
