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
