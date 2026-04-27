import { Controller, Get, Post, Header } from '@nestjs/common';
import { OutlookAutodiscoverService } from './outlook.autodiscover.service';

@Controller('autodiscover')
export class OutlookAutodiscoverController {
  constructor(
    private readonly outlookAutodiscover: OutlookAutodiscoverService,
  ) {}

  @Get('autodiscover.xml')
  @Post('autodiscover.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  getAutodiscover(): string {
    return this.outlookAutodiscover.buildAutodiscoverXml();
  }
}
