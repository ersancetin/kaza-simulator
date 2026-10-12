import { KazaClient } from '@/kaza-simulator/components/KazaClient';

// Bağımsız yayında üye kilidi kapalıdır; GateOS içinde isProtected /
// isAuthenticated değerleri oturum katmanından verilir.
export default function Sayfa() {
    return <KazaClient isProtected={false} isAuthenticated />;
}
