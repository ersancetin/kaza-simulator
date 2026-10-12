import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/montserrat';
import './globals.css';

export const metadata: Metadata = {
    metadataBase: new URL('https://ersancetin.github.io/kaza-simulator/'),
    title: 'Kaza Simülatörü — Cumhuriyet Avukatları',
    description:
        'Tarayıcıda çalışan trafik kazası canlandırması: gerçek yol verisi veya şablon senaryolarla 3B simülasyon, fren izinden hız, kaçınılabilirlik ve KTK temelli kusur ön değerlendirmesi; fotoğraf, kroki ve video çıktısı. Cumhuriyet Avukatları tarafından meslektaş faydasına hazırlanmış simülasyon aracıdır; hukuki görüş veya bilirkişi raporu değildir.',
    openGraph: {
        title: 'Kaza Simülatörü — Cumhuriyet Avukatları',
        description: 'Fizik tabanlı 3B kaza canlandırması, kroki ve video çıktısı — tamamen tarayıcıda.',
        type: 'website',
        images: ['og.png'],
    },
    twitter: { card: 'summary_large_image' },
    icons: {
        icon: [{ url: 'logo.png', type: 'image/png' }],
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
