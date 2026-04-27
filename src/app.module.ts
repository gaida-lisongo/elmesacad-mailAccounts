import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module';
import { MailAutoconfigModule } from './mail-autoconfig/mail-autoconfig.module';
import { AliasesModule } from './aliases/aliases.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    MailAutoconfigModule,
    AccountsModule,
    AliasesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
