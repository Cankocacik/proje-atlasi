import { execFile } from "node:child_process";

/** git komutunu çalıştırır; başarısızsa null döner (repo yok, upstream yok vb.). */
function git(repo, args, zamanAsimi = 15000) {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-c", "core.quotepath=off", "-C", repo, ...args],
      { timeout: zamanAsimi, windowsHide: true, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
      (err, stdout) => resolve(err ? null : stdout.trim()),
    );
  });
}

/** Kapsam (dahil) ve hariç yollarından pathspec üretir; ikisi de boşsa tüm repo. */
export function pathspec(kapsam = [], haric = []) {
  if (!kapsam.length && !haric.length) return [];
  return ["--", ...(kapsam.length ? kapsam : ["."]), ...haric.map((h) => `:(exclude)${h}`)];
}

const AYRAC = "\x1f";

export function logSatirlariniAyristir(cikti) {
  if (!cikti) return [];
  return cikti
    .split("\n")
    .filter(Boolean)
    .map((satir) => {
      const [hash, kisa, tarih, mesaj] = satir.split(AYRAC);
      return { hash, kisa, tarih, mesaj };
    });
}

// Aynı repoyu paylaşan projeler (Rosbel + modüller) için fetch repo başına bir kez yapılır.
const sonFetch = new Map();

/** Uzaktaki dalı tazeler; `aralikMs` dolmadan tekrar etmez. Ağ yoksa sessizce geçer. */
export async function fetchGerekirse(repo, aralikMs) {
  const onceki = sonFetch.get(repo);
  if (onceki && Date.now() - onceki.zaman < aralikMs) return onceki.is;
  const is = git(repo, ["fetch", "--quiet", "--no-tags"], 60000);
  sonFetch.set(repo, { zaman: Date.now(), is });
  return is;
}

/**
 * Bir projenin git özeti.
 *  - yerel: akış HEAD'den (henüz push edilmemiş işler dahil)
 *  - sunucu: akış upstream'den (push edilmiş ama canlıya alınmamış işler dahil); HEAD = canlıdaki sürüm
 * `geride` = upstream'de olup HEAD'de olmayan commit (sunucuda "canlıya alınmadı").
 * Kapsamlı (alt klasör) projelerde push durumu repo geneline ait olduğu için hesaplanmaz.
 */
export async function gitOzeti(repo, { kapsam = [], haric = [], gun = 21, ortam = "yerel" } = {}) {
  const spec = pathspec(kapsam, haric);
  const bicim = `--format=%H${AYRAC}%h${AYRAC}%cI${AYRAC}%s`;
  const upstreamVar = (await git(repo, ["rev-parse", "--abbrev-ref", "@{u}"])) !== null;
  const ref = ortam === "sunucu" && upstreamVar ? "@{u}" : "HEAD";
  const [dal, son, commitler, durum, ileride, geride, canlida] = await Promise.all([
    git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]),
    git(repo, ["log", "-1", bicim, ref, ...spec]),
    git(repo, ["log", "-n", "40", `--since=${gun}.days`, bicim, ref, ...spec]),
    git(repo, ["status", "--porcelain", ...spec]),
    kapsam.length || !upstreamVar ? Promise.resolve(null) : git(repo, ["rev-list", "--count", "@{u}..HEAD"]),
    upstreamVar ? git(repo, ["rev-list", "--count", "HEAD..@{u}", ...spec]) : Promise.resolve(null),
    git(repo, ["rev-parse", "--short", "HEAD"]),
  ]);
  if (dal === null) return { var: false, kaynak: "git" };
  const sayi = (s) => (s === null || s === "" ? null : Number(s));

  // Geride kalan varsa: hangi commitler ve hangi dosyalar — yayın adımları bunlardan çıkarılır.
  let bekleyen = null;
  if (sayi(geride) > 0) {
    const [bLog, bDosya] = await Promise.all([
      git(repo, ["log", "-n", "20", bicim, "HEAD..@{u}", ...spec]),
      git(repo, ["diff", "--name-only", "HEAD", "@{u}", ...spec]),
    ]);
    bekleyen = {
      commitler: logSatirlariniAyristir(bLog),
      dosyalar: bDosya ? bDosya.split("\n").filter(Boolean).slice(0, 2000) : [],
    };
  }

  return {
    var: true,
    kaynak: "git",
    dal,
    son: logSatirlariniAyristir(son)[0] ?? null,
    commitler: logSatirlariniAyristir(commitler),
    degisen: durum ? durum.split("\n").filter(Boolean).length : 0,
    ileride: sayi(ileride),
    geride: sayi(geride),
    canlida,
    bekleyen,
  };
}
