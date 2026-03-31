import { getPublicGraphqlUrl } from '@/lib/public-env';

interface GraphqlError {
  message: string;
}

interface GraphqlResponse<TData> {
  data?: TData;
  errors?: GraphqlError[];
}

interface PublicGraphqlOptions {
  revalidate?: number;
}

export async function fetchPublicGraphql<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  query: string,
  variables?: TVariables,
  options: PublicGraphqlOptions = {},
): Promise<TData | null> {
  const graphqlUrl = getPublicGraphqlUrl();

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      next: { revalidate: options.revalidate ?? 300 },
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as GraphqlResponse<TData>;

    if (result.errors?.length) {
      return null;
    }

    return result.data ?? null;
  } catch {
    return null;
  }
}
