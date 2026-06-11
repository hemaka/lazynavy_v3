import 'dotenv/config'
import 'reflect-metadata'
import { config as loadEnv } from 'dotenv'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { API_PREFIX } from '@lazynavy-v3/config'
import { AppModule } from './app.module'
import { apiPort } from './config/env'
import { uploadsDir } from './uploads/upload-paths'

loadEnv()

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())
  await app.register(fastifyMultipart, {
    limits: {
      files: 1,
      fileSize: 8 * 1024 * 1024,
    },
  })
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
  })
  app.setGlobalPrefix(API_PREFIX)
  app.enableCors()
  await app.listen(apiPort(), '0.0.0.0')
}

void bootstrap()
