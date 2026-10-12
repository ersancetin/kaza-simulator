import type { NextConfig } from 'next';

// Statik dışa aktarım: çıktı (out/) herhangi bir statik barındırıcıda,
// sunucu süreci olmadan çalışır (GateOS "Sıfır Sunucu Yükü" kuralı).
// GitHub Pages alt dizini için NEXT_PUBLIC_BASE_PATH=/kaza-simulator verilir.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
    output: 'export',
    basePath,
    assetPrefix: basePath || undefined,
    trailingSlash: true,
    images: { unoptimized: true },
    reactStrictMode: true,
    poweredByHeader: false,
};

export default nextConfig;
