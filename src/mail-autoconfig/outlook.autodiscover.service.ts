import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OutlookAutodiscoverService {
  constructor(private readonly config: ConfigService) {}

  buildAutodiscoverXml(): string {
    const host = this.config.get<string>(
      'MAIL_SERVER_FQDN',
      'mail.inbtp.ac.cd',
    );
    const imapPort = this.config.get<string>('IMAP_PORT', '993');
    const smtpPort = this.config.get<string>('SMTP_PORT', '465');
    return `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <Account>
      <AccountType>email</AccountType>
      <Action>settings</Action>
      <Protocol>
        <Type>IMAP</Type>
        <Server>${this.esc(host)}</Server>
        <Port>${this.esc(imapPort)}</Port>
        <DomainRequired>on</DomainRequired>
        <LoginName>%EMAILLOCALPART%@%EMAILDOMAIN%</LoginName>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
        <SPA>off</SPA>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>${this.esc(host)}</Server>
        <Port>${this.esc(smtpPort)}</Port>
        <DomainRequired>on</DomainRequired>
        <LoginName>%EMAILLOCALPART%@%EMAILDOMAIN%</LoginName>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
        <SPA>off</SPA>
        <UseTLS>on</UseTLS>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>
`;
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
