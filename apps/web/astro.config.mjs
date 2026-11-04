import { defineConfig } from "astro/config";
export default defineConfig({
  site: "https://theaipulsehub.com",
  base: "/bovino-pt",
  redirects: {
    "/aprender": "/bovino-pt/dados/", "/en/aprender": "/bovino-pt/en/dados/",
    "/carne/01-carne-crua": "/bovino-pt/carne/cor/", "/carne/02-maturacao": "/bovino-pt/carne/maturacao/",
    "/carne/03-cortes": "/bovino-pt/carne/cortes/", "/carne/04-cozedura": "/bovino-pt/carne/pontos/", "/carne/05-servir": "/bovino-pt/carne/servir/",
  },
  trailingSlash: "always",
  i18n: { defaultLocale: "pt", locales: ["pt", "en", "es"], routing: { prefixDefaultLocale: false } },
});
