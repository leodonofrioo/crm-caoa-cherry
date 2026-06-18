from __future__ import annotations

import csv
import json
import math
import re
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path.cwd()
SOURCE_ROOT = ROOT / "scraped" / "russi-acessorios" / "montadora-1"
OUTPUT_ROOT = SOURCE_ROOT / "processed"
PRODUCT_INPUT = SOURCE_ROOT / "produto-fotos"
VEHICLE_INPUT = SOURCE_ROOT / "veiculo-fotos"
PRODUCTS_CSV = SOURCE_ROOT / "produtos_unicos.csv"

SQUARE_SIZE = (2000, 2000)
PORTRAIT_SIZE = (2160, 2700)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass(frozen=True)
class RenderSpec:
    slug: str
    size: tuple[int, int]
    bg_mode: str
    fit_ratio: float
    vertical_anchor: float
    shadow_opacity: int
    shadow_blur: int
    shadow_offset: tuple[int, int]


SPECS = [
    RenderSpec(
        slug="marketplace-square",
        size=SQUARE_SIZE,
        bg_mode="white",
        fit_ratio=0.84,
        vertical_anchor=0.50,
        shadow_opacity=36,
        shadow_blur=42,
        shadow_offset=(0, 28),
    ),
    RenderSpec(
        slug="marketing-4x5",
        size=PORTRAIT_SIZE,
        bg_mode="premium-gradient",
        fit_ratio=0.80,
        vertical_anchor=0.47,
        shadow_opacity=58,
        shadow_blur=64,
        shadow_offset=(0, 42),
    ),
]


