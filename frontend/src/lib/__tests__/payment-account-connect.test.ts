import { describe, expect, it, vi } from 'vitest';
import { getSellerPaymentAccountAuthorizationUrl } from '../payment-account-connect';

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('getSellerPaymentAccountAuthorizationUrl', () => {
  it('requests the Mercado Pago OAuth URL with the current bearer token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        authorizationUrl:
          'https://auth.mercadopago.com.ar/authorization?state=signed',
      }),
    );
    const setToken = vi.fn();

    const authorizationUrl = await getSellerPaymentAccountAuthorizationUrl({
      backendUrl: 'https://backend.test',
      token: 'current-token',
      setToken,
      fetcher,
    });

    expect(authorizationUrl).toBe(
      'https://auth.mercadopago.com.ar/authorization?state=signed',
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://backend.test/payments/account?response=json',
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer current-token',
        },
      },
    );
    expect(setToken).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token and retries the OAuth URL request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'fresh-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          authorizationUrl:
            'https://auth.mercadopago.com.ar/authorization?state=fresh',
        }),
      );
    const setToken = vi.fn();

    const authorizationUrl = await getSellerPaymentAccountAuthorizationUrl({
      backendUrl: 'https://backend.test',
      token: 'expired-token',
      setToken,
      fetcher,
    });

    expect(authorizationUrl).toBe(
      'https://auth.mercadopago.com.ar/authorization?state=fresh',
    );
    expect(setToken).toHaveBeenCalledWith('fresh-token');
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'https://backend.test/payments/account?response=json',
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer fresh-token',
        },
      },
    );
  });

  it('throws a clear error when the backend cannot start the connection', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));

    await expect(
      getSellerPaymentAccountAuthorizationUrl({
        backendUrl: 'https://backend.test',
        token: null,
        setToken: vi.fn(),
        fetcher,
      }),
    ).rejects.toThrow(
      'No pudimos iniciar la conexión con Mercado Pago. Volvé a iniciar sesión e intentá de nuevo.',
    );
  });

  it('surfaces the backend validation message when OAuth configuration is incomplete', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          message:
            'Mercado Pago OAuth no está configurado para conectar vendedores',
          statusCode: 400,
        },
        400,
      ),
    );

    await expect(
      getSellerPaymentAccountAuthorizationUrl({
        backendUrl: 'https://backend.test',
        token: 'current-token',
        setToken: vi.fn(),
        fetcher,
      }),
    ).rejects.toThrow(
      'Mercado Pago OAuth no está configurado para conectar vendedores',
    );
  });

  it('throws a clear error when Mercado Pago authorization URL is missing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}));

    await expect(
      getSellerPaymentAccountAuthorizationUrl({
        backendUrl: 'https://backend.test',
        token: 'current-token',
        setToken: vi.fn(),
        fetcher,
      }),
    ).rejects.toThrow(
      'Mercado Pago no devolvió una URL de autorización válida.',
    );
  });
});
