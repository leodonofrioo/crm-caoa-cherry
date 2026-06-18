import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://russiacessorios.com.br";
const MONTADORA_ID = "1";
const OUT_DIR = path.join(process.cwd(), "scraped", "russi-acessorios", `montadora-${MONTADORA_ID}`);

const MIME_EXT = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

async function fetchText(urlPath) {
  const url = new URL(urlPath, BASE_URL);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchJson(urlPath) {
  const text = await fetchText(urlPath);
  return JSON.parse(text);
}

function sanitizeName(value) {
  const clean = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return clean.slice(0, 90) || "item";
}

function parseDataUri(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  return {
    mime,
    ext: MIME_EXT.get(mime) ?? "bin",
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extractNextFlightStream(html) {
  const chunks = [];
  const pattern = /self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g;
  let match;

  while ((match = pattern.exec(html))) {
    chunks.push(JSON.parse(match[1]));
  }

  return chunks.join("");
}

function parseFlightRows(stream) {
  const rows = new Map();
  const ordered = [];
  let pos = 0;

  while (pos < stream.length) {
    while (stream[pos] === "\n") pos += 1;
    if (pos >= stream.length) break;

    const colon = stream.indexOf(":", pos);
    if (colon === -1) break;

    const id = stream.slice(pos, colon);
    const payloadStart = colon + 1;
    let payload;
    let end;
    let type = "line";

    if (stream[payloadStart] === "T") {
      const comma = stream.indexOf(",", payloadStart + 1);
      const hexLength = stream.slice(payloadStart + 1, comma);
      const length = Number.parseInt(hexLength, 16);
      if (!Number.isFinite(length)) {
        throw new Error(`Invalid React Flight text length for row ${id}: ${hexLength}`);
      }

      const textStart = comma + 1;
      payload = stream.slice(textStart, textStart + length);
      end = textStart + length;
      type = "text";
    } else {
      const newline = stream.indexOf("\n", payloadStart);
      end = newline === -1 ? stream.length : newline + 1;
      payload = stream.slice(payloadStart, newline === -1 ? stream.length : newline);
    }

    const row = { id, payload, type };
    ordered.push(row);
    if (id) rows.set(id, row);
    pos = end;
  }

  return { rows, ordered };
}

function findProducts(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProducts(item);
      if (found) return found;
    }
    return null;
  }

  if (Array.isArray(value.produtos)) return value.produtos;

  for (const item of Object.values(value)) {
    const found = findProducts(item);
    if (found) return found;
  }

  return null;
}

function resolveFlightRefs(value, rows) {
  if (typeof value === "string") {
    if (value === "$undefined") return null;

    const ref = value.match(/^\$([0-9a-f]+)$/i);
    if (ref) {
      return rows.get(ref[1])?.payload ?? value;
    }

    return value;
  }

  if (Array.isArray(value)) return value.map((item) => resolveFlightRefs(item, rows));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveFlightRefs(item, rows)]),
    );
  }

  return value;
}

function extractProductsFromFlight(html) {
  const stream = extractNextFlightStream(html);
  const { rows, ordered } = parseFlightRows(stream);

  for (const row of ordered) {
    if (!row.payload.includes('"produtos"')) continue;

    try {
      const parsed = JSON.parse(row.payload);
      const products = findProducts(parsed);
      if (products) return resolveFlightRefs(products, rows);
    } catch {
      // Non-JSON React Flight rows are ignored.
    }
  }

  throw new Error("Could not find produtos array in React Flight payload");
}

