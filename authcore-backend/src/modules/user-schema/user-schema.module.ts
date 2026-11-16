import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessControlModule } from '@modules/access-control/access-control.module';
import { UsersModule } from '@modules/users/users.module';

import {
  UserAttribute,
  UserAttributeSchema,
} from './schemas/user-attribute.schema';
import { UserAttributeValuesService } from './services/user-attribute-values.service';
import { UserSchemaService } from './services/user-schema.service';
import { UserSchemaController } from './user-schema.controller';

/** Custom user variables: definitions (admin) and value validation (profiles). */
@Module({
  imports: [
    UsersModule,
    AccessControlModule,
    MongooseModule.forFeature([
      { name: UserAttribute.name, schema: UserAttributeSchema },
    ]),
  ],
  controllers: [UserSchemaController],
  providers: [UserSchemaService, UserAttributeValuesService],
  exports: [UserSchemaService, UserAttributeValuesService],
})
export class UserSchemaModule {}
