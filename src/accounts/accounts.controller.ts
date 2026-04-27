import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountApiGuard } from '../guards/account-api.guard';

@Controller('mail-accounts')
@UseGuards(AccountApiGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('exists')
  exists(@Query('email') email?: string) {
    return this.accountsService.emailExists(email ?? '');
  }

  @Get()
  list() {
    return this.accountsService.listUsers();
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.getUserById(id);
  }

  @Post()
  create(@Body() body: { email?: string; password?: string }) {
    return this.accountsService.createUser(body.email ?? '', body.password ?? '');
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { email?: string; password?: string },
  ) {
    return this.accountsService.updateUser(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.deleteUser(id);
  }
}
