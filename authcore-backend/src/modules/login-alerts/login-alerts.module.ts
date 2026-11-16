import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '@modules/users/users.module';

import { KnownDevicesController } from './known-devices.controller';
import { KnownDevice, KnownDeviceSchema } from './schemas/known-device.schema';
import { LoginAlertsService } from './services/login-alerts.service';

/** New-device detection + sign-in alerts, account-locked notices. */
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: KnownDevice.name, schema: KnownDeviceSchema },
    ]),
  ],
  controllers: [KnownDevicesController],
  providers: [LoginAlertsService],
  exports: [LoginAlertsService],
})
export class LoginAlertsModule {}
