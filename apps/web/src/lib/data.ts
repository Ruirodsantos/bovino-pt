import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const ROOT = path.resolve(process.cwd(), "../..");
const PUBLIC_DATA = path.resolve(process.cwd(), "public/data");

export type Footnote = { source: string; source_code: string; dataset: string; period: string; published: string | null; verified: string };
export type Stat = { id: string; label: string; value: number; unit: string; context: string; change?: number | null; change_ref?: string | null; footnote: Footnote };
export type CatalogItem = { id: string; title_pt: string; state: string; rows?: number; first_period?: string; last_period?: string; publication_date?: string; retrieved_at?: string; source_code?: string };
export type Summary = { stats: Stat[]; catalog: CatalogItem[]; last_run: { finished_at: string; datasets: { dataset: string; state: string; rows?: number; last_period?: string }[] } | null };

export function summary(): Summary {
  const f = path.join(PUBLIC_DATA, "summary.json");
  if (!fs.existsSync(f)) return { stats: [], catalog: [], last_run: null };
  return JSON.parse(fs.readFileSync(f, "utf-8"));
}

export function hasDataset(id: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DATA, `${id}.json`));
}

export type Breed = { slug: string; official_name: string; status: string; status_reason?: string; region?: string | null; fields: Record<string, { value: unknown; source_id: string | null; verified_at: string | null; missing_reason?: string; source_url?: string }> };

export function breeds(): Breed[] {
  const dir = path.join(ROOT, "data/registry/breeds");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort()
    .map((f) => parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Breed);
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

const nf0 = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });
export function fmt(v: number, unit = ""): string {
  if (unit === "€") {
    if (v >= 1e6) return `${nf1.format(v / 1e6)} M€`;
    return `${nf0.format(v)} €`;
  }
  if (v >= 1e6) return `${nf1.format(v / 1e6)} milhões`;
  return nf0.format(v);
}
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 7 ? iso + "-01" : iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString("pt-PT", iso.length === 7 ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
}
