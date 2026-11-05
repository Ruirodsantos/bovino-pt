import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const src = z.array(z.object({ label: z.string(), url: z.string().url() }));
const descobertasSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["verificado", "em revisão"]),
  dataset: z.string().optional(),
  sources: src.min(1),
});
const carneSchema = z.object({ title: z.string(), order: z.number(), summary: z.string(), photo: z.string().optional(), sources: src.default([]) });
const temaSchema = z.object({ chapter: z.number(), title: z.string(), hook: z.string().optional(), capa: z.enum(["full", "figure"]).optional(), note: z.string().optional(), kicker: z.string(), lead: z.string(), order: z.number(), photo: z.string().optional(),
  scenes: z.array(z.object({ title: z.string(), text: z.string(), photo: z.string().optional(), fig: z.string().optional(), pos: z.string().optional(), diagram: z.enum(["myoglobin", "cuts", "classificacao"]).optional() })),
  sources: src.default([]) });
const racasSchema = z.object({ title: z.string(), summary: z.string(), catalogue_page: z.number().optional() });

const block = z.object({ title: z.string(), paras: z.array(z.string()).optional(), list: z.array(z.string()).optional(),
  table: z.object({ head: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(), status: z.string().optional(), sources: src.optional() });
const fichaSchema = z.object({
  intro: z.string(), facts: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().optional() })),
  sections: z.array(z.object({ id: z.string(), title: z.string(), summary: z.string(), blocks: z.array(block) })),
});
const ficha = (dir: string) => defineCollection({ loader: glob({ pattern: "*.yaml", base: `../../content/${dir}` }), schema: fichaSchema });
// Portuguese (default) + en/es/fr editions: content/<lang>/<collection>/ with the same file names. Missing translations fall back en → pt (see lib/content.ts).
const make = (dir: string, schema: z.ZodTypeAny) => defineCollection({ loader: glob({ pattern: "*.md", base: `../../content/${dir}` }), schema });
const sets: Record<string, any> = {
  descobertas: (d: string) => make(d, descobertasSchema), racas: (d: string) => make(d, racasSchema),
  temas: (d: string) => make(d, temaSchema), fichas: (d: string) => ficha(d),
};
export const collections: Record<string, any> = {};
for (const [name, f] of Object.entries(sets)) {
  collections[name] = f(name);
  for (const l of ["en", "es", "fr"]) collections[`${name}_${l}`] = f(`${l}/${name}`);
}
