const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const storage=map=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
const authKey='sb-mtbvayknooxhdfrbranc-auth-token',rememberKey='nutrix-care-remember-session-v1';
const user={id:'00000000-0000-0000-0000-000000000001',email:'synthetic@example.invalid'};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic';
function browser(local=new Map(),session=new Map(),badPassword=false){
 const fetch=async(input,options={})=>{
  const url=String(input);
  if(url.includes('/auth/v1/token?grant_type=password'))return new Response(JSON.stringify(badPassword?{error:'invalid_grant',error_description:'Invalid login credentials'}:{access_token:token,refresh_token:'synthetic-refresh-token',token_type:'bearer',expires_in:3600,user}),{status:badPassword?400:200,headers:{'content-type':'application/json'}});
  if(url.includes('/auth/v1/logout'))return new Response(null,{status:204});
  if(url.includes('/auth/v1/user'))return new Response(JSON.stringify(user),{headers:{'content-type':'application/json'}});
  if(url.endsWith('/rest/v1/rpc/care_read'))return new Response(JSON.stringify({revision:1,member:{email:user.email,name:'Synthetic',role:'staff'},state:{version:1,operator:'Synthetic',animals:[],tasks:[],events:[]}}),{headers:{'content-type':'application/json'}});
  throw Error('Unexpected test request: '+url);
 };
 const ctx={CARE_CLOUD_CONFIG:{enabled:true,url:'https://mtbvayknooxhdfrbranc.supabase.co',key:'test-publishable-key'},localStorage:storage(local),sessionStorage:storage(session),document:{hidden:false,addEventListener:()=>{}},console,URL,Headers,Request,Response,fetch,crypto:webcrypto,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},AbortController,TextEncoder,TextDecoder,WebSocket:globalThis.WebSocket||class {constructor(){throw Error('Realtime network is disabled in this test');}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/vendor/supabase.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/cloud.js','utf8'),ctx);
 return {c:ctx.CareCloud,ctx,local,session,init:()=>ctx.CareCloud.init({onChange:()=>{},onStatus:()=>{},canRefresh:()=>true})};
}
(async()=>{
 const remembered=browser();await remembered.init();assert.equal(remembered.c.remember,false);
 await remembered.c.signIn(user.email,'test-password-only',true);assert.equal(remembered.c.ready,true);assert.ok(remembered.local.has(authKey));assert.ok(!remembered.session.has(authKey));assert.equal(remembered.local.get(rememberKey),'true');assert.ok(!JSON.stringify([...remembered.local]).includes('test-password-only'));
 const reopened=browser(remembered.local);await reopened.init();assert.equal(reopened.c.ready,true,'remembered session restores with the real SDK after browser restart');
 await reopened.c.signOut();assert.equal(reopened.c.ready,false);assert.ok(!remembered.local.has(authKey));assert.ok(!remembered.local.has(rememberKey));const afterLogout=browser(remembered.local);await afterLogout.init();assert.equal(afterLogout.c.ready,false);
 const temporary=browser();await temporary.init();await temporary.c.signIn(user.email,'test-password-only',false);assert.ok(temporary.session.has(authKey));assert.ok(!temporary.local.has(authKey));
 const reloadTab=browser(temporary.local,temporary.session);await reloadTab.init();assert.equal(reloadTab.c.ready,true,'existing tab sessions still restore on reload');
 const closeTab=browser(temporary.local);await closeTab.init();assert.equal(closeTab.c.ready,false,'unchecked sessions do not restore in a fresh browser session');
 const failed=browser(new Map(),new Map(),true);await failed.init();await assert.rejects(failed.c.signIn(user.email,'wrong-test-password',true));assert.ok(!failed.local.has(authKey));assert.ok(!failed.session.has(authKey));
 const nodes=new Map();const ui={cloud:{remember:false,error:''},esc:x=>String(x),$:key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);}};vm.createContext(ui);const app=fs.readFileSync('dist/app.js','utf8');vm.runInContext(app.slice(app.indexOf('function renderCloudLogin(){'),app.indexOf('function cloudStatus(){')),ui);ui.renderCloudLogin();assert.ok(nodes.get('#main').innerHTML.includes('name="remember" type="checkbox"'));assert.ok(!nodes.get('#main').innerHTML.includes('type="checkbox" checked'));ui.cloud.remember=true;ui.renderCloudLogin();assert.ok(nodes.get('#main').innerHTML.includes('type="checkbox" checked'));
 console.log('PASS: real vendored Supabase SDK restores opted-in sessions, keeps unchecked sessions tab-only, clears persisted auth on logout, does not store passwords, rejects failed logins and renders the optional checkbox.');
})().catch(e=>{console.error(e);process.exitCode=1;});
