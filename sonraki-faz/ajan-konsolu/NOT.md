# Ajan konsolu — sonraki faz (park edildi, 2026-10-13)

Panelden Claude Code / Codex çalıştırma denemesi. Kullanıcı kararıyla ilk fazda
Proje Atlası yalnız izleme yapar; bu dosyalar HİÇBİR yerden içe aktarılmaz.

- `ajan.js` — komut kurma (istem stdin'den, kabuk yok), stream-json / codex --json ayrıştırıcıları, wt argümanları
- `gorevler.js` — süreç başlatma/durdurma (taskkill /T), olay geçmişi `data/gorevler.json`

Devreye alırken: önce "yalnız Terminalde aç" mı, arka plan çalıştırma mı — karar kullanıcıda.
Sunucuda (uzak erişim) çalışacaksa arka plan çalıştırma ayrıca erişim kararı ister.
