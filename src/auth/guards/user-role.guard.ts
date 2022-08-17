import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    ctx: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles: string[] = this.reflector.get('roles', ctx.getHandler());

    if (!validRoles || validRoles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as User;

    if (!user) throw new BadRequestException('User not found');

    for (const role of user.roles) {
      if (validRoles.includes(role)) return true;
    }

    throw new ForbiddenException(
      `User ${user.fullname} need a valid role: [${validRoles}]`,
    );
  }
}
