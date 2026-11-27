// Monitor only the child launched by this runner. Never terminate another editor.
import {spawn} from 'node:child_process';
import {statSync,openSync,readSync,closeSync} from 'node:fs';
export function runLogged(cmd,args,{cwd,log,label,intervalMs=15000,idleMs=15*60*1000,hardMs=90*60*1000}){
 return new Promise((resolve,reject)=>{
  const started=Date.now();let changed=started,offset=0,mtime=0,reason=null,finished=false;
  const child=spawn(cmd,args,{cwd,stdio:'inherit',shell:false,env:{...process.env,PYTHONOPTIMIZE:''}});
  console.log(label+' PID '+child.pid+'; monitoring '+log);
  function sample(){
   try{
    const st=statSync(log);
    if(st.size!==offset||st.mtimeMs!==mtime){
     changed=Date.now();mtime=st.mtimeMs;
     const start=Math.max(0,st.size<offset?0:offset,st.size-16384);
     if(st.size>start){const fd=openSync(log,'r');try{const buf=Buffer.alloc(st.size-start);const n=readSync(fd,buf,0,buf.length,start);process.stdout.write(buf.subarray(0,n).toString('utf8'));}finally{closeSync(fd);}}
     offset=st.size;
    }
   }catch(error){if(error.code!=='ENOENT')console.error(label+' log read: '+error.message);}
  }
  function stop(message){if(finished||reason)return;reason=message;console.error(message);child.kill('SIGKILL');}
  const timer=setInterval(()=>{
   sample();const now=Date.now();
   console.log('['+label+'] elapsed '+Math.floor((now-started)/1000)+'s; last log change '+Math.floor((now-changed)/1000)+'s ago; '+offset+' bytes');
   if(now-started>=hardMs)stop(label+' exceeded hard runtime limit. Verification NOT passed.');
   else if(now-changed>=idleMs)stop(label+' log unchanged for '+Math.floor(idleMs/1000)+' seconds. Verification NOT passed.');
  },intervalMs);
  const interrupt=()=>stop(label+' interrupted; verification NOT passed.');
  process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
  function cleanup(){finished=true;clearInterval(timer);process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
  child.once('error',error=>{cleanup();reject(error);});
  child.once('close',(code,signal)=>{sample();cleanup();if(reason||code!==0)reject(Error(reason||label+' exited '+code+' '+(signal||'')));else resolve();});
 });
}
