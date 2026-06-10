import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const header = request.headers?.authorization as string | undefined
    if (!header?.startsWith('Bearer ')) return true
    return super.canActivate(context)
  }

  handleRequest<TUser = any>(_err: any, user: TUser | false): TUser | null {
    return user || null
  }
}
