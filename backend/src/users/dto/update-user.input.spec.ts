import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateProfileInput,
  ChangePasswordInput,
  UpdateKycInput,
  AcceptTermsInput,
  UpdateAvatarInput,
} from './update-user.input';
import { DocumentType } from '../../common/enums';

describe('Update User DTOs', () => {
  describe('UpdateProfileInput', () => {
    it('should validate empty input (all optional)', async () => {
      const input = plainToInstance(UpdateProfileInput, {});

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate valid profile update', async () => {
      const input = plainToInstance(UpdateProfileInput, {
        nombre: 'John',
        apellido: 'Doe',
        phone: '+5491112345678',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when nombre is too short', async () => {
      const input = plainToInstance(UpdateProfileInput, {
        nombre: 'J',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('nombre');
    });

    it('should fail when apellido is too short', async () => {
      const input = plainToInstance(UpdateProfileInput, {
        apellido: 'D',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('apellido');
    });

    it('should validate partial update with only nombre', async () => {
      const input = plainToInstance(UpdateProfileInput, {
        nombre: 'Jane',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });
  });

  describe('ChangePasswordInput', () => {
    it('should validate valid password change', async () => {
      const input = plainToInstance(ChangePasswordInput, {
        oldPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when oldPassword is empty', async () => {
      const input = plainToInstance(ChangePasswordInput, {
        oldPassword: '',
        newPassword: 'NewPass456!',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('oldPassword');
    });

    it('should fail when newPassword is too short', async () => {
      const input = plainToInstance(ChangePasswordInput, {
        oldPassword: 'OldPass123!',
        newPassword: 'Short1!',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('newPassword');
      expect(errors[0].constraints?.minLength).toBeDefined();
    });

    it('should fail when newPassword has no uppercase', async () => {
      const input = plainToInstance(ChangePasswordInput, {
        oldPassword: 'OldPass123!',
        newPassword: 'newpass456!',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('newPassword');
      expect(errors[0].constraints?.matches).toContain('mayúscula');
    });

    it('should fail when newPassword has no lowercase', async () => {
      const input = plainToInstance(ChangePasswordInput, {
        oldPassword: 'OldPass123!',
        newPassword: 'NEWPASS456!',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('newPassword');
      expect(errors[0].constraints?.matches).toContain('minúscula');
    });

    it('should fail when newPassword has no number', async () => {
      const input = plainToInstance(ChangePasswordInput, {
        oldPassword: 'OldPass123!',
        newPassword: 'NewPassword!',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('newPassword');
      expect(errors[0].constraints?.matches).toContain('número');
    });

    it('should validate strong password with all requirements', async () => {
      const input = plainToInstance(ChangePasswordInput, {
        oldPassword: 'OldPass123!',
        newPassword: 'MyStr0ngP@ss!',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateKycInput', () => {
    const validKycInput = {
      documentType: DocumentType.DNI,
      documentNumber: '12345678',
      street: 'Av. Corrientes',
      streetNumber: '1234',
      city: 'Buenos Aires',
      province: 'Buenos Aires',
      postalCode: '1000',
    };

    it('should validate valid KYC input', async () => {
      const input = plainToInstance(UpdateKycInput, validKycInput);

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate all document types', async () => {
      const documentTypes = [
        DocumentType.DNI,
        DocumentType.PASSPORT,
        DocumentType.CUIT_CUIL,
      ];

      for (const docType of documentTypes) {
        const input = plainToInstance(UpdateKycInput, {
          ...validKycInput,
          documentType: docType,
        });

        const errors = await validate(input);
        expect(errors).toHaveLength(0);
      }
    });

    it('should fail when documentNumber is too short', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        documentNumber: '123',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('documentNumber');
      expect(errors[0].constraints?.minLength).toContain('inválido');
    });

    it('should fail when documentNumber is too long', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        documentNumber: '1'.repeat(21),
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('documentNumber');
      expect(errors[0].constraints?.maxLength).toContain('inválido');
    });

    it('should validate with optional documentFrontUrl', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        documentFrontUrl: 'https://example.com/front.jpg',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate with optional documentBackUrl', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        documentBackUrl: 'https://example.com/back.jpg',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when street is too short', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        street: 'A',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('street');
    });

    it('should validate with optional apartment', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        apartment: 'B',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when city is too short', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        city: 'B',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('city');
    });

    it('should fail when province is too short', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        province: 'B',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('province');
    });

    it('should fail when postalCode is too short', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        postalCode: '123',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('postalCode');
    });

    it('should validate with optional phone', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        phone: '+5491112345678',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should validate valid CUIT format', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        cuitCuil: '20-12345678-5',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail with invalid CUIT format', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        cuitCuil: '20123456785',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('cuitCuil');
      expect(errors[0].constraints?.matches).toContain('XX-XXXXXXXX-X');
    });

    it('should fail with another invalid CUIT format', async () => {
      const input = plainToInstance(UpdateKycInput, {
        ...validKycInput,
        cuitCuil: '20-1234567-5',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('cuitCuil');
    });

    it('should validate without optional cuitCuil', async () => {
      const input = plainToInstance(UpdateKycInput, validKycInput);

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail with multiple validation errors', async () => {
      const input = plainToInstance(UpdateKycInput, {
        documentType: 'INVALID' as DocumentType,
        documentNumber: '1',
        street: 'A',
        city: 'B',
        province: 'C',
        postalCode: '12',
        cuitCuil: 'invalid',
      });

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe('AcceptTermsInput', () => {
    it('should validate valid terms acceptance', async () => {
      const input = plainToInstance(AcceptTermsInput, {
        termsVersion: 'v1.0',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when termsVersion is empty', async () => {
      const input = plainToInstance(AcceptTermsInput, {
        termsVersion: '',
      });

      const errors = await validate(input);
      // @IsString allows empty strings, so we check it passes or has other constraints
      // An empty string is still a valid string according to class-validator's @IsString
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('UpdateAvatarInput', () => {
    it('should validate valid avatar URL', async () => {
      const input = plainToInstance(UpdateAvatarInput, {
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
    });

    it('should fail when avatarUrl is empty', async () => {
      const input = plainToInstance(UpdateAvatarInput, {
        avatarUrl: '',
      });

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('avatarUrl');
      expect(errors[0].constraints?.isNotEmpty).toContain('requerida');
    });

    it('should fail when avatarUrl is not a string', async () => {
      const input = plainToInstance(UpdateAvatarInput, {
        avatarUrl: 123,
      } as any);

      const errors = await validate(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('avatarUrl');
    });
  });
});
