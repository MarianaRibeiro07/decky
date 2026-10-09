# Baralho

Fonte: "Playing Cards (Vector & PNG)", de Byron Knoll, em CC0 / domínio público.
Página: https://opengameart.org/content/playing-cards-vector-png (baixado em 08/10/2026).

Uso no Decky:

- 40 cartas do Truco (sem 8, 9, 10), PNG 500 x 726, nomeadas `<valor>_<naipe>.png` (ex.: `Q_copas.png`).
- J, Q e K usam as versões com figura (`*_of_*2.png` do zip). O Ás de Espadas usa a versão simples (`ace_of_spades2.png`).
- Ressalva de licença: a página diz que as figuras vêm de baralhos antigos da USPCC e "devem ser" domínio público, e um comentário questiona a arte ornamentada do Ás de Espadas, que por isso não foi usada.
- Acabamento por `scripts/build_cards.py` (Python + Pillow): margem interna (a arte é reduzida a 90%, sem deformar, e centralizada com 5% de papel em cada lado; o filete da borda é redesenhado no tamanho cheio), papel marfim em vez de branco puro e paleta de 256 cores com pontilhado (faces: 1,6 MB). O script é idempotente: rodar de novo não escurece o papel nem encolhe a arte de novo. Para partir das imagens originais, restaure-as do Git antes: `git checkout f3afff4 -- assets/cards` (depois restaure o `back.png` atual ou rode o script, que o gera de novo).
- O zip não traz verso de carta. O verso é do grupo: o original fica em `assets/Fundo-Carta-Vermelho.png` (1024 x 1536, 2,2 MB) e o app usa `back.png`, a mesma arte reduzida para 400 x 600 (0,35 MB). O original era decodificado em até ~25 imagens ao mesmo tempo durante a distribuição. O `back.png` é gerado pelo mesmo script em 500 x 726, a proporção das faces, com os cantos arredondados transparentes (antes era 400 x 600 e o app cortava a moldura). Para trocar a arte, substitua o original e rode o script.
