"""Genera le icone della PWA (nessun marchio di terzi): montagna stilizzata, sentiero e sole.
Uso: python scripts/make-icons.py   (richiede Pillow)"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)
BG = (20, 83, 45)       # verde bosco
SKY = (244, 241, 232)   # carta
ROCK = (28, 45, 38)
ROUTE = (249, 115, 22)  # arancio: traccia
SUN = (253, 224, 71)


def draw(size: int, safe: float = 1.0, rounded: bool = True) -> Image.Image:
    S = size * 4  # supersampling
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)
    m = (1 - safe) / 2 * S  # margine di sicurezza per le icone "maskable"
    k = safe * S

    def P(x, y):
        return (m + x * k, m + y * k)

    d.ellipse([P(0.64, 0.14), P(0.82, 0.32)], fill=SUN)
    d.polygon([P(0.04, 0.84), P(0.34, 0.30), P(0.50, 0.55), P(0.60, 0.42), P(0.96, 0.84)], fill=SKY)
    d.polygon([P(0.04, 0.84), P(0.34, 0.30), P(0.44, 0.47), P(0.30, 0.50), P(0.24, 0.62), P(0.16, 0.58)], fill=(214, 224, 218))
    d.polygon([P(0.04, 0.84), P(0.96, 0.84), P(0.96, 0.96), P(0.04, 0.96)], fill=ROCK)
    pts = [P(0.22, 0.95), P(0.40, 0.82), P(0.36, 0.72), P(0.55, 0.66), P(0.50, 0.58)]
    d.line(pts, fill=ROUTE, width=int(k * 0.045), joint="curve")
    d.ellipse([P(0.47, 0.55), P(0.53, 0.61)], fill=ROUTE)
    return im.resize((size, size), Image.LANCZOS)


draw(192).save(os.path.join(OUT, "icon-192.png"))
draw(512).save(os.path.join(OUT, "icon-512.png"))
draw(512, safe=0.72, rounded=False).save(os.path.join(OUT, "icon-maskable-512.png"))
draw(180, rounded=False).save(os.path.join(OUT, "apple-touch-icon.png"))
draw(64).save(os.path.join(OUT, "favicon-64.png"))
print("icone generate in", os.path.abspath(OUT))
