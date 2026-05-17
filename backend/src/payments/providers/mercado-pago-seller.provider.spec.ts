import { ConfigService } from '@nestjs/config';
import { MercadoPagoSellerProvider } from './mercado-pago-seller.provider';

function jsonResponse(body: object, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    json: async () => body,
  } as Response;
}

describe('MercadoPagoSellerProvider', () => {
  let configService: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = new ConfigService();
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      const values: Record<string, string | boolean> = {
        MP_ACCESS_TOKEN: 'platform-token',
        MP_OAUTH_CLIENT_ID: 'client-id',
        MP_OAUTH_CLIENT_SECRET: 'client-secret',
        MP_OAUTH_REDIRECT_URI:
          'http://localhost:3001/payments/account/callback',
        MP_PAYOUTS_ENABLED: true,
      };
      return values[key];
    });
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  it('builds a Mercado Pago OAuth authorization URL', () => {
    const provider = new MercadoPagoSellerProvider(configService);

    const url = provider.buildAuthorizationUrl('signed-state');

    expect(url).toContain('https://auth.mercadopago.com.ar/authorization');
    expect(url).toContain('client_id=client-id');
    expect(url).toContain('state=signed-state');
  });

  it('exchanges an OAuth code and normalizes the connected seller account', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'seller-access-token',
          refresh_token: 'seller-refresh-token',
          user_id: 123,
          expires_in: 3600,
          scope: 'offline_access',
          token_type: 'bearer',
          public_key: 'public-key',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 123,
          email: 'seller@mp.test',
          nickname: 'seller-mp',
          site_id: 'MLA',
        }),
      );
    const provider = new MercadoPagoSellerProvider(configService);

    const result = await provider.completeOAuth('oauth-code');

    expect(result.providerAccountId).toBe('123');
    expect(result.providerEmail).toBe('seller@mp.test');
    expect(result.accessToken).toBe('seller-access-token');
    expect(result.refreshToken).toBe('seller-refresh-token');
    expect(result.metadata.siteId).toBe('MLA');
  });

  it('creates a Mercado Pago seller payout', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'payout-1',
        status: 'approved',
        transactions: [{ id: 'tx-1', status: 'approved' }],
      }),
    );
    const provider = new MercadoPagoSellerProvider(configService);

    const result = await provider.createSellerPayout({
      payoutId: 'payout-1',
      sellerProviderAccountId: '123',
      sellerProviderEmail: 'seller@mp.test',
      amount: 1500,
      description: 'Liquidación LUK',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/payouts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer platform-token',
          'X-Idempotency-Key': 'payout-1',
        }),
      }),
    );
    expect(result.providerPayoutId).toBe('payout-1');
    expect(result.providerStatus).toBe('completed');
  });

  it('maps rejected payouts to failed', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'payout-1',
        status: 'rejected',
        status_detail: 'account_not_available',
      }),
    );
    const provider = new MercadoPagoSellerProvider(configService);

    const result = await provider.getSellerPayoutStatus('payout-1');

    expect(result.providerStatus).toBe('failed');
    expect(result.providerStatusDetail).toBe('account_not_available');
  });
});
