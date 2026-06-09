import { Controller, Get } from '@nestjs/common'
import { V3_DATABASE_NAME } from '@lazynavy-v3/config'

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { ok: true, service: 'lazynavy-v3-api', database: V3_DATABASE_NAME }
  }
}
