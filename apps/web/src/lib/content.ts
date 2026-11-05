import { getCollection, getEntry } from "astro:content";
import { chain, type Lang } from "../i18n";
const nm = (name: string, l: Lang) => (l === "pt" ? name : `${name}_${l}`);
/** Collection merged by id along the fallback chain (es/fr → en → pt): translated entries win. */
export async function coll(name: string, lang: Lang): Promise<any[]> {
  const out = new Map<string, any>();
  for (const l of [...chain(lang)].reverse()) {
    for (const e of await getCollection(nm(name, l) as any)) out.set(e.id, e);
  }
  return [...out.values()];
}
export async function entryL(name: string, id: string, lang: Lang): Promise<any | undefined> {
  for (const l of chain(lang)) { const e = await getEntry(nm(name, l) as any, id); if (e) return e; }
  return undefined;
}
