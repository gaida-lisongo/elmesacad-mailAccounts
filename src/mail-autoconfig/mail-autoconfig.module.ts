import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThunderbirdConfigController } from './thunderbird.config.controller';
import { ThunderbirdConfigService } from './thunderbird.config.service';
import { OutlookAutodiscoverController } from './outlook.autodiscover.controller';
import { OutlookAutodiscoverService } from './outlook.autodiscover.service';

@Module({
  imports: [ConfigModule],
  controllers: [ThunderbirdConfigController, OutlookAutodiscoverController],
  providers: [ThunderbirdConfigService, OutlookAutodiscoverService],
})
export class MailAutoconfigModule {}
