import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { AccountsService } from './accounts.service';

@Controller('mail-accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  list() {
    return this.accountsService.listMailAccounts();
  }

  @Post()
  create(@Body() body: { email?: string; password?: string }) {
    return this.accountsService.createAccount(
      body.email ?? '',
      body.password ?? '',
    );
  }

  @Delete()
  remove(@Body() body: { email?: string }) {
    return this.accountsService.deleteAccount(body.email ?? '');
  }

  @Put()
  updatePassword(@Body() body: { email?: string; password?: string }) {
    return this.accountsService.updatePassword(
      body.email ?? '',
      body.password ?? '',
    );
  }
}
