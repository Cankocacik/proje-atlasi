// Çalışma ortamı ayarları — tek yerden okunur.
//   ATLAS_ORTAM          yerel (PC, varsayılan) | sunucu
//   ATLAS_HOST           dışarıdan gelinen alan adı (ör. atlas.rosbelportal.com)
//   ATLAS_PAROLA_HASH    `npm run parola` çıktısı; uzak erişimde zorunlu
//   ATLAS_OTURUM_SIRRI   çerez imzası (en az 32 karakter); değiştirmek tüm oturumları kapatır
//   ATLAS_OTURUM_GUN     oturum süresi (gün, varsayılan 7)
//   GITHUB_TOKEN         salt-okur ince ayarlı token (repo yerelde yoksa commitler GitHub'dan)
export function ortamOku(env = process.env) {
  const ortam = env.ATLAS_ORTAM === "sunucu" ? "sunucu" : "yerel";
  return {
    ortam,
    host: (env.ATLAS_HOST ?? "").trim().toLowerCase() || null,
    parolaOzeti: env.ATLAS_PAROLA_HASH?.trim() || null,
    oturumSirri: env.ATLAS_OTURUM_SIRRI?.trim() || null,
    oturumGun: Number(env.ATLAS_OTURUM_GUN ?? 7) || 7,
    githubToken: env.GITHUB_TOKEN?.trim() || null,
  };
}
