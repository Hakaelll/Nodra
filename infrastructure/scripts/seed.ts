import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {passwordHash} from '../../apps/api/src/auth/auth.service';
async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('Development seed disabled in production');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
  try{
    const hashed=await passwordHash('Nodra-local-2026!');
    const users=[];
    for(const [email,firstName] of [['owner@nodra.local','Alex'],['worker1@nodra.local','Yago'],['worker2@nodra.local','Lucía'],['worker3@nodra.local','Dani']]){
      users.push(await db.user.upsert({where:{email},create:{email,firstName,lastName:'Demo',passwordHash:hashed},update:{}}));
    }
    const org=await db.organization.upsert({where:{slug:'northline'},create:{slug:'northline',name:'Northline',settings:{create:{}}},update:{}});
    for(const [i,user] of users.entries())await db.membership.upsert({where:{organizationId_userId:{organizationId:org.id,userId:user.id}},create:{organizationId:org.id,userId:user.id,permissionRole:i===0?'OWNER':'MEMBER'},update:{}});
    const role=await db.jobRole.upsert({where:{organizationId_name:{organizationId:org.id,name:'Apoyo de equipo'}},create:{organizationId:org.id,name:'Apoyo de equipo',description:'Rol de demostración, configurable por la organización.'},update:{}});
    const group=await db.group.upsert({where:{organizationId_name:{organizationId:org.id,name:'Equipo habitual'}},create:{organizationId:org.id,name:'Equipo habitual',type:'PERMANENT'},update:{}});
    const member=await db.membership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org.id,userId:users[1].id}}});
    await db.groupMember.upsert({where:{groupId_membershipId:{groupId:group.id,membershipId:member.id}},create:{groupId:group.id,membershipId:member.id,organizationId:org.id},update:{}});
    const base=new Date();base.setUTCDate(base.getUTCDate()+2);base.setUTCHours(9,0,0,0);
    for(const [i,title] of ['Preparación del espacio','Encuentro de equipo','Coordinación de apertura'].entries()){
      const id=`00000000-0000-4000-8000-00000000000${i+1}`;
      const start=new Date(base.getTime()+i*86400000),end=new Date(start.getTime()+4*3600000);
      const service=await db.service.upsert({where:{id},create:{id,organizationId:org.id,title,description:'Revisa el horario y confirma tu participación. Servicio de demostración con datos persistidos.',locationText:['Espacio Norte · Acceso principal','Centro de operaciones','Punto de encuentro · Recepción'][i],startsAt:start,endsAt:end,status:i===2?'DRAFT':'OPEN',createdBy:users[0].id},update:{}});
      let position=await db.servicePosition.findFirst({where:{serviceId:service.id}});
      position??=await db.servicePosition.create({data:{serviceId:service.id,organizationId:org.id,jobRoleId:role.id,quantity:3,description:'Trabajo coordinado con el resto del equipo.'}});
      if(i===0){await db.serviceInterest.upsert({where:{servicePositionId_userId:{servicePositionId:position.id,userId:users[1].id}},create:{organizationId:org.id,servicePositionId:position.id,userId:users[1].id},update:{}});
        if(!await db.serviceAssignment.findFirst({where:{servicePositionId:position.id,userId:users[1].id}}))await db.serviceAssignment.create({data:{organizationId:org.id,servicePositionId:position.id,userId:users[1].id,selectedBy:users[0].id,confirmations:{create:{}}}});
      }
    }
    if(!await db.notice.findFirst({where:{organizationId:org.id,title:'Bienvenidos al equipo'}}))await db.notice.create({data:{organizationId:org.id,title:'Bienvenidos al equipo',body:'Aquí encontrarás la información de cada servicio. Revisa tus confirmaciones pendientes antes de empezar.',requiresAcknowledgement:true,createdBy:users[0].id}});
    console.log('Development seed ready: owner@nodra.local / worker1@nodra.local. Demo access is documented in README.md.');
  }finally{await db.$disconnect();}
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
