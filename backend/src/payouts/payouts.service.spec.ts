import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PayoutStatus, Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { PayoutsService } from './payouts.service';

describe('PayoutsService', () => {
  let service: PayoutsService;

  const prisma = {
    raffle: { findUnique: jest.fn(), update: jest.fn() },
    payout: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: { aggregate: jest.fn() },
  };

  const notifications = {
    create: jest.fn(),
    sendPaymentWillBeReleasedNotification: jest.fn(),
    sendSellerPaymentNotification: jest.fn(),
    sendPayoutFailedNotification: jest.fn(),
  };
  const audit = { logPayoutReleased: jest.fn() };
  const activity = {
    logPayoutScheduled: jest.fn(),
    logPayoutReleased: jest.fn(),
    logPayoutFailed: jest.fn(),
  };
  const paymentsService = {
    calculateCommissions: jest.fn(),
    canReleaseFunds: jest.fn(),
  };
  const walletService = {
    debitSellerPayable: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    paymentsService.calculateCommissions.mockReturnValue({
      platformFee: 4,
      processingFee: 0,
      netAmount: 96,
    });
    paymentsService.canReleaseFunds.mockResolvedValue({
      canRelease: true,
      reason: 'OK',
    });
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { monto: new Prisma.Decimal(0) },
    });
    prisma.raffle.findUnique.mockResolvedValue({
      id: 'raffle-1',
      sellerId: 'seller-1',
      titulo: 'Rifa QA',
      tickets: [{ precioPagado: new Prisma.Decimal(100) }],
      payout: null,
    });
    prisma.payout.create.mockResolvedValue({
      id: 'payout-1',
      raffleId: 'raffle-1',
      sellerId: 'seller-1',
      grossAmount: new Prisma.Decimal(100),
      netAmount: new Prisma.Decimal(96),
      status: PayoutStatus.PENDING,
    });
    prisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      raffleId: 'raffle-1',
      sellerId: 'seller-1',
      netAmount: new Prisma.Decimal(96),
      platformFee: new Prisma.Decimal(4),
      processingFee: new Prisma.Decimal(0),
      status: PayoutStatus.PENDING,
      raffle: {
        id: 'raffle-1',
        titulo: 'Rifa QA',
        seller: {
          id: 'seller-1',
          email: 'seller@luk.test',
          sellerPaymentAccount: { id: 'spa-1', status: 'CONNECTED' },
        },
      },
    });
    prisma.payout.update.mockResolvedValue({ id: 'payout-1' });
    prisma.raffle.update.mockResolvedValue({ id: 'raffle-1' });
    walletService.debitSellerPayable.mockResolvedValue({
      sellerPayableBalance: new Prisma.Decimal(0),
    });
    notifications.create.mockResolvedValue({ id: 'notification-1' });
    notifications.sendPaymentWillBeReleasedNotification.mockResolvedValue(true);
    notifications.sendSellerPaymentNotification.mockResolvedValue(true);
    notifications.sendPayoutFailedNotification.mockResolvedValue(true);
    activity.logPayoutScheduled.mockResolvedValue({ id: 'activity-scheduled' });
    activity.logPayoutReleased.mockResolvedValue({ id: 'activity-released' });
    activity.logPayoutFailed.mockResolvedValue({ id: 'activity-failed' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
        { provide: ActivityService, useValue: activity },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: WalletService, useValue: walletService },
      ],
    }).compile();

    service = module.get(PayoutsService);
  });

  it('creates a payout from gross paid tickets and internal fee calculations', async () => {
    const result = await service.createPayout('raffle-1');

    expect(result.id).toBe('payout-1');
    expect(prisma.payout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        grossAmount: 100,
        platformFee: 4,
        processingFee: 0,
        netAmount: 96,
        status: PayoutStatus.PENDING,
      }),
    });
  });

  it('processes payout by debiting seller payable, without provider payout calls', async () => {
    await service.processPayout('payout-1');

    expect(walletService.debitSellerPayable).toHaveBeenCalledWith(
      prisma,
      'seller-1',
      96,
      expect.objectContaining({ raffleId: 'raffle-1' }),
    );
    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'payout-1' },
      data: expect.objectContaining({
        status: PayoutStatus.COMPLETED,
        providerPayoutId: 'internal_payout-1',
      }),
    });
    expect(notifications.create).toHaveBeenCalledWith(
      'seller-1',
      'INFO',
      'Pago completado',
      'Tu pago de $96.00 por "Rifa QA" fue procesado.',
      '/dashboard/payouts',
    );
    expect(notifications.sendSellerPaymentNotification).toHaveBeenCalledWith(
      'seller@luk.test',
      {
        raffleName: 'Rifa QA',
        amount: 96,
        fees: 4,
      },
    );
  });

  it('notifies and logs when payout is scheduled', async () => {
    const scheduled = {
      id: 'payout-1',
      scheduledFor: new Date('2026-05-05T00:00:00.000Z'),
    };
    prisma.payout.update.mockResolvedValueOnce(scheduled);
    prisma.raffle.findUnique.mockResolvedValueOnce({
      sellerId: 'seller-1',
      titulo: 'Rifa QA',
      seller: { email: 'seller@luk.test' },
    });

    await service.schedulePayoutAfterDelivery('raffle-1');

    expect(notifications.create).toHaveBeenCalledWith(
      'seller-1',
      'INFO',
      'Pago programado',
      expect.stringContaining('Rifa QA'),
      '/dashboard/payouts',
    );
    expect(
      notifications.sendPaymentWillBeReleasedNotification,
    ).toHaveBeenCalledWith('seller@luk.test', {
      raffleName: 'Rifa QA',
      daysRemaining: 7,
    });
    expect(activity.logPayoutScheduled).toHaveBeenCalledWith(
      'seller-1',
      'payout-1',
      expect.any(Date),
    );
  });

  it('notifies and logs when payout processing fails', async () => {
    walletService.debitSellerPayable.mockRejectedValueOnce(
      new Error('wallet debit failed'),
    );

    await expect(service.processPayout('payout-1')).rejects.toThrow(
      'wallet debit failed',
    );

    expect(prisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'payout-1' },
      data: expect.objectContaining({
        status: PayoutStatus.FAILED,
        failureReason: 'wallet debit failed',
      }),
    });
    expect(notifications.create).toHaveBeenCalledWith(
      'seller-1',
      'SYSTEM',
      'Error en pago',
      'Hubo un problema procesando tu pago por "Rifa QA". Contactá soporte.',
      '/dashboard/payouts',
    );
    expect(notifications.sendPayoutFailedNotification).toHaveBeenCalledWith(
      'seller@luk.test',
      {
        raffleName: 'Rifa QA',
        amount: 96,
        reason: 'wallet debit failed',
      },
    );
    expect(activity.logPayoutFailed).toHaveBeenCalledWith(
      'seller-1',
      'payout-1',
      'wallet debit failed',
      { raffleId: 'raffle-1' },
    );
  });

  it('blocks payout when buyer protection release conditions are not met', async () => {
    paymentsService.canReleaseFunds.mockResolvedValue({
      canRelease: false,
      reason: 'Hay una disputa activa',
    });

    await expect(service.processPayout('payout-1')).rejects.toThrow(
      BadRequestException,
    );

    expect(walletService.debitSellerPayable).not.toHaveBeenCalled();
  });
});
