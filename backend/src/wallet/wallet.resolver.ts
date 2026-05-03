import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { User } from '../users/entities/user.entity';
import { PaymentsService } from '../payments/payments.service';
import { CreateCreditTopUpInput } from './dto/create-credit-top-up.input';
import {
  CreditTopUpReceiptEntity,
  CreditTopUpResult,
  WalletAccountEntity,
  WalletLedgerEntryEntity,
} from './entities/wallet.entity';
import { WalletService } from './wallet.service';

@Resolver()
export class WalletResolver {
  constructor(
    private readonly walletService: WalletService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Query(() => WalletAccountEntity)
  @UseGuards(GqlAuthGuard)
  async myWallet(@CurrentUser() user: User) {
    return this.walletService.getWallet(user.id);
  }

  @Query(() => [WalletLedgerEntryEntity])
  @UseGuards(GqlAuthGuard)
  async walletLedger(
    @CurrentUser() user: User,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ) {
    return this.walletService.getLedger(user.id, take ?? 50);
  }

  @Query(() => CreditTopUpReceiptEntity)
  @UseGuards(GqlAuthGuard)
  async creditTopUpReceipt(
    @CurrentUser() user: User,
    @Args('topUpSessionId') topUpSessionId: string,
  ) {
    return this.walletService.getCreditTopUpReceipt(user.id, topUpSessionId);
  }

  @Mutation(() => CreditTopUpResult)
  @UseGuards(GqlAuthGuard)
  async createCreditTopUp(
    @CurrentUser() user: User,
    @Args('input') input: CreateCreditTopUpInput,
  ) {
    return this.paymentsService.createCreditTopUp(user.id, input.amount);
  }
}
