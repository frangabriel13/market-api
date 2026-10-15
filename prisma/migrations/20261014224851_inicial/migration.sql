-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'FABRICANTE');

-- CreateEnum
CREATE TYPE "EstadoMarca" AS ENUM ('ACTIVA', 'PAUSADA', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('RETIRO', 'ENVIO');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('NUEVO', 'PAGADO', 'EN_PREPARACION', 'ENTREGADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "marcaId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "dominioPropio" TEXT,
    "estado" "EstadoMarca" NOT NULL DEFAULT 'ACTIVA',
    "logoUrl" TEXT,
    "portadaUrl" TEXT,
    "textosBanner" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatsapp" TEXT NOT NULL,
    "direccionRetiro" TEXT,
    "horariosRetiro" TEXT,
    "redes" JSONB NOT NULL DEFAULT '{}',
    "comoComprar" TEXT NOT NULL DEFAULT '',
    "condicionesVenta" TEXT NOT NULL DEFAULT '',
    "minimoCompra" INTEGER NOT NULL DEFAULT 0,
    "colores" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "talles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guiaTallesUrl" TEXT,
    "ultimoNumeroPedido" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcionEntrega" (
    "id" UUID NOT NULL,
    "marcaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEntrega" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OpcionEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "padreId" UUID,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" UUID NOT NULL,
    "marcaId" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoProducto" (
    "id" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "urlMiniatura" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "FotoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variante" (
    "id" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "color" TEXT NOT NULL,
    "talle" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" UUID NOT NULL,
    "marcaId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'NUEVO',
    "opcionEntregaId" UUID NOT NULL,
    "tipoEntrega" "TipoEntrega" NOT NULL,
    "compradorNombre" TEXT NOT NULL,
    "compradorTelefono" TEXT NOT NULL,
    "compradorDni" TEXT,
    "compradorCuit" TEXT,
    "direccion" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "transporte" TEXT,
    "observaciones" TEXT,
    "total" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedido" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "productoId" UUID,
    "nombreProducto" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "talle" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,

    CONSTRAINT "ItemPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_marcaId_key" ON "Usuario"("marcaId");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_slug_key" ON "Marca"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_dominioPropio_key" ON "Marca"("dominioPropio");

-- CreateIndex
CREATE INDEX "OpcionEntrega_marcaId_idx" ON "OpcionEntrega"("marcaId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_slug_key" ON "Categoria"("slug");

-- CreateIndex
CREATE INDEX "Categoria_padreId_idx" ON "Categoria"("padreId");

-- CreateIndex
CREATE INDEX "Producto_marcaId_visible_creadoEn_idx" ON "Producto"("marcaId", "visible", "creadoEn");

-- CreateIndex
CREATE INDEX "Producto_marcaId_categoriaId_idx" ON "Producto"("marcaId", "categoriaId");

-- CreateIndex
CREATE INDEX "FotoProducto_productoId_orden_idx" ON "FotoProducto"("productoId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Variante_productoId_color_talle_key" ON "Variante"("productoId", "color", "talle");

-- CreateIndex
CREATE INDEX "Pedido_marcaId_creadoEn_idx" ON "Pedido"("marcaId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_marcaId_numero_key" ON "Pedido"("marcaId", "numero");

-- CreateIndex
CREATE INDEX "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "ItemPedido_productoId_idx" ON "ItemPedido"("productoId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcionEntrega" ADD CONSTRAINT "OpcionEntrega_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoProducto" ADD CONSTRAINT "FotoProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variante" ADD CONSTRAINT "Variante_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_opcionEntregaId_fkey" FOREIGN KEY ("opcionEntregaId") REFERENCES "OpcionEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
