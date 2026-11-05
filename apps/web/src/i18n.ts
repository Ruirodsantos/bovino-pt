// Site languages: Portuguese (default, no URL prefix), English (/en/), Spanish (/es/), French (/fr/).
export type Lang = "pt" | "en" | "es" | "fr";
export const BASE: string = import.meta.env.BASE_URL;
export const LANGS: Lang[] = ["pt", "en", "es", "fr"];
export const OTHER_LANGS: Lang[] = ["en", "es", "fr"];
export const LANG_NAME: Record<Lang, string> = { pt: "Português", en: "English", es: "Español", fr: "Français" };

export function langOf(url: URL): Lang {
  for (const l of OTHER_LANGS) if (url.pathname.startsWith(`${BASE}${l}/`)) return l;
  return "pt";
}
/** URL prefix of a language, e.g. "/bovino-pt/" or "/bovino-pt/es/". */
export const prefix = (lang: Lang): string => BASE + (lang === "pt" ? "" : `${lang}/`);
/** Link to a path ("racas/", "racas/mirandesa/") inside the given language. */
export const href = (lang: Lang, path = ""): string => prefix(lang) + path;
/** Same page in another language. */
export function switchTo(url: URL, from: Lang, to: Lang): string {
  return prefix(to) + url.pathname.slice(prefix(from).length);
}
/** T(pt, en, es?, fr?) — Spanish/French fall back to English when a string has no translation yet. */
export const tr = (lang: Lang) => (pt: string, en: string, es?: string, fr?: string): string =>
  lang === "pt" ? pt : lang === "es" ? (es ?? en) : lang === "fr" ? (fr ?? en) : en;
const LOC: Record<Lang, string> = { pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" };
export const locale = (lang: Lang): string => LOC[lang];
export const htmlLang = (lang: Lang): string => LOC[lang];
export const ogLocale = (lang: Lang): string => LOC[lang].replace("-", "_");
/** Non-Portuguese content falls back along this chain: es/fr → en → pt. */
export const chain = (lang: Lang): Lang[] => (lang === "pt" ? ["pt"] : lang === "en" ? ["en", "pt"] : [lang, "en", "pt"]);

const LICENSES: Record<string, [string, string, string]> = {
  "Licença Pexels": ["Pexels licence", "Licencia Pexels", "Licence Pexels"],
  "Licença Unsplash": ["Unsplash licence", "Licencia Unsplash", "Licence Unsplash"],
  "Domínio público": ["Public domain", "Dominio público", "Domaine public"],
};
export const licenseLabel = (lang: Lang, s: string): string => {
  const e = LICENSES[s]; if (!e || lang === "pt") return s;
  return lang === "en" ? e[0] : lang === "es" ? e[1] : e[2];
};
/** Localised field of a data object: key_<lang> → key_en → key. */
export const lf = (o: any, key: string, lang: Lang): any => (lang === "pt" || !o ? o?.[key] : (o[`${key}_${lang}`] ?? o[`${key}_en`] ?? o[key]));
/** Image credit record with alt/caption localised. */
export const locImg = (c: any, lang: Lang): any => (c && lang !== "pt" ? { ...c, alt: lf(c, "alt", lang), caption: lf(c, "caption", lang) } : c);
