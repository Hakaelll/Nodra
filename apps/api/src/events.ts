import {Prisma} from '@prisma/client';
export async function audit(tx:Prisma.TransactionClient,organizationId:string,actorId:string,action:string,entityId:string){
  await tx.auditEvent.create({data:{organizationId,actorId,action,entityId}});
}
export async function event(tx:Prisma.TransactionClient,organizationId:string,kind:string,entityId:string,title:string,body:string,recipientIds?:string[]){
  const recipients=recipientIds ?? (await tx.membership.findMany({where:{organizationId,status:'ACTIVE'},select:{userId:true}})).map(m=>m.userId);
  await tx.domainEvent.create({data:{organizationId,kind,entityId,title,body,recipientIds:recipients}});
}
