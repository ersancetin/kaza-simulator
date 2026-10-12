// 2918 sayılı Karayolları Trafik Kanunu — ilgili hükümlerden birebir alıntılar.
// Metinler mevzuat.gov.tr konsolide metninden (19.08.2026 tarihli doğrulanmış derleme) alınmıştır.
// Her alıntı, maddenin giriş cümlesi + ilgili bent + kapanış ifadesinden oluşan parçalardır;
// parçalar arasındaki atlanan kısımlar “…” ile gösterilir. Değişiklik ibareleri
// (ör. “(Değişik:12/2/2026-7574/14 md.)”) alıntıda gösterilmemiştir.

export interface KtkHukum {
    /** Atıf biçimi, ör. 'KTK m.84/1-a' */
    atif: string;
    /** Madde/bent kenar başlığı */
    baslik: string;
    /** Resmî metinden birebir parçalar (aralarında atlanan kısım vardır) */
    parcalar: readonly string[];
}

const M84_GIRIS = 'Araç sürücüleri trafik kazalarında;';
const M84_KAPANIS = 'Hallerinde asli kusurlu sayılırlar.';
const m84 = (bent: string, metin: string): KtkHukum => ({
    atif: `KTK m.84/${bent}`,
    baslik: 'Asli kusur sayılan hâller',
    parcalar: [M84_GIRIS, `${bent}) ${metin}`, M84_KAPANIS],
});

const M46_GIRIS = 'Karayollarında trafik sağdan akar. Aksine bir işaret bulunmadıkça sürücüler:';
const M52_GIRIS = 'Sürücüler:';
const M56_GIRIS = 'Sürücüler aşağıdaki kurallara ve yasaklara uymak zorundadırlar.';

