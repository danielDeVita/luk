import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DisputeStatus,
  DisputeType,
  Prisma,
  RaffleStatus,
  WalletLedgerEntryType,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { DisputesService } from './disputes.service';

describe('DisputesService', () => {
  let service: DisputesService;

  const prisma = {
    $transaction: jest.fn(),
    raffle: { findUnique: jest.fn(), update: jest.fn() },
    dispute: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    ticket: { findMany: jest.fn(), updateMany: jest.fn() },
    userReputation: { upsert: jest.fn() },
  };

  const walletService = {
    creditUserBalance: jest.fn(),
    debitSellerPayable: jest.fn(),
  };

  const notifications = {
    sendDisputeOpenedToSeller: jest.fn(),
    sendDisputeOpenedToBuyer: jest.fn(),
    sendDisputeResolvedNotification: jest.fn(),
    sendRefundDueToDisputeNotification: jest.fn(),
    create: jest.fn(),
  };

  const audit = {
    logDisputeResolved: jest.fn(),
    logRefundIssued: jest.fn(),
  };

  const activity = {
    logDisputeOpened: jest.fn(),
    logTicketsRefunded: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const raffle = {
    id: 'raffle-1',
    titulo: 'Rifa QA',
    sellerId: 'seller-1',
    winnerId: 'buyer-1',
    estado: RaffleStatus.SORTEADA,
    dispute: null,
    seller: { id: 'seller-1', email: 'seller@luk.test', nombre: 'Seller' },
    winner: { id: 'buyer-1', email: 'buyer@luk.test', nombre: 'Buyer' },
  };

  const dispute = {
    id: 'dispute-1',
    raffleId: 'raffle-1',
    reporterId: 'buyer-1',
    tipo: DisputeType.NO_LLEGO,
    titulo: 'No llegó',
    descripcion: 'No recibí el premio',
    evidencias: [],
    evidenciasVendedor: [],
    estado: DisputeStatus.ABIERTA,
    respuestaVendedor: null,
    resolucion: null,
    montoReembolsado: null,
    montoPagadoVendedor: null,
    adminNotes: null,
    fechaRespuestaVendedor: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    raffle,
    reporter: raffle.winner,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.raffle.findUnique.mockResolvedValue(raffle);
    prisma.dispute.create.mockResolvedValue(dispute);
    prisma.dispute.findUnique.mockResolvedValue(dispute);
    prisma.dispute.update.mockResolvedValue({
      ...dispute,
      estado: DisputeStatus.RESUELTA_COMPRADOR,
      raffle: {
        ...raffle,
        seller: raffle.seller,
        winner: raffle.winner,
      },
      reporter: raffle.winner,
    });
    prisma.ticket.findMany.mockResolvedValue([
      { id: 'ticket-1', precioPagado: new Prisma.Decimal(100) },
    ]);
    prisma.raffle.update.mockResolvedValue({ id: 'raffle-1' });
    prisma.userReputation.upsert.mockResolvedValue({ userId: 'seller-1' });
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        raffle: {
          findUnique: jest.fn().mockResolvedValue({ sellerId: 'seller-1' }),
        },
        ticket: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'ticket-1', precioPagado: new Prisma.Decimal(100) },
            ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        transaction: {
          findFirst: jest.fn().mockResolvedValue({ id: 'purchase-tx-1' }),
        },
      };
      return callback(tx);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: walletService },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
        { provide: ActivityService, useValue: activity },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(DisputesService);
  });

  it('opens a dispute and freezes the raffle delivery state', async () => {
    await service.openDispute('buyer-1', {
      raffleId: 'raffle-1',
      tipo: DisputeType.NO_LLEGO,
      titulo: 'No llegó',
      descripcion: 'No recibí el premio',
      evidencias: [],
    });

    expect(prisma.dispute.create).toHaveBeenCalled();
    expect(prisma.raffle.update).toHaveBeenCalledWith({
      where: { id: 'raffle-1' },
      data: { deliveryStatus: 'DISPUTED' },
    });
  });

  it('resolves buyer disputes by crediting Saldo LUK and debiting seller payable', async () => {
    await service.resolveDispute('admin-1', 'dispute-1', {
      decision: DisputeStatus.RESUELTA_COMPRADOR,
      resolucion: 'Reembolso al comprador',
      montoReembolsado: 100,
    });

    expect(walletService.creditUserBalance).toHaveBeenCalledWith(
      expect.any(Object),
      'buyer-1',
      100,
      WalletLedgerEntryType.TICKET_PURCHASE_REFUND,
      expect.objectContaining({ raffleId: 'raffle-1' }),
    );
    expect(walletService.debitSellerPayable).toHaveBeenCalledWith(
      expect.any(Object),
      'seller-1',
      100,
      expect.objectContaining({ raffleId: 'raffle-1' }),
    );
    expect(audit.logDisputeResolved).toHaveBeenCalledWith(
      'admin-1',
      'dispute-1',
      'Reembolso al comprador',
      expect.any(Object),
    );
  });
});
