const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('./dist/model.js');
assert.equal(C.kennels.length,151);
assert.equal(new Set(C.kennels).size,151);
for(const [b,a,n] of [[1,14,14],[2,16,14],[3,14,14],[4,14,15],[5,10,0],[6,13,13]]){
 const codes=C.kennelsFor(b);assert.equal(codes.filter(c=>c.startsWith(`D${b}-A`)).length,a);assert.equal(codes.filter(c=>c.startsWith(`D${b}-B`)).length,n);
}
for(const b of [1,3])assert.equal(C.kennelsFor(b).length,28);
assert.equal(C.kennelsFor(5).length,10);
assert.equal(C.kennelsFor(5)[9],'D5-A10');
assert.ok(!C.kennels.includes('D1-A15'));
assert.ok(!C.kennels.includes('D3-B15'));
assert.ok(!C.kennels.includes('D5-B01'));
assert.ok(!C.kennels.includes('D5-A11'));
assert.equal(C.age('2012-08-01','2026-10-12'),'14 ปี 2 เดือน 11 วัน');
assert.equal(C.age('2012-08-01','2026-07-31'),'13 ปี 11 เดือน 30 วัน');
assert.equal(C.age('2025-01-31','2025-03-01'),'0 ปี 1 เดือน 1 วัน');
assert.equal(C.age('2024-02-29','2025-02-28'),'1 ปี 0 เดือน 0 วัน');
const state=C.seed();
assert.throws(()=>C.validateAnimal({...state.animals[0]},state.animals),/มีอยู่แล้ว/);
assert.throws(()=>C.validateAnimal({...state.animals[0],id:'NEW',birth:'2999-01-01'},state.animals),/อนาคต/);
const sunny=state.animals[0];sunny.notes.push({text:'retain'});
assert.equal(C.moveAnimal(sunny,'D1-B14'),'D1-A01');
assert.equal(sunny.kennel,'D1-B14');assert.equal(sunny.notes[0].text,'retain');
assert.throws(()=>C.moveAnimal(sunny,'D1-B14'),/อยู่ในคอกนี้แล้ว/);
assert.equal(C.moveAnimal(sunny,'D2-A01'),'D1-B14');
assert.equal(C.moveAnimal(sunny,'D6-B13'),'D2-A01');
assert.equal(sunny.notes[0].text,'retain');
assert.equal(C.moveAnimal(sunny,'D5-A10'),'D6-B13');
assert.equal(sunny.notes[0].text,'retain');
C.validateAnimal({...sunny,id:'CLINIC-NEW'},state.animals);
assert.throws(()=>C.moveAnimal(sunny,'D5-A11'),/ปลายทาง/);
assert.throws(()=>C.moveAnimal(sunny,'D1-A15'),/ปลายทาง/);
for(const file of ['app.js','model.js','site-map.js'])new vm.Script(fs.readFileSync('dist/'+file,'utf8'),{filename:file});
console.log('PASS: 151 unique kennels across buildings 1–6, cross-building moves retain history, clinic single row included, age, validation and syntax.');

// Optional registration codes still need stable, distinct IDs for history and tasks.
const namedOnly=C.createAnimal({name:'  ชื่อซ้ำ  ',kennel:'D1-A01'},state.animals);
const sameName=C.createAnimal({id:'  ',name:'ชื่อซ้ำ',kennel:'D1-A01'},[...state.animals,namedOnly]);
assert.equal(namedOnly.name,'ชื่อซ้ำ');assert.match(namedOnly.id,/^AUTO-/);
assert.notEqual(namedOnly.id,sameName.id);assert.ok(namedOnly.id.length<=60);
assert.equal(C.createAnimal({id:'  NEW-17  ',name:'มีรหัส',kennel:'D1-A01'},state.animals).id,'NEW-17');
assert.throws(()=>C.createAnimal({id:'dstf56-17',name:'ซ้ำ',kennel:'D1-A01'},state.animals),/มีอยู่แล้ว/);
assert.throws(()=>C.createAnimal({name:'   ',kennel:'D1-A01'},state.animals),/ชื่อสัตว์/);
const stableId=namedOnly.id;namedOnly.notes.push({text:'ประวัติเดิม'});C.moveAnimal(namedOnly,'D2-A01');
assert.equal(namedOnly.id,stableId);assert.equal(namedOnly.notes[0].text,'ประวัติเดิม');
console.log('PASS: name-only entry, unique automatic IDs for duplicate names, manual-code validation and stable history after moves.');

assert.ok(C.kennels.includes('D2-A16'));
for(const removed of ['D2-B15','D4-A15','D6-A14','D6-A15','D6-B14','D6-B15'])assert.throws(()=>C.moveAnimal({...sunny},removed),/ปลายทาง/);
assert.equal(C.moveAnimal(sunny,'D2-A16'),'D5-A10');
assert.equal(sunny.notes[0].text,'retain');
console.log('PASS: asymmetric row boundaries, new D2-A16 destination and rejected retired cages.');

const appSource=fs.readFileSync('dist/app.js','utf8');
const renderSource=appSource.slice(appSource.indexOf('function renderBuildingMap(){'),appSource.indexOf('\nfunction animalRow('));
const ui={Care:C,SitePlan:{selectedBuilding:1},state:{animals:[],events:[]},occupants:()=>[],renderStats:()=>'',addButton:()=>'',monthlyProblems:()=>[],currentMonth:()=> '2026-10',thaiMonth:x=>x,thaiDate:x=>x,tag:x=>String(x),icon:()=>''};
vm.createContext(ui);vm.runInContext(renderSource,ui);
for(const building of C.buildings){ui.SitePlan.selectedBuilding=building;const html=ui.renderBuildingMap();const codes=[...html.matchAll(/data-code="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(codes,C.kennelsFor(building));assert.ok(!html.includes('undefined'));}
console.log('PASS: actual map renderer shows all 151 cages with correct asymmetric row labels.');
