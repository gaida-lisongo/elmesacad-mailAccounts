import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ThunderbirdConfigService {
  constructor(private readonly config: ConfigService) {}

  buildConfigV11Xml(): string {
    const host = this.config.get<string>(
      'MAIL_SERVER_FQDN',
      'mail.inbtp.ac.cd',
    );
    const imapPort = this.config.get<string>('IMAP_PORT', '993');
    const smtpPort = this.config.get<string>('SMTP_PORT', '465');
    const id =
      this.config.get<string>('MAIL_AUTOCNFIG_EMAIL_PROVIDER_ID', 'inbtp') ||
      'inbtp';
    const displayName = this.config.get<string>(
      'MAIL_DISPLAY_NAME',
      'INBTP Courrier',
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="${this.escapeAttr(id)}">
    <domain>${this.escapeCdata(host)}</domain>
    <displayName>${this.escapeCdata(displayName)}</displayName>
    <displayShortName>${this.escapeCdata(displayName)}</displayShortName>
    <incomingServer type="imap">
      <hostname>${this.escapeCdata(host)}</hostname>
      <port>${this.escapeCdata(imapPort)}</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILLOCALPART%@%EMAILDOMAIN%</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>${this.escapeCdata(host)}</hostname>
      <port>${this.escapeCdata(smtpPort)}</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILLOCALPART%@%EMAILDOMAIN%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>
`;
  }

  private escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private escapeCdata(s: string): string {
    return s.replace(/]]>/g, ']]]]><![CDATA[>');
  }
}
