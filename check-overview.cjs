const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Care=require('./dist/model.js'),listeners={};let opened;
const state={animals:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={Care,state,esc,tag:x=>String(x),document:{addEventListener:(name,fn)=>listeners[name]=fn},openKennel:code=>opened=code};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/site-map.js','utf8')+'\nglobalThis.plan=SitePlan;',ctx);const plan=ctx.plan;
const svg=plan.svg(),codes=[...svg.matchAll(/data-code="([^"]+)"/g)].map(m=>m[1]);assert.equal(codes.length,151);assert.equal(new Set(codes).size,151);assert.deepEqual([...codes].sort(),[...Care.kennels].sort());
const statuses=['ปกติ','ยังไม่ประเมิน','เฝ้าระวัง','อยู่ระหว่างดูแลรักษา','แยกดูแล'];
for(const [i,status] of statuses.entries())state.animals.push({id:'test-'+i,name:'สัตว์ทดสอบ '+i,status,kennel:'D1-A0'+(i+1)});
for(const [i,status] of statuses.entries()){const code='D1-A0'+(i+1);const cell=plan.svg().match(new RegExp('<g class="overview-cage"[^>]*data-code="'+code+'"[\\s\\S]*?</g>'))[0];assert.ok(cell.includes('data-status="'+status+'"'));assert.ok(cell.includes('fill:'+plan.healthColors.find(h=>h.status===status).color));}
assert.equal(plan.cageHealth([]).status,'กรงว่าง');assert.equal(plan.cageHealth([{status:'ปกติ'},{status:'เฝ้าระวัง'}]).status,'เฝ้าระวัง');assert.equal(plan.cageHealth([{status:'อยู่ระหว่างดูแลรักษา'},{status:'แยกดูแล'}]).status,'แยกดูแล');assert.equal(plan.cageHealth([{status:'ปกติ'},{status:''}]).status,'ยังไม่ประเมิน');
state.animals[0].status='แยกดูแล';state.animals[0].name='<script>alert("test")</script>';
const updated=plan.svg();assert.ok(updated.includes('data-code="D1-A01" data-status="แยกดูแล"'));assert.ok(!updated.includes('<script>'));assert.ok(updated.includes('&lt;script&gt;'));
const before=JSON.stringify(state);plan.render();assert.equal(JSON.stringify(state),before);
listeners.click({target:{closest:()=>({dataset:{plan:'kennel',code:'D2-A16'}})}});assert.equal(opened,'D2-A16');opened=null;listeners.click({target:{closest:()=>({dataset:{plan:'kennel',code:'D6-B15'}})}});assert.equal(opened,null);
console.log('PASS: all 151 overview cages, every health color, mixed-status priority, live state changes, escaped names and direct valid-cage navigation.');
