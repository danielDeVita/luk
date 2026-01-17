'use client';

import { useState, useEffect, useRef } from 'react';

const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3001/graphql';

interface GraphQLResponse<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useQuery<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): GraphQLResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const variablesRef = useRef(JSON.stringify(variables));
  const hasFetched = useRef(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL Error');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const variablesString = JSON.stringify(variables);

  useEffect(() => {
    if (!hasFetched.current || variablesRef.current !== variablesString) {
      variablesRef.current = variablesString;
      hasFetched.current = true;
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, variablesString]);

  return { data, loading, error, refetch: fetchData };
}

export async function graphqlMutation<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'GraphQL Error');
    }

    return { data: result.data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}
