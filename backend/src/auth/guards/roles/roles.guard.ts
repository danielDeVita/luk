import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from '../../decorators/roles.decorator';

// User type attached to request by Passport
interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

// Extend Request to include user property
interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

// GraphQL context type
interface GqlContext {
  req?: RequestWithUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

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

  private getUser(context: ExecutionContext): AuthenticatedUser | undefined {
    const type = context.getType<string>();

    if (type === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      const gqlContext = ctx.getContext<GqlContext>();
      return gqlContext.req?.user;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request?.user;
  }
}
