import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const descobertas = defineCollection({
  loader: glob({ pattern: "*.md", base: "../../content/descobertas" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    status: z.enum(["verificado", "em revisão"]),
    dataset: z.string().optional(),
    sources: z.array(z.object({ label: z.string(), url: z.string().url() })).min(1),
  }),
});
export const collections = { descobertas };
