import { HttpStatus, Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp, { type Sharp } from 'sharp';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';

import { UPLOAD_FIELD_NAME } from '../constants/file.constants';

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

export type ImageMode = 'avatar' | 'document';

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Re-encodes uploaded images with sharp (libvips):
 * - fully decodes them, so damaged or disguised files are rejected;
 * - applies the EXIF orientation, then drops all metadata (EXIF, GPS
 *   location, camera, XMP, IPTC, comments);
 * - avatars: square crop to IMAGE_AVATAR_SIZE; documents: shrunk to fit
 *   IMAGE_MAX_DIMENSION (never enlarged);
 * - refuses images above IMAGE_MAX_INPUT_PIXELS before decoding (bombs).
 * The format stays the same (JPEG → JPEG, …); GIF animation is kept.
 */
@Injectable()
export class ImageProcessingService implements OnModuleInit {
  private readonly avatarSize: number;
  private readonly maxDimension: number;
  private readonly quality: number;
  private readonly maxInputPixels: number;

  constructor(configService: ConfigService) {
    this.avatarSize = configService.getOrThrow<number>(
      'storage.image.avatarSize',
    );
    this.maxDimension = configService.getOrThrow<number>(
      'storage.image.maxDimension',
    );
    this.quality = configService.getOrThrow<number>('storage.image.quality');
    this.maxInputPixels = configService.getOrThrow<number>(
      'storage.image.maxInputPixels',
    );
  }

  onModuleInit(): void {
    // Uploads are one-off: libvips' operation cache would only hold memory.
    sharp.cache(false);
  }

  isImage(mimeType: string): boolean {
    return IMAGE_TYPES.has(mimeType);
  }

  async process(
    input: Buffer,
    mimeType: string,
    mode: ImageMode,
  ): Promise<ProcessedImage> {
    const isAnimated = mimeType === 'image/gif';
    try {
      let pipeline = sharp(input, {
        limitInputPixels: this.maxInputPixels,
        failOn: 'error',
        animated: isAnimated,
        sequentialRead: true,
      }).rotate();
      pipeline =
        mode === 'avatar'
          ? pipeline.resize(this.avatarSize, this.avatarSize, {
              fit: 'cover',
              position: 'centre',
            })
          : pipeline.resize(this.maxDimension, this.maxDimension, {
              fit: 'inside',
              withoutEnlargement: true,
            });
      const { data, info } = await this.encode(pipeline, mimeType).toBuffer({
        resolveWithObject: true,
      });
      return {
        buffer: data,
        width: info.width,
        height: info.pageHeight ?? info.height,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isTooBig = /pixel limit/i.test(message);
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.FileUnreadable,
        isTooBig
          ? 'The image has too many pixels'
          : 'The image could not be read (damaged or not a real image)',
        [
          {
            field: UPLOAD_FIELD_NAME,
            message: isTooBig
              ? 'image dimensions too large'
              : 'unreadable image',
          },
        ],
      );
    }
  }

  /** Same format out; sharp writes no metadata unless asked to. */
  private encode(pipeline: Sharp, mimeType: string): Sharp {
    switch (mimeType) {
      case 'image/jpeg':
        return pipeline.jpeg({ quality: this.quality, mozjpeg: true });
      case 'image/png':
        return pipeline.png({ compressionLevel: 9 });
      case 'image/webp':
        return pipeline.webp({ quality: this.quality });
      default:
        return pipeline.gif();
    }
  }
}
