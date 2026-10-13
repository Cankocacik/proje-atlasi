export type Durum = "live" | "dev" | "warn" | "idle";
export type Asama = "fikir" | "gelistirme" | "bekliyor" | "canli" | "beklemede";
export type Ikon = "hub" | "product" | "tool" | "client" | "module";

export interface Commit {
  hash: string;
  kisa: string;
  tarih: string;
  mesaj: string;
  projeId?: string;
}

export interface Uyari {
  metin: string;
  kaynak: "elle" | "git" | "saglik" | "pm2" | "denetim";
  seviye: "orta" | "yuksek";
  /** Elle uyarının eklendiği gün (YYYY-AA-GG). */
  tarih?: string;
}

export interface ManifestSorunu {
  seviye: "hata" | "uyari";
  yer: string;
  mesaj: string;
}

export interface Proje {
  id: string;
  ad: string;
  tur: string;
  ikon: Ikon;
  kart?: boolean;
  ust?: string;
  asama: Asama;
  asamaSira: number;
  konum: { x: number; y: number; w?: number };
  repo?: string;
  kapsam?: string[];
  surum?: string;
  url?: string;
  aciklama?: string;
  durum: Durum;
  uyarilar: Uyari[];
  github?: string;
  pm2?: string[];
  surecler?: string[];
  atlasKendisi?: boolean;
  saglikGecmisi?: SaglikGecmisi | null;
  git: {
    var: boolean;
    kaynak?: "git" | "github";
    hata?: string;
    dal?: string;
    son?: Commit | null;
    degisen?: number | null;
    ileride?: number | null;
    geride?: number | null;
    canlida?: string | null;
    bekleyen?: Bekleyen | null;
  } | null;
  saglik: { ok: boolean; kod: number | null; ms: number | null; hata?: string } | null;
}

export interface Adim {
  id: string;
  metin: string;
  etiket: "engel" | "sirada" | string;
  projeId: string;
  tamam: boolean;
}

export interface Akis {
  kaynak: string;
  hedef: string;
  etiket?: string;
}

export interface Surec {
  ad: string;
  id: number;
  durum: string;
  calismaSn: number;
  yenidenBaslama: number;
  sonSaatYenidenBaslama: number;
  hata15: number;
  bellekMb: number | null;
  cpu: number | null;
}

export interface LogSatiri {
  zaman: string;
  akim: "out" | "err";
  hata: boolean;
  metin: string;
  /** Atlas açılmadan önce dosyada olan satır: zamanı bilinmiyor. */
  gecmis?: boolean;
}

export type Ortam = "yerel" | "sunucu";

export interface Anlik {
  zaman: string;
  ortam: Ortam;
  surecler: Surec[] | null;
  gorunum: { vurgu?: string; radar?: boolean };
  harita: { genislik: number; yukseklik: number };
  akislar: Akis[];
  projeler: Proje[];
  akis: Commit[];
  hafta: { tarih: string; gun: string; sayi: number; bugun: boolean }[];
  adimlar: Adim[];
  manifestHatasi?: string | null;
  manifestSorunlari?: ManifestSorunu[];
  atlas?: AtlasBilgi | null;
  denetim?: Denetim | null;
  olaylar?: Olay[];
}

/** Son 24 saatin 30'ar dakikalık kutuları: ok · kismi (bazısı düştü) · hata · null (veri yok). */
export interface SaglikGecmisi {
  yuzde: number | null;
  ortalamaMs: number | null;
  ornek: number;
  kutular: ("ok" | "kismi" | "hata" | null)[];
}

export interface Olay {
  id: number;
  zaman: string;
  seviye: "hata" | "uyari" | "iyi" | "bilgi";
  tur: string;
  projeId?: string;
  metin: string;
}

export interface DenetimSonucu {
  ad: string;
  durum: "ok" | "uyari" | "hata" | "atla";
  mesaj: string;
  cozum?: string;
}

export interface Denetim {
  zaman: string;
  sonuclar: DenetimSonucu[];
  ozet: { ok: number; uyari: number; hata: number; atla: number };
}

export interface AtlasBilgi {
  commit: string | null;
  tarih: string | null;
  mesaj: string | null;
  derleme: string | null;
  derlemeEski: boolean;
  node: string;
  baslangic: string;
}

export interface YayinAdimi {
  adim: string;
  not?: string;
  /** Komut değil bilgi satırı (kopyalanmaz). */
  bilgi?: boolean;
  dosya: number;
  ornek: string[];
}

/** Uzakta olup bu kopyada olmayan iş: sunucuda "canlıya bekleyen", PC'de "çekilmemiş". */
export interface Bekleyen {
  commitler: Commit[];
  dosyaSayisi: number;
  adimlar: YayinAdimi[];
}
