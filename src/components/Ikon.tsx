import type { Ikon as IkonTur } from "../types";

const ORTAK = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function ProjeIkon({ tur, boyut = 20 }: { tur: IkonTur; boyut?: number }) {
  const p = { width: boyut, height: boyut, viewBox: "0 0 24 24", "aria-hidden": true, ...ORTAK };
  switch (tur) {
    case "hub":
      return <svg {...p}><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
    case "product":
      return <svg {...p}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></svg>;
    case "tool":
      return <svg {...p}><path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.5-6.5M14.5 6.5L13 5 5 13l3 3" /></svg>;
    case "client":
      return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="9" strokeDasharray="2 3" /></svg>;
  }
}

type SvgAd = "ev" | "harita" | "hat" | "nabiz" | "liste" | "yenile" | "arti" | "eksi" | "uyari" | "kod" | "dis" | "ara" | "klasor" | "gorev" | "zil" | "kalkan" | "indir";

export function Svg({ ad, boyut = 18 }: { ad: SvgAd; boyut?: number }) {
  const p = { width: boyut, height: boyut, viewBox: "0 0 24 24", "aria-hidden": true, ...ORTAK, strokeWidth: 1.8 };
  switch (ad) {
    case "zil":
      return <svg {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
    case "kalkan":
      return <svg {...p}><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "indir":
      return <svg {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
    case "ara":
      return <svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>;
    case "klasor":
      return <svg {...p}><path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>;
    case "gorev":
      return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 12 3 3 7-7" /></svg>;
    case "ev":
      return <svg {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
    case "harita":
      return <svg {...p}><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="M11 7.2L6.2 15.8M13 7.2l4.8 8.6M7.5 18h9" /></svg>;
    case "hat":
      return <svg {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>;
    case "nabiz":
      return <svg {...p}><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>;
    case "liste":
      return <svg {...p}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>;
    case "yenile":
      return <svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>;
    case "arti":
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "eksi":
      return <svg {...p}><path d="M5 12h14" /></svg>;
    case "uyari":
      return <svg {...p}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4" /><path d="M12 17.5v.01" /></svg>;
    case "kod":
      return <svg {...p}><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg>;
    case "dis":
      return <svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
  }
}

export function RadarLogo({ boyut = 38 }: { boyut?: number }) {
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 42 42" fill="none" aria-hidden="true">
      <circle cx="21" cy="21" r="11" stroke="var(--acc)" strokeWidth="1.7" />
      <ellipse cx="21" cy="21" rx="21" ry="7" transform="rotate(-32 21 21)" stroke="var(--acc)" strokeWidth="1.7" />
      <circle cx="34" cy="10" r="2.5" fill="var(--acc)" />
    </svg>
  );
}
