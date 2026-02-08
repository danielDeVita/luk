import { Page } from '@playwright/test';

/**
 * Test user credentials (from seed data)
 */
export const TEST_BUYER = {
  email: 'comprador@test.com',
  password: 'Password123!',
};

export const TEST_SELLER = {
  email: 'vendedor@test.com',
  password: 'Password123!',
};

export const TEST_ADMIN = {
  email: 'admin@test.com',
  password: 'Admin123!',
};

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      token
      refreshToken
      user {
        id
        email
        nombre
        apellido
        role
      }
    }
  }
`;

/**
 * Authenticate via direct API call and inject tokens into localStorage.
 * Bypasses the browser login UI entirely — reliable in CI environments.
 */
export async function apiLogin(
  page: Page,
  user: { email: string; password: string },
): Promise<{ token: string; refreshToken: string; user: Record<string, unknown> }> {
  const graphqlUrl =
    process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3001/graphql';

  // Retry login up to 5 times with delay (handles global + login throttler)
  let result;
  for (let attempt = 0; attempt < 5; attempt++) {
    let response;
    try {
      response = await page.request.post(graphqlUrl, {
        data: {
          query: LOGIN_MUTATION,
          variables: { email: user.email, password: user.password },
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      throw new Error(
        `Backend not reachable at ${graphqlUrl}. Start the backend before running E2E tests.\n  Original error: ${error}`,
      );
    }

    // Handle HTTP 429 (global GqlThrottlerGuard) — retry with backoff
    if (response.status() === 429) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }

    result = await response.json();

    if (!result.errors) break;

    // Handle GraphQL-level throttle errors (LoginThrottlerGuard)
    const errorMsg = JSON.stringify(result.errors);
    if (errorMsg.includes('throttl') || errorMsg.includes('rate') || errorMsg.includes('Too many')) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }

    throw new Error(
      `API login failed: ${JSON.stringify(result.errors, null, 2)}`,
    );
  }

  if (!result || result.errors) {
    throw new Error(
      `API login failed after retries: ${result ? JSON.stringify(result.errors, null, 2) : 'HTTP 429 throttled'}`,
    );
  }

  const { token, refreshToken, user: userData } = result.data.login;

  // Navigate to establish origin for localStorage
  // Use domcontentloaded to avoid waiting for Apollo queries to complete
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Set Zustand auth state in localStorage (matches persist format in store/auth.ts)
  // Now that dashboard pages check hasHydrated, they will wait for Zustand to finish
  // reading from localStorage before checking authentication.
  await page.evaluate(
    ({ user, token, refreshToken }) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            user,
            token,
            refreshToken,
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    },
    { user: userData, token, refreshToken },
  );

  return { token, refreshToken, user: userData };
}
