import { ApiProperty } from '@nestjs/swagger';

/** POST /uploads response data. */
export class UploadedFileDto {
  @ApiProperty({ description: 'File record id (DELETE /files/:id removes it)' })
  id!: string;
  @ApiProperty({ example: 'image (9).png', description: 'Original file name' })
  name!: string;
  @ApiProperty({
    example: 'upload/2026/11/a9ec9c85-c069-4a54-8d42-652ffb19e0e6.png',
    description: 'Object key on the storage',
  })
  key!: string;
  @ApiProperty({
    example:
      'https://my-bucket.sgp1.digitaloceanspaces.com/upload/2026/11/a9ec9c85-….png',
    description:
      'Public URL: the bucket / CDN address, or /files/public/:id when the storage has no public URL',
  })
  url!: string;
  @ApiProperty({
    example: 'image/png',
    description: 'Detected from the content',
  })
  fileType!: string;
  @ApiProperty({ example: 497225, description: 'Bytes as stored' })
  fileSize!: number;
  @ApiProperty({ example: 0, description: 'PDF page count; 0 for other types' })
  filePages!: number;
}
