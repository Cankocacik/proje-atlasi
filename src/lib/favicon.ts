import type { GenelDurum } from "./durumOzeti";

const RENK: Record<GenelDurum, string> = { sorun: "#F67F65", not: "#F6AF65", temiz: "" };

/**
 * Sekme simgesi durumu taşır: sabitlenmiş sekmede sayfaya bakmadan sorun görülür.
 * Temizde vurgu rengi radar; sorunda kırmızı, notta turuncu nokta. Saf (test/favicon.test.ts).
 */
export function faviconSvg(durum: GenelDurum, vurgu: string): string {
  const v = /^#[0-9a-f]{3,8}$/i.test(vurgu) ? vurgu : "#C6F24E";
  const nokta = RENK[durum]
    ? `<circle cx='33' cy='9' r='8' fill='${RENK[durum]}' stroke='#07090D' stroke-width='3'/>`
    : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 42 42'><circle cx='21' cy='21' r='19' fill='#07090D' stroke='#2A3444' stroke-width='2'/><path d='M21 21 L21 2 A19 19 0 0 1 38 13 Z' fill='${v}' fill-opacity='.5'/><circle cx='21' cy='21' r='4' fill='${v}'/>${nokta}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
