import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { v2 as cloudinary } from 'cloudinary';

@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);
  private readonly isConfigured: boolean;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.isConfigured = true;
      this.logger.log('✅ Cloudinary configured');
    } else {
      this.isConfigured = false;
      this.logger.warn('⚠️ Cloudinary not configured');
    }
  }

  /**
   * GET /uploads/signature
   * Generates a signature for direct Cloudinary uploads from the frontend
   * Returns timestamp, signature, and upload parameters
   */
  @Get('signature')
  @UseGuards(JwtAuthGuard)
  getUploadSignature() {
    if (!this.isConfigured) {
      return {
        error: 'Cloudinary not configured',
        mock: true,
        // Return mock data for development
        signature: 'mock_signature',
        timestamp: Math.floor(Date.now() / 1000),
        cloudName: 'demo',
        apiKey: 'demo',
        folder: 'raffles',
      };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'raffles';

    // Create the signature for Cloudinary upload
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        // Add any additional upload parameters here
      },
      this.configService.get('CLOUDINARY_API_SECRET') || '',
    );

    return {
      signature,
      timestamp,
      cloudName: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      apiKey: this.configService.get<string>('CLOUDINARY_API_KEY'),
      folder,
    };
  }

  /**
   * GET /uploads/signature/avatar
   * Generates signature for avatar uploads with specific transformations
   */
  @Get('signature/avatar')
  @UseGuards(JwtAuthGuard)
  getAvatarUploadSignature() {
    if (!this.isConfigured) {
      return {
        error: 'Cloudinary not configured',
        mock: true,
        signature: 'mock_signature',
        timestamp: Math.floor(Date.now() / 1000),
      };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'avatars';

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        transformation: 'c_fill,w_200,h_200,g_face', // Crop to face, 200x200
      },
      this.configService.get('CLOUDINARY_API_SECRET') || '',
    );

    return {
      signature,
      timestamp,
      cloudName: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      apiKey: this.configService.get<string>('CLOUDINARY_API_KEY'),
      folder,
      transformation: 'c_fill,w_200,h_200,g_face',
    };
  }
}
