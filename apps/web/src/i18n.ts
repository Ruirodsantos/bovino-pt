// Site languages: Portuguese (default, no URL prefix) and English (/en/).
export type Lang = "pt" | "en";
export const BASE: string = import.meta.env.BASE_URL;
export const LANGS: Lang[] = ["pt", "en"];

export function langOf(url: URL): Lang {
  return url.pathname.startsWith(`${BASE}en/`) ? "en" : "pt";
}
/** URL prefix of a language, e.g. "/bovino-pt/" or "/bovino-pt/en/". */
export const prefix = (lang: Lang): string => BASE + (lang === "en" ? "en/" : "");
/** Link to a path ("racas/", "racas/mirandesa/") inside the given language. */
export const href = (lang: Lang, path = ""): string => prefix(lang) + path;
/** Same page in another language. */
export function switchTo(url: URL, from: Lang, to: Lang): string {
  return prefix(to) + url.pathname.slice(prefix(from).length);
}
export const tr = (lang: Lang) => (pt: string, en: string): string => (lang === "en" ? en : pt);
export const locale = (lang: Lang): string => (lang === "en" ? "en-GB" : "pt-PT");
export const htmlLang = (lang: Lang): string => (lang === "en" ? "en-GB" : "pt-PT");

const LICENSES_EN: Record<string, string> = { "Licença Pexels": "Pexels licence", "Licença Unsplash": "Unsplash licence", "Domínio público": "Public domain" };
export const licenseLabel = (lang: Lang, s: string): string => (lang === "en" ? LICENSES_EN[s] ?? s : s);
