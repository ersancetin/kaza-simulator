// Tarayıcı içi video kaydı yardımcıları (MediaRecorder). Three.js'ten bağımsızdır;
// arayüz bu modülü 3B motoru yüklemeden kullanabilir.

export interface VideoSecenek {
    genislik: number;
    yukseklik: number;
    fps: number;
    hiz: number;
}

export interface VideoSonuc {
    blob: Blob;
    uzanti: 'mp4' | 'webm';
}

export function videoDestekleniyor(): boolean {
    return typeof window !== 'undefined' && 'MediaRecorder' in window && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/** Tarayıcının kaydedebildiği en uygun biçim: önce H.264 MP4 (her oynatıcıda açılır), yoksa WebM */
export function videoTuru(): { mime: string; uzanti: 'mp4' | 'webm' } | null {
    const adaylar: Array<[string, 'mp4' | 'webm']> = [
        ['video/mp4;codecs=avc1.42E01F', 'mp4'],
        ['video/mp4;codecs=avc1', 'mp4'],
        ['video/webm;codecs=vp9', 'webm'],
        ['video/webm;codecs=vp8', 'webm'],
        ['video/webm', 'webm'],
        ['video/mp4', 'mp4'],
    ];
    for (const [m, u] of adaylar) if (MediaRecorder.isTypeSupported(m)) return { mime: m, uzanti: u };
    return null;
}
