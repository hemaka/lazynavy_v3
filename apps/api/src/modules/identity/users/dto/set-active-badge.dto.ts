import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator'

export class SetActiveBadgeDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  badgeId?: string | null
}
