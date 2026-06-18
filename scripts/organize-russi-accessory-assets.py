from __future__ import annotations

import csv
import json
import shutil
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path.cwd()
SOURCE_ROOT = ROOT / "scraped" / "russi-acessorios" / "montadora-1"
PUBLIC_ROOT = ROOT / "public" / "catalogo" / "acessorios"
TS_OUTPUT = ROOT / "src" / "data" / "russiAccessories.generated.ts"

PRODUCTS_CSV = SOURCE_ROOT / "produtos_unicos.csv"
PRODUCTS_BY_VEHICLE_CSV = SOURCE_ROOT / "produtos_por_veiculo.csv"
PROCESSED_INDEX_CSV = SOURCE_ROOT / "processed" / "index.csv"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    chars = []
    prev_dash = False
    for char in ascii_text.lower():
        if char.isalnum():
            chars.append(char)
            prev_dash = False
        elif not prev_dash:
            chars.append("-")
            prev_dash = True
    return "".join(chars).strip("-")[:110] or "acessorio"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def infer_category(name: str) -> str:
    upper = name.upper()
    if "PELICULA SOLAR" in upper:
        return "Película Solar"
    if any(token in upper for token in ["PELICULA", "INSULFILM"]):
        return "Película"
    if any(token in upper for token in ["TAPETE", "BANDEJA PORTAMALA", "PORTA-MALA BORRACHA"]):
        return "Tapete"
    if any(token in upper for token in ["LED", "LAMPADA", "FAROL", "LANTERNA", "ILUMINACAO"]):
        return "Iluminação"
    if any(token in upper for token in ["ALARME", "ANTIFURTO", "TRAVA", "SENSOR", "SEGURANCA"]):
        return "Segurança"
    if any(token in upper for token in ["CAMERA", "USB", "MULTIMIDIA", "INTERFACE", "STREAMING", "MODULO"]):
        return "Tecnologia"
    if any(token in upper for token in ["PROTETOR", "CALHA", "CARTER", "SUPAGLASS"]):
        return "Proteção"
    if any(token in upper for token in ["APLIQUE", "FRISO", "ENVELOPAMENTO", "SOLEIRA", "SPOILER", "ADESIVO"]):
        return "Estética"
    if any(token in upper for token in ["VITRIFICACAO", "CRISTALIZACAO", "HIGIENIZACAO"]):
        return "Serviço"
    return "Outro"


def default_time_estimate(category: str) -> int:
    return {
        "Película Solar": 90,
        "Película": 90,
        "Tapete": 10,
        "Proteção": 30,
        "Segurança": 60,
        "Estética": 30,
        "Tecnologia": 60,
        "Iluminação": 40,
        "Serviço": 180,
        "Outro": 30,
    }[category]


def load_processed_paths() -> dict[str, dict[str, Path]]:
    paths: dict[str, dict[str, Path]] = defaultdict(dict)
    for row in read_csv(PROCESSED_INDEX_CSV):
        if row["grupo"] != "produto-fotos":
            continue
        paths[row["produto_id"]][row["variant"]] = SOURCE_ROOT / row["output_file"]
    return paths


def load_vehicle_map() -> dict[str, list[dict[str, str]]]:
    vehicles: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    for row in read_csv(PRODUCTS_BY_VEHICLE_CSV):
        product_id = row["produto_id"]
        vehicle_key = "|".join([row["veiculo_nome"], row["veiculo_versao"], row["ano_de"], row["ano_ate"]])
        vehicles[product_id][vehicle_key] = {
            "id": row["veiculo_id"],
            "nome": row["veiculo_nome"],
            "versao": row["veiculo_versao"],
            "ano_de": row["ano_de"],
            "ano_ate": row["ano_ate"],
        }
    return {product_id: list(items.values()) for product_id, items in vehicles.items()}


def public_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT / "public").as_posix()


def copy_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def build_description(product: dict[str, str], vehicles: list[dict[str, str]]) -> str:
    if not vehicles:
        return f"Produto Russi Acessórios. Código {product['codigo']}."
    names = sorted({vehicle["nome"] for vehicle in vehicles})
    models = ", ".join(names[:4])
    extra = "" if len(names) <= 4 else f" + {len(names) - 4} modelos"
    return f"Produto Russi Acessórios. Código {product['codigo']}. Compatível com {models}{extra}."


