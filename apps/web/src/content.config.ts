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
const racasSchema = z.object({ title: z.string(), summary: z.string(), catalogue_page: z.number().optional() });

const block = z.object({ title: z.string(), paras: z.array(z.string()).optional(), list: z.array(z.string()).optional(),
  table: z.object({ head: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(), status: z.string().optional(), sources: src.optional() });
const fichaSchema = z.object({
  intro: z.string(), facts: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().optional() })),
  sections: z.array(z.object({ id: z.string(), title: z.string(), summary: z.string(), blocks: z.array(block) })),
});
const ficha = (dir: string) => defineCollection({ loader: glob({ pattern: "*.yaml", base: `../../content/${dir}` }), schema: fichaSchema });
// Portuguese (default) and English editions. English files live in content/en/<collection>/ with the same file names.
const make = (dir: string, schema: z.ZodTypeAny) => defineCollection({ loader: glob({ pattern: "*.md", base: `../../content/${dir}` }), schema });
export const collections = {
  descobertas: make("descobertas", descobertasSchema), carne: make("carne", carneSchema), racas: make("racas", racasSchema),
  descobertas_en: make("en/descobertas", descobertasSchema), carne_en: make("en/carne", carneSchema), racas_en: make("en/racas", racasSchema),
  fichas: ficha("fichas"), fichas_en: ficha("en/fichas"),
};
