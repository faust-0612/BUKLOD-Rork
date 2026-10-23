// Run with TypeScript, React and matching react-test-renderer installed.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('typescript'),React=require('react'),renderer=require('react-test-renderer'),assert=require('node:assert/strict');
global.IS_REACT_ACT_ENVIRONMENT=true;
const base=path.resolve(__dirname,'..');
const calls=[];let account='u1', online=true, failTasks=false, taskDeferred=null;
function query(table){let mode='read';const q=new Proxy({}, {get(_,k){if(k==='then')return (resolve,reject)=>{
 calls.push(table+':'+mode);
 if(taskDeferred&&table.endsWith('_tasks')&&mode==='read')return taskDeferred.then(resolve,reject);
 return Promise.resolve({data:table.includes('settings')?{hidden_widgets:[]}:table.endsWith('_tasks')?[{id:'t1',title:'Task',status:'OPEN'}]:[],error:failTasks&&table.endsWith('_tasks')?{message:'offline'}:null}).then(resolve,reject);
 };return ()=>{if(['update','insert','upsert'].includes(k))mode=k;return q}}});return q}
let accessError=true;
const noop=()=>null;const rn=new Proxy({StyleSheet:{create:x=>x,hairlineWidth:1},Alert:{alert:()=>{}},Share:{share:async()=>{}},Linking:{openURL:async()=>{}}},{get:(o,k)=>o[k]??k});
function load(file){const module={exports:{}};const result=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,file+' syntax');
 vm.runInNewContext(result.outputText,{exports:module.exports,module,console,setTimeout,clearTimeout,require:n=>{
 if(n==='react')return React;if(n==='react-native')return rn;if(n==='expo-router')return {router:{},useFocusEffect:cb=>React.useEffect(cb,[cb])};
 if(n.endsWith('clusterHomeLoading'))return load('src/lib/clusterHomeLoading.ts');
 if(n.endsWith('buklodCluster'))return {verifyClusterManageAccess:async()=>{if(accessError)throw Error('offline');return {allowed:true,cluster:{scope_id:'c1'}}}};
 if(n.endsWith('buklodAsyncTimeout'))return {withBuklodTimeout:task=>Promise.resolve(task)};
 if(n.endsWith('/supabase'))return {supabase:{from:query,rpc:query}};
 if(n.endsWith('AuthProvider'))return {useAuth:()=>({user:{id:account}})};
 if(n.endsWith('NetworkProvider'))return {useNetwork:()=>({online})};
 if(n.endsWith('BuklodCharacterEventProvider'))return {useBuklodCharacterEventsOptional:()=>null};
 if(n.endsWith('buklodSafeArea'))return {useBuklodScrollBottomInset:()=>0,useBuklodDrawerBottomInset:()=>0};
 if(n.endsWith('BuklodDashboardCustomizer'))return {DEFAULT_DASHBOARD_THEME:{cardColor:'#fff'}};
 if(n.endsWith('buklodClusterInvite'))return {buildClusterInviteUrl:()=>''};
 if(n.endsWith('/theme'))return {colors:{}};
 return new Proxy({__esModule:true,default:noop},{get:(o,k)=>o[k]??noop});
 }});return module.exports;}
const Component=load('src/components/BuklodClusterHomeCommandCenterImpl.tsx').default;
const props={scope:{scope_id:'c1',scope_type:'CLUSTER',name:'Cluster',show_faith_content:false}};
(async()=>{let root;await renderer.act(async()=>{root=renderer.create(React.createElement(Component,props))});
 assert.deepEqual(calls.sort(),['buklod_cluster_home_notices:read','buklod_cluster_home_settings:read']);calls.length=0;
 const openTask=()=>root.root.findByProps({accessibilityLabel:'Open Tasks & Assignments'}).props.onPress();
 await renderer.act(async()=>openTask());assert.deepEqual(calls,['buklod_cluster_tasks:read']);calls.length=0;
 await renderer.act(async()=>root.root.findAllByType('Pressable').find(p=>p.findAllByType('Text').some(t=>t.children.includes('MARK DONE'))).props.onPress());
 assert.deepEqual(calls,['buklod_cluster_tasks:update','buklod_cluster_tasks:read']);calls.length=0;
 await renderer.act(async()=>openTask());await renderer.act(async()=>openTask());assert.equal(calls.length,0);
 failTasks=true;await renderer.act(async()=>root.root.findAllByType('ScrollView').find(p=>p.props.refreshControl).props.refreshControl.props.onRefresh());
 assert(root.root.findAllByType('Text').some(t=>t.children.includes('Task')));
 failTasks=false;calls.length=0;online=false;
 await renderer.act(async()=>root.update(React.createElement(Component,{...props,scope:{...props.scope,scope_id:'offline'}})));
 assert.equal(calls.length,0);assert(!root.root.findAllByType('Text').some(t=>t.children.includes('Task')));
 online=true;account='u2';calls.length=0;
 await renderer.act(async()=>root.update(React.createElement(Component,props)));
 assert(calls.includes('buklod_cluster_tasks:read')); // never reuse u1's cache
 let finish;taskDeferred=new Promise(r=>finish=r);
 await renderer.act(async()=>root.update(React.createElement(Component,{...props,scope:{...props.scope,scope_id:'slow'}})));
 await renderer.act(async()=>root.update(React.createElement(Component,{...props,scope:{...props.scope,scope_id:'c1'}})));
 await renderer.act(async()=>finish({data:[{id:'stale',title:'WRONG CLUSTER',status:'OPEN'}],error:null}));
 assert(!root.root.findAllByType('Text').some(t=>t.children.includes('WRONG CLUSTER')));
 await renderer.act(async()=>root.unmount());
 const Gate=load('src/components/ClusterManageGate.tsx').default;
 await renderer.act(async()=>{root=renderer.create(React.createElement(Gate,{scopeId:'c1'},()=>React.createElement('Text',null,'AUTHORIZED')))});
 assert(!root.root.findAllByType('Text').some(t=>t.children.includes('ADMIN ACCESS REQUIRED')));
 assert(root.root.findAllByType('Text').some(t=>t.children.includes('RETRY')));
 accessError=false;await renderer.act(async()=>root.root.findByType('Pressable').props.onPress());
 assert(root.root.findAllByType('Text').some(t=>t.children.includes('AUTHORIZED')));
 await renderer.act(async()=>root.unmount());
 console.log('PASS admin gate: network failure offers retry without granting access or falsely denying admin.');
 console.log('PASS rendered Cluster: 2 initial reads, lazy task read, targeted mutation refresh, cached reopen, failed refresh retention, offline handling, account isolation, stale-scope rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
