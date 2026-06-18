CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "car_models" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "car_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "car_versions" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "car_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "car_years" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "year" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "car_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "imageUrl" TEXT,
  "attributes" JSONB,
  "universal" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variations" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageUrl" TEXT,
  "attributes" JSONB,
  "priceCents" INTEGER NOT NULL,
  "commissionBonusCents" INTEGER,
  "commissionBonusPercent" DOUBLE PRECISION,
  "timeEstimate" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sku" TEXT,
  "legacyAccessoryIds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_variations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_compatibilities" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "variationId" TEXT,
  "model" TEXT NOT NULL,
  "version" TEXT,
  "year" TEXT,
  CONSTRAINT "vehicle_compatibilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales" (
  "id" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientPhone" TEXT NOT NULL,
  "carModel" TEXT NOT NULL,
  "carVersion" TEXT NOT NULL,
  "carYear" TEXT NOT NULL,
  "carSalespersonName" TEXT,
  "installerName" TEXT NOT NULL,
  "installationDate" TEXT NOT NULL,
  "discountCents" INTEGER NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "lostReason" TEXT,
  "internalNotes" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "commissionPercent" DOUBLE PRECISION NOT NULL,
  "commissionCents" INTEGER NOT NULL,
  "baseCommissionCents" INTEGER,
  "productBonusCents" INTEGER,
  "goalExtraCents" INTEGER,
  "goalBonusCents" INTEGER,
  "filmConfiguration" JSONB,
  "commissionStatus" TEXT NOT NULL,
  "commissionPaidAt" TIMESTAMP(3),
  "paymentStatus" TEXT NOT NULL,
  "paymentForecastDate" TEXT,
  "partialPaidCents" INTEGER,
  "installationStatus" TEXT NOT NULL,
  "installationNotes" TEXT,
  CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_items" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "accessoryId" TEXT NOT NULL,
  "productId" TEXT,
  "variationId" TEXT,
  "vehicleModel" TEXT,
  "productName" TEXT,
  "variationName" TEXT,
  "description" TEXT,
  "timeEstimate" INTEGER,
  "name" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "followups" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "carModel" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_events" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "field" TEXT,
  "previousValue" TEXT,
  "nextValue" TEXT,
  "changedBy" TEXT,
  CONSTRAINT "sale_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
CREATE UNIQUE INDEX "car_versions_modelId_name_key" ON "car_versions"("modelId", "name");
CREATE UNIQUE INDEX "car_years_versionId_year_key" ON "car_years"("versionId", "year");
CREATE INDEX "products_name_category_idx" ON "products"("name", "category");
CREATE INDEX "product_variations_productId_name_idx" ON "product_variations"("productId", "name");
CREATE INDEX "vehicle_compatibilities_model_version_year_idx" ON "vehicle_compatibilities"("model", "version", "year");
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");
CREATE INDEX "sales_status_idx" ON "sales"("status");
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");
CREATE INDEX "followups_saleId_idx" ON "followups"("saleId");
CREATE INDEX "followups_dueDate_status_idx" ON "followups"("dueDate", "status");
CREATE INDEX "sale_events_saleId_idx" ON "sale_events"("saleId");
CREATE INDEX "sale_events_createdAt_idx" ON "sale_events"("createdAt");

ALTER TABLE "car_versions" ADD CONSTRAINT "car_versions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "car_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "car_years" ADD CONSTRAINT "car_years_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "car_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_compatibilities" ADD CONSTRAINT "vehicle_compatibilities_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_compatibilities" ADD CONSTRAINT "vehicle_compatibilities_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "followups" ADD CONSTRAINT "followups_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_events" ADD CONSTRAINT "sale_events_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
