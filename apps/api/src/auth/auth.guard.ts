import {CanActivate,ExecutionContext,Injectable,UnauthorizedException,Inject,createParamDecorator} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {FastifyRequest} from 'fastify';
import {Database} from '../database';
export type AuthRequest=FastifyRequest & {userId:string};
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt:JwtService,@Inject(Database) private readonly db:Database){}
  async canActivate(context:ExecutionContext){
    const req=context.switchToHttp().getRequest<AuthRequest>();
    const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):undefined;
    if(!token)throw new UnauthorizedException('Inicia sesión para continuar.');
    try{
      const payload=await this.jwt.verifyAsync<{sub:string;sid:string}>(token);
      const session=await this.db.session.findFirst({where:{id:payload.sid,userId:payload.sub,revokedAt:null,expiresAt:{gt:new Date()},user:{active:true}}});
      if(!session)throw new Error('Inactive session');req.userId=payload.sub;return true;
    }catch{throw new UnauthorizedException('Sesión caducada. Inicia sesión de nuevo.');}
  }
}
export const CurrentUser=createParamDecorator((_data:unknown,ctx:ExecutionContext)=>ctx.switchToHttp().getRequest<AuthRequest>().userId);
