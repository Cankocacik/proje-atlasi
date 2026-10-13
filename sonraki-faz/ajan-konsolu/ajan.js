// Claude Code / Codex CLI için komut kurma ve çıktı ayrıştırma.
// Saf fonksiyonlar (test/ajan.test.js); süreç yönetimi gorevler.js'te.
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export const AJANLAR = ["claude", "codex"];
export const YETKILER = ["oku", "yaz"];

/** codex.cmd bir kabuk sarmalayıcısı; doğrudan node + codex.js çalıştırılır (kabuk = tırnak derdi yok). */
export function codexGirisi(yolDegiskeni = process.env.PATH ?? "") {
  for (const dizin of yolDegiskeni.split(delimiter)) {
    if (!dizin) continue;
    const js = join(dizin, "node_modules", "@openai", "codex", "bin", "codex.js");
    if (existsSync(join(dizin, "codex.cmd")) && existsSync(js)) return js;
  }
  return null;
}

/**
 * Arka plan (başsız) çalıştırma komutu. İstem komut satırına DEĞİL stdin'e
 * yazılır — böylece kullanıcının metni hiçbir kabuk/tırnak kuralına girmez.
 *   oku → Claude "plan" (dosyaya dokunmaz), Codex "read-only" kum havuzu
 *   yaz → Claude "acceptEdits" (dosya düzenler; komut çalıştırma izni yok), Codex "workspace-write"
 */
export function basliksizKomut({ ajan, yetki, oturum }, codexJs = codexGirisi()) {
  if (!YETKILER.includes(yetki)) throw new Error(`geçersiz yetki: ${yetki}`);
  if (ajan === "claude") {
    return {
      komut: "claude",
      args: [
        "-p", "--output-format", "stream-json", "--verbose",
        "--permission-mode", yetki === "yaz" ? "acceptEdits" : "plan",
        ...(oturum ? ["--resume", oturum] : []),
      ],
    };
  }
  if (ajan === "codex") {
    if (!codexJs) throw new Error("codex bulunamadı (PATH'te codex.cmd yok)");
    return {
      komut: process.execPath,
      args: [codexJs, "exec", "--json", "--skip-git-repo-check", "-s", yetki === "yaz" ? "workspace-write" : "read-only", "-"],
    };
  }
  throw new Error(`bilinmeyen ajan: ${ajan}`);
}

/** Windows Terminal ';' karakterini alt komut ayırıcı sayar; kaçırılmalı. Satır sonları tek satıra iner. */
export function wtKacir(metin) {
  return metin.replace(/\r?\n+/g, " ").replace(/;/g, "\\;");
}

/** Etkileşimli oturumu yeni Windows Terminal sekmesinde açan wt argümanları. */
export function terminalArgumanlari({ ajan, repo, baslik, istem, oturum }, codexJs = codexGirisi()) {
  const args = ["-w", "0", "nt", "-d", repo, "--title", wtKacir(baslik)];
  if (ajan === "claude") {
    args.push("claude");
    if (oturum) args.push("--resume", oturum);
    if (istem) args.push(wtKacir(istem));
  } else if (ajan === "codex") {
    if (!codexJs) throw new Error("codex bulunamadı (PATH'te codex.cmd yok)");
    args.push(process.execPath, codexJs);
    if (istem) args.push(wtKacir(istem));
  } else {
    throw new Error(`bilinmeyen ajan: ${ajan}`);
  }
  return args;
}

const KISA = 4000;
const kirp = (s, n = KISA) => (s.length > n ? `${s.slice(0, n)}…` : s);

function aracOzeti(ad, girdi = {}) {
  const hedef = girdi.file_path ?? girdi.path ?? girdi.command ?? girdi.pattern ?? girdi.url ?? girdi.query ?? girdi.description;
  return hedef ? `${ad} · ${kirp(String(hedef), 300)}` : ad;
}

/**
 * Claude stream-json satırı → { olaylar, oturum?, sonuc? }.
 * olay: { tur: "metin" | "arac" | "sonuc" | "hata" | "bilgi", metin }
 */
