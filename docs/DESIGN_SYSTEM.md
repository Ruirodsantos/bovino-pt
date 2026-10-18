# Design system — protótipo (2026-10-18)

Estado: **protótipo em avaliação** em `/bovino-pt/prototipo/` (noindex, fora do menu principal). Nada do site atual foi alterado. A aplicação ao resto do site depende da aprovação do Rui.

## Auditoria do site atual (resumo)
- Aspeto de relatório: títulos e parágrafos antes de imagens; muita informação visível por defeito.
- Fotografia escassa e desigual: só 9 de 15 raças com foto da própria raça confirmada; faltam Mirandesa, Garvonesa, Jarmelista, Marinhoa, Minhota, Algarvia, Preta e Brava de Lide.
- Cor dominada por tons escuros/terra; tipografia única (Lexend) sem personalidade nos títulos.
- Navegação com 4 áreas; Observatório escondido em «Aprender».
- Conteúdo profundo só existe para o Ramo Grande.

## Paleta
Verde profundo #183C32 · Verde natural #547D55 · Marfim #F8F7F2 · Branco #FFFFFF · Dourado #C7A66A · Carvão #242824. Fundos claros nas secções informativas; verde escuro só em momentos pontuais. Verde natural e dourado nunca em texto pequeno.

## Tipografia
Títulos: Lexend. Texto: Lexend (17 px, entrelinha 1,65, linhas ≤ ~62 caracteres). Sem maiúsculas em excesso.

## Fotografia
Nunca outra raça nem imagens de IA. Autor, licença e origem em cada imagem. Sem foto autorizada: paisagem do território com etiqueta «foto da raça por obter» (ou fotografia provisória assinalada). WebP em 3 tamanhos, lazy-load fora da primeira dobra.

## Movimento
Aparecimento suave, paralaxe subtil (CSS `animation-timeline: view()` em `@supports`), tudo desligado com `prefers-reduced-motion`.

## Navegação
Início · As raças · A carne · Da pastagem ao prato · Aprender · Observatório. Menu móvel em painel, fecha com Esc.

## Três níveis
Descobrir (visual, breve) → Explorar (explicação) → Aprofundar (`<details>` com blocos e fontes, sempre no HTML, indexável).

## Páginas do protótipo
`prototipo/` (home), `prototipo/racas/` (galeria editorial com filtro por região), `prototipo/racas/ramo-grande/` (página completa), `prototipo/design-system/`.

## Pendente
Fotografias melhores (T-0405, contactos só com aprovação do Rui); restantes 14 fichas; ligar «A carne», «Da pastagem ao prato», «Aprender» e «Observatório» ao novo estilo.
