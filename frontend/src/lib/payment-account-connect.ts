interface PaymentAccountConnectionResponse {
  authorizationUrl?: string;
}

interface RefreshTokenResponse {
  token?: string;
}

interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
}

interface GetSellerPaymentAccountAuthorizationUrlParams {
  backendUrl: string;
  token: string | null;
  setToken: (token: string) => void;
  fetcher?: typeof fetch;
}

async function readApiErrorMessage(response: Response): Promise<string | null> {
  const payload = (await response.json().catch(() => null)) as
    | ApiErrorResponse
    | null;
  const message = payload?.message;

  if (Array.isArray(message)) {
    return message.join(' ');
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return null;
}

export async function getSellerPaymentAccountAuthorizationUrl({
  backendUrl,
  token,
  setToken,
  fetcher = fetch,
}: GetSellerPaymentAccountAuthorizationUrlParams): Promise<string> {
  const requestAuthorizationUrl = async (authToken: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    return fetcher(`${backendUrl}/payments/account?response=json`, {
      method: 'GET',
      credentials: 'include',
      headers,
    });
  };

  let response = await requestAuthorizationUrl(token);

  if (response.status === 401) {
    const refreshResponse = await fetcher(`${backendUrl}/auth/refresh`, {
      method: 'GET',
      credentials: 'include',
    });

    if (refreshResponse.ok) {
      const refreshData =
        (await refreshResponse.json()) as RefreshTokenResponse;

      if (refreshData.token) {
        setToken(refreshData.token);
        response = await requestAuthorizationUrl(refreshData.token);
      }
    }
  }

  if (!response.ok) {
    const apiErrorMessage =
      response.status === 401 ? null : await readApiErrorMessage(response);

    throw new Error(
      apiErrorMessage ||
        'No pudimos iniciar la conexión con Mercado Pago. Volvé a iniciar sesión e intentá de nuevo.',
    );
  }

  const data =
    (await response.json()) as PaymentAccountConnectionResponse;

  if (!data.authorizationUrl) {
    throw new Error('Mercado Pago no devolvió una URL de autorización válida.');
  }

  return data.authorizationUrl;
}
