import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingAddress } from './entities/shipping-address.entity';
import { CreateShippingAddressInput, UpdateShippingAddressInput } from './dto/shipping-address.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Resolver(() => ShippingAddress)
export class ShippingResolver {
  constructor(private shippingService: ShippingService) {}

  @Query(() => [ShippingAddress])
  @UseGuards(JwtAuthGuard)
  async myShippingAddresses(@CurrentUser() user: { id: string }) {
    return this.shippingService.findAll(user.id);
  }

  @Query(() => ShippingAddress, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async myDefaultShippingAddress(@CurrentUser() user: { id: string }) {
    return this.shippingService.getDefault(user.id);
  }

  @Query(() => ShippingAddress)
  @UseGuards(JwtAuthGuard)
  async shippingAddress(
    @CurrentUser() user: { id: string },
    @Args('id') id: string,
  ) {
    return this.shippingService.findOne(user.id, id);
  }

  @Mutation(() => ShippingAddress)
  @UseGuards(JwtAuthGuard)
  async createShippingAddress(
    @CurrentUser() user: { id: string },
    @Args('input') input: CreateShippingAddressInput,
  ) {
    return this.shippingService.create(user.id, input);
  }

  @Mutation(() => ShippingAddress)
  @UseGuards(JwtAuthGuard)
  async updateShippingAddress(
    @CurrentUser() user: { id: string },
    @Args('id') id: string,
    @Args('input') input: UpdateShippingAddressInput,
  ) {
    return this.shippingService.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteShippingAddress(
    @CurrentUser() user: { id: string },
    @Args('id') id: string,
  ) {
    return this.shippingService.delete(user.id, id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async setDefaultShippingAddress(
    @CurrentUser() user: { id: string },
    @Args('id') id: string,
  ) {
    return this.shippingService.setDefault(user.id, id);
  }
}
