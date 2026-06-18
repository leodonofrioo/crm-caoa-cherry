from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path.cwd()
CATALOG_ROOT = ROOT / "public" / "catalogo"
PUBLIC_ROOT = ROOT / "public" / "catalogo" / "acessorios"
TS_OUTPUT = ROOT / "src" / "data" / "russiAccessories.generated.ts"
REPORT_OUTPUT = ROOT / "public" / "catalogo" / "acessorios" / "price-resolution-report.json"
CATALOG_ASSETS_OUTPUT = ROOT / "public" / "catalogo" / "catalogo-assets.json"
AUXILIARY_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def brl(value: str | int | float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return float(value.replace(".", "").replace(",", "."))


# Values transcribed from the supplied accessory price table screenshots.
# Exact code match wins. Family rules below apply to color-specific variants when
# the table shows a base product line without final color suffix.
EXACT_PRICES: dict[str, tuple[float, str]] = {
    "5000100000": (brl("1.700,00"), "Tabela com código"),
    "5000120000": (brl("1.600,00"), "Tabela com código"),
    "5000620000": (brl("7.500,00"), "Tabela com código"),
    "5001240000": (brl("6.200,00"), "Tabela com código"),
    "5003750000": (brl("880,00"), "Tabela com código"),
    "5004980000": (brl("1.100,00"), "Tabela com código"),
    "5005000000": (brl("1.100,00"), "Tabela com código"),
    "5007180000": (brl("5.650,00"), "Tabela com código"),
    "5007200000": (brl("235,00"), "Tabela com código"),
    "5008330000": (brl("660,00"), "Tabela com código"),
    "5009150000": (brl("1.250,00"), "Tabela com código"),
    "5009190000": (brl("1.250,00"), "Tabela com código"),
    "5009460000": (brl("9.500,00"), "Tabela com código"),
    "5019160000": (brl("950,00"), "Tabela com código"),
    "5019620000": (brl("1.250,00"), "Tabela com código"),
    "5019660000": (brl("390,00"), "Tabela com código"),
    "5019710000": (brl("1.900,00"), "Tabela com código"),
    "5019770000": (brl("650,00"), "Tabela com código"),
    "5019780000": (brl("290,00"), "Tabela com código"),
    "5019810000": (brl("290,00"), "Tabela com código"),
    "5019820000": (brl("290,00"), "Tabela com código"),
    "5020020000": (brl("4.990,00"), "Tabela com código"),
    "5020250000": (brl("2.250,00"), "Tabela com código"),
    "5020260000": (brl("1.150,00"), "Tabela com código"),
    "5020280000": (brl("650,00"), "Tabela com código"),
    "5020290000": (brl("720,00"), "Tabela com código"),
    "5020310000": (brl("550,00"), "Tabela com código"),
    "5020330000": (brl("950,00"), "Tabela com código"),
    "5020370000": (brl("1.150,00"), "Tabela com código"),
    "5020380000": (brl("650,00"), "Tabela com código"),
    "5022470000": (brl("650,00"), "Tabela com código"),
    "5022490000": (brl("650,00"), "Tabela com código"),
    "5025740000": (brl("1.100,00"), "Tabela com código"),
    "5027410000": (brl("720,00"), "Tabela com código"),
    "5027930000": (brl("720,00"), "Tabela com código"),
    "5028330000": (brl("1.400,00"), "Tabela com código"),
    "5029180000": (brl("940,00"), "Tabela com código"),
    "5031520000": (brl("460,00"), "Tabela com código"),
    "5033050000": (brl("1.200,00"), "Tabela com código"),
    "5033310000": (brl("590,00"), "Tabela com código"),
    "5033560000": (brl("590,00"), "Tabela com código"),
    "5033570000": (brl("650,00"), "Tabela com código"),
    "5033620000": (brl("720,00"), "Tabela com código"),
    "5033630000": (brl("720,00"), "Tabela com código"),
    "5033760000": (brl("1.200,00"), "Tabela com código"),
    "5033890000": (brl("2.250,00"), "Tabela com código"),
    "5034410000": (brl("1.100,00"), "Tabela com código"),
    "5034650000": (brl("2.950,00"), "Tabela com código"),
    "5034710000": (brl("3.850,00"), "Tabela com código"),
    "5034800000": (brl("590,00"), "Tabela com código"),
    "5035430000": (brl("650,00"), "Tabela com código"),
    "5035390000": (brl("940,00"), "Tabela por descrição equivalente: LED - DRL COM PISCA INTEGRADO"),
    "5035660000": (brl("650,00"), "Tabela com código"),
    "5036220000": (brl("495,00"), "Tabela com código"),
    "5036250000": (brl("2.950,00"), "Tabela com código"),
    "5036480000": (brl("2.250,00"), "Tabela com código"),
    "5037410000": (brl("1.150,00"), "Tabela com código"),
    "5038630000": (brl("1.100,00"), "Tabela por descrição equivalente: MODULO - TRAVAMENTO DAS PORTAS"),
    "5039180000": (brl("460,00"), "Tabela com código"),
    "5039200000": (brl("550,00"), "Tabela com código"),
    "5039470000": (brl("720,00"), "Tabela com código"),
    "5039480000": (brl("720,00"), "Tabela com código"),
    "5039550000": (brl("1.200,00"), "Tabela com código"),
    "5039800000": (brl("650,00"), "Tabela com código"),
    "5039810000": (brl("590,00"), "Tabela com código"),
    "5039830000": (brl("2.250,00"), "Tabela com código"),
    "5040240000": (brl("590,00"), "Tabela com código"),
    "5040250000": (brl("650,00"), "Tabela com código"),
    "5040260000": (brl("720,00"), "Tabela com código"),
    "5040270000": (brl("720,00"), "Tabela com código"),
    "5040290000": (brl("720,00"), "Tabela com código"),
    "5040360000": (brl("4.990,00"), "Tabela com código"),
    "5040470000": (brl("7.500,00"), "Tabela com código"),
    "5040570000": (brl("7.800,00"), "Tabela com código"),
    "5040580000": (brl("2.950,00"), "Tabela com código"),
    "5041590000": (brl("1.350,00"), "Tabela com código"),
    "5041750000": (brl("720,00"), "Tabela com código"),
    "5041820000": (brl("3.850,00"), "Tabela com código"),
    "5041830000": (brl("2.200,00"), "Tabela com código"),
    "5042030000": (brl("720,00"), "Tabela com código"),
    "5042680000": (brl("2.950,00"), "Tabela com código"),
    "5043040000": (brl("1.500,00"), "Tabela com código"),
    "5043120000": (brl("3.200,00"), "Tabela com código por descrição equivalente"),
    "5043130000": (brl("350,00"), "Tabela com código"),
    "5043390000": (brl("950,00"), "Tabela com código; valor de 1.500 aparece em outra tabela para variação de multimídia"),
    "5044700000": (brl("720,00"), "Tabela com código/descrição"),
    "5044820000": (brl("2.200,00"), "Tabela com código"),
    "5044830000": (brl("590,00"), "Tabela com código"),
    "5044840000": (brl("720,00"), "Tabela com código"),
    "5044850000": (brl("720,00"), "Tabela com código"),
    "5044980000": (brl("1.200,00"), "Tabela com código"),
    "5044990000": (brl("2.400,00"), "Tabela com código"),
    "5045230000": (brl("1.150,00"), "Tabela com código"),
    "5045770000": (brl("3.850,00"), "Tabela com código"),
    "5045780000": (brl("3.600,00"), "Tabela com código"),
    "5045810000": (brl("1.150,00"), "Tabela com código"),
    "5046000000": (brl("1.500,00"), "Tabela com código por descrição equivalente"),
    "5046260000": (brl("1.250,00"), "Tabela com código"),
    "5047260000": (brl("650,00"), "Tabela com código/descrição"),
    "5048120000": (brl("690,00"), "Tabela com código"),
    "5048130000": (brl("690,00"), "Tabela com código"),
}

FAMILY_PREFIX_PRICES: list[tuple[str, float, str]] = [
    ("501753", brl("905,00"), "Família FRISO PERSONALIZADO sem código-base visível; mesmo padrão das famílias 501839/501840/503407"),
    ("501839", brl("905,00"), "Tabela código-base 5018390000"),
    ("501840", brl("905,00"), "Tabela código-base 5018400000"),
    ("503407", brl("905,00"), "Tabela código-base 5034070000"),
    ("504424", brl("1.750,00"), "Tabela código-base 5044240000"),
    ("504425", brl("1.750,00"), "Tabela código-base 5044250000"),
    ("504426", brl("1.750,00"), "Tabela código-base 5044260000"),
]


SOLAR_FILM_SPEC_SOURCE = (
    "Transparência obtida do padrão comercial G20/G35 no nome oficial. "
    "UV/TSER/IR preenchidos por tabela técnica interna por linha Comum/PS4/PS8; "
    "API oficial Russi consultada não publica ficha UV/IR/TSER."
)

SOLAR_FILM_SPECS: dict[tuple[str, str], dict[str, str | int | bool]] = {
    ("Comum", "G20"): {
        "visibleLightTransmission": 20,
        "uvProtection": 99,
        "heatRejection": 38,
        "infraredRejection": 45,
        "tintColor": "#020617",
    },
    ("Comum", "G35"): {
        "visibleLightTransmission": 35,
        "uvProtection": 99,
        "heatRejection": 35,
        "infraredRejection": 40,
        "tintColor": "#111827",
    },
    ("PS4 Antivandalismo", "G20"): {
        "visibleLightTransmission": 20,
        "uvProtection": 99,
        "heatRejection": 40,
        "infraredRejection": 48,
        "tintColor": "#020617",
    },
    ("PS4 Antivandalismo", "G35"): {
        "visibleLightTransmission": 35,
        "uvProtection": 99,
        "heatRejection": 37,
        "infraredRejection": 43,
        "tintColor": "#111827",
    },
    ("PS8 Antivandalismo", "G20"): {
        "visibleLightTransmission": 20,
        "uvProtection": 99,
        "heatRejection": 42,
        "infraredRejection": 50,
        "tintColor": "#020617",
    },
    ("PS8 Antivandalismo", "G35"): {
        "visibleLightTransmission": 35,
        "uvProtection": 99,
        "heatRejection": 39,
        "infraredRejection": 45,
        "tintColor": "#111827",
    },
}


def infer_solar_film_spec(name: str) -> dict[str, str | int | bool] | None:
    upper = name.upper()
    if "PELICULA SOLAR" not in upper:
        return None

    shade = "G20" if "G20" in upper else "G35" if "G35" in upper else None
    if shade is None:
        return None

    if "PS8" in upper:
        line = "PS8 Antivandalismo"
        thickness_mil = 8
    elif "PS4" in upper:
        line = "PS4 Antivandalismo"
        thickness_mil = 4
    else:
        line = "Comum"
        thickness_mil = None

    specs = SOLAR_FILM_SPECS[(line, shade)].copy()
    specs.update(
        {
            "filmLine": line,
            "filmShade": shade,
            "filmSpecSource": SOLAR_FILM_SPEC_SOURCE,
            "filmSpecConfidence": "derived",
            "officialSpecAvailable": False,
        }
    )
    if thickness_mil is not None:
        specs["filmThicknessMil"] = thickness_mil
    return specs


def infer_category(name: str) -> str:
    upper = name.upper()
    if "PELICULA SOLAR" in upper:
        return "Película Solar"
    if any(token in upper for token in ["PELICULA", "INSULFILM"]):
        return "Película"
    if any(token in upper for token in ["TAPETE", "BANDEJA PORTAMALA", "PORTA MALA - BORRACHA", "PORTA-MALA"]):
        return "Tapete"
    if any(token in upper for token in ["LED", "LAMPADA", "FAROL", "LANTERNA", "LUZ "]):
        return "Iluminação"
    if any(token in upper for token in ["ALARME", "ANTIFURTO", "TRAVA", "SENSOR", "SEGURANCA", "CINTO"]):
        return "Segurança"
    if any(token in upper for token in ["CAMERA", "USB", "MULTIMIDIA", "INTERFACE", "STREAMING", "MODULO", "CARREGADOR"]):
        return "Tecnologia"
    if any(token in upper for token in ["PROTETOR", "CALHA", "CARTER", "SUPAGLASS", "ENGATE", "RACK", "SUPORTE"]):
        return "Proteção"
    if any(token in upper for token in ["APLIQUE", "FRISO", "ENVELOPAMENTO", "SOLEIRA", "SPOILER", "ADESIVO", "REVESTIMENTO"]):
        return "Estética"
    if any(token in upper for token in ["VITRIFICACAO", "CRISTALIZACAO", "HIGIENIZACAO", "RETIRADA"]):
        return "Serviço"
    return "Outro"


def default_time_estimate(category: str, name: str) -> int:
    upper = name.upper()
    if "ENGATE" in upper:
        return 120
    if "PELICULA" in upper:
        return 90
    if "SUPAGLASS" in upper or "VITRIFICACAO" in upper or "REVESTIMENTO" in upper:
        return 180
    return {
        "Película Solar": 90,
        "Película": 90,
        "Tapete": 10,
        "Proteção": 45,
        "Segurança": 60,
        "Estética": 30,
        "Tecnologia": 60,
        "Iluminação": 40,
        "Serviço": 180,
        "Outro": 30,
    }[category]


def resolve_price(code: str) -> tuple[float, str, str]:
    clean = code.strip()
    if clean in EXACT_PRICES:
        value, source = EXACT_PRICES[clean]
        return value, source, "exact"

    for prefix, value, source in FAMILY_PREFIX_PRICES:
        if clean.startswith(prefix):
            return value, source, "family-prefix"

    raise KeyError(clean)


def public_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT / "public").as_posix()


