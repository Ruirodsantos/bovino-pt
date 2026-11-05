import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { Lang } from "../i18n";
import { locale } from "../i18n";

const ROOT = path.resolve(process.cwd(), "../..");
const PUBLIC_DATA = path.resolve(process.cwd(), "public/data");

export type Footnote = { source: string; source_code: string; dataset: string; period: string; period_en?: string; published: string | null; verified: string };
export type Stat = { id: string; label: string; label_en?: string; value: number; unit: string; context: string; context_en?: string; change?: number | null; change_ref?: string | null; change_ref_en?: string | null; footnote: Footnote };
export type CatalogItem = { id: string; title_pt: string; title_en?: string; state: string; rows?: number; first_period?: string; last_period?: string; publication_date?: string; retrieved_at?: string; source_code?: string };
export type Summary = { stats: Stat[]; catalog: CatalogItem[]; last_run: { finished_at: string; datasets: { dataset: string; state: string; rows?: number; last_period?: string }[] } | null };

export function summary(): Summary {
  const f = path.join(PUBLIC_DATA, "summary.json");
  if (!fs.existsSync(f)) return { stats: [], catalog: [], last_run: null };
  return JSON.parse(fs.readFileSync(f, "utf-8"));
}

export function hasDataset(id: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DATA, `${id}.json`));
}

export type Herd = { year: number; males: number; females: number; breeders: number; source_page: number };
export type Breed = { slug: string; official_name: string; status: string; status_reason?: string; region?: string | null;
  herd?: Herd; solar?: string; solar_quote?: string; lat?: number; lon?: number; photo?: string; photo_kind?: "raça" | "solar" | "paisagem"; catalogue_page?: number; name_sources?: { url: string }[]; last_verified?: string; fields: Record<string, { value: unknown; source_id: string | null; verified_at: string | null; missing_reason?: string; source_url?: string }> };

export function breeds(): Breed[] {
  const dir = path.join(ROOT, "data/registry/breeds");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort()
    .map((f) => parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Breed);
}

type BreedEn = { solar?: string; solar_quote?: string; fields?: Record<string, string> };
let _en: Record<string, any> | null = null;
function enData(): Record<string, any> {
  if (!_en) {
    const f = path.join(ROOT, "data/registry/breeds_en.yaml");
    _en = fs.existsSync(f) ? (parse(fs.readFileSync(f, "utf-8")) as Record<string, any>) : {};
  }
  return _en;
}
export function breedEn(slug: string): BreedEn { return (enData()[slug] ?? {}) as BreedEn; }
const _lx: Record<string, Record<string, any>> = {};
function langData(lang: Lang): Record<string, any> {
  if (lang === "pt" || lang === "en") return enData();
  if (!_lx[lang]) {
    const f = path.join(ROOT, `data/registry/breeds_${lang}.yaml`);
    _lx[lang] = fs.existsSync(f) ? (parse(fs.readFileSync(f, "utf-8")) as Record<string, any>) : {};
  }
  return _lx[lang];
}
/** Localised breed texts (solar, solar_quote, fields): data/registry/breeds_<lang>.yaml, falling back per key to breeds_en.yaml. */
export function breedL(slug: string, lang: Lang): BreedEn {
  const e = breedEn(slug);
  if (lang === "pt" || lang === "en") return e;
  const o = (langData(lang)[slug] ?? {}) as BreedEn;
  return { ...e, ...o, fields: { ...(e.fields ?? {}), ...(o.fields ?? {}) } };
}
const FIELD_LABELS_ES: Record<string, string> = {
  geographic_origin: "Solar (región de origen)", historical_background: "Historia", population: "Efectivo",
  physical_characteristics: "Características", production_systems: "Sistema de producción", meat_characteristics: "La carne",
  certifications: "Certificaciones (DOP/IGP)", producer_organizations: "Asociación de criadores", geographic_distribution: "Distribución",
  photographs: "Fotografías", economic_information: "Economía", historical_trends: "Evolución",
};
const FIELD_LABELS_FR: Record<string, string> = {
  geographic_origin: "Terroir d\u2019origine (région)", historical_background: "Histoire", population: "Cheptel",
  physical_characteristics: "Caractéristiques", production_systems: "Système de production", meat_characteristics: "La viande",
  certifications: "Certifications (AOP/IGP)", producer_organizations: "Association d\u2019éleveurs", geographic_distribution: "Répartition",
  photographs: "Photographies", economic_information: "Économie", historical_trends: "Évolution",
};
export function fieldLabels(lang: Lang): Record<string, string> {
  if (lang === "pt") return FIELD_LABELS;
  const en = { ...FIELD_LABELS, ...(enData()._field_labels ?? {}) };
  return lang === "es" ? { ...en, ...FIELD_LABELS_ES } : lang === "fr" ? { ...en, ...FIELD_LABELS_FR } : en;
}

