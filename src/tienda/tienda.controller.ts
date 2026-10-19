import { Controller, Get, Param, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { Publico } from '../auth/decorators.js';
import { CategoriasService } from '../categorias/categorias.service.js';
import { IdParamDto } from '../common/id-param.dto.js';
import { productosTiendaQuerySchema } from '../schemas/tienda.js';
import { MarcaDeTienda } from './marca-de-tienda.js';
import { ProductosTiendaService } from './productos-tienda.service.js';
import { TiendaService } from './tienda.service.js';

class ProductosTiendaQueryDto extends createZodDto(
  productosTiendaQuerySchema,
) {}

@Publico()
@Controller('tienda')
export class TiendaController {
  constructor(
    private readonly tienda: TiendaService,
    private readonly categorias: CategoriasService,
    private readonly productos: ProductosTiendaService,
  ) {}

  @Get()
  configuracion(@MarcaDeTienda() marcaId: string) {
    return this.tienda.configuracion(marcaId);
  }

  @Get('categorias')
  listarCategorias(@MarcaDeTienda() marcaId: string) {
    return this.categorias.listarDeTienda(marcaId);
  }

  @Get('destacados')
  destacados(@MarcaDeTienda() marcaId: string) {
    return this.productos.destacados(marcaId);
  }

  @Get('productos')
  listarProductos(
    @MarcaDeTienda() marcaId: string,
    @Query() { categoria }: ProductosTiendaQueryDto,
  ) {
    return this.productos.listar(marcaId, categoria);
  }

  @Get('productos/:id')
  obtenerProducto(
    @MarcaDeTienda() marcaId: string,
    @Param() { id }: IdParamDto,
  ) {
    return this.productos.obtener(marcaId, id);
  }
}
