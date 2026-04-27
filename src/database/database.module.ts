// src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mysql from 'mysql2/promise';

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      inject: [ConfigService], // On injecte le service de config ici
      useFactory: async (configService: ConfigService) => {
        const portRaw = configService.get<string | number>('DB_PORT') ?? 3306;
        const port =
          typeof portRaw === 'number'
            ? portRaw
            : parseInt(String(portRaw), 10) || 3306;
        const pass =
          configService.get<string>('DB_PASS') ??
          configService.get<string>('DB_SECRET') ??
          'admin';
        return await mysql.createConnection({
          host: configService.get<string>('DB_HOST', 'localhost'),
          port,
          user: configService.get<string>('DB_USER', 'mailuser'),
          password: pass,
          database: configService.get<string>('DB_NAME', 'servermail'),
          connectTimeout: 8000,
        });
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}