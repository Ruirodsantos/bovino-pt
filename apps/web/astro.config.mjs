import { defineConfig } from "astro/config";
export default defineConfig({
  site: "https://ruirodsantos.github.io",
  base: "/bovino-pt",
  trailingSlash: "always",
  i18n: { defaultLocale: "pt", locales: ["pt", "en", "es"], routing: { prefixDefaultLocale: false } },
});
