import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Connection } from 'mysql2/promise';
import { buildDovecotHash, parseMailbox } from './mail-accounts.util';

export type MailApiErrorCode =
  | 'validation_error'
  | 'db_unreachable'
  | 'db_auth_failed'
  | 'db_missing_config'
  | 'maildir_creation_failed'
  | 'maildir_permission_failed'
  | 'internal_error';

@Injectable()
export class AccountsService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: Connection,
  ) {}

  private getStatusFromCode(code: MailApiErrorCode): number {
    if (code === 'validation_error') return HttpStatus.BAD_REQUEST;
    if (code === 'db_unreachable') return HttpStatus.SERVICE_UNAVAILABLE;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private throwApiError(
    code: MailApiErrorCode,
    message: string,
  ): never {
    throw new HttpException(
      { ok: false, code, message },
      this.getStatusFromCode(code),
    );
  }

  private handleError(error: unknown): never {
    if (!(error instanceof Error)) {
      this.throwApiError('internal_error', 'Unexpected server error');
    }
    const mysqlError = error as Error & { code?: string };
    if (
      error.message === 'invalid_email' ||
      error.message === 'invalid_password' ||
      error.message === 'hash_generation_failed' ||
      error.message === 'openssl_missing'
    ) {
      this.throwApiError(
        'validation_error',
        'Invalid payload. Provide non-empty email/password and an email with user@domain.',
      );
    }
    if (error.message === 'db_port_invalid') {
      this.throwApiError(
        'db_missing_config',
        'Invalid DB_PORT value. Expected a positive integer.',
      );
    }
    if (mysqlError.code === 'ER_DUP_ENTRY') {
      this.throwApiError('validation_error', 'Email already exists.');
    }
    if (
      mysqlError.code === 'ECONNREFUSED' ||
      mysqlError.code === 'ETIMEDOUT' ||
      mysqlError.code === 'EHOSTUNREACH'
    ) {
      this.throwApiError(
        'db_unreachable',
        'Database unreachable. Verify DB_HOST/DB_PORT and network access.',
      );
    }
    if (mysqlError.code === 'ER_ACCESS_DENIED_ERROR') {
      this.throwApiError(
        'db_auth_failed',
        'Database authentication failed. Verify DB_USER and DB_SECRET.',
      );
    }
    if (
      error.message === 'maildir_chown_failed' ||
      error.message === 'chown_command_missing'
    ) {
      this.throwApiError(
        'maildir_permission_failed',
        'Maildir created but chown to vmail:vmail failed.',
      );
    }
    this.throwApiError('internal_error', error.message || 'Unexpected server error');
  }

  async createAccount(email: string, password: string) {
    try {
      const mailbox = parseMailbox(email);
      const hash = await buildDovecotHash(password);
      await this.db.execute(
        'INSERT INTO users (email, password, maildir) VALUES (?, ?, ?)',
        [mailbox.email, hash, mailbox.relativeMaildir],
      );
      return {
        ok: true,
        status: 'created' as const,
        account: {
          email: mailbox.email,
          maildir: mailbox.relativeMaildir,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async listMailAccounts() {
    try {
      const [rows] = await this.db.execute(
        'SELECT email, maildir FROM users ORDER BY email ASC',
      );
      return { ok: true, rows };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async deleteAccount(email: string) {
    try {
      const mailbox = parseMailbox(email);
      await this.db.execute('DELETE FROM users WHERE email = ?', [
        mailbox.email,
      ]);
      return { ok: true, deleted: true as const };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async updatePassword(email: string, password: string) {
    try {
      const mailbox = parseMailbox(email);
      const hash = await buildDovecotHash(password);
      await this.db.execute('UPDATE users SET password = ? WHERE email = ?', [
        hash,
        mailbox.email,
      ]);
      return { ok: true, updated: true as const };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }
}
