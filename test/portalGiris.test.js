import { describe, expect, it } from "vitest";
import { jwtYuku, portalGirisi } from "../server/portalGiris.js";

const URL_ = "http://127.0.0.1:4000/api/auth/login";
const jeton = (yuk) => `h.${Buffer.from(JSON.stringify(yuk)).toString("base64url")}.imza`;

/** Sahte fetch: giriş yanıtını verir, yapılan çağrıları kaydeder. */
function sahte(girisYaniti) {
  const cagrilar = [];
  const fetchFn = async (url, secenek) => {
    cagrilar.push({ url, secenek });
    if (url.endsWith("/logout")) return { ok: true, status: 200, json: async () => ({}) };
    if (girisYaniti instanceof Error) throw girisYaniti;
    return { ok: girisYaniti.status < 400, status: girisYaniti.status, json: async () => girisYaniti.govde ?? {} };
  };
  return { fetchFn, cagrilar };
}

describe("portalGirisi", () => {
  it("doğru parola + izinli e-posta → ok; portal jetonu hemen /logout ile kapatılır", async () => {
    const { fetchFn, cagrilar } = sahte({ status: 200, govde: { token: jeton({ email: "Muhammed@RosbelTR.com", sid: "x" }) } });
    expect(await portalGirisi({ url: URL_, eposta: "muhammed@rosbeltr.com", parola: "p", fetchFn })).toEqual({ ok: true });
    expect(JSON.parse(cagrilar[0].secenek.body)).toEqual({ email: "muhammed@rosbeltr.com", password: "p" });
    expect(cagrilar[1].url).toBe("http://127.0.0.1:4000/api/auth/logout");
    expect(cagrilar[1].secenek.headers.authorization).toMatch(/^Bearer h\./);
  });

  it("portal 401 → parola yanlış", async () => {
    const { fetchFn } = sahte({ status: 401 });
    expect(await portalGirisi({ url: URL_, eposta: "a@b.c", parola: "x", fetchFn })).toEqual({ ok: false, neden: "parola" });
  });

  it("başka kullanıcının jetonu (ör. test rolü) reddedilir ama yine de kapatılır", async () => {
    const { fetchFn, cagrilar } = sahte({ status: 200, govde: { token: jeton({ email: "test@x.com" }) } });
    expect(await portalGirisi({ url: URL_, eposta: "muhammed@rosbeltr.com", parola: "p", fetchFn })).toEqual({ ok: false, neden: "kullanici" });
    expect(cagrilar.some((c) => c.url.endsWith("/logout"))).toBe(true);
  });

  it("portal kapalı, 429 ya da jetonsuz yanıt → portal hatası (parola yanlış sayılmaz)", async () => {
    const e = Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    expect(await portalGirisi({ url: URL_, eposta: "a@b.c", parola: "p", fetchFn: sahte(e).fetchFn })).toEqual({ ok: false, neden: "portal", kod: "ECONNREFUSED" });
    expect((await portalGirisi({ url: URL_, eposta: "a@b.c", parola: "p", fetchFn: sahte({ status: 429 }).fetchFn })).neden).toBe("portal");
    expect((await portalGirisi({ url: URL_, eposta: "a@b.c", parola: "p", fetchFn: sahte({ status: 200, govde: {} }).fetchFn })).neden).toBe("portal");
  });

  it("jwtYuku bozuk jetonda null döner", () => {
    expect(jwtYuku("bozuk")).toBeNull();
    expect(jwtYuku(jeton({ email: "a" }))).toEqual({ email: "a" });
  });
});
