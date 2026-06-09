import { Module } from '@nestjs/common'
import { HomeController } from './home.controller'
import { HomeService } from './home.service'
import { IdentityModule } from '../identity/identity.module'
import { VesselsModule } from '../vessels/vessels.module'
import { VoyagesModule } from '../voyages/voyages.module'

@Module({
  imports: [IdentityModule, VesselsModule, VoyagesModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
