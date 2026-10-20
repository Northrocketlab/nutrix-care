export const OWNER_EMAIL='north2585456@gmail.com';
export const CONFIRMATION='ล้างข้อมูลทั้งหมด';
const origins=new Set(['https://northrocketlab.github.io','https://nutrix-care-center.decentgleam32.chatgpt.site']);
export function createResetHandler({createClient,url,anonKey,serviceKey}){
 return async req=>{
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return respond(403,{error:'CARE_FORBIDDEN'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond(405,{error:'CARE_METHOD_NOT_ALLOWED'});
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return respond(401,{error:'CARE_LOGIN_REQUIRED'});
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  let passwordClient;
  try{
   const raw=await req.text();if(raw.length>16384)return respond(400,{error:'CARE_INVALID_REQUEST'});
   const body=JSON.parse(raw);
   if(!body||typeof body.email!=='string'||body.email.trim().toLowerCase()!==OWNER_EMAIL||typeof body.password!=='string'||!body.password||body.confirmation!==CONFIRMATION||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0)return respond(400,{error:'CARE_INVALID_REQUEST'});
   const identityClient=createClient(url,anonKey,options);
   const {data:identity,error:identityError}=await identityClient.auth.getUser(token);
   const user=identity?.user;
   if(identityError||!user)return respond(401,{error:'CARE_LOGIN_REQUIRED'});
   if(user.email?.toLowerCase()!==OWNER_EMAIL||!user.email_confirmed_at)return respond(403,{error:'CARE_FORBIDDEN'});
   const admin=createClient(url,serviceKey,options);
   const {data:member,error:memberError}=await admin.from('care_members').select('email,role,active').eq('email',OWNER_EMAIL).maybeSingle();
   if(memberError||!member?.active||member.role!=='admin')return respond(403,{error:'CARE_FORBIDDEN'});
   passwordClient=createClient(url,anonKey,options);
   const {data:verified,error:passwordError}=await passwordClient.auth.signInWithPassword({email:OWNER_EMAIL,password:body.password});
   body.password='';
   if(passwordError||verified?.user?.id!==user.id)return respond(401,{error:'CARE_REAUTH_FAILED'});
   const {data,error}=await admin.rpc('care_admin_reset',{actor_uid:user.id,expected_revision:body.expected_revision,confirmation:body.confirmation});
   if(error){if(error.message?.includes('CARE_CONFLICT'))return respond(409,{error:'CARE_CONFLICT'});if(error.message?.includes('CARE_FORBIDDEN'))return respond(403,{error:'CARE_FORBIDDEN'});return respond(500,{error:'CARE_RESET_FAILED'});}
   return respond(200,data);
  }catch{return respond(400,{error:'CARE_RESET_FAILED'});}
  finally{if(passwordClient)try{await passwordClient.auth.signOut({scope:'local'});}catch{}}
 };
}
