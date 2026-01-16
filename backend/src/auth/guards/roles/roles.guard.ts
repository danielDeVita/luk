import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = this.getUser(context);
    
    // No user means not authenticated
    if (!user) {
      return false;
    }

    // Check if user has at least one of the required roles
    return requiredRoles.includes(user.role);
  }

  private getUser(context: ExecutionContext) {
    const type = context.getType<string>();
    
    if (type === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext().req?.user;
    }
    
    return context.switchToHttp().getRequest()?.user;
  }
}
