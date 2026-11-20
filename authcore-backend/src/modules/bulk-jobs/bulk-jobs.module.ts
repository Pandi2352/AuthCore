import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BulkJobsService } from './bulk-jobs.service';
import { BulkJob, BulkJobSchema } from './schemas/bulk-job.schema';

/**
 * Runs uploaded CSV / Excel files row by row and keeps their history and results. Any
 * feature imports this module and gives BulkJobsService a definition of one row.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: BulkJob.name, schema: BulkJobSchema }]),
  ],
  providers: [BulkJobsService],
  exports: [BulkJobsService],
})
export class BulkJobsModule {}
