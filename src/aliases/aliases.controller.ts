import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AliasesService } from './aliases.service';
import { AccountApiGuard } from '../guards/account-api.guard';

@Controller('mail-aliases')
@UseGuards(AccountApiGuard)
export class AliasesController {
  constructor(private readonly aliases: AliasesService) {}

  @Get()
  list() {
    return this.aliases.list();
  }

  @Post()
  create(
    @Body() body: { source?: string; destination?: string },
  ) {
    return this.aliases.create(body.source ?? '', body.destination ?? '');
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.aliases.remove(id);
  }
}
