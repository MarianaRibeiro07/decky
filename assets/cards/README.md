# Baralho

Fonte: "Playing Cards (Vector & PNG)", de Byron Knoll, em CC0 / domínio público.
Página: https://opengameart.org/content/playing-cards-vector-png (baixado em 08/10/2026).

Uso no Decky:

- 40 cartas do Truco (sem 8, 9, 10), PNG 500 x 726, nomeadas `<valor>_<naipe>.png` (ex.: `Q_copas.png`).
- J, Q e K usam as versões com figura (`*_of_*2.png` do zip). O Ás de Espadas usa a versão simples (`ace_of_spades2.png`).
- Ressalva de licença: a página diz que as figuras vêm de baralhos antigos da USPCC e "devem ser" domínio público, e um comentário questiona a arte ornamentada do Ás de Espadas, que por isso não foi usada.
- O zip não traz verso de carta. O verso é do grupo: o original fica em `assets/Fundo-Carta-Vermelho.png` (1024 x 1536, 2,2 MB) e o app usa `back.png`, a mesma arte reduzida para 400 x 600 (0,35 MB). O original era decodificado em até ~25 imagens ao mesmo tempo durante a distribuição. Para trocar a arte, gere de novo o `back.png` em 400 x 600.
