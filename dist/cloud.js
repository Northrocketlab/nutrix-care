(function(root){
 'use strict';
 const config=root.CARE_CLOUD_CONFIG||{};
 const Cloud={enabled:config.enabled===true,ready:false,busy:false,member:null,revision:null,error:'',client:null,onChange:null};
 Cloud.message=e=>{
  const m=e?.message||String(e);
  if(m.includes('CARE_FORBIDDEN'))return 'บัญชีนี้ยังไม่ได้รับสิทธิ์ หรือยังไม่ได้ยืนยันอีเมล กรุณาติดต่อผู้ดูแล';
  if(m.includes('CARE_CONFLICT'))return 'มีคนอื่นบันทึกก่อนคุณแล้ว รายการนี้ยังไม่ถูกบันทึก กรุณาคัดลอกข้อความที่กรอก ปิดหน้าต่าง กดอัปเดตข้อมูล แล้วทำรายการอีกครั้ง';
  if(m.includes('CARE_INVALID_KENNEL'))return 'มีรหัสกรงที่ไม่อยู่ในผังปัจจุบัน กรุณาตรวจตำแหน่งก่อนนำเข้า';
  if(m.includes('Could not find the function')||m.includes('PGRST202'))return 'ยังไม่ได้ตั้งฐานข้อมูล กรุณารันไฟล์ setup.sql ใน Supabase ก่อน';
  if(m.includes('Invalid login credentials'))return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if(m.includes('Failed to fetch')||m.includes('Network'))return 'เชื่อมต่อฐานข้อมูลไม่ได้ ข้อมูลยังไม่ถูกยืนยันว่าบันทึกสำเร็จ กรุณาตรวจอินเทอร์เน็ตและอัปเดตข้อมูลก่อนลองใหม่';
  return 'ดำเนินการไม่สำเร็จ: '+m;
 };
 Cloud.accept=result=>{Cloud.revision=result.revision;Cloud.member=result.member;Cloud.ready=true;Cloud.error='';Cloud.onChange?.(result.state);};
 Cloud.read=async(force=false)=>{
  if(Cloud.busy||(!force&&!Cloud.canRefresh()))return;
  const requestRevision=Cloud.revision;
  const {data,error}=await Cloud.client.rpc('care_read');
  if(error){Cloud.error=Cloud.message(error);Cloud.onStatus?.();throw error;}
  if(Cloud.busy||Cloud.revision!==requestRevision||(!force&&!Cloud.canRefresh()))return;
  Cloud.accept(data);Cloud.onStatus?.();
 };
 Cloud.write=async draft=>{
  if(!Cloud.ready||!Cloud.member)throw Error('กรุณาล็อกอินและโหลดข้อมูลก่อนบันทึก');
  if(Cloud.busy)throw Error('กำลังบันทึก กรุณารอสักครู่');
  Cloud.busy=true;Cloud.onStatus?.();
  try{const {data,error}=await Cloud.client.rpc('care_write',{expected_revision:Cloud.revision,new_state:draft});
   if(error)throw Error(Cloud.message(error));Cloud.accept(data);return data.state;
  }catch(e){Cloud.error=e.message;throw e;}finally{Cloud.busy=false;Cloud.onStatus?.();}
 };
 Cloud.canReset=()=>Cloud.enabled&&Cloud.ready&&Cloud.member?.role==='admin'&&Cloud.member?.email?.toLowerCase()==='north2585456@gmail.com';
 Cloud.resetAll=async({email,password,confirmation})=>{
  if(!Cloud.canReset())throw Error('ใช้ได้เฉพาะบัญชีผู้ดูแลเจ้าของระบบ');
  if(Cloud.busy)throw Error('กำลังบันทึก กรุณารอสักครู่');
  Cloud.busy=true;Cloud.onStatus?.();
  try{
   const {data,error}=await Cloud.client.functions.invoke('care-admin-reset',{body:{email,password,confirmation,expected_revision:Cloud.revision}});
   if(error){let code='CARE_RESET_FAILED';try{code=(await error.context.json()).error||code;}catch{}
    if(code==='CARE_REAUTH_FAILED')throw Error('อีเมลหรือรหัสผ่านสำหรับยืนยันไม่ถูกต้อง');
    if(code==='CARE_LOGIN_REQUIRED')throw Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    if(code==='CARE_INVALID_REQUEST')throw Error('กรุณาตรวจอีเมล รหัสผ่าน และข้อความยืนยัน');
    if(code==='CARE_RESET_FAILED')throw Error('ยังยืนยันการล้างไม่ได้ กรุณาปิดหน้าต่างและอัปเดตข้อมูลก่อนลองใหม่');
    throw Error(Cloud.message({message:code}));
   }
   if(!data?.state||!Number.isSafeInteger(data.revision)||!data.member)throw Error('ยังยืนยันผลการล้างไม่ได้ กรุณาอัปเดตข้อมูล');
   Cloud.accept(data);return data.state;
  }finally{password='';Cloud.busy=false;Cloud.onStatus?.();}
 };
 Cloud.signIn=async(email,password)=>{
  const {error}=await Cloud.client.auth.signInWithPassword({email,password});
  if(error)throw Error(Cloud.message(error));
  try{await Cloud.read(true);}catch(e){throw Error(Cloud.message(e));}
 };
 Cloud.signOut=async()=>{
  if(Cloud.busy)throw Error('รอให้บันทึกเสร็จก่อนออกจากระบบ');
  const {error}=await Cloud.client.auth.signOut();if(error)throw Error(Cloud.message(error));
  Cloud.ready=false;Cloud.member=null;Cloud.revision=null;Cloud.error='';Cloud.onChange?.(null);Cloud.onStatus?.();
 };
 Cloud.init=async({onChange,onStatus,canRefresh})=>{
  if(!Cloud.enabled)return;
  Cloud.onChange=onChange;Cloud.onStatus=onStatus;Cloud.canRefresh=canRefresh;
  if(!root.supabase){Cloud.error='โหลดระบบล็อกอินไม่ได้ กรุณารีเฟรชหน้าเว็บ';onStatus();return;}
  // Browser session only. Animal records are never cached into the old demo key.
  Cloud.client=root.supabase.createClient(config.url,config.key,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const {data,error}=await Cloud.client.auth.getSession();
  if(error)Cloud.error=Cloud.message(error);
  if(data?.session){try{await Cloud.read(true);}catch(e){Cloud.error=Cloud.message(e);}}
  onStatus();
  Cloud.client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){Cloud.ready=false;Cloud.member=null;Cloud.revision=null;onChange(null);onStatus();}});
  setInterval(()=>{if(Cloud.ready&&!document.hidden)Cloud.read().catch(()=>{});},10000);
  document.addEventListener('visibilitychange',()=>{if(Cloud.ready&&!document.hidden)Cloud.read().catch(()=>{});});
 };
 root.CareCloud=Cloud;
})(globalThis);
