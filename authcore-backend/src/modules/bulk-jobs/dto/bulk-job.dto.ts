import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ListQueryDto } from '@common/dto/list-query.dto';

/** History: page, limit and `search` (file name or uploader email). */
export class BulkJobListQueryDto extends ListQueryDto {}

/** A bulk job as lists and polling see it (row results are in the result CSV). */
export class BulkJobDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'USER_CREATE' }) kind!: string;
  @ApiProperty({ example: 'new-hires.csv' }) fileName!: string;
  @ApiProperty() uploadedBy!: string;
  @ApiProperty({ type: String, nullable: true, example: 'admin@example.com' })
  uploadedByEmail!: string | null;
  @ApiProperty({ enum: ['PROCESSING', 'DONE', 'INVALID_TEMPLATE', 'FAILED'] })
  status!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the file was rejected or the job stopped',
  })
  message!: string | null;
  @ApiProperty({ example: 120, description: 'Rows in the file' })
  totalCount!: number;
  @ApiProperty({ example: 115 }) successCount!: number;
  @ApiProperty({ example: 2, description: 'Rows with nothing to do' })
  skippedCount!: number;
  @ApiProperty({ example: 3 }) errorCount!: number;
  @ApiProperty({ example: 120, description: 'Rows finished so far' })
  processedCount!: number;
  @ApiProperty() startedAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) finishedAt!: Date | null;
}

export class BulkJobStatsDto {
  @ApiProperty({ example: 14, description: 'Files uploaded' }) jobs!: number;
  @ApiProperty({ example: 1200, description: 'Rows in all files' })
  rows!: number;
  @ApiProperty({ example: 1150 }) succeeded!: number;
  @ApiProperty({ example: 50 }) failed!: number;
  @ApiProperty({
    example: 2,
    description: 'Files rejected (wrong columns, unreadable …)',
  })
  invalidFiles!: number;
  @ApiPropertyOptional({ type: Date, nullable: true }) lastRunAt!: Date | null;
}
