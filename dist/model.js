(function(root){
  const buildings=[1,2,3,4,5,6];
  const layoutFor=building=>({1:{rows:['A','B'],counts:{A:14,B:14}},2:{rows:['A','B'],counts:{A:16,B:14}},3:{rows:['A','B'],counts:{A:14,B:14}},4:{rows:['A','B'],counts:{A:14,B:15}},5:{rows:['A'],counts:{A:10}},6:{rows:['A','B'],counts:{A:13,B:13}}}[Number(building)]);
  const kennelsFor=building=>{const layout=layoutFor(building);return layout?layout.rows.flatMap(row=>Array.from({length:layout.counts[row]},(_,i)=>`D${Number(building)}-${row}${String(i+1).padStart(2,'0')}`)):[];};
  const kennels=buildings.flatMap(kennelsFor);
  function bangkokDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
  function age(birth,today=bangkokDate()){
    if(!birth) return 'ไม่ระบุวันเกิด';
    const b=new Date(birth+'T00:00:00Z'),t=new Date(today+'T00:00:00Z');
    if(!Number.isFinite(b.getTime())||!Number.isFinite(t.getTime())||b>t)return 'ตรวจสอบวันเกิด';
    const shifted=n=>{const first=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+n,1));const lastDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(b.getUTCDate(),lastDay)));};
    let totalMonths=(t.getUTCFullYear()-b.getUTCFullYear())*12+t.getUTCMonth()-b.getUTCMonth();
    if(shifted(totalMonths)>t)totalMonths--;
    const days=Math.round((t-shifted(totalMonths))/86400000);
    return `${Math.floor(totalMonths/12)} ปี ${totalMonths%12} เดือน ${days} วัน`;
  }
  function seed(){return {version:1,operator:'',animals:[{id:'DSTF56-17',name:'Sunny',species:'สุนัข',breed:'Shih Tsu',sex:'Female',birth:'2012-08-01',stage:'Senior',kennel:'D1-A01',status:'ยังไม่ประเมิน',symptoms:'',medications:[],notes:[],checks:[],placementExample:true}],tasks:[],events:[]};}
  function validateAnimal(a,animals,editing=false){
    if(!a.name?.trim())throw Error('กรุณากรอกชื่อสัตว์');
    if(!a.id?.trim())throw Error('ไม่พบรหัสอ้างอิงของสัตว์ กรุณาลองเพิ่มใหม่');
    if(!editing&&animals.some(x=>x.id.toLowerCase()===a.id.trim().toLowerCase()))throw Error('รหัสสัตว์นี้มีอยู่แล้ว');
    if(a.birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(a.birth)||a.birth>bangkokDate()))throw Error('วันเกิดต้องไม่เป็นวันที่ในอนาคต');
    if(!editing&&!kennels.includes(a.kennel))throw Error('กรุณาเลือกกรงในอาคารที่เปิดใช้งาน');
  }
  function createAnimal(data,animals){
    const id=data.id?.trim()||'AUTO-'+root.crypto.randomUUID();
    const animal={id,name:data.name?.trim()||'',species:'สุนัข',breed:data.breed||'',sex:data.sex||'ไม่ระบุ',birth:data.birth||'',stage:data.stage||'ไม่ระบุ',kennel:data.kennel,status:data.status||'ยังไม่ประเมิน',symptoms:'',medications:[],checks:[],notes:[],placementExample:false};
    validateAnimal(animal,animals);
    return animal;
  }
  function updateAnimalProfile(animal,data){
    if(!animal)throw Error('ไม่พบสัตว์ที่ต้องการแก้ไข');
    const labels={name:'ชื่อ',breed:'พันธุ์',sex:'เพศ',birth:'วันเกิด',stage:'ช่วงวัย'};
    const next={...animal};
    for(const key of Object.keys(labels))if(Object.hasOwn(data,key))next[key]=String(data[key]??'').trim();
    validateAnimal(next,[],true);
    if(next.name.length>100||(next.breed||'').length>100)throw Error('ชื่อและพันธุ์ต้องไม่เกิน 100 ตัวอักษร');
    const changes=Object.keys(labels).filter(key=>(animal[key]||'')!==(next[key]||'')).map(key=>({field:labels[key],before:animal[key]||'',after:next[key]||''}));
    // Update basic details only; IDs, placement, medications and history stay attached.
    for(const key of Object.keys(labels))if(Object.hasOwn(data,key))animal[key]=next[key];
    return changes;
  }
  function moveAnimal(a,destination){if(!kennels.includes(destination))throw Error('ไม่พบคอกปลายทาง');if(destination===a.kennel)throw Error('สัตว์อยู่ในคอกนี้แล้ว');const from=a.kennel;a.kennel=destination;a.placementExample=false;return from;}
  function hasMonthlyIssue(check){return Boolean(check&&((check.coat&&check.coat!=='ปกติ')||(check.nails&&check.nails!=='เหมาะสม')||(check.ears&&check.ears!=='สะอาด')));}
  function addMonthlyCheck(animal,data,{operator,time,maxMonth=bangkokDate().slice(0,7)}){
    const choices={coat:['ปกติ','พันกัน / ต้องแปรง','สกปรก / ต้องทำความสะอาด','มีข้อสังเกตอื่น'],nails:['เหมาะสม','ยาว / ต้องตัด','มีข้อสังเกตอื่น'],ears:['สะอาด','ต้องทำความสะอาด','มีข้อสังเกตอื่น']};
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month)||data.month>maxMonth)throw Error('เดือนไม่ถูกต้องหรือเป็นเดือนในอนาคต');
    if(Object.entries(choices).some(([key,allowed])=>!allowed.includes(data[key])))throw Error('กรุณาเลือกผลขน เล็บ และหูให้ครบ');
    const previous=[...animal.checks].reverse().find(c=>c.month===data.month);
    if(!hasMonthlyIssue(data)&&!hasMonthlyIssue(previous))throw Error('บันทึกเฉพาะตัวที่พบปัญหา กรุณาเลือกปัญหาอย่างน้อยหนึ่งรายการ');
    animal.checks.push({month:data.month,coat:data.coat,nails:data.nails,ears:data.ears,note:data.note||'',operator,time,problemOnly:true});
  }
  const api={buildings,layoutFor,kennelsFor,kennels,bangkokDate,age,seed,validateAnimal,createAnimal,updateAnimalProfile,moveAnimal,hasMonthlyIssue,addMonthlyCheck};
  root.Care=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
