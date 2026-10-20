const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const {createResetHandler,OWNER_EMAIL,CONFIRMATION}=await import('./supabase/functions/care-admin-reset/handler.mjs');
 const original={revision:8,member:{email:OWNER_EMAIL,name:'North',role:'admin'},state:{version:1,animals:[],tasks:[],events:[]}};
 async function run(overrides={},request={}){
  const cfg={identity:true,email:OWNER_EMAIL,role:'admin',active:true,correctPassword:true,sameUser:true,...overrides};let rpcCalls=0,passwordCalls=0,signOut=0;
  const createClient=(_url,key)=>key==='service'?{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:cfg.role,active:cfg.active}})})})}),rpc:async(name,args)=>{rpcCalls++;assert.equal(name,'care_admin_reset');assert.deepEqual(args,{actor_uid:'owner-id',expected_revision:7,confirmation:CONFIRMATION});return cfg.conflict?{error:{message:'CARE_CONFLICT'}}:{data:original};}}:{auth:{getUser:async()=>({data:{user:cfg.identity?{id:'owner-id',email:cfg.email,email_confirmed_at:'confirmed'}:null}}),signInWithPassword:async args=>{passwordCalls++;assert.equal(args.email,OWNER_EMAIL);assert.equal(args.password,'test-password-only');return cfg.correctPassword?{data:{user:{id:cfg.sameUser?'owner-id':'other-id'}}}:{error:{message:'incorrect'}};},signOut:async opts=>{assert.deepEqual(opts,{scope:'local'});signOut++;}}};
  const body={email:OWNER_EMAIL,password:'test-password-only',confirmation:CONFIRMATION,expected_revision:7,...request.body};
  const headers={'Content-Type':'application/json','Origin':'https://northrocketlab.github.io',...(request.noToken?{}:{Authorization:'Bearer test-token'}),...request.headers};
  const response=await createResetHandler({createClient,url:'https://example.invalid',anonKey:'anon',serviceKey:'service'})(new Request('https://example.invalid',{method:request.method||'POST',headers,...(request.method==='OPTIONS'?{}:{body:JSON.stringify(body)})}));
  const text=await response.text();assert.ok(!text.includes('test-password-only'));return {status:response.status,rpcCalls,passwordCalls,signOut,text};
 }
 for(const cfg of [{identity:false},{email:'staff@example.invalid'},{role:'staff'},{active:false},{correctPassword:false},{sameUser:false}]){const r=await run(cfg);assert.ok([401,403].includes(r.status));assert.equal(r.rpcCalls,0);}
 for(const request of [{noToken:true},{body:{confirmation:'wrong'}},{body:{email:'someone@example.invalid'}},{body:{expected_revision:-1}},{headers:{Origin:'https://evil.invalid'}}]){assert.equal((await run({},request)).rpcCalls,0);}
 const ok=await run();assert.equal(ok.status,200);assert.equal(ok.rpcCalls,1);assert.equal(ok.passwordCalls,1);assert.equal(ok.signOut,1);
 const conflict=await run({conflict:true});assert.equal(conflict.status,409);
 assert.equal((await run({}, {method:'OPTIONS',noToken:true})).status,204);
 const context={CARE_CLOUD_CONFIG:{enabled:true},document:{},console};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/cloud.js','utf8'),context);const c=context.CareCloud;
 c.ready=true;c.member={email:OWNER_EMAIL,role:'staff'};c.revision=7;assert.equal(c.canReset(),false);await assert.rejects(c.resetAll({}),/ผู้ดูแล/);
 c.member.role='admin';assert.equal(c.canReset(),true);let accepted=0;c.onChange=()=>accepted++;
 c.client={functions:{invoke:async()=>({error:{context:{json:async()=>({error:'CARE_REAUTH_FAILED'})}}})}};
 await assert.rejects(c.resetAll({email:OWNER_EMAIL,password:'bad',confirmation:CONFIRMATION}),/ไม่ถูกต้อง/);assert.equal(c.revision,7);assert.equal(accepted,0);assert.equal(c.busy,false);
 c.client={functions:{invoke:async()=>({data:original})}};await c.resetAll({email:OWNER_EMAIL,password:'test',confirmation:CONFIRMATION});assert.equal(c.revision,8);assert.equal(accepted,1);assert.equal(c.busy,false);
 const app=fs.readFileSync('dist/app.js','utf8');let shown='';
 const ui={cloud:c,state:{animals:[],tasks:[]},esc:x=>String(x),openModal:(_title,html)=>shown=html};vm.createContext(ui);
 vm.runInContext(app.slice(app.indexOf('const input='),app.indexOf('const select='))+app.slice(app.indexOf('function openCloudAccount(){'),app.indexOf('// Erase password fields')),ui);
 c.member={email:OWNER_EMAIL,role:'admin',name:'North'};ui.openCloudAccount();assert.ok(shown.includes('data-cloud="reset-open"'));
 c.member.role='staff';ui.openCloudAccount();assert.ok(!shown.includes('data-cloud="reset-open"'));
 c.member={email:'other-admin@example.invalid',role:'admin'};ui.openCloudAccount();assert.ok(!shown.includes('data-cloud="reset-open"'));
 c.member={email:OWNER_EMAIL,role:'admin',name:'North'};ui.openResetForm();assert.ok(shown.includes('id="admin-reset-form"'));assert.ok(shown.includes('autocomplete="current-password"'));assert.ok(shown.includes('name="confirmation"'));
 console.log('PASS: server-side password check, owner/admin restrictions, rejected invalid confirmations, conflict handling, verification-session cleanup and unchanged client state on failure.');
})().catch(e=>{console.error(e);process.exitCode=1;});
