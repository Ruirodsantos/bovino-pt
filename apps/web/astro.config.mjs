import { defineConfig } from "astro/config";
export default defineConfig({
  site: "https://theaipulsehub.com",
  base: "/bovino-pt",
  redirects: { "/aprender": "/bovino-pt/dados/", "/en/aprender": "/bovino-pt/en/dados/" },
  trailingSlash: "always",
  i18n: { defaultLocale: "pt", locales: ["pt", "en", "es"], routing: { prefixDefaultLocale: false } },
});