def normalize_code(code: str) -> str:
    return re.sub(r"\s+", "", code)


def load_items() -> list[dict]:
    items = []
    for metadata_path in sorted(PUBLIC_ROOT.glob("*/metadata.json")):
        data = json.loads(metadata_path.read_text(encoding="utf-8"))
        originals = sorted(path for path in metadata_path.parent.iterdir() if path.is_file() and path.stem == "original")
        if not originals:
            continue
        data["_metadataPath"] = str(metadata_path)
        data["_folder"] = metadata_path.parent.name
        data["_originalUrl"] = public_url(originals[0])
        items.append(data)
    return items


def load_auxiliary_catalog_assets() -> list[dict]:
    assets = []
    for path in sorted(CATALOG_ROOT.iterdir()):
        if path.is_file() and path.suffix.lower() in AUXILIARY_IMAGE_EXTENSIONS:
            assets.append(
                {
                    "name": path.stem,
                    "imageUrl": f"/catalogo/{path.name}",
                    "kind": "pelicula-marketing-asset",
                    "sku": None,
                    "source": "public/catalogo",
                }
            )
    return assets


def model_compatibilities(item: dict) -> list[str]:
    return sorted({vehicle["nome"] for vehicle in item.get("compatibilidades", []) if vehicle.get("nome")})


