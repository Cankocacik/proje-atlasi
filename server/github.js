// Repo bu makinede yoksa commitler GitHub REST API'den okunur.

export function githubCommitCevir(c) {
  return {
    hash: c.sha,
    kisa: c.sha.slice(0, 7),
    tarih: c.commit?.committer?.date ?? c.commit?.author?.date,
    mesaj: String(c.commit?.message ?? "").split("\n")[0],
  };
}

async function istek(yol, token) {
  const r = await fetch(`https://api.github.com${yol}`, {
    signal: AbortSignal.timeout(10000),
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "proje-atlasi",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

/** depo = "sahip/ad". Yerel git özetiyle aynı şekli döndürür (degisen/ileride bilinmez). */
export async function githubOzeti(depo, { dal = "main", token = null, gun = 21, simdi = Date.now() } = {}) {
  try {
    const since = new Date(simdi - gun * 86_400_000).toISOString();
    const q = (ek) => `/repos/${depo}/commits?sha=${encodeURIComponent(dal)}${ek}`;
    let liste = await istek(q(`&per_page=40&since=${since}`), token);
    const commitler = liste.map(githubCommitCevir);
    if (!commitler.length) liste = await istek(q("&per_page=1"), token);
    return {
      var: true,
      kaynak: "github",
      dal,
      son: liste[0] ? githubCommitCevir(liste[0]) : null,
      commitler,
      degisen: null,
      ileride: null,
      geride: null,
    };
  } catch (e) {
    return { var: false, kaynak: "github", hata: e.message };
  }
}
