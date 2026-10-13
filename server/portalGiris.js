// Atlas parolası = Rosbel portalındaki tek bir kullanıcının parolası.
// Parola portalın kendi giriş ucuna sorulur (aynı sunucuda, loopback); doğruysa
// portalın verdiği jetonun e-postası izinli e-postayla eşleşmeli. Portal oturumu
// açık bırakılmaz: jeton hemen /logout ile iptal edilir.

/** JWT yükünü imza doğrulamadan okur — jeton doğrudan portalın kendisinden geldiği için yeterli. */
export function jwtYuku(jeton) {
  try {
    return JSON.parse(Buffer.from(String(jeton).split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Sonuç: { ok: true } | { ok: false, neden: "parola" | "kullanici" | "portal", kod? }
 *  parola    → portal 401 (yanlış parola / pasif hesap)
 *  kullanici → parola doğru ama başka bir kullanıcının (izinli e-posta değil)
 *  portal    → portal yanıt vermedi / 429 / 5xx
 */
export async function portalGirisi({ url, eposta, parola, fetchFn = fetch }) {
  let r;
  try {
    r = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: eposta, password: parola }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { ok: false, neden: "portal", kod: e?.cause?.code ?? e?.name ?? "ağ hatası" };
  }
  if (r.status === 401 || r.status === 403) return { ok: false, neden: "parola" };
  if (!r.ok) return { ok: false, neden: "portal", kod: r.status };

  const veri = await r.json().catch(() => ({}));
  const yuk = veri.token ? jwtYuku(veri.token) : null;
  if (!yuk) return { ok: false, neden: "portal", kod: "jeton yok" };

  // Portal oturumunu kapat (yanıtı beklenmez; başarısız olsa da jeton zaten kullanılmıyor).
  fetchFn(url.replace(/\/login\/?$/, "/logout"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${veri.token}` },
    body: "{}",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});

  if (String(yuk.email ?? "").trim().toLowerCase() !== eposta.trim().toLowerCase()) {
    return { ok: false, neden: "kullanici" };
  }
  return { ok: true };
}
