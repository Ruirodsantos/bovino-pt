import type { Lang } from "../i18n";
type L4 = { pt: string; en: string; es: string; fr: string };
const l = (pt: string, en: string, es: string, fr: string): L4 => ({ pt, en, es, fr });
export const CHAPTERS: { n: number; name: L4; promise: L4 }[] = [
  { n: 1, name: l("O animal", "The animal", "El animal", "L’animal"), promise: l("Onde tudo começa: a mãe, o pasto e o criador.", "Where it all begins: the mother, the pasture and the farmer.", "Donde todo empieza: la madre, el pasto y el criador.", "Là où tout commence : la mère, le pâturage et l’éleveur.") },
  { n: 2, name: l("O caminho", "The road", "El camino", "Le chemin"), promise: l("Do campo ao matadouro, à classificação e à desmancha.", "From field to abattoir, grading and butchery.", "Del campo al matadero, la clasificación y el despiece.", "Du champ à l’abattoir, au classement et à la découpe.") },
  { n: 3, name: l("A carne", "The meat", "La carne", "La viande"), promise: l("Aprender a olhar: cor, gordura, fibra, cortes e tempo.", "Learning to look: colour, fat, fibre, cuts and time.", "Aprender a mirar: color, grasa, fibra, cortes y tiempo.", "Apprendre à regarder : couleur, gras, fibre, morceaux et temps.") },
  { n: 4, name: l("Do talho ao lume", "From butcher to flame", "De la carnicería al fuego", "De la boucherie au feu"), promise: l("Comprar bem e cozinhar com rigor: cada temperatura muda a carne.", "Buy well and cook with precision: every temperature changes the meat.", "Comprar bien y cocinar con rigor: cada temperatura cambia la carne.", "Bien acheter et cuisiner avec rigueur : chaque température change la viande.") },
  { n: 5, name: l("À mesa", "At the table", "A la mesa", "À table"), promise: l("O último minuto decide o que o cliente recorda.", "The last minute decides what the guest remembers.", "El último minuto decide lo que el cliente recuerda.", "La dernière minute décide de ce dont le client se souvient.") },
];
export const EXTRAS: Record<string, { href: string; title: L4; hook: L4 }> = {
  fibra: { href: "viagem/contra-a-fibra/", title: l("Cortar contra a fibra", "Cutting against the grain", "Cortar contra la fibra", "Trancher contre la fibre"), hook: l("Porque é que a direção do corte muda a maciez?", "Why does the direction of the cut change tenderness?", "¿Por qué la dirección del corte cambia la ternura?", "Pourquoi le sens de la coupe change-t-il la tendreté ?") },
  cortes: { href: "anatomia-cortes/", title: l("Os cortes em 3D", "The cuts in 3D", "Los cortes en 3D", "Les morceaux en 3D"), hook: l("Rode o animal e toque numa peça.", "Rotate the animal and tap a cut.", "Gira el animal y toca una pieza.", "Faites pivoter l’animal et touchez un morceau.") },
};
export const pick = (o: L4, lang: Lang) => o[lang];
export const HUB = {
  title: l("A viagem", "The journey", "El viaje", "Le voyage"),
  lead: (n: number) => l(`Do pasto ao prato, em ${n} paragens.`, `From pasture to plate, in ${n} stops.`, `Del pasto al plato, en ${n} paradas.`, `Du pâturage à l’assiette, en ${n} étapes.`),
  intro: l("Cinco capítulos, pela ordem em que o animal faz o caminho. Cada paragem responde a uma pergunta.", "Five chapters, in the order the animal makes its way. Each stop answers one question.", "Cinco capítulos, en el orden en que el animal hace el camino. Cada parada responde a una pregunta.", "Cinq chapitres, dans l’ordre où l’animal fait le chemin. Chaque étape répond à une question."),
  start: l("Começar a viagem →", "Start the journey →", "Empezar el viaje →", "Commencer le voyage →"),
};
