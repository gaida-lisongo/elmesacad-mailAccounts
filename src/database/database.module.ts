// src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'mysql2/promise';
import * as mysql from 'mysql2/promise';

/** Pool partagé — évite les erreurs « Can't add new command when connection is in closed state »
 *  après timeout MySQL ou coupure réseau (single createConnection était statique jusqu’à mort DB). */
@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_POOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        const portRaw = configService.get<string | number>('DB_PORT') ?? 3306;
        const port =
          typeof portRaw === 'number'
            ? portRaw
            : parseInt(String(portRaw), 10) || 3306;
        const pass =
          configService.get<string>('DB_PASS') ??
          configService.get<string>('DB_SECRET') ??
          'admin';
        const limitRaw = configService.get<string | number>('DB_POOL_LIMIT');
        const connectionLimit =
          typeof limitRaw === 'number'
            ? limitRaw
            : parseInt(String(limitRaw ?? '10'), 10) || 10;
        return mysql.createPool({
          host: configService.get<string>('DB_HOST', 'localhost'),
          port,
          user: configService.get<string>('DB_USER', 'mailuser'),
          password: pass,
          database: configService.get<string>('DB_NAME', 'servermail'),
          waitForConnections: true,
          connectionLimit,
          queueLimit: 0,
          connectTimeout: 8000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });
      },
    },
    {
      /** @deprecated Utiliser DATABASE_POOL ; alias pour ne pas casser les imports existants */
      provide: 'DATABASE_CONNECTION',
      useExisting: 'DATABASE_POOL',
    },
  ],
  exports: ['DATABASE_POOL', 'DATABASE_CONNECTION'],
})
export class DatabaseModule {}