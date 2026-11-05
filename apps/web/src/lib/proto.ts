// Dados curtos usados só pelo protótipo. Frases derivadas do campo «solar» do registo (sem acrescentar factos novos).
export const TERRA: Record<string, string> = {
  alentejana: "Alentejo", algarvia: "Algarve", arouquesa: "Arouca e vales do Vouga e Douro", barrosa: "Planalto do Barroso", "brava-de-lide": "Ribatejo, Alentejo, Beiras e Açores",
  cachena: "Peneda-Gerês", garvonesa: "Baixo Alentejo", jarmelista: "Guarda (antigo concelho do Jarmelo)", marinhoa: "Baixo Vouga", maronesa: "Serras do Alvão e Marão",
  mertolenga: "Baixo Alentejo", minhota: "Entre Douro e Minho", mirandesa: "Terras de Miranda", preta: "Sul do Tejo", "ramo-grande": "Ilha Terceira, Açores",
};
export const FRASE: Record<string, string> = {
  alentejana: "A raça do Alentejo.", algarvia: "A raça do Algarve.", arouquesa: "A raça das encostas de Arouca.", barrosa: "A raça do planalto do Barroso.", "brava-de-lide": "O toiro bravo, do Ribatejo aos Açores.",
  cachena: "A raça da Peneda-Gerês.", garvonesa: "A raça do Baixo Alentejo.", jarmelista: "A raça do Jarmelo, na Guarda.", marinhoa: "A raça do Baixo Vouga.", maronesa: "A raça do Alvão e do Marão.",
  mertolenga: "A raça de Mértola.", minhota: "A raça do Entre Douro e Minho.", mirandesa: "A raça de Miranda do Douro e da posta mirandesa.", preta: "A raça do Sul do Tejo.", "ramo-grande": "A raça autóctone dos Açores.",
};
/** Ordem editorial da galeria e tamanho de cada mosaico. */
export const ORDEM: [string, string][] = [
  ["mirandesa", "t-a"], ["barrosa", "t-b"], ["maronesa", "t-c"], ["cachena", "t-c"], ["arouquesa", "t-c"], ["ramo-grande", "t-d"], ["mertolenga", "t-c"],
  ["alentejana", "t-f"], ["minhota", "t-e"], ["marinhoa", "t-e"], ["garvonesa", "t-c"], ["algarvia", "t-c"],
  ["preta", "t-c"], ["jarmelista", "t-e"], ["brava-de-lide", "t-e"],
];
export const FRASE_EN: Record<string, string> = {
  alentejana: "The breed of the Alentejo.", algarvia: "The breed of the Algarve.", arouquesa: "The breed of the Arouca hillsides.", barrosa: "The breed of the Barroso plateau.", "brava-de-lide": "The fighting bull, from the Ribatejo to the Azores.",
  cachena: "The breed of Peneda-Gerês.", garvonesa: "The breed of the Lower Alentejo.", jarmelista: "The breed of Jarmelo, in Guarda.", marinhoa: "The breed of the Lower Vouga.", maronesa: "The breed of the Alvão and Marão mountains.",
  mertolenga: "The breed of Mértola.", minhota: "The breed of Entre Douro e Minho.", mirandesa: "The breed of Miranda do Douro and the posta mirandesa.", preta: "The breed south of the Tagus.", "ramo-grande": "The native breed of the Azores.",
};
export const FRASE_ES: Record<string, string> = {
  alentejana: "La raza del Alentejo.", algarvia: "La raza del Algarve.", arouquesa: "La raza de las laderas de Arouca.", barrosa: "La raza de la meseta del Barroso.", "brava-de-lide": "El toro bravo, del Ribatejo a las Azores.",
  cachena: "La raza de Peneda-Gerês.", garvonesa: "La raza del Bajo Alentejo.", jarmelista: "La raza de Jarmelo, en Guarda.", marinhoa: "La raza del Bajo Vouga.", maronesa: "La raza de las sierras del Alvão y el Marão.",
  mertolenga: "La raza de Mértola.", minhota: "La raza de Entre Douro e Minho.", mirandesa: "La raza de Miranda do Douro y de la posta mirandesa.", preta: "La raza del sur del Tajo.", "ramo-grande": "La raza autóctona de las Azores.",
};
export const FRASE_FR: Record<string, string> = {
  alentejana: "La race de l'Alentejo.", algarvia: "La race de l'Algarve.", arouquesa: "La race des coteaux d'Arouca.", barrosa: "La race du plateau du Barroso.", "brava-de-lide": "Le taureau de combat, du Ribatejo aux Açores.",
  cachena: "La race de Peneda-Gerês.", garvonesa: "La race du Bas Alentejo.", jarmelista: "La race de Jarmelo, à Guarda.", marinhoa: "La race du Bas Vouga.", maronesa: "La race des montagnes de l'Alvão et du Marão.",
  mertolenga: "La race de Mértola.", minhota: "La race d'Entre Douro e Minho.", mirandesa: "La race de Miranda do Douro et de la posta mirandesa.", preta: "La race du sud du Tage.", "ramo-grande": "La race autochtone des Açores.",
};
/** Tagline of a breed in the given language. */
export const frase = (lang: "pt" | "en" | "es" | "fr", slug: string): string =>
  (lang === "pt" ? FRASE : lang === "es" ? FRASE_ES : lang === "fr" ? FRASE_FR : FRASE_EN)[slug] ?? FRASE_EN[slug] ?? FRASE[slug];
