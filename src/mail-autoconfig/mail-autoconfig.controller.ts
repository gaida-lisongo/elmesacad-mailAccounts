/**
 * Auto-configuration mail (Thunderbird / Outlook).
 * Volontairement SANS guard (pas de JWT, pas d’API key) : exposé publiquement
 * via Traefik (routeurs autoconfig / autodiscover sans forwardAuth).
 */
import { All, Controller, Get, Header } from '@nestjs/common';
import { ThunderbirdConfigService } from './thunderbird.config.service';
import { OutlookAutodiscoverService } from './outlook.autodiscover.service';

const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';

@Controller()
export class MailAutoconfigController {
  constructor(
    private readonly thunderbirdConfig: ThunderbirdConfigService,
    private readonly outlookAutodiscover: OutlookAutodiscoverService,
  ) {}

  @Get('mail/config-v1.1.xml')
  @Header('Content-Type', XML_CONTENT_TYPE)
  getThunderbirdConfigV11(): string {
    return this.thunderbirdConfig.buildConfigV11Xml();
  }

  /**
   * Outlook interroge souvent en GET ou POST (corps XML parfois ignoré pour la réponse statique).
   * ANY couvre GET, POST et les autres verbes si besoin (même payload XML).
   */
  @All('autodiscover/autodiscover.xml')
  @Header('Content-Type', XML_CONTENT_TYPE)
  getOutlookAutodiscover(): string {
    return this.outlookAutodiscover.buildAutodiscoverXml();
  }
}
