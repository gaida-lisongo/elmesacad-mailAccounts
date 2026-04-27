import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailAutoconfigController } from './mail-autoconfig.controller';
import { ThunderbirdConfigService } from './thunderbird.config.service';
import { OutlookAutodiscoverService } from './outlook.autodiscover.service';

@Module({
  imports: [ConfigModule],
  controllers: [MailAutoconfigController],
  providers: [ThunderbirdConfigService, OutlookAutodiscoverService],
})
export class MailAutoconfigModule {}
