-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('TRANSFERENCIA', 'EFECTIVO');

-- AlterTable
-- Los pedidos anteriores (de prueba, previos al lanzamiento) quedan con
-- TRANSFERENCIA; los nuevos siempre la traen.
ALTER TABLE "Pedido" ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "formaPago" "FormaPago" NOT NULL DEFAULT 'TRANSFERENCIA';

ALTER TABLE "Pedido" ALTER COLUMN "formaPago" DROP DEFAULT;
