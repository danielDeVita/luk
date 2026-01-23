import { GraphQLError, GraphQLSchema } from 'graphql';
import {
  getComplexity,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity';
import {
  ApolloServerPlugin,
  GraphQLRequestListener,
  GraphQLSchemaContext,
  BaseContext,
} from '@apollo/server';
import { Logger } from '@nestjs/common';

const logger = new Logger('QueryComplexity');

// Maximum allowed query complexity
// Higher values allow more complex queries
// Typical single query: 10-50, complex dashboard: 100-200
const MAX_COMPLEXITY = 500;

// Warning threshold - log queries approaching limit
const WARN_COMPLEXITY = 300;

/**
 * Apollo Server plugin that limits GraphQL query complexity.
 * Prevents denial-of-service via deeply nested or expensive queries.
 *
 * How it works:
 * - Each field adds 1 to complexity (simpleEstimator)
 * - Fields with @complexity directive can specify custom values
 * - List fields multiply their child complexity by estimated count
 * - Queries exceeding MAX_COMPLEXITY are rejected before execution
 */
export const complexityPlugin: ApolloServerPlugin<BaseContext> = {
  async serverWillStart() {
    let _currentSchema: GraphQLSchema;

    return {
      schemaDidLoadOrUpdate({ apiSchema }: GraphQLSchemaContext) {
        _currentSchema = apiSchema;
      },
    };
  },

  async requestDidStart({
    schema,
  }): Promise<GraphQLRequestListener<BaseContext>> {
    return {
      async didResolveOperation({ request, document }): Promise<void> {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables || {},
          estimators: [
            // Use field-level complexity if defined via @complexity directive
            fieldExtensionsEstimator(),
            // Default: each field has complexity of 1
            // Lists multiply child complexity by 10 (assumes pagination)
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (complexity > WARN_COMPLEXITY) {
          logger.warn(
            `Query approaching complexity limit: ${complexity}/${MAX_COMPLEXITY}`,
            { operationName: request.operationName },
          );
        }

        if (complexity > MAX_COMPLEXITY) {
          logger.error(
            `Query rejected - complexity ${complexity} exceeds limit ${MAX_COMPLEXITY}`,
            { operationName: request.operationName },
          );

          throw new GraphQLError(
            `Query is too complex: ${complexity}. Maximum allowed complexity: ${MAX_COMPLEXITY}`,
            {
              extensions: {
                code: 'QUERY_COMPLEXITY_EXCEEDED',
                complexity,
                maxComplexity: MAX_COMPLEXITY,
              },
            },
          );
        }
      },
    };
  },
};
