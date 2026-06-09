import 'reflect-metadata'
import { config as loadEnv } from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { API_PREFIX } from '@lazynavy-v3/config'
import { AppModule } from './app.module'
import { apiPort } from './config/env'

loadEnv()

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())
  app.setGlobalPrefix(API_PREFIX)
  app.enableCors()
  await app.listen(apiPort(), '0.0.0.0')
}

void bootstrap()
