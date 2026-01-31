import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

type MockConfigService = {
  get: jest.Mock;
};

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn(),
    },
  },
}));

describe('UploadsController', () => {
  let controller: UploadsController;
  let _config: MockConfigService;

  const createConfiguredModule = async () => {
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        const configMap: Record<string, string> = {
          CLOUDINARY_CLOUD_NAME: 'test-cloud',
          CLOUDINARY_API_KEY: 'test-api-key',
          CLOUDINARY_API_SECRET: 'test-api-secret',
        };
        return configMap[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: ConfigService, useValue: mockConfig }],
    }).compile();

    return module;
  };

  const createUnconfiguredModule = async () => {
    const mockConfig = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: ConfigService, useValue: mockConfig }],
    }).compile();

    return module;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor - Cloudinary configured', () => {
    it('should initialize with Cloudinary configured', async () => {
      const module = await createConfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      expect(cloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'test-api-key',
        api_secret: 'test-api-secret',
      });
    });
  });

  describe('constructor - Cloudinary not configured', () => {
    it('should handle missing Cloudinary configuration', async () => {
      const module = await createUnconfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      expect(controller).toBeDefined();
    });
  });

  describe('getUploadSignature', () => {
    it('should generate upload signature when configured', async () => {
      const module = await createConfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue(
        'generated_signature_123',
      );

      const result = controller.getUploadSignature();

      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          folder: 'raffles',
        }),
        'test-api-secret',
      );

      expect(result).toEqual({
        signature: 'generated_signature_123',
        timestamp: expect.any(Number),
        cloudName: 'test-cloud',
        apiKey: 'test-api-key',
        folder: 'raffles',
      });
    });

    it('should return mock data when not configured', async () => {
      const module = await createUnconfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      const result = controller.getUploadSignature();

      expect(result).toEqual({
        error: 'Cloudinary not configured',
        mock: true,
        signature: 'mock_signature',
        timestamp: expect.any(Number),
        cloudName: 'demo',
        apiKey: 'demo',
        folder: 'raffles',
      });
      expect(cloudinary.utils.api_sign_request).not.toHaveBeenCalled();
    });

    it('should generate new timestamp on each call', async () => {
      const module = await createConfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue(
        'signature_1',
      );

      const result1 = controller.getUploadSignature();
      const result2 = controller.getUploadSignature();

      expect(result1.timestamp).toBeLessThanOrEqual(result2.timestamp);
    });
  });

  describe('getAvatarUploadSignature', () => {
    it('should generate avatar upload signature with transformations', async () => {
      const module = await createConfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue(
        'avatar_signature_456',
      );

      const result = controller.getAvatarUploadSignature();

      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          folder: 'avatars',
          transformation: 'c_fill,w_200,h_200,g_face',
        }),
        'test-api-secret',
      );

      expect(result).toEqual({
        signature: 'avatar_signature_456',
        timestamp: expect.any(Number),
        cloudName: 'test-cloud',
        apiKey: 'test-api-key',
        folder: 'avatars',
        transformation: 'c_fill,w_200,h_200,g_face',
      });
    });

    it('should return mock data when not configured', async () => {
      const module = await createUnconfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      const result = controller.getAvatarUploadSignature();

      expect(result).toEqual({
        error: 'Cloudinary not configured',
        mock: true,
        signature: 'mock_signature',
        timestamp: expect.any(Number),
      });
      expect(cloudinary.utils.api_sign_request).not.toHaveBeenCalled();
    });

    it('should use avatars folder instead of raffles', async () => {
      const module = await createConfiguredModule();
      controller = module.get<UploadsController>(UploadsController);

      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue(
        'signature',
      );

      const result = controller.getAvatarUploadSignature();

      expect(result.folder).toBe('avatars');
      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'avatars',
        }),
        expect.any(String),
      );
    });
  });
});
