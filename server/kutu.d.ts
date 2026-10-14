export interface Kutu {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const KART_YUKSEKLIK: number;
export const HUB_YUKSEKLIK: number;

export function kutuBul(p: { kart?: boolean; ikon: string; konum: { x: number; y: number; w?: number } }): Kutu;
