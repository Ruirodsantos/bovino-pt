export const CHAPTERS = [
  { n: 1, name: "O animal", promise: "Onde tudo começa: a mãe, o pasto e o criador." },
  { n: 2, name: "O caminho", promise: "Do campo ao matadouro, à classificação e à desmancha." },
  { n: 3, name: "A carne", promise: "Aprender a olhar: cor, gordura, fibra, cortes e tempo." },
  { n: 4, name: "Do talho ao lume", promise: "Comprar bem e cozinhar com rigor: cada temperatura muda a carne." },
  { n: 5, name: "À mesa", promise: "O último minuto decide o que o cliente recorda." },
];
// Paragens extra (páginas especiais) dentro de um capítulo, depois do tema indicado.
export const EXTRAS: Record<string, { href: string; title: string; hook: string }> = {
  fibra: { href: "viagem/contra-a-fibra/", title: "Cortar contra a fibra", hook: "Porque é que a direção do corte muda a maciez?" },
  cortes: { href: "anatomia-cortes/", title: "Os cortes em 3D", hook: "Rode o animal e toque numa peça." },
};
