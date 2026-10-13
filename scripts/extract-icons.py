#!/usr/bin/env python3
"""Laver app-ikonerne ud fra ref/ur-ikon.png.

ref/ur-ikon.png er Ur-appens ikon (mørk tilstand) skåret ud af et skærmbillede af
iPhone-hjemmeskærmen (225 px). De sorte hjørner uden for ikonets runde form fyldes med
kantfarven, så iOS selv kan runde hjørnerne pænt.

Kør: python3 scripts/extract-icons.py   (kræver Pillow + numpy)
"""
import numpy as np
from PIL import Image

SRC = 'ref/ur-ikon.png'


def fill_corners(img):
    a = np.asarray(img.convert('RGB')).astype(np.float64)
    h, w, _ = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    # iOS-ikonets form (superellipse ~ afrundet kvadrat med radius 22,5 %)
    r = 0.225 * w
    cx = np.clip(xx, r, w - 1 - r)
    cy = np.clip(yy, r, h - 1 - r)
    inside = (xx - cx) ** 2 + (yy - cy) ** 2 <= (r - 1.5) ** 2
    band = a[14:26, w // 3: 2 * w // 3].reshape(-1, 3)
    out = a.copy()
    out[~inside] = np.median(band, axis=0)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def main():
    src = fill_corners(Image.open(SRC))
    for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512), ('favicon-32.png', 32)]:
        src.resize((size, size), Image.LANCZOS).save('icons/' + name, optimize=True)
    bg = tuple(int(c) for c in np.asarray(src)[16:24, 100:125].reshape(-1, 3).mean(0))
    m = Image.new('RGB', (512, 512), bg)
    m.paste(src.resize((420, 420), Image.LANCZOS), (46, 46))
    m.save('icons/maskable-512.png', optimize=True)
    print('Ikoner gemt i icons/')


if __name__ == '__main__':
    main()
