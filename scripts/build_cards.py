"""Acabamento do baralho do Decky (faces e verso).

Uso, na raiz do projeto (precisa de Python 3 e Pillow):

    python scripts/build_cards.py

Faces (`assets/cards/<valor>_<naipe>.png`, 500 x 726):
- papel marfim em vez de branco puro: multiplica cada pixel pelo tom `PAPER`. O preto continua
  preto e o vermelho continua vermelho; só o branco perde o brilho de tela, que ofuscava sobre a
  mesa escura;
- paleta de 256 cores (as artes são vetoriais, com poucas cores), para as figuras pesarem menos.
  A face com figura passava de 200 KB e até 25 cartas são decodificadas na distribuição. O
  pontilhado evita faixas nos degradês (Ás de Espadas).

É idempotente: uma face que já está marfim é pulada, então rodar duas vezes não escurece o papel.

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


def tint_face(path: Path) -> bool:
    image = Image.open(path).convert("RGBA")
    if image.getpixel(PAPER_PROBE)[:3] != (255, 255, 255):
        return False
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
