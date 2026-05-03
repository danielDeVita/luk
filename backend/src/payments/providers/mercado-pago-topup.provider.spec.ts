import { ConfigService } from '@nestjs/config';
import { MercadoPagoTopUpProvider } from './mercado-pago-topup.provider';

const preferenceCreateMock = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest
    .fn()
    .mockImplementation(({ accessToken }: { accessToken: string }) => ({
      accessToken,
    })),
  Preference: jest.fn().mockImplementation(() => ({
    create: preferenceCreateMock,
  })),
  Payment: jest.fn(),
}));

describe('MercadoPagoTopUpProvider', () => {
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        MP_ACCESS_TOKEN: 'TEST-token',
        FRONTEND_URL: 'https://luk.example.com',
        BACKEND_URL: 'https://api.luk.example.com',
      };

      return values[key];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    preferenceCreateMock.mockResolvedValue({
      id: 'preference-1',
      init_point: 'https://mercadopago.example/checkout/preference-1',
    });
  });

  it('creates a wallet-only checkout payload with a statement descriptor', async () => {
    const provider = new MercadoPagoTopUpProvider(configService);

    const result = await provider.createCreditTopUp({
      topUpSessionId: 'topup-1',
      userId: 'user-1',
      amount: 3000,
      providerReference: 'luk_topup_123',
      buyerProfile: {
        email: 'buyer@luk.test',
        firstName: 'Buyer',
        lastName: 'QA',
      },
    });

    expect(result).toEqual({
      redirectUrl: 'https://mercadopago.example/checkout/preference-1',
      providerSessionId: 'preference-1',
    });

    const payload = preferenceCreateMock.mock.calls[0][0].body as {
      items: Array<{
        title: string;
        description: string;
      }>;
      statement_descriptor: string;
      external_reference: string;
      notification_url: string;
      back_urls: {
        success: string;
        failure: string;
        pending: string;
      };
    };

    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        title: 'Carga de saldo LUK',
        description: 'Saldo para tu wallet en LUK.',
      }),
    );
    expect(payload.statement_descriptor).toBe('LUK SALDO');
    expect(payload.external_reference).toBe('luk_topup_123');
    expect(payload.notification_url).toBe(
      'https://api.luk.example.com/payments/webhook',
    );
    expect(payload.back_urls).toEqual({
      success: 'https://luk.example.com/checkout/status',
      failure: 'https://luk.example.com/checkout/status',
      pending: 'https://luk.example.com/checkout/status',
    });

    const serializedPayload = JSON.stringify(payload).toLowerCase();
    expect(serializedPayload).not.toContain('rifa');
    expect(serializedPayload).not.toContain('ticket');
  });
});
