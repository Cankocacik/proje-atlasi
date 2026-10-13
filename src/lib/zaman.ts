/** Takvim günü farkı (saat değil): dün 23:59 ile bugün 00:01 arası 1 gündür. */
export function gunFarki(iso: string, simdi: Date): number {
  const d = new Date(iso);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function goreli(iso: string | null | undefined, simdi: Date): string {
  if (!iso) return "kayıt yok";
  const n = gunFarki(iso, simdi);
  if (n <= 0) {
    const dk = Math.max(0, Math.round((simdi.getTime() - new Date(iso).getTime()) / 60_000));
    if (dk < 1) return "az önce";
    if (dk < 60) return `${dk} dk önce`;
    return `${Math.floor(dk / 60)} sa önce`;
  }
  if (n === 1) return "dün";
  return `${n} gün önce`;
}

export function tarihSaat(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
