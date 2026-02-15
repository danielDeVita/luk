import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateRaffleInput,
  ProductInput,
  UpdateRaffleInput,
  BuyTicketsInput,
  MarkAsShippedInput,
} from './create-raffle.input';
import { ProductCondition } from '../../common/enums';

describe('CreateRaffleInput DTOs', () => {
  describe('ProductInput', () => {
    it('should validate valid product input', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        categoria: 'Electronics',
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://example.com/image1.jpg'],
        especificacionesTecnicas: { color: 'Black', storage: '256GB' },
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when nombre is too short', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'AB',
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://example.com/image1.jpg'],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('nombre');
      expect(errors[0].constraints?.minLength).toContain('3 caracteres');
    });

    it('should fail when nombre exceeds max length', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'A'.repeat(101),
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://example.com/image1.jpg'],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('nombre');
    });

    it('should fail when descripcionDetallada is too short', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada: 'Short',
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://example.com/image1.jpg'],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('descripcionDetallada');
      expect(errors[0].constraints?.minLength).toContain('20 caracteres');
    });

    it('should fail when descripcionDetallada exceeds max length', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada: 'A'.repeat(2001),
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://example.com/image1.jpg'],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('descripcionDetallada');
    });

    it('should fail when no images provided', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        condicion: ProductCondition.NUEVO,
        imagenes: [],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('imagenes');
      expect(errors[0].constraints?.arrayMinSize).toContain(
        'al menos 1 imagen',
      );
    });

    it('should fail when more than 5 images', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        condicion: ProductCondition.NUEVO,
        imagenes: [
          'https://example.com/1.jpg',
          'https://example.com/2.jpg',
          'https://example.com/3.jpg',
          'https://example.com/4.jpg',
          'https://example.com/5.jpg',
          'https://example.com/6.jpg',
        ],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('imagenes');
      expect(errors[0].constraints?.arrayMaxSize).toContain(
        'Máximo 5 imágenes',
      );
    });

    it('should fail when imagen URL is invalid', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        condicion: ProductCondition.NUEVO,
        imagenes: ['not-a-valid-url'],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('imagenes');
    });

    it('should accept optional categoria', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://example.com/image1.jpg'],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should accept optional especificacionesTecnicas', async () => {
      const input = plainToInstance(ProductInput, {
        nombre: 'iPhone 15 Pro',
        descripcionDetallada:
          'This is a detailed description with more than 20 characters',
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://example.com/image1.jpg'],
        especificacionesTecnicas: { key: 'value' },
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate all ProductCondition values', async () => {
      const conditions = [
        ProductCondition.NUEVO,
        ProductCondition.USADO_COMO_NUEVO,
        ProductCondition.USADO_BUEN_ESTADO,
        ProductCondition.USADO_ACEPTABLE,
      ];

      for (const condicion of conditions) {
        const input = plainToInstance(ProductInput, {
          nombre: 'Product',
          descripcionDetallada: 'Detailed description with enough characters',
          condicion,
          imagenes: ['https://example.com/image.jpg'],
        });

        const errors = await validate(input);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('CreateRaffleInput', () => {
    const validProductInput = {
      nombre: 'iPhone 15 Pro',
      descripcionDetallada:
        'Detailed description with more than 20 characters here',
      condicion: ProductCondition.NUEVO,
      imagenes: ['https://example.com/image1.jpg'],
    };

    it('should validate valid create raffle input', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Raffle for iPhone 15 Pro',
        descripcion:
          'This is a long description that meets the minimum requirement of 50 characters',
        productData: validProductInput,
        totalTickets: 100,
        precioPorTicket: 10.5,
        fechaLimite: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when titulo is too short', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Short',
        descripcion:
          'This is a long description that meets the minimum requirement of 50 characters',
        productData: validProductInput,
        totalTickets: 100,
        precioPorTicket: 10.5,
        fechaLimite: new Date(Date.now() + 86400000).toISOString(),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('titulo');
      expect(errors[0].constraints?.minLength).toContain('10 caracteres');
    });

    it('should fail when descripcion is too short', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Valid Title Here',
        descripcion: 'Too short',
        productData: validProductInput,
        totalTickets: 100,
        precioPorTicket: 10.5,
        fechaLimite: new Date(Date.now() + 86400000).toISOString(),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('descripcion');
      expect(errors[0].constraints?.minLength).toContain('50 caracteres');
    });

    it('should fail when totalTickets is less than 10', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Valid Title Here',
        descripcion:
          'This is a long description that meets the minimum requirement of 50 characters',
        productData: validProductInput,
        totalTickets: 5,
        precioPorTicket: 10.5,
        fechaLimite: new Date(Date.now() + 86400000).toISOString(),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('totalTickets');
      expect(errors[0].constraints?.min).toContain('Mínimo 10 tickets');
    });

    it('should fail when totalTickets exceeds 10000', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Valid Title Here',
        descripcion:
          'This is a long description that meets the minimum requirement of 50 characters',
        productData: validProductInput,
        totalTickets: 15000,
        precioPorTicket: 10.5,
        fechaLimite: new Date(Date.now() + 86400000).toISOString(),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('totalTickets');
      expect(errors[0].constraints?.max).toContain('Máximo 10,000 tickets');
    });

    it('should fail when precioPorTicket is less than 1', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Valid Title Here',
        descripcion:
          'This is a long description that meets the minimum requirement of 50 characters',
        productData: validProductInput,
        totalTickets: 100,
        precioPorTicket: 0.5,
        fechaLimite: new Date(Date.now() + 86400000).toISOString(),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('precioPorTicket');
      expect(errors[0].constraints?.min).toContain('precio mínimo es 1');
    });

    it('should fail when precioPorTicket exceeds 1000000', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Valid Title Here',
        descripcion:
          'This is a long description that meets the minimum requirement of 50 characters',
        productData: validProductInput,
        totalTickets: 100,
        precioPorTicket: 2000000,
        fechaLimite: new Date(Date.now() + 86400000).toISOString(),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('precioPorTicket');
      expect(errors[0].constraints?.max).toContain(
        'precio máximo es 1,000,000',
      );
    });

    it('should fail when fechaLimite is in the past', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'Valid Title Here',
        descripcion:
          'This is a long description that meets the minimum requirement of 50 characters',
        productData: validProductInput,
        totalTickets: 100,
        precioPorTicket: 10.5,
        fechaLimite: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      });

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      const fechaLimiteError = errors.find((e) => e.property === 'fechaLimite');
      expect(fechaLimiteError).toBeDefined();
    });

    it('should fail with multiple validation errors', async () => {
      const input = plainToInstance(CreateRaffleInput, {
        titulo: 'AB',
        descripcion: 'Short',
        productData: {
          nombre: 'A',
          descripcionDetallada: 'Short',
          condicion: 'INVALID',
          imagenes: [],
        },
        totalTickets: 5,
        precioPorTicket: 0.5,
        fechaLimite: 'invalid-date',
      });

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe('UpdateRaffleInput', () => {
    it('should validate with all optional fields', async () => {
      const input = plainToInstance(UpdateRaffleInput, {});

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate partial update with titulo', async () => {
      const input = plainToInstance(UpdateRaffleInput, {
        titulo: 'Updated Title Here',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when titulo is too short in update', async () => {
      const input = plainToInstance(UpdateRaffleInput, {
        titulo: 'Short',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('titulo');
    });

    it('should validate partial update with descripcion', async () => {
      const input = plainToInstance(UpdateRaffleInput, {
        descripcion:
          'This is a valid updated description that is long enough for validation',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when descripcion is too short in update', async () => {
      const input = plainToInstance(UpdateRaffleInput, {
        descripcion: 'Short',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('descripcion');
    });

    it('should validate update with imagenes', async () => {
      const input = plainToInstance(UpdateRaffleInput, {
        imagenes: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when imagenes has invalid URL', async () => {
      const input = plainToInstance(UpdateRaffleInput, {
        imagenes: ['not-a-url'],
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('imagenes');
    });
  });

  describe('BuyTicketsInput', () => {
    it('should validate valid buy tickets input', async () => {
      const input = plainToInstance(BuyTicketsInput, {
        raffleId: 'raffle-id-123',
        cantidad: 5,
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when cantidad is less than 1', async () => {
      const input = plainToInstance(BuyTicketsInput, {
        raffleId: 'raffle-id-123',
        cantidad: 0,
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('cantidad');
      expect(errors[0].constraints?.min).toContain('al menos 1 ticket');
    });

    it('should fail when cantidad exceeds 100', async () => {
      const input = plainToInstance(BuyTicketsInput, {
        raffleId: 'raffle-id-123',
        cantidad: 150,
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('cantidad');
      expect(errors[0].constraints?.max).toContain('Máximo 100 tickets');
    });
  });

  describe('MarkAsShippedInput', () => {
    it('should validate valid mark as shipped input', async () => {
      const input = plainToInstance(MarkAsShippedInput, {
        raffleId: 'raffle-id-123',
        trackingNumber: 'TRACK123456',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate without tracking number', async () => {
      const input = plainToInstance(MarkAsShippedInput, {
        raffleId: 'raffle-id-123',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when tracking number exceeds max length', async () => {
      const input = plainToInstance(MarkAsShippedInput, {
        raffleId: 'raffle-id-123',
        trackingNumber: 'A'.repeat(101),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('trackingNumber');
    });
  });
});
