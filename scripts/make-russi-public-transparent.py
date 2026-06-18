from __future__ import annotations

import csv
import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path.cwd()
PUBLIC_ROOT = ROOT / "public" / "catalogo" / "acessorios"
TS_OUTPUT = ROOT / "src" / "data" / "russiAccessories.generated.ts"

SQUARE_SIZE = (2000, 2000)
PORTRAIT_SIZE = (2160, 2700)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def load_image(path: Path) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(path)).convert("RGBA")


def rgb_array(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGB"), dtype=np.uint8)


def estimate_border_background(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    height, width = rgb.shape[:2]
    band = max(3, min(width, height) // 18)
    border = np.concatenate(
        [
            rgb[:band, :, :].reshape(-1, 3),
            rgb[-band:, :, :].reshape(-1, 3),
            rgb[:, :band, :].reshape(-1, 3),
            rgb[:, -band:, :].reshape(-1, 3),
        ],
        axis=0,
    ).astype(np.float32)
    return np.median(border, axis=0), float(np.mean(np.std(border, axis=0)))


def border_connected(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    flood = np.zeros((height + 2, width + 2), dtype=np.uint8)
    work = mask.astype(np.uint8).copy()

    for x in range(width):
        if work[0, x]:
            cv2.floodFill(work, flood, (x, 0), 2)
        if work[height - 1, x]:
            cv2.floodFill(work, flood, (x, height - 1), 2)
    for y in range(height):
        if work[y, 0]:
            cv2.floodFill(work, flood, (0, y), 2)
        if work[y, width - 1]:
            cv2.floodFill(work, flood, (width - 1, y), 2)

    return work == 2


def content_bbox_from_alpha(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha > 12)
    if xs.size == 0 or ys.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def expand_bbox(
    bbox: tuple[int, int, int, int],
    size: tuple[int, int],
    ratio: float,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = bbox
    width, height = right - left, bottom - top
    pad = max(8, int(max(width, height) * ratio))
    return (
        max(0, left - pad),
        max(0, top - pad),
        min(size[0], right + pad),
        min(size[1], bottom + pad),
    )


def alpha_from_uniform_border(image: Image.Image) -> np.ndarray:
    rgb = rgb_array(image)
    bg, border_std = estimate_border_background(rgb)
    arr = rgb.astype(np.int16)
    diff = np.linalg.norm(arr - bg.astype(np.int16), axis=2)

    threshold = 20 if bg.mean() > 225 and border_std < 18 else 30
    threshold = max(threshold, min(52, int(border_std * 1.7 + 18)))
    background_like = diff < threshold
    bg_connected = border_connected(background_like)
    alpha = (~bg_connected).astype(np.uint8) * 255
    return alpha


def alpha_from_grabcut(image: Image.Image, base_alpha: np.ndarray) -> np.ndarray:
    rgb = rgb_array(image)
    height, width = rgb.shape[:2]
    alpha_bbox = content_bbox_from_alpha(base_alpha)
    if alpha_bbox is None:
        margin_x, margin_y = max(2, width // 25), max(2, height // 25)
        rect = (margin_x, margin_y, width - margin_x * 2, height - margin_y * 2)
    else:
        left, top, right, bottom = expand_bbox(alpha_bbox, (width, height), 0.07)
        rect = (left, top, max(1, right - left), max(1, bottom - top))

    mask = np.full((height, width), cv2.GC_PR_BGD, dtype=np.uint8)
    mask[base_alpha > 10] = cv2.GC_PR_FGD

    border = max(2, min(width, height) // 45)
    mask[:border, :] = cv2.GC_BGD
    mask[-border:, :] = cv2.GC_BGD
    mask[:, :border] = cv2.GC_BGD
    mask[:, -border:] = cv2.GC_BGD

    sure_fg = cv2.erode((base_alpha > 220).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1).astype(bool)
    mask[sure_fg] = cv2.GC_FGD

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(rgb, mask, rect, bgd_model, fgd_model, 4, cv2.GC_INIT_WITH_MASK)
        result = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except cv2.error:
        result = base_alpha

    base_coverage = np.mean(base_alpha > 12)
    result_coverage = np.mean(result > 12)
    if result_coverage < 0.015 or result_coverage > 0.92:
        return base_alpha
    if base_coverage > 0 and result_coverage < base_coverage * 0.42:
        return base_alpha
    return result


def soften_alpha(alpha: np.ndarray) -> Image.Image:
    mask = Image.fromarray(alpha, "L")
    mask = mask.filter(ImageFilter.MaxFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(0.45))
    return mask.point(lambda p: 255 if p > 248 else p)


def polish_rgba(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    rgb = Image.new("RGB", rgba.size, (255, 255, 255))
    rgb.paste(rgba, mask=alpha)
    rgb = ImageOps.autocontrast(rgb, cutoff=0.2)
    rgb = ImageEnhance.Color(rgb).enhance(1.03)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.05)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.15)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def make_cutout(image: Image.Image) -> tuple[Image.Image, dict[str, float | bool]]:
    source_alpha = np.asarray(image.getchannel("A"))
    rgb = rgb_array(image)
    _bg, border_std = estimate_border_background(rgb)

    if np.mean(source_alpha < 245) > 0.02:
        alpha = source_alpha
        method = "source-alpha"
    else:
        base_alpha = alpha_from_uniform_border(image)
        base_coverage = np.mean(base_alpha > 12)
        if border_std < 42 and 0.01 < base_coverage < 0.90:
            alpha = alpha_from_grabcut(image, base_alpha)
            method = "border-grabcut"
        else:
            alpha = alpha_from_grabcut(image, base_alpha)
            method = "grabcut-conservative"

    alpha_image = soften_alpha(alpha)
    cutout = image.copy()
    cutout.putalpha(alpha_image)

    bbox = cutout.getchannel("A").getbbox()
    if bbox:
        bbox = expand_bbox(bbox, cutout.size, 0.045)
        cutout = cutout.crop(bbox)

    cutout = polish_rgba(cutout)
    final_alpha = np.asarray(cutout.getchannel("A"))
    metrics = {
        "method": method,
        "borderStd": round(float(border_std), 2),
        "alphaCoverage": round(float(np.mean(final_alpha > 12)), 4),
        "transparentCorners": bool(
            final_alpha[0, 0] < 8
            and final_alpha[0, -1] < 8
            and final_alpha[-1, 0] < 8
            and final_alpha[-1, -1] < 8
        ),
    }
    return cutout, metrics


def fit_on_canvas(cutout: Image.Image, size: tuple[int, int], fit_ratio: float) -> Image.Image:
    bbox = cutout.getchannel("A").getbbox()
    if bbox:
        cutout = cutout.crop(expand_bbox(bbox, cutout.size, 0.035))

    max_width = int(size[0] * fit_ratio)
    max_height = int(size[1] * fit_ratio)
    scale = min(max_width / cutout.width, max_height / cutout.height)
    new_size = (max(1, round(cutout.width * scale)), max(1, round(cutout.height * scale)))
    resized = cutout.resize(new_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - resized.width) // 2
    y = (size[1] - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def find_original(folder: Path) -> Path | None:
    originals = sorted(path for path in folder.iterdir() if path.stem == "original" and path.suffix.lower() in IMAGE_EXTENSIONS)
    return originals[0] if originals else None


def transparent_quality(path: Path) -> dict[str, float | bool]:
    image = Image.open(path).convert("RGBA")
    alpha = np.asarray(image.getchannel("A"))
    bbox = content_bbox_from_alpha(alpha)
    if bbox:
        left, top, right, bottom = bbox
        margins = {
            "left": left / image.width,
            "right": (image.width - right) / image.width,
            "top": top / image.height,
            "bottom": (image.height - bottom) / image.height,
        }
    else:
        margins = {"left": 0, "right": 0, "top": 0, "bottom": 0}
    return {
        "hasAlpha": image.mode == "RGBA",
        "transparentCorners": bool(alpha[0, 0] == 0 and alpha[0, -1] == 0 and alpha[-1, 0] == 0 and alpha[-1, -1] == 0),
        "alphaCoverage": round(float(np.mean(alpha > 12)), 4),
        "minMargin": round(float(min(margins.values())), 4),
    }


def public_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT / "public").as_posix()


def update_metadata(folder: Path, square: Path, portrait: Path, metrics: dict) -> None:
    metadata_path = folder / "metadata.json"
    if not metadata_path.exists():
        return
    data = json.loads(metadata_path.read_text(encoding="utf-8"))
    images = data.setdefault("images", {})
    images["marketplace"] = public_url(square)
    images["marketing"] = public_url(portrait)
    images["transparent"] = public_url(square)
    data["transparentProcessing"] = metrics
    metadata_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def rebuild_catalogs() -> None:
    items = []
    for folder in sorted(path for path in PUBLIC_ROOT.iterdir() if path.is_dir()):
        metadata_path = folder / "metadata.json"
        if metadata_path.exists():
            items.append(json.loads(metadata_path.read_text(encoding="utf-8")))

    (PUBLIC_ROOT / "catalogo-acessorios.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

    with (PUBLIC_ROOT / "catalogo-acessorios.csv").open("w", encoding="utf-8", newline="") as file:
        fieldnames = ["id", "codigo", "nome", "categoria", "descricao", "marketplace", "marketing", "original", "produtoUrl"]
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow(
                {
                    "id": item["id"],
                    "codigo": item["codigo"],
                    "nome": item["nome"],
                    "categoria": item["categoria"],
                    "descricao": item["descricao"],
                    "marketplace": item["images"]["marketplace"],
                    "marketing": item["images"]["marketing"],
                    "original": item["images"]["original"],
                    "produtoUrl": item["source"]["produtoUrl"],
                }
            )

    accessories = []
    for item in items:
        accessories.append(
            {
                "id": item["id"],
                "name": item["nome"],
                "description": item["descricao"],
                "category": item["categoria"],
                "imageUrl": item["images"]["marketplace"],
                "attributes": {
                    "codigo": item["codigo"],
                    "russiId": item["russiId"],
                    "marketingImageUrl": item["images"]["marketing"],
                    "originalImageUrl": item["images"]["original"],
                    "sourceUrl": item["source"]["produtoUrl"],
                },
                "price": 0,
                "timeEstimate": item["tempoInstalacaoMin"],
                "compatibilities": sorted({vehicle["nome"] for vehicle in item["compatibilidades"]}),
                "universal": False,
                "active": True,
            }
        )

    TS_OUTPUT.write_text(
        "import { Accessory } from '../types';\n\n"
        "// Generated from Russi Acessórios catalog. Do not edit manually.\n"
        "// Images point to transparent PNG files in public/catalogo/acessorios.\n"
        f"export const RUSSI_ACCESSORIES: Accessory[] = {json.dumps(accessories, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )


def make_review_sheet(review_items: list[dict], output: Path) -> None:
    sample = review_items[:12]
    if not sample:
        return
    thumb = 280
    cols = 4
    rows = int(np.ceil(len(sample) / cols))
    sheet = Image.new("RGB", (cols * 360, rows * 370), (235, 238, 242))
    draw = ImageDraw.Draw(sheet)
    checker = Image.new("RGB", (thumb, thumb), (255, 255, 255))
    checker_draw = ImageDraw.Draw(checker)
    step = 28
    for y in range(0, thumb, step):
        for x in range(0, thumb, step):
            if (x // step + y // step) % 2:
                checker_draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(218, 224, 232))

    for index, item in enumerate(sample):
        col = index % cols
        row = index // cols
        x0 = col * 360 + 40
        y0 = row * 370 + 34
        bg = checker.copy().convert("RGBA")
        image = ImageOps.contain(Image.open(item["squarePath"]).convert("RGBA"), (thumb, thumb), Image.Resampling.LANCZOS)
        bg.alpha_composite(image, ((thumb - image.width) // 2, (thumb - image.height) // 2))
        sheet.paste(bg.convert("RGB"), (x0, y0))
        draw.text((x0, y0 + thumb + 12), item["slug"][:44], fill=(20, 30, 45))
        draw.text((x0, y0 + thumb + 32), f"alpha={item['quality']['alphaCoverage']} margin={item['quality']['minMargin']}", fill=(71, 85, 105))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, "JPEG", quality=92, optimize=True)


def main() -> None:
    folders = sorted(path for path in PUBLIC_ROOT.iterdir() if path.is_dir())
    review = []
    for folder in folders:
        original = find_original(folder)
        if not original:
            continue

        source = load_image(original)
        cutout, metrics = make_cutout(source)
        square = folder / "marketplace-2000.png"
        portrait = folder / "marketing-2160x2700.png"
        fit_on_canvas(cutout, SQUARE_SIZE, 0.84).save(square, "PNG", optimize=True)
        fit_on_canvas(cutout, PORTRAIT_SIZE, 0.82).save(portrait, "PNG", optimize=True)

        quality = transparent_quality(square)
        item = {
            "slug": folder.name,
            "original": original.name,
            "square": public_url(square),
            "portrait": public_url(portrait),
            "squarePath": str(square),
            "metrics": metrics,
            "quality": quality,
            "needsReview": bool(
                not quality["hasAlpha"]
                or not quality["transparentCorners"]
                or quality["minMargin"] < 0.025
                or quality["alphaCoverage"] < 0.01
                or quality["alphaCoverage"] > 0.86
            ),
        }
        update_metadata(folder, square, portrait, item)
        review.append(item)

    rebuild_catalogs()

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "mode": "transparent-png-v2",
        "counts": {
            "folders": len(folders),
            "processed": len(review),
            "needsReview": sum(1 for item in review if item["needsReview"]),
        },
        "outputs": {
            "marketplace": "marketplace-2000.png",
            "marketing": "marketing-2160x2700.png",
            "catalogJson": "/catalogo/acessorios/catalogo-acessorios.json",
            "catalogCsv": "/catalogo/acessorios/catalogo-acessorios.csv",
        },
    }
    (PUBLIC_ROOT / "transparent-review.json").write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8")
    (PUBLIC_ROOT / "transparent-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    make_review_sheet([item for item in review if item["needsReview"]] or review, PUBLIC_ROOT / "transparent-review-sheet.jpg")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
