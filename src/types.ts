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
  kaynak: "elle" | "git" | "saglik" | "pm2";
  seviye: "orta" | "yuksek";
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
}
