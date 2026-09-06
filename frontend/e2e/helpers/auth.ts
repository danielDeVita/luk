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

export const TEST_UNVERIFIED = {
  email: 'unverified@test.com',
  password: 'Password123!',
};

export const TEST_PENDING_KYC = {
  email: 'pending-kyc@test.com',
  password: 'Password123!',
};

export const TEST_REJECTED_KYC = {
  email: 'rejected-kyc@test.com',
  password: 'Password123!',
};

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      token
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
 * Authenticate via direct API call and restore the browser session.
 * Bypasses the browser login UI entirely — reliable in CI environments.
 *
 * Auth cookies (httpOnly refresh token) set by the login response land in
 * the page's cookie jar (page.request shares storage with the page context).
 * Only the user identity is written to localStorage — the access token lives
 * in memory and is re-issued on reload via /auth/refresh, same as real users.
 */
export async function apiLogin(
  page: Page,
  user: { email: string; password: string },
): Promise<{ token: string; user: Record<string, unknown> }> {
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

  const { token, user: userData } = result.data.login;

  // Navigate to establish origin for localStorage
  // Use domcontentloaded to avoid waiting for Apollo queries to complete
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Persist identity only (matches persist format in store/auth.ts).
  // The access token is NOT stored: on reload the app re-issues it into
  // memory via /auth/refresh using the httpOnly cookie from the login above.
  await page.evaluate(({ user }) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user,
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  }, { user: userData });

  // Reload so the app boots through the real session-restore path,
  // then wait for the refresh round-trip (best effort — callers assert UI).
  const refreshResponse = page
    .waitForResponse(
      (response) =>
        response.url().includes('/auth/refresh') &&
        response.request().method() === 'GET',
      { timeout: 15000 },
    )
    .catch(() => null);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await refreshResponse;

  return { token, user: userData };
}
