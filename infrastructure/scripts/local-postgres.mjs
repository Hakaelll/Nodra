// Optional developer fixture. Docker Compose remains the normal local environment.
import EmbeddedPostgres from 'embedded-postgres';
import {existsSync,mkdirSync} from 'node:fs';
const databaseDir=new URL('../../.local/postgres',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
mkdirSync(databaseDir,{recursive:true});
const pg=new EmbeddedPostgres({databaseDir,port:5433,user:'nodra',password:'nodra_local',persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:message=>console.error(message)});
if(!existsSync(`${databaseDir}/PG_VERSION`))await pg.initialise();
await pg.start();
const client=pg.getPgClient();await client.connect();
for(const name of ['nodra_test','nodra']){const found=await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);if(!found.rowCount)await pg.createDatabase(name);}
await client.end();console.log('Local PostgreSQL ready on 127.0.0.1:5433; databases nodra and nodra_test.');
const keepAlive=setInterval(()=>{},60000);
async function stop(){clearInterval(keepAlive);await pg.stop();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
