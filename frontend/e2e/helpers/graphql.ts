import { Page } from '@playwright/test';

/**
 * GraphQL helper utilities for E2E tests
 */

export interface TestUser {
  email: string;
  password: string;
  id?: string;
  token?: string;
}

/**
 * Execute a GraphQL query/mutation from the browser context
 */
export async function executeGraphQL(
  page: Page,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
) {
  const graphqlUrl =
    process.env.NEXT_PUBLIC_GRAPHQL_URL ||
    'http://localhost:3001/graphql';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await page.request.post(graphqlUrl, {
    data: {
      query,
      variables,
    },
    headers,
  });

  const result = await response.json();

  if (result.errors) {
    throw new Error(
      `GraphQL Error: ${JSON.stringify(result.errors, null, 2)}`,
    );
  }

  return result.data;
}

/**
 * Create a test raffle via GraphQL
 */
export async function createTestRaffle(
  page: Page,
  token: string,
  overrides?: {
    titulo?: string;
    descripcion?: string;
    totalTickets?: number;
    precioPorTicket?: number;
    categoria?: string;
  },
) {
  const mutation = `
    mutation CreateRaffle($input: CreateRaffleInput!) {
      createRaffle(input: $input) {
        id
        titulo
        descripcion
        totalTickets
        precioPorTicket
        estado
      }
    }
  `;

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  const variables = {
    input: {
      titulo: overrides?.titulo || 'Test Raffle',
      descripcion: overrides?.descripcion || 'Test description',
      totalTickets: overrides?.totalTickets || 100,
      precioPorTicket: overrides?.precioPorTicket || 100,
      fechaSorteo: futureDate.toISOString(),
      categoria: overrides?.categoria || 'ELECTRONICA',
      imagenes: [],
    },
  };

  const data = await executeGraphQL(page, mutation, variables, token);
  return data.createRaffle;
}

/**
 * Create test tickets via GraphQL
 */
export async function createTestTickets(
  page: Page,
  token: string,
  raffleId: string,
  quantity: number,
) {
  const mutation = `
    mutation BuyTickets($raffleId: String!, $quantity: Int!) {
      buyTickets(raffleId: $raffleId, quantity: $quantity) {
        paidWithCredit
        creditDebited
        creditBalanceAfter
        tickets {
          id
          numero
        }
      }
    }
  `;

  const variables = {
    raffleId,
    quantity,
  };

  const data = await executeGraphQL(page, mutation, variables, token);
  return data.buyTickets;
}

/**
 * Create a test dispute via GraphQL
 */
export async function createTestDispute(
  page: Page,
  token: string,
  raffleId: string,
  overrides?: {
    tipo?: string;
    descripcion?: string;
  },
) {
  const mutation = `
    mutation OpenDispute($input: OpenDisputeInput!) {
      openDispute(input: $input) {
        id
        tipo
        descripcion
        estado
      }
    }
  `;

  const variables = {
    input: {
      raffleId,
      tipo: overrides?.tipo || 'PRODUCTO_NO_RECIBIDO',
      descripcion:
        overrides?.descripcion || 'Test dispute description',
    },
  };

  const data = await executeGraphQL(page, mutation, variables, token);
  return data.openDispute;
}

/**
 * Get user token from localStorage after login
 */
export async function getUserToken(
  page: Page,
): Promise<string | null> {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.token || null;
    } catch {
      return null;
    }
  });
}

/**
 * Wait for GraphQL request to complete
 */
export async function waitForGraphQL(
  page: Page,
  operationName: string,
  timeout = 5000,
) {
  return page.waitForResponse(
    (response) => {
      if (!response.url().includes('/graphql')) return false;
      return (
        response.request().postDataJSON()?.operationName ===
        operationName
      );
    },
    { timeout },
  );
}
