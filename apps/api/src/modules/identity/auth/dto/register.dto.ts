import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  nickname!: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsString()
  @MinLength(6)
  password!: string
}
