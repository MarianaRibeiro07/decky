"""Acabamento do baralho do Decky (faces e verso).

Uso, na raiz do projeto (precisa de Python 3 e Pillow):

    python scripts/build_cards.py

Faces (`assets/cards/<valor>_<naipe>.png`, 500 x 726):
- margem interna: a arte original encosta índice e naipes no filete da borda. O desenho é reduzido
  por igual (`ART_SCALE`, sem deformar) e centralizado num cartão do mesmo tamanho, com o filete
  redesenhado na borda. Sobra a mesma proporção de papel nos quatro lados (5% da largura e da altura);
- papel marfim em vez de branco puro: multiplica cada pixel pelo tom `PAPER`. O preto continua
  preto e o vermelho continua vermelho; só o branco perde o brilho de tela, que ofuscava sobre a
  mesa escura;
- paleta de 256 cores (as artes são vetoriais, com poucas cores), para as figuras pesarem menos.
  A face com figura passava de 200 KB e até 25 cartas são decodificadas na distribuição. O
  pontilhado evita faixas nos degradês (Ás de Espadas).

É idempotente: uma face que já está marfim é pulada, então rodar duas vezes não escurece o papel nem
encolhe a arte de novo. Para refazer a partir das artes originais (brancas, sem margem), restaure-as
do Git antes: `git checkout f3afff4 -- assets/cards` (commit que trouxe o baralho) e rode o script.

Verso (`assets/cards/back.png`): gerado de `assets/Fundo-Carta-Vermelho.png` na mesma proporção das
faces (500 x 726, o original é 2:3) e com os mesmos cantos arredondados transparentes. Antes era
400 x 600 com `resizeMode="cover"`, que cortava o filete ornamental da borda.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "assets" / "cards"
BACK_SOURCE = ROOT / "assets" / "Fundo-Carta-Vermelho.png"

SIZE = (500, 726)
# Raio do canto das faces do baralho de Byron Knoll (medido: ~22 px em 500 de largura).
CORNER = 22
# Marfim do papel (creme do logo, um pouco mais claro para manter o contraste dos naipes).
PAPER = (252, 248, 239)
# Ponto do papel usado para saber se a face já foi tratada (dentro da borda, acima de qualquer naipe).
PAPER_PROBE = (250, 10)
# Escala da arte dentro do cartão: 0,9 deixa 5% de papel em cada lado (25 px na largura, 36 na altura),
# o bastante para índice e naipes não encostarem no filete sem deixar a carta vazia.
ART_SCALE = 0.90
# Filete da borda das faces originais: 1 px preto e 1 px cinza, com o canto arredondado.
OUTLINE = ((0, 0, 0), (127, 127, 127))


TRANSPARENT = 255


def quantized(image: Image.Image) -> Image.Image:
    """
    Paleta de 255 cores com pontilhado (Floyd-Steinberg) mais um índice transparente para os cantos.
    O pontilhado não mexe nas cores chapadas (já estão na paleta) e evita faixas nos degradês
    (Ás de Espadas, verso). O canto perde a borda suave, mas no app ele fica por baixo do recorte
    arredondado da moldura da carta.
    """
    palette = image.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    hidden = image.getchannel("A").point(lambda a: 255 if a < 128 else 0)
    palette.paste(TRANSPARENT, mask=hidden)
    palette.info["transparency"] = TRANSPARENT
    return palette


def pad_face(image: Image.Image) -> Image.Image:
    """
    Reduz a arte e a centraliza no mesmo tamanho, deixando papel em volta. O filete original
    (que encolheria junto e viraria uma moldura dentro da carta) é apagado antes e desenhado de
    novo na borda do cartão, com o mesmo canto.
    """
    white = (255, 255, 255)
    flat = Image.new("RGB", image.size, white)
    flat.paste(image, mask=image.getchannel("A"))
    # Apaga o filete: tudo fora de um retângulo arredondado 4 px para dentro vira papel. O canto da
    # arte original tem raio de ~17 px; o recorte interno usa 14 px para cobrir a curva inteira.
    inner = Image.new("L", flat.size, 0)
    ImageDraw.Draw(inner).rounded_rectangle((4, 4, flat.width - 5, flat.height - 5), 14, fill=255)
    flat.paste(white, mask=ImageChops.invert(inner))

    art = flat.resize((round(flat.width * ART_SCALE), round(flat.height * ART_SCALE)), Image.Resampling.LANCZOS)
    card = Image.new("RGB", image.size, white)
    card.paste(art, ((card.width - art.width) // 2, (card.height - art.height) // 2))
    draw = ImageDraw.Draw(card)
    for inset, color in enumerate(OUTLINE):
        draw.rounded_rectangle((inset, inset, card.width - 1 - inset, card.height - 1 - inset), CORNER - inset, outline=color, width=1)
    padded = card.convert("RGBA")
    padded.putalpha(rounded_mask(image.size, CORNER))
    return padded


def tint_face(path: Path) -> bool:
    image = Image.open(path).convert("RGBA")
    if image.getpixel(PAPER_PROBE)[:3] != (255, 255, 255):
        return False
    image = pad_face(image)
    rgb = image.convert("RGB")
    paper = Image.new("RGB", image.size, PAPER)
    tinted = ImageChops.multiply(rgb, paper)
    tinted.putalpha(image.getchannel("A"))
    quantized(tinted).save(path, optimize=True)
    return True


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    # Desenhado em 4x e reduzido: borda do canto suave, sem serrilhado.
    scale = 4
    big = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, big.width - 1, big.height - 1), radius * scale, fill=255)
    return big.resize(size, Image.Resampling.LANCZOS)


def build_back() -> None:
    source = Image.open(BACK_SOURCE).convert("RGB")
    # 2:3 para 500:726 é um achatamento vertical de 3%, invisível, e preserva a moldura inteira.
    back = source.resize(SIZE, Image.Resampling.LANCZOS).convert("RGBA")
    back.putalpha(rounded_mask(SIZE, CORNER))
    quantized(back).save(CARDS / "back.png", optimize=True)


def main() -> None:
    faces = sorted(p for p in CARDS.glob("*_*.png"))
    changed = [p.name for p in faces if tint_face(p)]
    print(f"faces tratadas: {len(changed)} de {len(faces)}")
    build_back()
    print("verso gerado: back.png", Image.open(CARDS / "back.png").size)


if __name__ == "__main__":
    main()
