import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

@InputType()
export class AskQuestionInput {
  @Field()
  @IsNotEmpty({ message: 'El ID de la rifa es requerido' })
  @IsString()
  raffleId!: string;

  @Field()
  @IsNotEmpty({ message: 'La pregunta no puede estar vacía' })
  @IsString()
  @MinLength(10, { message: 'La pregunta debe tener al menos 10 caracteres' })
  @MaxLength(500, { message: 'La pregunta no puede exceder 500 caracteres' })
  content!: string;
}

@InputType()
export class AnswerQuestionInput {
  @Field()
  @IsNotEmpty({ message: 'El ID de la pregunta es requerido' })
  @IsString()
  questionId!: string;

  @Field()
  @IsNotEmpty({ message: 'La respuesta no puede estar vacía' })
  @IsString()
  @MinLength(5, { message: 'La respuesta debe tener al menos 5 caracteres' })
  @MaxLength(1000, { message: 'La respuesta no puede exceder 1000 caracteres' })
  content!: string;
}
