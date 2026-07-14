"""Generate transparent Pi mark icons (no white background) for light/dark chrome."""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SVG = ROOT / "public" / "icons" / "brand-mark.svg"
OUT_PUBLIC = ROOT / "public" / "icons"
OUT_TAURI = ROOT / "apps" / "desktop" / "src-tauri" / "icons"


def parse_body_rects(svg_text: str) -> list[tuple[float, float, float, float]]:
    rects = re.findall(
        r'<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"',
        svg_text,
    )
    body: list[tuple[float, float, float, float]] = []
    for x, y, w, h in rects:
        x, y, w, h = map(float, (x, y, w, h))
        # skip full-canvas white plate
        if w >= 45 and h >= 45:
            continue
        body.append((x, y, w, h))
    return body


def render(
    body: list[tuple[float, float, float, float]],
    size: int,
    fill: tuple[int, int, int, int],
    pad_ratio: float = 0.12,
) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = size * pad_ratio
    scale = (size - 2 * pad) / 46.0
    for x, y, w, h in body:
        x0 = pad + x * scale
        y0 = pad + y * scale
        x1 = pad + (x + w) * scale
        y1 = pad + (y + h) * scale
        draw.rectangle([x0, y0, x1, y1], fill=fill)
    return img


def main() -> None:
    body = parse_body_rects(SVG.read_text(encoding="utf-8"))
    print(f"body rects: {len(body)}")
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)
    OUT_TAURI.mkdir(parents=True, exist_ok=True)

    black = (17, 17, 17, 255)
    white = (242, 240, 236, 255)

    def L(s: int) -> Image.Image:
        return render(body, s, black)

    def D(s: int) -> Image.Image:
        return render(body, s, white)

    # Public UI marks
    L(32).save(OUT_PUBLIC / "pi-mark-light.png")
    D(32).save(OUT_PUBLIC / "pi-mark-dark.png")
    L(192).save(OUT_PUBLIC / "pi-mark-light-192.png")
    D(192).save(OUT_PUBLIC / "pi-mark-dark-192.png")
    L(512).save(OUT_PUBLIC / "pi-mark-light-512.png")
    D(512).save(OUT_PUBLIC / "pi-mark-dark-512.png")
    L(128).save(OUT_PUBLIC / "pi-mark.png")

    # Transparent SVG-like CSS brand: keep black, invert via CSS for dark themes
    # Also write brand-mark without white plate
    svg_clean = SVG.read_text(encoding="utf-8")
    svg_clean = re.sub(
        r'<rect width="46" height="46" fill="#ffffff"/>\s*',
        "",
        svg_clean,
    )
    svg_clean = svg_clean.replace('fill="#111111"', 'fill="currentColor"')
    (OUT_PUBLIC / "brand-mark.svg").write_text(svg_clean, encoding="utf-8")

    # Tauri pack icons (default black glyph)
    L(32).save(OUT_TAURI / "32x32.png")
    L(128).save(OUT_TAURI / "128x128.png")
    L(256).save(OUT_TAURI / "128x128@2x.png")
    L(512).save(OUT_TAURI / "icon.png")
    L(256).save(OUT_TAURI / "icon-light.png")
    D(256).save(OUT_TAURI / "icon-dark.png")

    ico_sizes = [16, 32, 48, 64, 128, 256]
    light_ico = [L(s) for s in ico_sizes]
    dark_ico = [D(s) for s in ico_sizes]
    light_ico[0].save(
        OUT_TAURI / "icon.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=light_ico[1:],
    )
    light_ico[0].save(
        OUT_TAURI / "icon-light.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=light_ico[1:],
    )
    dark_ico[0].save(
        OUT_TAURI / "icon-dark.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=dark_ico[1:],
    )

    store = {
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }
    for name, s in store.items():
        L(s).save(OUT_TAURI / name)

    print("done →", OUT_PUBLIC, OUT_TAURI)


if __name__ == "__main__":
    main()
