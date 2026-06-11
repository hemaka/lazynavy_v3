import { Controller, Post, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../identity/auth/guards/jwt-auth.guard'
import { MediaService } from './media.service'

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  async upload(@Request() req: any) {
    const file = await req.file()
    return this.media.upload(file, publicBaseUrl(req))
  }
}

function publicBaseUrl(req: any) {
  const forwardedProto = firstHeader(req.headers?.['x-forwarded-proto'])
  const forwardedHost = firstHeader(req.headers?.['x-forwarded-host'])
  const protocol = forwardedProto ?? req.protocol ?? 'http'
  const host = forwardedHost ?? firstHeader(req.headers?.host) ?? 'localhost:9180'
  return `${protocol}://${host}`
}

function firstHeader(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0].split(',')[0]?.trim() : undefined
  return typeof value === 'string' ? value.split(',')[0]?.trim() : undefined
}
