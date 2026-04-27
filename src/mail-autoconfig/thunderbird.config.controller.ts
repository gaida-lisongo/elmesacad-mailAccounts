import { Controller, Get, Header } from '@nestjs/common';
import { ThunderbirdConfigService } from './thunderbird.config.service';

@Controller('mail')
export class ThunderbirdConfigController {
  constructor(private readonly thunderbird: ThunderbirdConfigService) {}

  @Get('config-v1.1.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  getClientConfigV11(): string {
    return this.thunderbird.buildConfigV11Xml();
  }
}
