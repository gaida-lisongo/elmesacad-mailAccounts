import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { buildDovecotHash, parseMailbox } from './mail-accounts.util';

export type MailApiErrorCode =
  | 'validation_error'
  | 'not_found'
  | 'db_unreachable'
  | 'db_auth_failed'
  | 'db_missing_config'
  | 'internal_error';

@Injectable()
export class AccountsService {
  constructor(@Inject('DATABASE_CONNECTION') private readonly db: Pool) {}

  private getStatusFromCode(code: MailApiErrorCode): number {
    if (code === 'validation_error') return HttpStatus.BAD_REQUEST;
    if (code === 'not_found') return HttpStatus.NOT_FOUND;
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
      error.message === 'openssl_missing' ||
      error.message === 'user_not_found'
    ) {
      this.throwApiError(
        'validation_error',
        'Invalid payload or user id.',
      );
    }
    if (error.message === 'db_port_invalid') {
      this.throwApiError(
        'db_missing_config',
        'Invalid DB_PORT value. Expected a positive integer.',
      );
    }
    if (mysqlError.code === 'ER_DUP_ENTRY') {
      this.throwApiError('validation_error', 'Email or alias already exists.');
    }
    if (
      mysqlError.code === 'PROTOCOL_CONNECTION_LOST' ||
      mysqlError.code === 'PROTOCOL_ENQUEUE_AFTER_QUIT' ||
      (typeof mysqlError.message === 'string' &&
        mysqlError.message.includes('closed state'))
    ) {
      this.throwApiError(
        'db_unreachable',
        'Connexion MariaDB fermée ou interrompue. Vérifier MariaDB puis redémarrer le service mail si nécessaire.',
      );
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
        'Database authentication failed. Verify DB_USER and DB_PASS/DB_SECRET.',
      );
    }
    this.throwApiError('internal_error', error.message || 'Unexpected server error');
  }

  private async getOrCreateDomainId(domain: string): Promise<number> {
    const [existing] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM virtual_domains WHERE name = ? LIMIT 1',
      [domain],
    );
    if (existing.length) {
      return Number(existing[0].id);
    }
    const [res] = await this.db.execute<ResultSetHeader>(
      'INSERT INTO virtual_domains (name) VALUES (?)',
      [domain],
    );
    return res.insertId;
  }

  async createUser(email: string, password: string) {
    try {
      const m = parseMailbox(email);
      const hash = await buildDovecotHash(password);
      const domainId = await this.getOrCreateDomainId(m.domain);
      const [r] = await this.db.execute<ResultSetHeader>(
        'INSERT INTO virtual_users (domain_id, email, password) VALUES (?, ?, ?)',
        [domainId, m.email, hash],
      );
      return {
        ok: true,
        status: 'created' as const,
        id: r.insertId,
        user: { email: m.email, domain: m.domain },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async listUsers() {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT vu.id, vu.email, vd.id AS domain_id, vd.name AS domain_name
         FROM virtual_users vu
         INNER JOIN virtual_domains vd ON vu.domain_id = vd.id
         ORDER BY vu.email ASC`,
      );
      return { ok: true, rows };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async getUserById(id: number) {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT vu.id, vu.email, vd.id AS domain_id, vd.name AS domain_name
         FROM virtual_users vu
         INNER JOIN virtual_domains vd ON vu.domain_id = vd.id
         WHERE vu.id = ?
         LIMIT 1`,
        [id],
      );
      if (!rows.length) {
        this.throwApiError('not_found', 'User not found');
      }
      return { ok: true, user: rows[0] };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async emailExists(rawEmail: string) {
    try {
      const m = parseMailbox(rawEmail);
      const [rows] = await this.db.execute<RowDataPacket[]>(
        'SELECT 1 AS found FROM virtual_users WHERE email = ? LIMIT 1',
        [m.email],
      );
      return { ok: true, exists: rows.length > 0, email: m.email };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async updateUser(
    id: number,
    body: { email?: string; password?: string },
  ) {
    try {
      if (!body.email?.trim() && !body.password) {
        this.throwApiError('validation_error', 'Provide email and/or password');
      }
      const [found] = await this.db.execute<RowDataPacket[]>(
        'SELECT 1 AS ok FROM virtual_users WHERE id = ? LIMIT 1',
        [id],
      );
      if (!found.length) {
        this.throwApiError('not_found', 'User not found');
      }

      if (body.email && body.password) {
        const m = parseMailbox(body.email);
        const domainId = await this.getOrCreateDomainId(m.domain);
        const hash = await buildDovecotHash(body.password);
        await this.db.execute(
          'UPDATE virtual_users SET email = ?, domain_id = ?, password = ? WHERE id = ?',
          [m.email, domainId, hash, id],
        );
        return { ok: true, updated: true as const, id };
      }
      if (body.email) {
        const m = parseMailbox(body.email);
        const domainId = await this.getOrCreateDomainId(m.domain);
        await this.db.execute(
          'UPDATE virtual_users SET email = ?, domain_id = ? WHERE id = ?',
          [m.email, domainId, id],
        );
        return { ok: true, updated: true as const, id };
      }
      if (body.password) {
        const hash = await buildDovecotHash(body.password);
        await this.db.execute(
          'UPDATE virtual_users SET password = ? WHERE id = ?',
          [hash, id],
        );
        return { ok: true, updated: true as const, id };
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }

  async deleteUser(id: number) {
    try {
      const [r] = await this.db.execute<ResultSetHeader>(
        'DELETE FROM virtual_users WHERE id = ?',
        [id],
      );
      if (r.affectedRows === 0) {
        this.throwApiError('not_found', 'User not found');
      }
      return { ok: true, deleted: true as const, id };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.handleError(error);
    }
  }
}
