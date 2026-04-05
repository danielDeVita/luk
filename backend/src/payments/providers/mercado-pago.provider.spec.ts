import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TicketPurchaseMode } from '../../common/enums';
import { MercadoPagoProvider } from './mercado-pago.provider';
import type { CreateCheckoutSessionInput } from './payment-provider.types';

const preferenceCreateMock = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest
    .fn()
    .mockImplementation(({ accessToken }) => ({ accessToken })),
  Preference: jest.fn().mockImplementation(() => ({
    create: preferenceCreateMock,
  })),
  Payment: jest.fn(),
}));

describe('MercadoPagoProvider', () => {
  let provider: MercadoPagoProvider;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        MP_ACCESS_TOKEN: 'TEST-access-token',
        FRONTEND_URL: 'http://localhost:3000',
        BACKEND_URL: 'http://localhost:3001',
        PLATFORM_FEE_PERCENT: '4',
      };
      return config[key];
    }),
  };

  const baseInput: CreateCheckoutSessionInput = {
    raffleId: 'raffle-123',
    cantidad: 2,
    buyerId: 'buyer-456',
    precioPorTicket: 1500,
    tituloRifa: 'Rifa QA',
    reservationId: 'reservation-123',
    baseQuantity: 2,
    bonusQuantity: 0,
    grantedQuantity: 2,
    packApplied: false,
    packIneligibilityReason: null,
    grossSubtotal: 3000,
    discountApplied: 0,
    promotionDiscountApplied: 0,
    packDiscountApplied: 0,
    cashChargedAmount: 3150,
    purchaseMode: TicketPurchaseMode.CHOOSE_NUMBERS,
    selectedNumbers: [7, 11],
    selectionPremiumPercent: 5,
    selectionPremiumAmount: 150,
    buyerProfile: {
      email: 'buyer@test.com',
      firstName: 'Buyer',
      lastName: 'User',
      identificationType: 'DNI',
      identificationNumber: '12345678',
      phone: {
        number: '5491122334455',
      },
      registrationDate: '2026-03-01T12:00:00.000Z',
      authenticationType: 'Gmail',
      isFirstPurchaseOnline: false,
      lastPurchase: '2026-03-10T12:00:00.000Z',
      address: {
        zipCode: '1425',
        streetName: 'Av Santa Fe',
        streetNumber: '1234',
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    preferenceCreateMock.mockResolvedValue({
      init_point: 'https://mp.test/checkout',
      id: 'pref-123',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MercadoPagoProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<MercadoPagoProvider>(MercadoPagoProvider);
  });

  it('sends enriched payer data and lottery category to Mercado Pago', async () => {
    await provider.createCheckoutSession(baseInput);

    expect(preferenceCreateMock).toHaveBeenCalledWith({
      body: expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'raffle-123',
            title: '2 Ticket(s) - Rifa QA',
            description:
              'Compra de 2 ticket(s) elegidos (7, 11) para la rifa "Rifa QA"',
            category_id: 'lottery',
            quantity: 1,
            unit_price: 3150,
            currency_id: 'ARS',
          }),
        ],
        payer: {
          email: 'buyer@test.com',
          name: 'Buyer',
          surname: 'User',
          identification: {
            type: 'DNI',
            number: '12345678',
          },
          phone: {
            area_code: undefined,
            number: '5491122334455',
          },
          address: {
            zip_code: '1425',
            street_name: 'Av Santa Fe',
            street_number: '1234',
          },
          authentication_type: 'Gmail',
          registration_date: '2026-03-01T12:00:00.000Z',
          is_first_purchase_online: false,
          last_purchase: '2026-03-10T12:00:00.000Z',
        },
        marketplace_fee: 126,
      }),
    });
  });

  it('omits optional payer subfields when buyer profile lacks them', async () => {
    await provider.createCheckoutSession({
      ...baseInput,
      purchaseMode: TicketPurchaseMode.RANDOM,
      selectedNumbers: null,
      buyerProfile: {
        email: 'buyer@test.com',
        firstName: 'Buyer',
        lastName: 'User',
        registrationDate: '2026-03-01T12:00:00.000Z',
        authenticationType: 'Web Nativa',
        isFirstPurchaseOnline: true,
      },
    });

    const body = preferenceCreateMock.mock.calls[0][0].body;

    expect(body.items[0].description).toBe(
      'Compra de 2 ticket(s) para la rifa "Rifa QA"',
    );
    expect(body.payer).toEqual({
      email: 'buyer@test.com',
      name: 'Buyer',
      surname: 'User',
      authentication_type: 'Web Nativa',
      registration_date: '2026-03-01T12:00:00.000Z',
      is_first_purchase_online: true,
      last_purchase: undefined,
    });
  });
});
