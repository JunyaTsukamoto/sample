import { spawn } from 'child_process';
const PORT=4599;
const srv = spawn('node',['tests/fixture-server.mjs'],{env:{...process.env,FIX_PORT:PORT},stdio:'inherit'});
await new Promise(r=>setTimeout(r,900));
const t = spawn('npx',['tsx','tests/integration.mts'],{stdio:'inherit',env:{...process.env,FIX_PORT:PORT}});
t.on('exit',(c)=>{ srv.kill(); process.exit(c||0); });
