import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { parseMailbox } from '../accounts/mail-accounts.util';

@Injectable()
export class AliasesService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: Connection,
  ) {}

  private throw(msg: string, status = HttpStatus.BAD_REQUEST) {
    throw new HttpException({ ok: false, code: 'validation_error', message: msg }, status);
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

  async list() {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT va.id, va.source, va.destination, vd.name AS domain_name
       FROM virtual_aliases va
       INNER JOIN virtual_domains vd ON va.domain_id = vd.id
       ORDER BY va.source ASC`,
    );
    return { ok: true, rows };
  }

  async create(sourceRaw: string, destinationRaw: string) {
    const s = parseMailbox(sourceRaw);
    const d = parseMailbox(destinationRaw);
    const domainId = await this.getOrCreateDomainId(s.domain);
    try {
      await this.db.execute(
        'INSERT INTO virtual_aliases (domain_id, source, destination) VALUES (?, ?, ?)',
        [domainId, s.email, d.email],
      );
      return { ok: true, status: 'created' as const, alias: { source: s.email, destination: d.email } };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'ER_DUP_ENTRY') {
        this.throw('Alias source already exists');
      }
      throw e;
    }
  }

  async remove(id: number) {
    const [r] = await this.db.execute<ResultSetHeader>(
      'DELETE FROM virtual_aliases WHERE id = ?',
      [id],
    );
    if (r.affectedRows === 0) {
      throw new HttpException(
        { ok: false, code: 'not_found', message: 'Alias not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { ok: true, deleted: true as const, id };
  }
}
