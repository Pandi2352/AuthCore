import { ApiProperty } from '@nestjs/swagger';

class ConflictDto {
  @ApiProperty({ example: 'roleName' })
  field!: string;

  @ApiProperty({
    example: 'A role named "HR Manager" already exists in category MANAGEMENT',
  })
  message!: string;
}

/** Answer of the "does this key / name already exist?" endpoints (live form validation). */
export class ExistsResponseDto {
  @ApiProperty({
    example: true,
    description: 'true when at least one of the given values is taken',
  })
  exists!: boolean;

  @ApiProperty({
    type: [ConflictDto],
    description: 'Which values are taken (empty when all are free)',
  })
  conflicts!: ConflictDto[];
}
