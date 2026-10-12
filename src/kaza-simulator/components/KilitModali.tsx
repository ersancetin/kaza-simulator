'use client';

// Auth Shield: oturum açmamış kullanıcı eylem başlattığında bordo kilit modalı.

import * as Dialog from '@radix-ui/react-dialog';
import { Lock } from 'lucide-react';
import { Buton } from './ui/temel.tsx';

export function KilitModali({ acik, kapat, girisIste }: { acik: boolean; kapat: () => void; girisIste: () => void }) {
    return (
        <Dialog.Root open={acik} onOpenChange={(a) => !a && kapat()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[4000] bg-bordo backdrop-blur-sm" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-[4001] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 text-center shadow-2xl animate-giris">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aha-red/10 text-aha-red">
                        <Lock className="h-6 w-6" />
                    </span>
                    <Dialog.Title className="mt-4 text-xl font-bold">Üyelere özel</Dialog.Title>
                    <Dialog.Description className="mt-2 text-[13px] font-light leading-relaxed text-muted-foreground">
                        Simülasyonu hesaplamak ve çıktı almak için oturum açın. Önizlemeyi incelemeye devam edebilirsiniz.
                    </Dialog.Description>
                    <div className="mt-6 flex flex-col gap-2">
                        <Buton tur="birincil" className="justify-center" onClick={girisIste}>Giriş yap</Buton>
                        <Buton tur="hayalet" className="justify-center" onClick={kapat}>Önizlemeye dön</Buton>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
