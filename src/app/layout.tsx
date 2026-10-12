import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/montserrat';
import './globals.css';

export const metadata: Metadata = {
    metadataBase: new URL('https://ersancetin.github.io/kaza-simulator/'),
    title: 'Kaza Simülatörü — Trafik Kazası Canlandırma ve Ön Analiz',
    description:
        'Tarayıcıda çalışan trafik kazası canlandırması: gerçek yol verisi veya şablon senaryolarla 3B simülasyon, fren izinden hız, kaçınılabilirlik ve KTK temelli kusur ön değerlendirmesi; fotoğraf, kroki ve video çıktısı.',
    openGraph: {
        title: 'Kaza Simülatörü — Trafik Kazası Canlandırma ve Ön Analiz',
        description: 'Fizik tabanlı 3B kaza canlandırması, kroki ve video çıktısı — tamamen tarayıcıda.',
        type: 'website',
        images: ['og.png'],
    },
    twitter: { card: 'summary_large_image' },
    icons: {
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23C81D25'/%3E%3Cpath d='M18 40h28l-4-12a4 4 0 0 0-4-3H26a4 4 0 0 0-4 3z' fill='white'/%3E%3Ccircle cx='24' cy='42' r='4' fill='white'/%3E%3Ccircle cx='40' cy='42' r='4' fill='white'/%3E%3C/svg%3E",
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#C81D25',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="tr">
            <body>{children}</body>
        </html>
    );
}
