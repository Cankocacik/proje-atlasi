import { describe, expect, it } from "vitest";
import { kisici, mesajMetni, telegramAyari, telegramGonder, telegramSohbetleri } from "../server/telegram.js";
import { bildirilir } from "../server/bildirim.js";

describe("telegramAyari", () => {
  it("token ve sohbet ikisi de varsa açık, biri eksikse kapalı", () => {
    expect(telegramAyari({})).toBeNull();
    expect(telegramAyari({ ATLAS_TELEGRAM_TOKEN: "t" })).toBeNull();
    expect(telegramAyari({ ATLAS_TELEGRAM_TOKEN: " t ", ATLAS_TELEGRAM_SOHBET: " 42 " })).toEqual({ token: "t", sohbet: "42" });
  });
});

describe("bildirilir (tek kaynak)", () => {
  it("düşüş ve geri gelişler; commit/yayın/açılış değil", () => {
    expect(bildirilir({ seviye: "hata", tur: "site" })).toBe(true);
    expect(bildirilir({ seviye: "iyi", tur: "icsaglik" })).toBe(true);
    expect(bildirilir({ seviye: "iyi", tur: "denetim" })).toBe(true);
    expect(bildirilir({ seviye: "iyi", tur: "yayin" })).toBe(false);
    expect(bildirilir({ seviye: "bilgi", tur: "atlas" })).toBe(false);
    expect(bildirilir({ seviye: "uyari", tur: "surec" })).toBe(false);
  });
});

describe("mesajMetni", () => {
  it("olayları tek mesajda toplar, sorun sayısını başlığa yazar, adresi ekler", () => {
    const m = mesajMetni(
      [{ seviye: "hata", metin: "ORMO Gümrük: site yanıt vermiyor (530)" }, { seviye: "iyi", metin: "siparis-backend yeniden çalışıyor" }],
      { host: "atlas.rosbelportal.com" },
    );
    expect(m).toBe("Proje Atlası — 1 sorun\n\n✗ ORMO Gümrük: site yanıt vermiyor (530)\n✓ siparis-backend yeniden çalışıyor\n\nhttps://atlas.rosbelportal.com");
  });
});

describe("kisici", () => {
  it("saatte sınırı aşınca bastırır ve bastırılanı bir kez söyler", () => {
    const k = kisici(2, 1000);
    expect([k.izinli(0), k.izinli(1), k.izinli(2), k.izinli(3)]).toEqual([true, true, false, false]);
    expect(k.izinli(1001)).toBe(true);
    expect(k.bastirilaniAl()).toBe(2);
    expect(k.bastirilaniAl()).toBe(0);
  });
});

describe("Telegram API çağrıları (sahte fetch)", () => {
  it("sendMessage gövdesi; hata açıklaması iletilir", async () => {
    let cagri = null;
    await telegramGonder({ token: "T", sohbet: "42" }, "merhaba", async (url, s) => {
      cagri = { url, govde: JSON.parse(s.body) };
      return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }) };
    });
    expect(cagri.url).toBe("https://api.telegram.org/botT/sendMessage");
    expect(cagri.govde).toEqual({ chat_id: "42", text: "merhaba", disable_web_page_preview: true });
    await expect(telegramGonder({ token: "T", sohbet: "1" }, "x", async () => ({ ok: false, status: 400, json: async () => ({ ok: false, description: "Bad Request: chat not found" }) })))
      .rejects.toThrow("Telegram 400: Bad Request: chat not found");
  });

  it("getUpdates'ten tekil sohbet listesi çıkarır", async () => {
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: [
      { message: { chat: { id: 7, first_name: "Muhammed", type: "private" } } },
      { message: { chat: { id: 7, first_name: "Muhammed", type: "private" } } },
      { message: { chat: { id: -100, title: "Rosbel ops", type: "group" } } },
    ] }) });
    expect(await telegramSohbetleri("T", fetchFn)).toEqual([
      { id: 7, ad: "Muhammed", tur: "private" },
      { id: -100, ad: "Rosbel ops", tur: "group" },
    ]);
  });
});
