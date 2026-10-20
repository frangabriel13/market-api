-- CreateEnum
CREATE TYPE "TipoTextoLegal" AS ENUM ('TERMINOS', 'PRIVACIDAD');

-- CreateTable
CREATE TABLE "TextoLegal" (
    "tipo" "TipoTextoLegal" NOT NULL,
    "contenido" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextoLegal_pkey" PRIMARY KEY ("tipo")
);
