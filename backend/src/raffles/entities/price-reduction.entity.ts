import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class PriceReduction {
  @Field(() => ID)
  id!: string;

  @Field()
  raffleId!: string;

  @Field(() => Float)
  precioAnterior!: number;

  @Field(() => Float)
  precioSugerido!: number;

  @Field(() => Float)
  porcentajeReduccion!: number;

  @Field()
  ticketsVendidosAlMomento!: number;

  @Field({ nullable: true })
  aceptada?: boolean | null;

  @Field({ nullable: true })
  fechaRespuesta?: Date | null;

  @Field({ nullable: true })
  raffleTitulo?: string;
}