def sanitize_filename(name: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip("-").lower()
    return clean[:120] or "image"


def load_metadata() -> dict[str, dict[str, str]]:
    if not PRODUCTS_CSV.exists():
        return {}

    with PRODUCTS_CSV.open("r", encoding="utf-8", newline="") as file:
        return {row["id"]: row for row in csv.DictReader(file)}


def estimate_background(rgb: Image.Image) -> np.ndarray:
    arr = np.asarray(rgb, dtype=np.int16)
    height, width = arr.shape[:2]
    band = max(3, min(width, height) // 20)
    border = np.concatenate(
        [
            arr[:band, :, :].reshape(-1, 3),
            arr[-band:, :, :].reshape(-1, 3),
            arr[:, :band, :].reshape(-1, 3),
            arr[:, -band:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    return np.median(border, axis=0)


def foreground_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    rgba = ImageOps.exif_transpose(image).convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"))
    if np.count_nonzero(alpha < 250) > alpha.size * 0.02:
        bbox = rgba.getchannel("A").getbbox()
        if bbox:
            return expand_bbox(bbox, rgba.size, 0.035)

    rgb = rgba.convert("RGB")
    arr = np.asarray(rgb, dtype=np.int16)
    bg = estimate_background(rgb)
    diff = np.abs(arr - bg).max(axis=2)
    threshold = 28 if bg.mean() > 220 else 36
    mask = diff > threshold

    if mask.mean() < 0.006 or mask.mean() > 0.94:
        return (0, 0, rgba.width, rgba.height)

    ys, xs = np.where(mask)
    bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return expand_bbox(bbox, rgba.size, 0.045)


def expand_bbox(
    bbox: tuple[int, int, int, int],
    size: tuple[int, int],
    ratio: float,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = bbox
    width, height = right - left, bottom - top
    pad = int(max(width, height) * ratio)
    return (
        max(0, left - pad),
        max(0, top - pad),
        min(size[0], right + pad),
        min(size[1], bottom + pad),
    )


def border_connected_background(bg_like: np.ndarray) -> np.ndarray:
    height, width = bg_like.shape
    visited = np.zeros_like(bg_like, dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < height and 0 <= x < width and bg_like[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((y, x))

    for x in range(width):
        push(0, x)
        push(height - 1, x)
    for y in range(height):
        push(y, 0)
        push(y, width - 1)

    while queue:
        y, x = queue.popleft()
        push(y - 1, x)
        push(y + 1, x)
        push(y, x - 1)
        push(y, x + 1)

    return visited


def make_cutout(image: Image.Image) -> Image.Image:
    cropped = ImageOps.exif_transpose(image).convert("RGBA")
    cropped = cropped.crop(foreground_bbox(cropped))

    rgb = cropped.convert("RGB")
    arr = np.asarray(rgb, dtype=np.int16)
    bg = estimate_background(rgb)
    diff = np.abs(arr - bg).max(axis=2)
    threshold = 24 if bg.mean() > 220 else 34
    bg_like = diff < threshold
    connected_bg = border_connected_background(bg_like)
    product = ~connected_bg

    coverage = product.mean()
    if coverage < 0.012 or coverage > 0.96:
        return polish_image(cropped)

    alpha = Image.fromarray((product.astype(np.uint8) * 255), "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.65))
    source_alpha = cropped.getchannel("A")
    if np.count_nonzero(np.asarray(source_alpha) < 250) > source_alpha.width * source_alpha.height * 0.02:
        alpha = ImageChops.multiply(alpha, source_alpha)

    cutout = cropped.copy()
    cutout.putalpha(alpha)

    alpha_bbox = cutout.getchannel("A").getbbox()
    if alpha_bbox:
        cutout = cutout.crop(expand_bbox(alpha_bbox, cutout.size, 0.015))

    return polish_image(cutout)


def polish_image(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    rgb = Image.new("RGB", rgba.size, "white")
    rgb.paste(rgba, mask=rgba.getchannel("A"))
    rgb = ImageOps.autocontrast(rgb, cutoff=0.35)
    rgb = ImageEnhance.Color(rgb).enhance(1.04)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.07)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.22)

    polished = rgb.convert("RGBA")
    polished.putalpha(rgba.getchannel("A"))
    return polished


def make_background(size: tuple[int, int], mode: str) -> Image.Image:
    width, height = size
    if mode == "white":
        return Image.new("RGB", size, (255, 255, 255))

    y = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, width, dtype=np.float32)[None, :]
    base = np.zeros((height, width, 3), dtype=np.float32)
    top = np.array([248, 250, 252], dtype=np.float32)
    bottom = np.array([234, 238, 244], dtype=np.float32)
    base[:] = top * (1 - y[..., None]) + bottom * y[..., None]

    cx, cy = 0.52, 0.40
    radial = np.clip(1 - np.sqrt((x - cx) ** 2 + ((y - cy) * 0.82) ** 2) / 0.72, 0, 1)
    highlight = radial[..., None] * 18
    arr = np.clip(base + highlight, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def fit_layer(layer: Image.Image, spec: RenderSpec) -> Image.Image:
    max_width = int(spec.size[0] * spec.fit_ratio)
    max_height = int(spec.size[1] * (spec.fit_ratio if spec.size[0] == spec.size[1] else spec.fit_ratio * 0.90))
    scale = min(max_width / layer.width, max_height / layer.height)
    new_size = (max(1, round(layer.width * scale)), max(1, round(layer.height * scale)))
    return layer.resize(new_size, Image.Resampling.LANCZOS)


def compose(layer: Image.Image, spec: RenderSpec) -> Image.Image:
    canvas = make_background(spec.size, spec.bg_mode).convert("RGBA")
    fitted = fit_layer(layer, spec)

    x = (spec.size[0] - fitted.width) // 2
    y = int(spec.size[1] * spec.vertical_anchor - fitted.height / 2)
    y = max(int(spec.size[1] * 0.06), min(y, spec.size[1] - fitted.height - int(spec.size[1] * 0.06)))

    alpha = fitted.getchannel("A")
    if alpha.getbbox():
        shadow = Image.new("RGBA", spec.size, (0, 0, 0, 0))
        shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(spec.shadow_blur))
        shadow_alpha = shadow_alpha.point(lambda pixel: min(spec.shadow_opacity, int(pixel * spec.shadow_opacity / 255)))
        shadow_layer = Image.new("RGBA", fitted.size, (24, 32, 44, 0))
        shadow_layer.putalpha(shadow_alpha)
        shadow.alpha_composite(shadow_layer, (x + spec.shadow_offset[0], y + spec.shadow_offset[1]))
        canvas = Image.alpha_composite(canvas, shadow)

    canvas.alpha_composite(fitted, (x, y))
    return canvas.convert("RGB")


def product_id_from_name(path: Path) -> str:
    return path.name.split("-", 1)[0]


def save_render(image: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "JPEG", quality=95, subsampling=0, optimize=True, progressive=True)


def process_one(source: Path, group: str, metadata: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    original = Image.open(source)
    cutout = make_cutout(original)
    source_stem = sanitize_filename(source.stem)
    product_id = product_id_from_name(source)
    meta = metadata.get(product_id, {})
    rows: list[dict[str, str]] = []

    for spec in SPECS:
        rendered = compose(cutout, spec)
        target = OUTPUT_ROOT / spec.slug / group / f"{source_stem}.jpg"
        save_render(rendered, target)
        rows.append(
            {
                "grupo": group,
                "source_file": str(source.relative_to(SOURCE_ROOT)).replace("\\", "/"),
                "variant": spec.slug,
                "output_file": str(target.relative_to(SOURCE_ROOT)).replace("\\", "/"),
                "width": str(spec.size[0]),
                "height": str(spec.size[1]),
                "produto_id": product_id if group == "produto-fotos" else "",
                "produto_nome": meta.get("nome", ""),
                "codigo": meta.get("codigo", ""),
            }
        )

    return rows


def make_contact_sheet(rows: list[dict[str, str]]) -> Path | None:
    product_rows = [row for row in rows if row["grupo"] == "produto-fotos" and row["variant"] == "marketplace-square"]
    sample = product_rows[:8]
    if not sample:
        return None

    thumb = (360, 360)
    cell_w = thumb[0] * 2 + 44
    cell_h = thumb[1] + 86
    cols = 2
    rows_count = math.ceil(len(sample) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows_count * cell_h), (245, 247, 250))
    draw = ImageDraw.Draw(sheet)

    for index, row in enumerate(sample):
        source = SOURCE_ROOT / row["source_file"]
        output = SOURCE_ROOT / row["output_file"]
        original = ImageOps.contain(Image.open(source).convert("RGB"), thumb, Image.Resampling.LANCZOS)
        rendered = ImageOps.contain(Image.open(output).convert("RGB"), thumb, Image.Resampling.LANCZOS)
        col = index % cols
        line = index // cols
        x0 = col * cell_w + 18
        y0 = line * cell_h + 18

        draw.rounded_rectangle((x0 - 8, y0 - 8, x0 + cell_w - 26, y0 + cell_h - 26), radius=18, fill=(255, 255, 255))
        sheet.paste(original, (x0 + (thumb[0] - original.width) // 2, y0 + 28 + (thumb[1] - original.height) // 2))
        sheet.paste(rendered, (x0 + thumb[0] + 28, y0 + 28 + (thumb[1] - rendered.height) // 2))
        draw.text((x0, y0), "original", fill=(71, 85, 105))
        draw.text((x0 + thumb[0] + 28, y0), "tratada", fill=(15, 118, 110))
        title = row["produto_nome"][:54] if row["produto_nome"] else source.stem[:54]
        draw.text((x0, y0 + thumb[1] + 40), title, fill=(30, 41, 59))

    target = OUTPUT_ROOT / "preview-contact-sheet.jpg"
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, "JPEG", quality=92, optimize=True, progressive=True)
    return target


def iter_images(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(path for path in directory.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)


def main() -> None:
    metadata = load_metadata()
    rows: list[dict[str, str]] = []
    inputs = [
        ("produto-fotos", iter_images(PRODUCT_INPUT)),
        ("veiculo-fotos", iter_images(VEHICLE_INPUT)),
    ]

    for group, files in inputs:
        for source in files:
            rows.extend(process_one(source, group, metadata))

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    index_path = OUTPUT_ROOT / "index.csv"
    with index_path.open("w", encoding="utf-8", newline="") as file:
        fieldnames = [
            "grupo",
            "source_file",
            "variant",
            "output_file",
            "width",
            "height",
            "produto_id",
            "produto_nome",
            "codigo",
        ]
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    preview = make_contact_sheet(rows)
    manifest = {
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "source_root": str(SOURCE_ROOT),
        "outputs": {
            "marketplace-square": {
                "size": f"{SQUARE_SIZE[0]}x{SQUARE_SIZE[1]}",
                "description": "Fundo branco, crop automatico, upscale, contraste, nitidez, sombra suave.",
            },
            "marketing-4x5": {
                "size": f"{PORTRAIT_SIZE[0]}x{PORTRAIT_SIZE[1]}",
                "description": "Formato vertical 4:5, fundo premium discreto, crop automatico, upscale, contraste, nitidez.",
            },
        },
        "counts": {
            "source_product_photos": len(inputs[0][1]),
            "source_vehicle_photos": len(inputs[1][1]),
            "rendered_files": len(rows),
        },
        "index": str(index_path.relative_to(SOURCE_ROOT)).replace("\\", "/"),
        "preview": str(preview.relative_to(SOURCE_ROOT)).replace("\\", "/") if preview else None,
    }

    manifest_path = OUTPUT_ROOT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