export function filledFields(b: Breed): number {
  return Object.values(b.fields ?? {}).filter((f) => f.value !== null && f.value !== undefined && f.source_id).length;
}

export const FIELD_LABELS: Record<string, string> = {
  geographic_origin: "Solar (região de origem)", historical_background: "História", population: "Efetivo",
  physical_characteristics: "Características", production_systems: "Sistema de produção", meat_characteristics: "A carne",
  certifications: "Certificações (DOP/IGP)", producer_organizations: "Associação de criadores", geographic_distribution: "Distribuição",
  photographs: "Fotografias", economic_information: "Economia", historical_trends: "Evolução",
};

export function num(v: number, lang: Lang = "pt", digits = 0): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(v);
}
export function fmt(v: number, unit = "", lang: Lang = "pt"): string {
  const en = lang === "en", sp = lang === "pt" ? " " : "\u00a0";
  if (unit === "€") {
    if (v >= 1e6) return en ? `€${num(v / 1e6, lang, 1)} million` : `${num(v / 1e6, lang, 1)}${sp}M€`;
    return en ? `€${num(v, lang)}` : `${num(v, lang)}${sp}€`;
  }
  if (v >= 1e6) return `${num(v / 1e6, lang, 1)} ${lang === "pt" ? "milhões" : lang === "es" ? "millones" : lang === "fr" ? "millions" : "million"}`;
  return num(v, lang);
}
export function fmtDate(iso?: string | null, lang: Lang = "pt"): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 7 ? iso + "-01" : iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString(locale(lang), iso.length === 7 ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
}

import credits from "../data/images.json";
export function photoFor(slug: string): { id: string; kind: string } | null {
  const b = breeds().find((x) => x.slug === slug);
  // Só fotografias em que o autor identifica a raça; paisagens nunca ilustram uma raça.
  if (!b?.photo || b.photo_kind !== "raça" || !(credits as Record<string, unknown>)[b.photo]) return null;
  return { id: b.photo, kind: b.photo_kind ?? "solar" };
}

/** Region filter for the breeds gallery, derived from each breed's catalogue homeland (see Breed.solar). */
export const REGIONS: Record<string, string[]> = {
  alentejana: ["sul"], algarvia: ["sul"], arouquesa: ["norte", "centro"], barrosa: ["norte"], "brava-de-lide": ["centro", "sul", "ilhas"],
  cachena: ["norte"], garvonesa: ["sul"], jarmelista: ["centro"], marinhoa: ["centro"], maronesa: ["norte"], mertolenga: ["sul"],
  minhota: ["norte"], mirandesa: ["norte"], preta: ["sul"], "ramo-grande": ["ilhas"],
};
const REGION_L: Record<Lang, Record<string, string>> = {
  pt: { norte: "Norte", centro: "Centro", sul: "Alentejo e Algarve", ilhas: "Ilhas" },
  en: { norte: "North", centro: "Centre", sul: "Alentejo and Algarve", ilhas: "Islands" },
  es: { norte: "Norte", centro: "Centro", sul: "Alentejo y Algarve", ilhas: "Islas" },
  fr: { norte: "Nord", centro: "Centre", sul: "Alentejo et Algarve", ilhas: "Îles" },
};
export const REGION_LABELS = (lang: Lang): Record<string, string> => REGION_L[lang];

/** Best available image for a breed card: the breed itself, else a landscape of its homeland (clearly tagged), else none. */
export function cardPhoto(slug: string): { id: string; kind: "raça" | "solar" | "paisagem" } | null {
  const b = breeds().find((x) => x.slug === slug);
  if (!b?.photo || !(credits as Record<string, unknown>)[b.photo]) return null;
  return { id: b.photo, kind: (b.photo_kind ?? "solar") as any };
}

/** Foto do cartão/herói: uma paisagem partilhada por várias raças não se repete (mostra-se só a foto própria ou uma paisagem exclusiva da raça). */
export function uniquePhoto(slug: string): { id: string; kind: "raça" | "solar" | "paisagem" } | null {
  const p = cardPhoto(slug);
  if (!p || p.kind === "raça") return p;
  const n = breeds().filter((x) => cardPhoto(x.slug)?.id === p.id).length;
  return n > 1 ? null : p;
}

/** Where the page hero should be a landscape (e.g. when the only breed photo is cluttered); the breed photo then appears in level 1. */
export const HERO_OVERRIDE: Record<string, string> = {};