def as_ts(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def main() -> None:
    products = read_csv(PRODUCTS_CSV)
    processed_paths = load_processed_paths()
    vehicle_map = load_vehicle_map()
    catalog = []
    accessories_ts = []

    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)

    for product in products:
        product_id = product["id"]
        code = product["codigo"]
        name = product["nome"].strip()
        slug = f"{code}-{slugify(name)}-id-{product_id}"
        folder = PUBLIC_ROOT / slug
        folder.mkdir(parents=True, exist_ok=True)

        original_source = SOURCE_ROOT / product["foto_arquivo"]
        original_ext = original_source.suffix.lower() or ".jpg"
        original_target = folder / f"original{original_ext}"
        marketplace_target = folder / "marketplace-2000.jpg"
        marketing_target = folder / "marketing-2160x2700.jpg"

        copy_file(original_source, original_target)
        copy_file(processed_paths[product_id]["marketplace-square"], marketplace_target)
        copy_file(processed_paths[product_id]["marketing-4x5"], marketing_target)

        vehicles = vehicle_map.get(product_id, [])
        category = infer_category(name)
        description = build_description(product, vehicles)
        compatibilities = sorted({vehicle["nome"] for vehicle in vehicles})

        item = {
            "id": f"russi_{product_id}",
            "russiId": int(product_id),
            "codigo": code,
            "nome": name,
            "slug": slug,
            "categoria": category,
            "descricao": description,
            "preco": 0,
            "needsPrice": True,
            "tempoInstalacaoMin": default_time_estimate(category),
            "compatibilidades": vehicles,
            "images": {
                "marketplace": public_url(marketplace_target),
                "marketing": public_url(marketing_target),
                "original": public_url(original_target),
            },
            "source": {
                "produtoUrl": product["produto_url"],
                "fotoMime": product["foto_mime"],
                "fotoBytes": int(product["foto_bytes"] or 0),
            },
        }

        accessory = {
            "id": f"russi_{product_id}",
            "name": name,
            "description": description,
            "category": category,
            "imageUrl": item["images"]["marketplace"],
            "attributes": {
                "codigo": code,
                "russiId": int(product_id),
                "marketingImageUrl": item["images"]["marketing"],
                "originalImageUrl": item["images"]["original"],
                "sourceUrl": product["produto_url"],
            },
            "price": 0,
            "timeEstimate": default_time_estimate(category),
            "compatibilities": compatibilities,
            "universal": False,
            "active": True,
        }

        (folder / "metadata.json").write_text(json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")
        catalog.append(item)
        accessories_ts.append(accessory)

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "https://russiacessorios.com.br/catalogo/montadoras/1",
        "assetBaseUrl": "/catalogo/acessorios",
        "counts": {
            "accessories": len(catalog),
            "folders": len(catalog),
            "imagesPerAccessory": 3,
            "totalImages": len(catalog) * 3,
        },
        "files": {
            "catalogJson": "/catalogo/acessorios/catalogo-acessorios.json",
            "catalogCsv": "/catalogo/acessorios/catalogo-acessorios.csv",
            "typescriptData": "src/data/russiAccessories.generated.ts",
        },
    }

    (PUBLIC_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (PUBLIC_ROOT / "catalogo-acessorios.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    with (PUBLIC_ROOT / "catalogo-acessorios.csv").open("w", encoding="utf-8", newline="") as file:
        fieldnames = [
            "id",
            "codigo",
            "nome",
            "categoria",
            "descricao",
            "marketplace",
            "marketing",
            "original",
            "produtoUrl",
        ]
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for item in catalog:
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

    TS_OUTPUT.write_text(
        "import { Accessory } from '../types';\n\n"
        "// Generated from Russi Acessórios catalog. Do not edit manually.\n"
        "// Prices stay 0 because the source catalog does not expose prices.\n"
        f"export const RUSSI_ACCESSORIES: Accessory[] = {as_ts(accessories_ts)};\n",
        encoding="utf-8",
    )

    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
