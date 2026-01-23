import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

// GraphQL context type
interface GqlContext {
  req?: Request;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  getRequest(context: ExecutionContext): Request | undefined {
    // Handle both REST and GraphQL contexts
    const type = context.getType<string>();

    if (type === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      const gqlContext = ctx.getContext<GqlContext>();
      return gqlContext.req;
    }

    return context.switchToHttp().getRequest<Request>();
  }
}
