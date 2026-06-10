import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, MaxLength, IsIn, ValidateIf, IsISO8601 } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string

  @IsOptional()
  @IsString()
  avatar?: string

  @IsOptional()
  @IsString()
  coverImage?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  firstLanguage?: string

  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  textLanguage?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  uiLanguage?: string

  @IsOptional()
  @IsIn(['male', 'female', 'private'])
  gender?: string

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  birthDate?: string | null

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  sailingYears?: number

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean

  @IsOptional()
  @IsIn(['exact', 'region', 'hidden'])
  locationPolicy?: string

  // null 表示清空,字符串表示设置为某条 vessel 的 id
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  currentVesselId?: string | null
}