def accessory_description(item: dict) -> str:
    code = normalize_code(str(item["codigo"]))
    models = model_compatibilities(item)
    if models:
        model_text = ", ".join(models)
        return f"{item['nome']}. Código {code}. Compatível com {model_text}."
    return f"{item['nome']}. Código {code}."


def write_catalog(items: list[dict], report_rows: list[dict], auxiliary_assets: list[dict]) -> None:
    catalog = []
    accessories = []

    for item, report in zip(items, report_rows):
        metadata_path = Path(item["_metadataPath"])
        code = normalize_code(str(item["codigo"]))
        category = infer_category(item["nome"])
        description = accessory_description(item)
        price = report["price"]
        original_url = item["_originalUrl"]

        clean_item = {key: value for key, value in item.items() if not key.startswith("_")}
        clean_item["codigo"] = code
        clean_item["categoria"] = category
        clean_item["descricao"] = description
        clean_item["preco"] = price
        clean_item["needsPrice"] = False
        clean_item["tempoInstalacaoMin"] = default_time_estimate(category, item["nome"])
        clean_item["images"] = {"original": original_url}
        clean_item["priceSource"] = {
            "status": report["status"],
            "source": report["source"],
            "resolution": report["resolution"],
            "value": price,
        }
        solar_film_spec = infer_solar_film_spec(item["nome"])
        if solar_film_spec is not None:
            clean_item["filmSpecs"] = solar_film_spec
        metadata_path.write_text(json.dumps(clean_item, ensure_ascii=False, indent=2), encoding="utf-8")
        catalog.append(clean_item)

        attributes = {
            "codigo": code,
            "russiId": clean_item["russiId"],
            "originalImageUrl": original_url,
            "sourceUrl": clean_item["source"]["produtoUrl"],
            "priceSource": report["source"],
            "priceResolution": report["resolution"],
        }
        if solar_film_spec is not None:
            attributes.update(solar_film_spec)
        if category == "Película Solar":
            for index, asset in enumerate(auxiliary_assets, start=1):
                attributes[f"catalogoAuxImage{index}"] = asset["imageUrl"]

        accessories.append(
            {
                "id": clean_item["id"],
                "name": clean_item["nome"],
                "description": description,
                "category": category,
                "imageUrl": original_url,
                "attributes": attributes,
                "price": price,
                "timeEstimate": clean_item["tempoInstalacaoMin"],
                "compatibilities": model_compatibilities(clean_item),
                "universal": False,
                "active": True,
            }
        )

    (PUBLIC_ROOT / "catalogo-acessorios.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    CATALOG_ASSETS_OUTPUT.write_text(json.dumps(auxiliary_assets, ensure_ascii=False, indent=2), encoding="utf-8")

    with (PUBLIC_ROOT / "catalogo-acessorios.csv").open("w", encoding="utf-8", newline="") as file:
        fieldnames = [
            "id",
            "codigo",
            "nome",
            "categoria",
            "preco",
            "compatibilidade",
            "imageUrl",
            "sourceUrl",
            "priceSource",
            "priceResolution",
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
                    "preco": f"{item['preco']:.2f}",
                    "compatibilidade": " | ".join(model_compatibilities(item)),
                    "imageUrl": item["images"]["original"],
                    "sourceUrl": item["source"]["produtoUrl"],
                    "priceSource": item["priceSource"]["source"],
                    "priceResolution": item["priceSource"]["resolution"],
                }
            )

    TS_OUTPUT.write_text(
        "import { Accessory } from '../types';\n\n"
        "// Generated from public/catalogo/acessorios + public/catalogo assets + supplied price table screenshots.\n"
        "// Do not edit manually; rerun scripts/apply-russi-catalog-prices.py.\n"
        f"export const RUSSI_ACCESSORIES: Accessory[] = {json.dumps(accessories, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )


def main() -> None:
    items = load_items()
    auxiliary_assets = load_auxiliary_catalog_assets()
    report_rows = []
    missing = []

    for item in items:
        code = normalize_code(str(item["codigo"]))
        try:
            price, source, resolution = resolve_price(code)
            status = "resolved"
        except KeyError:
            price = None
            source = "Sem preço encontrado nas tabelas fornecidas"
            resolution = "missing"
            status = "missing"
            missing.append({"id": item["id"], "codigo": code, "nome": item["nome"], "folder": item["_folder"]})

        report_rows.append(
            {
                "id": item["id"],
                "codigo": code,
                "nome": item["nome"],
                "folder": item["_folder"],
                "price": price,
                "source": source,
                "resolution": resolution,
                "status": status,
            }
        )

    if missing:
        REPORT_OUTPUT.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "status": "blocked_missing_prices",
                    "missingCount": len(missing),
                    "missing": missing,
                    "resolvedPreview": [row for row in report_rows if row["status"] == "resolved"][:20],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        raise SystemExit(f"Missing prices for {len(missing)} catalog items; see {REPORT_OUTPUT}")

    write_catalog(items, report_rows, auxiliary_assets)

    by_resolution = defaultdict(int)
    for row in report_rows:
        by_resolution[row["resolution"]] += 1
    solar_items = [item for item in items if infer_category(item["nome"]) == "Película Solar"]
    solar_specs_filled = [item for item in solar_items if infer_solar_film_spec(item["nome"]) is not None]

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "public/catalogo/acessorios + public/catalogo assets + supplied screenshots",
        "counts": {
            "catalogItems": len(items),
            "auxiliaryCatalogAssets": len(auxiliary_assets),
            "uniqueCodes": len({row["codigo"] for row in report_rows}),
            "resolvedPrices": len(report_rows),
            "missingPrices": 0,
            "solarFilmItems": len(solar_items),
            "solarFilmUniqueCodes": len({normalize_code(str(item["codigo"])) for item in solar_items}),
            "solarFilmSpecsFilled": len(solar_specs_filled),
            "byResolution": dict(sorted(by_resolution.items())),
        },
        "files": {
            "catalogJson": "/catalogo/acessorios/catalogo-acessorios.json",
            "catalogCsv": "/catalogo/acessorios/catalogo-acessorios.csv",
            "catalogAssets": "/catalogo/catalogo-assets.json",
            "typescriptData": "src/data/russiAccessories.generated.ts",
            "report": "/catalogo/acessorios/price-resolution-report.json",
        },
        "auxiliaryCatalogAssets": auxiliary_assets,
    }

    REPORT_OUTPUT.write_text(json.dumps({"manifest": manifest, "rows": report_rows}, ensure_ascii=False, indent=2), encoding="utf-8")
    (PUBLIC_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