async function writeDataImage(dataUri, directory, fileStem) {
  const image = parseDataUri(dataUri);
  if (!image) return null;

  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${fileStem}.${image.ext}`);
  await fs.writeFile(filePath, image.buffer);

  return {
    file: filePath,
    mime: image.mime,
    bytes: image.buffer.length,
  };
}

function relativeToOut(filePath) {
  return path.relative(OUT_DIR, filePath).split(path.sep).join("/");
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function writeCsv(filePath, rows, columns) {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];

  await fs.writeFile(filePath, lines.join("\n"), "utf8");
}

async function scrapeProductsForCar(car) {
  const html = await fetchText(`/catalogo/produtos/${car.id}`);
  return extractProductsFromFlight(html).map((product) => ({
    id: product.id,
    nome: product.nome,
    codigo: product.codigo,
    foto_url: product.foto_url,
    video_url: product.video_url || "",
  }));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const [allCars, allBrands] = await Promise.all([fetchJson("/api/carros"), fetchJson("/api/montadoras")]);
  const brand = allBrands.find((item) => String(item.id) === MONTADORA_ID) ?? {
    id: Number(MONTADORA_ID),
    nome: `montadora-${MONTADORA_ID}`,
  };

  const cars = allCars
    .filter((car) => String(car.montadora_id) === MONTADORA_ID)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const vehicleRows = [];
  const productRows = [];
  const uniqueProducts = new Map();
  const productImageDir = path.join(OUT_DIR, "produto-fotos");
  const vehicleImageDir = path.join(OUT_DIR, "veiculo-fotos");

  for (const car of cars) {
    const vehicleStem = `${car.id}-${sanitizeName(car.nome)}-${sanitizeName(car.versao ?? "")}`;
    const mainVehiclePhoto = await writeDataImage(car.foto_url, vehicleImageDir, `${vehicleStem}-principal`);
    const vehicleGallery = [];

    for (const photo of car.fotos ?? []) {
      const saved = await writeDataImage(
        photo.foto_url,
        vehicleImageDir,
        `${vehicleStem}-foto-${String(photo.ordem ?? photo.id).padStart(2, "0")}`,
      );
      if (saved) {
        vehicleGallery.push({
          id: photo.id,
          ordem: photo.ordem,
          arquivo: relativeToOut(saved.file),
          mime: saved.mime,
          bytes: saved.bytes,
        });
      }
    }

    vehicleRows.push({
      id: car.id,
      nome: car.nome,
      versao: car.versao,
      ano_de: car.ano_de,
      ano_ate: car.ano_ate,
      montadora_id: car.montadora_id,
      foto_arquivo: mainVehiclePhoto ? relativeToOut(mainVehiclePhoto.file) : "",
      fotos: vehicleGallery,
    });

    const products = await scrapeProductsForCar(car);

    for (const product of products) {
      const productStem = `${product.id}-${sanitizeName(product.codigo)}-${sanitizeName(product.nome)}`;
      let imageInfo = uniqueProducts.get(product.id)?.imageInfo;

      if (!imageInfo) {
        const savedProductImage = await writeDataImage(product.foto_url, productImageDir, productStem);
        imageInfo = savedProductImage
          ? {
              arquivo: relativeToOut(savedProductImage.file),
              mime: savedProductImage.mime,
              bytes: savedProductImage.bytes,
            }
          : null;
      }

      const row = {
        montadora_id: brand.id,
        montadora_nome: brand.nome,
        veiculo_id: car.id,
        veiculo_nome: car.nome,
        veiculo_versao: car.versao,
        ano_de: car.ano_de,
        ano_ate: car.ano_ate,
        produto_id: product.id,
        produto_nome: product.nome,
        codigo: product.codigo,
        video_url: product.video_url,
        produto_url: `${BASE_URL}/catalogo/produto/${product.id}`,
        foto_arquivo: imageInfo?.arquivo ?? "",
        foto_mime: imageInfo?.mime ?? "",
        foto_bytes: imageInfo?.bytes ?? "",
      };

      productRows.push(row);

      const existing = uniqueProducts.get(product.id);
      if (existing) {
        existing.veiculos.push({
          id: car.id,
          nome: car.nome,
          versao: car.versao,
          ano_de: car.ano_de,
          ano_ate: car.ano_ate,
        });
      } else {
        uniqueProducts.set(product.id, {
          id: product.id,
          nome: product.nome,
          codigo: product.codigo,
          video_url: product.video_url,
          produto_url: `${BASE_URL}/catalogo/produto/${product.id}`,
          foto_arquivo: imageInfo?.arquivo ?? "",
          foto_mime: imageInfo?.mime ?? "",
          foto_bytes: imageInfo?.bytes ?? "",
          imageInfo,
          veiculos: [
            {
              id: car.id,
              nome: car.nome,
              versao: car.versao,
              ano_de: car.ano_de,
              ano_ate: car.ano_ate,
            },
          ],
        });
      }
    }
  }

  const uniqueProductRows = [...uniqueProducts.values()]
    .map(({ imageInfo, ...product }) => product)
    .sort((a, b) => a.nome.localeCompare(b.nome) || String(a.codigo).localeCompare(String(b.codigo)));

  productRows.sort(
    (a, b) =>
      String(a.veiculo_nome).localeCompare(String(b.veiculo_nome)) ||
      String(a.produto_nome).localeCompare(String(b.produto_nome)) ||
      String(a.codigo).localeCompare(String(b.codigo)),
  );

  const manifest = {
    source_url: `${BASE_URL}/catalogo/montadoras/${MONTADORA_ID}`,
    scraped_at: new Date().toISOString(),
    montadora: {
      id: brand.id,
      nome: brand.nome,
    },
    counts: {
      veiculos: vehicleRows.length,
      produtos_por_veiculo: productRows.length,
      produtos_unicos: uniqueProductRows.length,
      produto_fotos: uniqueProductRows.filter((item) => item.foto_arquivo).length,
      veiculo_fotos: vehicleRows.reduce((total, item) => total + (item.foto_arquivo ? 1 : 0) + item.fotos.length, 0),
    },
    notes: [
      "Produto detalhe /api/produtos/{id} incrementa views no site remoto; scraper nao chama esse endpoint por padrao.",
      "Fotos salvas sao fotos principais disponiveis na listagem de produtos por veiculo.",
    ],
  };

  const productColumns = [
    "montadora_id",
    "montadora_nome",
    "veiculo_id",
    "veiculo_nome",
    "veiculo_versao",
    "ano_de",
    "ano_ate",
    "produto_id",
    "produto_nome",
    "codigo",
    "video_url",
    "produto_url",
    "foto_arquivo",
    "foto_mime",
    "foto_bytes",
  ];

  const uniqueColumns = [
    "id",
    "nome",
    "codigo",
    "video_url",
    "produto_url",
    "foto_arquivo",
    "foto_mime",
    "foto_bytes",
  ];

  await Promise.all([
    fs.writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8"),
    fs.writeFile(path.join(OUT_DIR, "veiculos.json"), JSON.stringify(vehicleRows, null, 2), "utf8"),
    fs.writeFile(path.join(OUT_DIR, "produtos_por_veiculo.json"), JSON.stringify(productRows, null, 2), "utf8"),
    fs.writeFile(path.join(OUT_DIR, "produtos_unicos.json"), JSON.stringify(uniqueProductRows, null, 2), "utf8"),
    writeCsv(path.join(OUT_DIR, "produtos_por_veiculo.csv"), productRows, productColumns),
    writeCsv(path.join(OUT_DIR, "produtos_unicos.csv"), uniqueProductRows, uniqueColumns),
  ]);

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
