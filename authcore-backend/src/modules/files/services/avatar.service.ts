import { HttpStatus, Injectable } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { UsersService } from '@modules/users/users.service';

import type { FileResponseDto } from '../dto/file.dto';
import { FilePurpose } from '../enums/file.enum';
import { FilesService, type IncomingFile } from './files.service';

/** Profile picture: an AVATAR file whose public URL is the user's `picture` claim. */
@Injectable()
export class AvatarService {
  constructor(
    private readonly filesService: FilesService,
    private readonly usersService: UsersService,
  ) {}

  /** Stores a new avatar (the previous one is deleted) and sets `picture`. */
  async set(
    userId: string,
    file: IncomingFile | undefined,
    uploadedBy: string,
  ): Promise<FileResponseDto> {
    await this.requireUser(userId);
    const avatar = await this.filesService.upload(
      file,
      FilePurpose.Avatar,
      userId,
      uploadedBy,
    );
    const attributes = await this.usersService.getAttributes(userId);
    await this.usersService.setAttributes(userId, {
      ...attributes,
      picture: avatar.url,
    });
    return avatar;
  }

  async get(userId: string): Promise<FileResponseDto> {
    const avatar = await this.filesService.findSingle(
      userId,
      FilePurpose.Avatar,
    );
    if (!avatar) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'No profile picture',
      );
    }
    return avatar;
  }

  /** Deletes the avatar file and clears `picture` if it pointed to it. */
  async remove(userId: string): Promise<{ isRemoved: boolean }> {
    await this.requireUser(userId);
    const current = await this.filesService.findSingle(
      userId,
      FilePurpose.Avatar,
    );
    const removedCount = await this.filesService.removeAllOf(
      userId,
      FilePurpose.Avatar,
    );
    const attributes = await this.usersService.getAttributes(userId);
    if (current && attributes.picture === current.url) {
      const rest = { ...attributes };
      Reflect.deleteProperty(rest, 'picture');
      await this.usersService.setAttributes(userId, rest);
    }
    return { isRemoved: removedCount > 0 };
  }

  private async requireUser(userId: string): Promise<void> {
    if (!(await this.usersService.findById(userId))) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'User not found',
      );
    }
  }
}
