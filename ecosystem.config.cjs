// Sunucuda pm2 ile çalıştırma: `pm2 start ecosystem.config.cjs && pm2 save`
// Gizli değerler (parola özeti, oturum sırrı, GitHub token) burada DEĞİL, .env'de.
module.exports = {
  apps: [
    {
      name: "proje-atlasi",
      script: "server/index.js",
      cwd: __dirname,
      interpreter: "node",
      env: {
        ATLAS_ORTAM: "sunucu",
        ATLAS_HOST: "atlas.rosbelportal.com",
        PORT: "4321",
      },
      max_memory_restart: "300M",
      time: true,
    },
  ],
};
