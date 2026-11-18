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

import type { ImageMode } from '../constants/file.constants';

export type { ImageMode };

/** Branding sizes: logos fit 1024 × 512, icons (mark, favicon) on a 256 × 256 canvas. */
const LOGO_BOX = { width: 1024, height: 512 } as const;
const ICON_SIZE = 256;

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
      pipeline = this.resize(pipeline, mode, mimeType);
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

  private resize(pipeline: Sharp, mode: ImageMode, mimeType: string): Sharp {
    switch (mode) {
      case 'avatar':
        return pipeline.resize(this.avatarSize, this.avatarSize, {
          fit: 'cover',
          position: 'centre',
        });
      case 'logo':
        return pipeline.resize(LOGO_BOX.width, LOGO_BOX.height, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      case 'icon':
        // Whole image kept, centred on a square canvas: transparent (PNG / WebP) or white (JPEG).
        return pipeline.resize(ICON_SIZE, ICON_SIZE, {
          fit: 'contain',
          background:
            mimeType === 'image/jpeg'
              ? { r: 255, g: 255, b: 255, alpha: 1 }
              : { r: 0, g: 0, b: 0, alpha: 0 },
        });
      default:
        return pipeline.resize(this.maxDimension, this.maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        });
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
