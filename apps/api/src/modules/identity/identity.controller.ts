import { Controller, Get } from '@nestjs/common'
import { IdentityService } from './identity.service'

@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('dev-session')
  async devSession() {
    const user = await this.identity.getOrCreateDevUser()
    return { user }
  }
}
