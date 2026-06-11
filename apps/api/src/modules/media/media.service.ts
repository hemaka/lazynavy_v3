import { BadRequestException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { uploadsDir } from '../../uploads/upload-paths'

type MultipartFile = {
  filename?: string
  mimetype?: string
  toBuffer: () => Promise<Buffer>
}

@Injectable()
export class MediaService {
  async upload(file: MultipartFile | undefined, publicBaseUrl: string) {
    if (!file) throw new BadRequestException('请选择要上传的图片')
    if (!file.mimetype?.startsWith('image/')) throw new BadRequestException('只支持图片上传')

    const buffer = await file.toBuffer()
    const extension = normalizedExtension(file.filename, file.mimetype)
    const filename = `${randomUUID()}${extension}`
    await writeFile(join(uploadsDir, filename), buffer)

    return {
      url: `${publicBaseUrl}/uploads/${filename}`,
      filename,
      mimeType: file.mimetype,
      fileSize: buffer.byteLength,
    }
  }
}

function normalizedExtension(filename: string | undefined, mimetype: string) {
  const fromName = filename ? extname(filename).toLowerCase() : ''
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) return fromName
  if (mimetype === 'image/png') return '.png'
  if (mimetype === 'image/webp') return '.webp'
  if (mimetype === 'image/gif') return '.gif'
  return '.jpg'
}
