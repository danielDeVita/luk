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

  const result = await response.json();

  if (result.errors) {
    throw new Error(
      `API login failed: ${JSON.stringify(result.errors, null, 2)}`,
    );
  }

  const { token, refreshToken, user: userData } = result.data.login;

  // Navigate to establish origin for localStorage
  await page.goto('/');

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
