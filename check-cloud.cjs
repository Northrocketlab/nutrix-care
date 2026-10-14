const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function controller(){const context={CARE_CLOUD_CONFIG:{enabled:true},document:{hidden:false},console};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/cloud.js','utf8'),context);return context.CareCloud;}
(async()=>{
 let c=controller();assert.equal(c.enabled,true);await assert.rejects(c.write({}),/ล็อกอิน/);
 const draft={version:1,animals:[],tasks:[],events:[]};
 c.ready=true;c.revision=4;c.member={name:'North'};let accepted=0;c.onChange=()=>accepted++;
 c.client={rpc:async(name,args)=>{assert.equal(name,'care_write');assert.equal(args.expected_revision,4);assert.equal(args.new_state,draft);return {data:{revision:5,member:c.member,state:draft}};}};
 await c.write(draft);assert.equal(c.revision,5);assert.equal(accepted,1);assert.equal(c.busy,false);
 c.client={rpc:async()=>({error:{message:'CARE_CONFLICT'}})};
 await assert.rejects(c.write(draft),/คนอื่นบันทึก/);assert.equal(c.revision,5);assert.equal(accepted,1);assert.equal(c.busy,false);
 c.client={rpc:async()=>{throw Error('Failed to fetch');}};
 await assert.rejects(c.write(draft));assert.equal(c.revision,5);assert.equal(accepted,1);
 // An earlier background read cannot replace a freshly accepted save.
 let finish;c.canRefresh=()=>true;c.client={rpc:()=>new Promise(r=>finish=r)};
 const pending=c.read();c.revision=6;finish({data:{revision:5,member:c.member,state:draft}});await pending;
 assert.equal(c.revision,6);assert.equal(accepted,1);
 // A dialog opened while the request was in flight blocks accepting that read.
 let open=false;c.canRefresh=()=>!open;const pendingDialog=c.read();open=true;
 finish({data:{revision:7,member:c.member,state:draft}});await pendingDialog;assert.equal(c.revision,6);
 for(const file of ['cloud.js','cloud-config.js','app.js'])new vm.Script(fs.readFileSync('dist/'+file,'utf8'));
 console.log('PASS: confirmed saves, rejected conflicts, failed network writes, stale reads and open-form refresh protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
