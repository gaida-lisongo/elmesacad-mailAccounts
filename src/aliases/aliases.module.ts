import { Module } from '@nestjs/common';
import { AliasesController } from './aliases.controller';
import { AliasesService } from './aliases.service';
import { AccountApiGuard } from '../guards/account-api.guard';

@Module({
  controllers: [AliasesController],
  providers: [AliasesService, AccountApiGuard],
})
export class AliasesModule {}
