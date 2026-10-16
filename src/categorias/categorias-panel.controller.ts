import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { CategoriasService } from './categorias.service.js';

@Roles('FABRICANTE')
@Controller('panel/categorias')
export class CategoriasPanelController {
  constructor(private readonly categorias: CategoriasService) {}

  @Get()
  listar() {
    return this.categorias.listar();
  }
}