export const KTK_HUKUMLERI = {
    '84/a': m84('a', 'Kırmızı ışıklı trafik işaretinde veya yetkili memurun dur işaretinde geçme,'),
    '84/b': m84('b', 'Taşıt giremez trafik işareti bulunan karayoluna veya bölünmüş karayolunda karşı yönden gelen trafiğin kullandığı şerit, rampa ve bağlantı yollarına girme,'),
    '84/c': m84('c', 'İkiden fazla şeritli taşıt yollarında, karşı yönden gelen trafiğin kullandığı şerit veya yol bölümüne girme,'),
    '84/d': m84('d', 'Arkadan çarpma,'),
    '84/e': m84('e', 'Geçme yasağı olan yerlerde geçme,'),
    '84/f': m84('f', 'Doğrultu değiştirme manevralarını yanlış yapma,'),
    '84/g': m84('g', 'Şeride tecavüz etme,'),
    '84/h': m84('h', 'Kavşaklarda geçiş önceliğine uymama,'),
    '84/i': m84('i', 'Kaplamanın dar olduğu yerlerde geçiş önceliğine uymama,'),
    '84/j': m84('j', 'Manevraları düzenleyen genel şartlara uymama,'),
    '84/k': m84('k', 'Yerleşim birimleri dışındaki karayolunun taşıt yolu üzerinde, zorunlu haller dışında park etme veya duraklama ve her durumda gerekli tedbirleri almama,'),
    '84/l': m84('l', 'Park için ayrılmış yerlerde veya taşıt yolu dışında kurallara uygun olarak park edilmiş araçlara çarpma,'),
    '84/son': {
        atif: 'KTK m.84 (son cümle)',
        baslik: 'Birden fazla sürücünün asli kusur hâli',
        parcalar: ['Ancak, kazada bu hareketlerden herhangi biri, kazaya karışan araç sürücülerinden birden fazlası tarafından yapılmış veya kaza bu hareketler dışında kurallarla, yasaklamalara, kısıtlamalara ve talimatlara uyulmaması nedenlerinden doğmuşsa, karayolunu kullananlar için kusur oranı yönetmelikte belirtilen esaslara göre tespit edilir.'],
    },
    '46/1-a': {
        atif: 'KTK m.46/1-a', baslik: 'Trafiğin akışı',
        parcalar: [M46_GIRIS, 'a) Araçlarını, gidiş yönüne göre yolun sağından, çok şeritli yollarda ise yol ve trafik durumuna göre hızının gerektirdiği şeritten sürmek,', 'zorundadırlar.'],
    },
    '46/1-b': {
        atif: 'KTK m.46/1-b', baslik: 'Trafiğin akışı',
        parcalar: [M46_GIRIS, 'b) Şerit değiştirmeden önce gireceği şeritte sürülen araçların emniyetle geçişini beklemek,', 'zorundadırlar.'],
    },
    '46/1-c': {
        atif: 'KTK m.46/1-c', baslik: 'Trafiğin akışı',
        parcalar: [M46_GIRIS, 'c) Trafiği aksatacak veya tehlikeye sokacak şekilde şerit değiştirmemek,', 'zorundadırlar.'],
    },
    '46/1-h': {
        atif: 'KTK m.46/1-h', baslik: 'Trafiğin akışı',
        parcalar: [M46_GIRIS, 'h) Tekyönlü karayollarında araçlarını ters istikamette sürmemek', 'zorundadırlar.'],
    },
    '47/1-b': {
        atif: 'KTK m.47/1-b', baslik: 'Trafik işaretlerine uyma zorunluluğu',
        parcalar: ['Karayollarından faydalananlar aşağıdaki sıralamaya göre;', 'b) Trafik ışıklarına,', 'Uymak zorundadırlar.'],
    },
    '48/1': {
        atif: 'KTK m.48/1', baslik: 'Uyuşturucu, uyarıcı madde ve alkollü içki',
        parcalar: ['Uyuşturucu veya uyarıcı maddeleri almış olan sürücüler ile alkollü olan sürücülerin karayolunda araç sürmeleri yasaktır.'],
    },
    '51/1': {
        atif: 'KTK m.51/1', baslik: 'Hız sınırları',
        parcalar: ['Sürücüler, aksine bir karar alınıp işaretlenmemişse yönetmelikte belirtilen hız sınırlarını aşmamak zorundadırlar.'],
    },
    '52/1-a': {
        atif: 'KTK m.52/1-a', baslik: 'Hız kuralları',
        parcalar: [M52_GIRIS, 'a) Kavşaklara yaklaşırken, dönemeçlere girerken, tepe üstlerine yaklaşırken, dönemeçli yollarda ilerlerken, yaya geçitlerine, hemzemin geçitlere, tünellere, dar köprü ve menfezlere yaklaşırken, yapım ve onarım alanlarına girerken, hızlarını azaltmak,', 'Zorundadırlar.'],
    },
    '52/1-b': {
        atif: 'KTK m.52/1-b', baslik: 'Hız kuralları',
        parcalar: [M52_GIRIS, 'b) Hızlarını, kullandıkları aracın yük ve teknik özelliğine, görüş, yol, hava ve trafik durumunun gerektirdiği şartlara uydurmak,', 'Zorundadırlar.'],
    },
    '52/1-c': {
        atif: 'KTK m.52/1-c', baslik: 'Hız kuralları',
        parcalar: [M52_GIRIS, 'c) Diğer bir aracı izlerken yukarıdaki fıkrada belirlenen durumları göz önünde tutarak güvenli bir mesafe bırakmak,', 'Zorundadırlar.'],
    },
    '53/son': {
        atif: 'KTK m.53 (dönüşlerde ilk geçiş hakkı)', baslik: 'Dönüş kuralları',
        parcalar: ['Sağa ve sola dönüşlerde, sürücüler kurallara uygun olarak geçiş yapan yayalara, varsa bisiklet yolundaki ve bisiklet şeridindeki bisiklet ve elektrikli skuter kullananlara ve sola dönüşlerde sağdan ve karşıdan gelen trafiğe ilk geçiş hakkını vermek zorundadırlar.'],
    },
    '54/1-b': {
        atif: 'KTK m.54/1-b', baslik: 'Geçme kural ve yasakları',
        parcalar: ['b) Geçmenin yasak olduğu yerler; 1. Geçmenin herhangi bir trafik işaretiyle yasaklandığı yerlerde, 2. Görüş yetersizliği olan tepelerde ve dönemeçlerde, 3. Yaya ve okul geçitleri yaklaşımında, 4. Kavşaklarda, demiryolu geçitlerinde ve bunların yaklaşımında, 5. Gidiş ve geliş için birer şeridi bulunan iki yönlü trafiğin kullanıldığı köprü ve tünellerde, Sürücülerin önlerindeki bir aracı geçmeleri yasaktır.'],
    },
    '56/1-a': {
        atif: 'KTK m.56/1-a', baslik: 'Şerit izleme',
        parcalar: [M56_GIRIS, 'a) Şerit izleme: 1. Sürücülerin; geçme, dönme, duraklama, durma ve park etme gibi haller dışında şerit değiştirmeleri veya iki şeridi birden kullanmaları, 2. Kavşaklara yaklaşırken, yerleşim yerleri dışında yüzelli metre, yerleşim yerlerinde ise otuz metre mesafe içinde ve kavşaklarda şerit değiştirmeleri, 3. Araçların cinsine ve hızına uygun olmayan şeritten gitmeleri, 4. İşaret vermeden şerit değiştirmeleri, Yasaktır.'],
    },
    '56/1-b': {
        atif: 'KTK m.56/1-b', baslik: 'Gelen trafikle karşılaşma',
        parcalar: [M56_GIRIS, 'b) Gelen trafikle karşılaşma: Sürücüler; iki yönlü trafiğin kullanıldığı taşıt yollarında karşı yönden gelen araçların geçişini zorlaştıran bir durum varsa geçişi kolaylaştırmak için aracını sağ kenara yanaştırmaya, gerektiğinde sağa yanaşıp durmaya,'],
    },
    '56/1-c': {
        atif: 'KTK m.56/1-c', baslik: 'Araçlar arasındaki mesafe',
        parcalar: [M56_GIRIS, 'c) Araçlar arasındaki mesafe: Sürücüler önlerinde giden araçları yönetmelikte belirtilen güvenli ve yeterli bir mesafeden izlemek zorundadırlar.'],
    },
    '57/1-a': {
        atif: 'KTK m.57/1-a', baslik: 'Kavşaklarda geçiş hakkı',
        parcalar: ['Kavşaklarda aşağıdaki kurallar uygulanır.', 'a) Kavşağa yaklaşan sürücüler kavşaktaki şartlara uyacak şekilde yavaşlamak, dikkatli olmak, geçiş hakkı olan araçların önce geçmesine imkan vermek zorundadırlar.'],
    },
    '57/1-c': {
        atif: 'KTK m.57/1-c', baslik: 'Kavşaklarda geçiş hakkı',
        parcalar: ['c) Kavşak kollarının trafik yoğunluğu bakımından farklı oldukları işaretlerle belirlenmemiş ise; 1. Motorsuz araç sürücüleri motorlu araçlara, 2. Motorlu araçlardan soldaki sağdan gelen araca, Geçiş hakkını vermek zorundadırlar.'],
    },
    '59/1': {
        atif: 'KTK m.59/1', baslik: 'Duraklama ve park etme',
        parcalar: ['Yerleşim birimleri dışındaki kara yolunda zorunlu haller dışında taşıt yolu üzerinde duraklamak veya park etmek yasaktır.'],
    },
    '67/1-a': {
        atif: 'KTK m.67/1-a', baslik: 'Manevralar',
        parcalar: ['Manevralarda aşağıdaki kurallar uygulanır.', 'a) Sürücülerin, park yapmış taşıtlar arasından çıkarken, duraklarken veya park yaparken taşıt yolunun sağına veya soluna yanaşırken, sağa veya sola dönerken, karayolunu kullananlar için tehlike doğurabilecek ve bunların hareketlerini zorlaştıracak şekilde davranmaları yasaktır.'],
    },
    '67/1-c': {
        atif: 'KTK m.67/1-c', baslik: 'Manevralar',
        parcalar: ['Manevralarda aşağıdaki kurallar uygulanır.', 'c) Dönüşlerde veya şerit değiştirmelerde sürücülerin niyetlerini dönüş işaret ışıkları veya kol işareti ile açıkça ve yeterli şekilde belirtmesi, işaretlerin manevra süresince devam etmesi ve biter bitmez sona erdirilmesi zorunludur.'],
    },
    '68/1-a': {
        atif: 'KTK m.68/1-a', baslik: 'Yayaların uyacakları kurallar',
        parcalar: ['Yayaların uyacakları kurallar aşağıda belirtilmiştir.', 'a) Yayalar, aşağıda sayılan haller dışında, taşıt yolu bitişiğinde ve yakınında yaya yolu, banket veya alan varsa burada yürümek zorundadır.'],
    },
    '68/1-b': {
        atif: 'KTK m.68/1-b', baslik: 'Yayaların uyacakları kurallar',
        parcalar: ['b) Taşıt yolunun karşı tarafına geçmek isteyen yayaların taşıt yolunu, yaya ve okul geçidi ile kavşak giriş ve çıkışları dışında herhangi bir yerden geçmeleri yasaktır.'],
    },
    '68/1-b-1': {
        atif: 'KTK m.68/1-b-1', baslik: 'Yayaların uyacakları kurallar',
        parcalar: ['Yayalar, bu yerlerden geçerken;', '1. Yaya ve okul geçitlerinin bulunduğu yerlerde, geçitte yayalar için ışıklı işaret varsa bu işaretlere uymak,', 'Zorundadırlar.'],
    },
    '68/1-b-son': {
        atif: 'KTK m.68/1-b (son cümle)', baslik: 'Yayaların uyacakları kurallar',
        parcalar: ['Ancak, yüz metre kadar mesafede yaya geçidi veya kavşak bulunmayan yerlerde yayalar, taşıt trafiği için bir engel teşkil etmemek şartı ile ve yolu kontrol ederek kendi güvenliklerini sağladıktan sonra en kısa doğrultuda ve en kısa zamanda taşıt yolunu geçebilirler.'],
    },
    '68/1-c': {
        atif: 'KTK m.68/1-c', baslik: 'Yayaların uyacakları kurallar',
        parcalar: ['c) Yaya yollarında, geçitlerde veya zorunlu hallerde taşıt yolu üzerinde bulunan yayaların, trafiği engelleyecek veya tehlikeye düşürecek şekilde davranışlarda bulunmaları veya buraları saygısızca kullanmaları yasaktır.'],
    },
    '73/1': {
        atif: 'KTK m.73/1', baslik: 'Saygısızca araç sürme, telefon kullanma',
        parcalar: ['Karayolunda araçların kamunun rahat ve huzurunu bozacak veya kişilere zarar verecek şekilde saygısızca sürülmesi, araçlardan bir şey atılması veya dökülmesi, seyir halinde sürücülerin cep ve araç telefonu ile benzer haberleşme cihazlarını kullanması yasaktır.'],
    },
    '74/1': {
        atif: 'KTK m.74/1', baslik: 'Yayalara ilk geçiş hakkı verilmesi',
        parcalar: ['Sürücüler, görevli bir kişi veya ışıklı trafik işareti bulunmayan ancak trafik işareti veya levhalarıyla belirlenmiş kavşak giriş ve çıkışları ile yaya veya okul geçitlerine yaklaşırken yavaşlamak, varsa buralardan geçen veya geçmek üzere bulunan yayalara durarak ilk geçiş hakkını vermek zorundadırlar.'],
    },
} as const satisfies Record<string, KtkHukum>;

export type KtkAnahtar = keyof typeof KTK_HUKUMLERI;

/** Parçaları atlanan kısımları “…” ile göstererek birleştirir */
export const alintiMetni = (h: KtkHukum): string => h.parcalar.join(' … ');

/** Anahtardan hükmü getirir; bilinmeyen anahtar için undefined */
export function hukumGetir(anahtar: string): KtkHukum | undefined {
    return (KTK_HUKUMLERI as Readonly<Record<string, KtkHukum>>)[anahtar];
}

/** Gerekçelerdeki hükümleri tekrarsız ve kanun sırasına göre toplar */
export function hukumListesi(anahtarlar: readonly string[]): Array<{ anahtar: string; hukum: KtkHukum }> {
    const sira = Object.keys(KTK_HUKUMLERI);
    return [...new Set(anahtarlar)]
        .filter((a) => hukumGetir(a))
        .sort((x, y) => {
            const mx = parseInt(x, 10), my = parseInt(y, 10);
            return mx !== my ? mx - my : sira.indexOf(x) - sira.indexOf(y);
        })
        .map((anahtar) => ({ anahtar, hukum: hukumGetir(anahtar) as KtkHukum }));
}
