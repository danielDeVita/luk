import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { DisputeType, DisputeStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Raffle } from '../../raffles/entities/raffle.entity';

@ObjectType()
export class Dispute {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field(() => Raffle, { nullable: true })
  raffle?: Raffle;

  @Field()
  reporterId!: string;

  @Field(() => User, { nullable: true })
  reporter?: User;

  @Field(() => DisputeType)
  tipo!: DisputeType;

  @Field()
  titulo!: string;

  @Field()
  descripcion!: string;

  @Field(() => [String])
  evidencias!: string[];

  @Field(() => DisputeStatus)
  estado!: DisputeStatus;

  @Field(() => String, { nullable: true })
  respuestaVendedor?: string;

  @Field(() => [String], { nullable: true })
  evidenciasVendedor?: string[];

  @Field(() => String, { nullable: true })
  adminNotes?: string;

  @Field(() => String, { nullable: true })
  resolucion?: string;

  @Field(() => Float, { nullable: true })
  montoReembolsado?: number;

  @Field(() => Float, { nullable: true })
  montoPagadoVendedor?: number;

  @Field(() => Date, { nullable: true })
  fechaRespuestaVendedor?: Date;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date;
}
