import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from '@prisma/client';
import { Request } from 'express';

// Extend Request to include user property set by Passport
interface RequestWithUser extends Request {
  user?: User;
}

// GraphQL context type
interface GqlContext {
  req?: RequestWithUser;
  user?: User;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): User | undefined => {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext<GqlContext>();
    return gqlContext?.req?.user ?? gqlContext?.user;
  },
);