export function claudeSatiri(o) {
  const cikti = { olaylar: [] };
  if (o.type === "system" && o.subtype === "init") {
    cikti.oturum = o.session_id;
    cikti.olaylar.push({ tur: "bilgi", metin: `Oturum açıldı · ${o.model ?? "model ?"}` });
  } else if (o.type === "assistant") {
    for (const p of o.message?.content ?? []) {
      if (p.type === "text" && p.text?.trim()) cikti.olaylar.push({ tur: "metin", metin: kirp(p.text.trim()) });
      if (p.type === "tool_use") cikti.olaylar.push({ tur: "arac", metin: aracOzeti(p.name, p.input) });
    }
  } else if (o.type === "user") {
    for (const p of o.message?.content ?? []) {
      if (p.type === "tool_result" && p.is_error) {
        const icerik = Array.isArray(p.content) ? p.content.map((x) => x.text ?? "").join(" ") : String(p.content ?? "");
        cikti.olaylar.push({ tur: "hata", metin: kirp(icerik.trim() || "araç hatası", 600) });
      }
    }
  } else if (o.type === "result") {
    cikti.oturum = o.session_id;
    cikti.sonuc = {
      hata: Boolean(o.is_error) || o.subtype !== "success",
      metin: typeof o.result === "string" ? o.result : "",
      maliyet: o.total_cost_usd ?? null,
      sureMs: o.duration_ms ?? null,
      tur: o.num_turns ?? null,
    };
    if (cikti.sonuc.hata) cikti.olaylar.push({ tur: "hata", metin: kirp(cikti.sonuc.metin || o.subtype || "çalışma hatayla bitti") });
  }
  return cikti;
}

/** Codex exec --json satırı → { olaylar, oturum?, sonuc? }. Sürümler arası alan farkına toleranslı. */
export function codexSatiri(o) {
  const cikti = { olaylar: [] };
  const tip = o.type ?? o.msg?.type;
  if (tip === "thread.started") {
    cikti.oturum = o.thread_id;
    cikti.olaylar.push({ tur: "bilgi", metin: "Oturum açıldı · codex" });
  } else if (tip === "item.started" && o.item?.type === "command_execution") {
    cikti.olaylar.push({ tur: "arac", metin: `Komut · ${kirp(String(o.item.command ?? ""), 300)}` });
  } else if (tip === "item.completed" && o.item) {
    const it = o.item;
    if (it.type === "agent_message" && it.text?.trim()) {
      cikti.olaylar.push({ tur: "metin", metin: kirp(it.text.trim()) });
      cikti.sonMesaj = it.text.trim();
    } else if (it.type === "file_change") {
      const dosyalar = (it.changes ?? []).map((c) => `${c.kind ?? "değişti"} ${c.path}`).join(", ");
      cikti.olaylar.push({ tur: "arac", metin: `Dosya · ${kirp(dosyalar || "değişiklik", 300)}` });
    } else if (it.type === "command_execution" && it.exit_code && it.exit_code !== 0) {
      cikti.olaylar.push({ tur: "hata", metin: `Komut ${it.exit_code} koduyla bitti: ${kirp(String(it.command ?? ""), 200)}` });
    } else if (it.type === "error") {
      cikti.olaylar.push({ tur: "hata", metin: kirp(String(it.message ?? "hata")) });
    }
  } else if (tip === "turn.failed" || tip === "error") {
    cikti.olaylar.push({ tur: "hata", metin: kirp(String(o.error?.message ?? o.message ?? "hata")) });
    cikti.sonuc = { hata: true, metin: String(o.error?.message ?? o.message ?? "") };
  } else if (tip === "turn.completed") {
    cikti.sonuc = { hata: false, metin: "", girdiToken: o.usage?.input_tokens ?? null, ciktiToken: o.usage?.output_tokens ?? null };
  }
  return cikti;
}

/** Satır akışını tamponlar: parça parça gelen stdout'tan tam satırlar çıkarır. */
export function satirTamponu(geriCagir) {
  let artik = "";
  return {
    ekle(parca) {
      artik += parca;
      const satirlar = artik.split(/\r?\n/);
      artik = satirlar.pop() ?? "";
      for (const s of satirlar) if (s.trim()) geriCagir(s);
    },
    bitir() {
      if (artik.trim()) geriCagir(artik);
      artik = "";
    },
  };
}
