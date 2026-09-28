"""Gera ícones e splash do Android a partir de public/brand/ceda-logo.png.

Uso: python scripts/generate-android-assets.py (requer Pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / 'public' / 'brand' / 'ceda-logo.png'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'

ICON_BACKGROUND = (249, 115, 22, 255)  # #F97316, laranja da marca
SPLASH_BACKGROUND = (9, 9, 11, 255)  # #09090b, background_color do PWA
SUPERSAMPLE = 4

DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
SPLASH_SIZES = {
    'drawable': (480, 320),
    'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480),
    'drawable-land-xhdpi': (1280, 720), 'drawable-land-xxhdpi': (1600, 960),
    'drawable-land-xxxhdpi': (1920, 1280),
    'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800),
    'drawable-port-xhdpi': (720, 1280), 'drawable-port-xxhdpi': (960, 1600),
    'drawable-port-xxxhdpi': (1280, 1920),
}


def circle_mask(size: int, inset: float = 0.0) -> Image.Image:
    """Máscara circular suavizada (supersample) para bordas limpas."""
    big = size * SUPERSAMPLE
    mask = Image.new('L', (big, big), 0)
    pad = inset * big
    ImageDraw.Draw(mask).ellipse((pad, pad, big - pad, big - pad), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def clean_logo() -> Image.Image:
    """Recorta o disco da logo e remove a franja escura da borda original."""
    logo = Image.open(LOGO).convert('RGBA')
    logo = logo.crop(logo.getchannel('A').point(lambda a: 255 if a > 200 else 0).getbbox())
    side = min(logo.size)
    logo = logo.resize((side, side), Image.LANCZOS)
    logo.putalpha(circle_mask(side, inset=0.012))
    return logo


def logo_disc(logo: Image.Image, diameter: int) -> Image.Image:
    return logo.resize((diameter, diameter), Image.LANCZOS)


def compose(size: tuple[int, int], background, logo: Image.Image, ratio: float) -> Image.Image:
    canvas = Image.new('RGBA', size, background)
    diameter = round(min(size) * ratio)
    disc = logo_disc(logo, diameter)
    canvas.alpha_composite(disc, ((size[0] - diameter) // 2, (size[1] - diameter) // 2))
    return canvas


def save(image: Image.Image, path: Path, keep_alpha: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    (image if keep_alpha else image.convert('RGB')).save(path, optimize=True)


def generate_icons(logo: Image.Image) -> None:
    for density, scale in DENSITIES.items():
        folder = RES / f'mipmap-{density}'
        # Adaptativo: 108dp, com a logo dentro da zona segura de 66dp.
        foreground = compose((round(108 * scale),) * 2, (0, 0, 0, 0), logo, 0.60)
        save(foreground, folder / 'ic_launcher_foreground.png', keep_alpha=True)
        # Legado (Android 7): 48dp quadrado e redondo.
        legacy_size = round(48 * scale)
        legacy = compose((legacy_size,) * 2, ICON_BACKGROUND, logo, 0.80)
        save(legacy, folder / 'ic_launcher.png')
        round_icon = legacy.copy()
        round_icon.putalpha(circle_mask(legacy_size))
        save(round_icon, folder / 'ic_launcher_round.png', keep_alpha=True)


def generate_splashes(logo: Image.Image) -> None:
    for folder, size in SPLASH_SIZES.items():
        save(compose(size, SPLASH_BACKGROUND, logo, 0.32), RES / folder / 'splash.png')


def main() -> None:
    if not RES.exists():
        raise SystemExit('Pasta android/ não encontrada. Rode "npx cap add android" antes.')
    logo = clean_logo()
    generate_icons(logo)
    generate_splashes(logo)
    print('Ícones e splash do Android gerados em', RES)


if __name__ == '__main__':
    main()
