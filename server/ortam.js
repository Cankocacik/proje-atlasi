// Çalışma ortamı ayarları — tek yerden okunur.
//   ATLAS_ORTAM          yerel (PC, varsayılan) | sunucu
//   ATLAS_HOST           dışarıdan gelinen alan adı (ör. atlas.rosbelportal.com)
//   ATLAS_PORTAL_EPOSTA  girişi Rosbel portal kullanıcısıyla yap (yalnız bu e-posta kabul edilir)
//   ATLAS_PORTAL_GIRIS_URL  portal giriş ucu (varsayılan http://127.0.0.1:4000/api/auth/login)
//   ATLAS_PAROLA_HASH    portal yerine ayrı parola: `npm run parola` çıktısı
//   ATLAS_OTURUM_SIRRI   çerez imzası (en az 32 karakter); değiştirmek tüm oturumları kapatır
//   ATLAS_OTURUM_GUN     oturum süresi (gün, varsayılan 7)
//   GITHUB_TOKEN         salt-okur ince ayarlı token (repo yerelde yoksa commitler GitHub'dan)
export function ortamOku(env = process.env) {
  const ortam = env.ATLAS_ORTAM === "sunucu" ? "sunucu" : "yerel";
  return {
    ortam,
    host: (env.ATLAS_HOST ?? "").trim().toLowerCase() || null,
    portalEposta: env.ATLAS_PORTAL_EPOSTA?.trim().toLowerCase() || null,
    portalGirisUrl: env.ATLAS_PORTAL_GIRIS_URL?.trim() || "http://127.0.0.1:4000/api/auth/login",
    parolaOzeti: env.ATLAS_PAROLA_HASH?.trim() || null,
    oturumSirri: env.ATLAS_OTURUM_SIRRI?.trim() || null,
    oturumGun: Number(env.ATLAS_OTURUM_GUN ?? 7) || 7,
    githubToken: env.GITHUB_TOKEN?.trim() || null,
  };
}
