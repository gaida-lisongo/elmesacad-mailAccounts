import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AccountApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.config.get<string>('ACCOUNT_API_KEY')?.trim();
    if (!expected) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new UnauthorizedException(
          'ACCOUNT_API_KEY is not set; refusing API access in production',
        );
      }
      return true;
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = (req.header('X-API-Key') || req.header('x-api-key') || '') as string;
    if (key !== expected) {
      throw new UnauthorizedException('Invalid or missing X-API-Key');
    }
    return true;
  }
}
