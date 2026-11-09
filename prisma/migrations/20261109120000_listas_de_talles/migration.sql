-- CreateTable
CREATE TABLE "ListaTalles" (
    "id" UUID NOT NULL,
    "marcaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "talles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guiaTallesUrl" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListaTalles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "listaTallesId" UUID;

-- Los talles y la guía de cada marca pasan a una lista "Talles" que usan
-- todos sus productos. Las marcas sin talles, guía ni productos arrancan sin
-- listas.
INSERT INTO "ListaTalles" ("id", "marcaId", "nombre", "talles", "guiaTallesUrl")
SELECT gen_random_uuid(), m."id", 'Talles', m."talles", m."guiaTallesUrl"
FROM "Marca" m
WHERE cardinality(m."talles") > 0
   OR m."guiaTallesUrl" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "Producto" p WHERE p."marcaId" = m."id");

UPDATE "Producto" p
SET "listaTallesId" = l."id"
FROM "ListaTalles" l
WHERE l."marcaId" = p."marcaId";

-- AlterTable
ALTER TABLE "Marca" DROP COLUMN "guiaTallesUrl",
DROP COLUMN "talles";

-- CreateIndex
CREATE UNIQUE INDEX "ListaTalles_marcaId_nombre_key" ON "ListaTalles"("marcaId", "nombre");

-- CreateIndex
CREATE INDEX "Producto_listaTallesId_idx" ON "Producto"("listaTallesId");

-- AddForeignKey
ALTER TABLE "ListaTalles" ADD CONSTRAINT "ListaTalles_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_listaTallesId_fkey" FOREIGN KEY ("listaTallesId") REFERENCES "ListaTalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
