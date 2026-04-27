import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountApiGuard } from '../guards/account-api.guard';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountApiGuard],
})
export class AccountsModule {}
