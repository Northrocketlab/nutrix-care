const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('dist/app.js','utf8'),Care=require('./dist/model.js');
const state={animals:[
 {id:'1',name:'Alpha',breed:' Shih Tsu ',kennel:'D1-A01',status:'ปกติ'},
 {id:'2',name:'Bravo',breed:'shih   tsu',kennel:'D1-A02',status:'เฝ้าระวัง'},
 {id:'3',name:'Charlie',breed:'Bulldog',kennel:'D1-A03',status:'ปกติ'},
 {id:'4',name:'Delta',breed:'',kennel:'D1-A04',status:'ปกติ'},
 {id:'5',name:'Echo',breed:'<script>"&',kennel:'D1-A05',status:'ปกติ'}
]};
const original=JSON.stringify(state),listeners={};let renders=0;
const ctx={Care,state,query:'',statusFilter:'ทั้งหมด',breedFilter:'all',statuses:['ปกติ','เฝ้าระวัง'],heading:()=>'',addButton:()=>'',animalRow:a=>`ROW:${a.name};`,esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),render:()=>renders++,document:{addEventListener:(type,fn)=>listeners[type]=fn}};
vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('function renderAnimals(){'),app.indexOf('function renderTasks()')),ctx);
let html=ctx.renderAnimals();assert.ok(html.includes('ทุกสายพันธุ์'));assert.ok(html.includes('ไม่ระบุสายพันธุ์'));assert.equal((html.match(/value="breed:shih tsu"/g)||[]).length,1);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('แสดง 5 จาก 5 ตัว'));
ctx.breedFilter='breed:shih tsu';html=ctx.renderAnimals();assert.ok(html.includes('ROW:Alpha;'));assert.ok(html.includes('ROW:Bravo;'));assert.ok(!html.includes('ROW:Charlie;'));assert.ok(html.includes('แสดง 2 จาก 5 ตัว'));
ctx.statusFilter='เฝ้าระวัง';html=ctx.renderAnimals();assert.ok(!html.includes('ROW:Alpha;'));assert.ok(html.includes('ROW:Bravo;'));
ctx.query='D1-A01';html=ctx.renderAnimals();assert.ok(html.includes('ไม่พบสัตว์'));ctx.statusFilter='ทั้งหมด';html=ctx.renderAnimals();assert.ok(html.includes('ROW:Alpha;'));assert.ok(!html.includes('ROW:Bravo;'));
ctx.query='';ctx.breedFilter='breed:';html=ctx.renderAnimals();assert.ok(html.includes('ROW:Delta;'));assert.ok(!html.includes('ROW:Alpha;'));
ctx.breedFilter='breed:removed';ctx.renderAnimals();assert.equal(ctx.breedFilter,'all');assert.equal(JSON.stringify(state),original);
const start=app.indexOf("document.addEventListener('change',e=>{if(e.target.id==='breed-filter')");vm.runInContext(app.slice(start,app.indexOf('\n',start)),ctx);listeners.change({target:{id:'breed-filter',value:'breed:bulldog'}});assert.equal(ctx.breedFilter,'breed:bulldog');assert.equal(renders,1);
console.log('PASS: breed grouping, missing breed, escaped options, combined search/health/breed filters, count, stale selection and actual change handler without data mutation.');
