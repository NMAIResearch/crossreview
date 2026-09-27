// Purpose: exercise trusted workflow scripts against API fixtures without remote writes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function scripts(name){
  const lines=fs.readFileSync(path.join(__dirname,'../.github/workflows',name),'utf8').split('\n'),result=[];
  for(let i=0;i<lines.length;i++)if(/^\s+script: \|$/.test(lines[i])){
    const depth=lines[i].search(/\S/)+2,body=[];
    while(++i<lines.length && (!lines[i].trim() || lines[i].search(/\S/)>=depth))body.push(lines[i].slice(depth));
    i--;result.push(body.join('\n'));
  }
  return result;
}
const [pending,report]=scripts('precheck.yml'),[creditPending,refresh]=scripts('credit.yml');
async function run(script,{body='same',env={},files={},labels=['precheck-pending'],items=[]}={}){
  const calls=[];
  const methods={get:async()=>({data:{body,labels:labels.map(name=>({name}))}}),listForRepo:()=>{},addLabels:async p=>calls.push(['add',p]),removeLabel:async p=>calls.push(['remove',p]),createComment:async p=>calls.push(['comment',p])};
  const ctx={github:{rest:{issues:methods},paginate:async()=>items},context:{repo:{owner:'fixture',repo:'fixture'},issue:{number:12}},core:{notice:m=>calls.push(['notice',m])},require:n=>{assert.equal(n,'fs');return {existsSync:n=>n in files,readFileSync:n=>{if(!(n in files))throw Error('Missing fixture file');return files[n]}}},process:{env:{BODY:'same',...env}}};
  await new vm.Script('(async()=>{'+script+'})()').runInNewContext(ctx);
  return calls;
}
test('pre-check marks pending before removing a previous pass',async()=>{
  const calls=await run(pending,{labels:['precheck-passed']});assert.equal(calls[0][0],'add');assert.equal(calls[0][1].labels[0],'precheck-pending');assert.equal(calls[1][1].name,'precheck-passed');
});
test('missing clone or report never records a pass',async()=>{
  const calls=await run(report,{env:{URL:'https://github.com/fixture/repo'}});assert(calls.some(([a,p])=>a==='add'&&p.labels[0]==='precheck-failed'));assert(!calls.some(([a,p])=>a==='add'&&p.labels[0]==='precheck-passed'));
});
test('edited body cannot clear the pending check',async()=>{
  const calls=await run(report,{body:'changed',env:{URL:'https://github.com/fixture/repo',CODE:'0'},files:{'precheck.md':'pass'}});assert.equal(calls.length,1);assert.equal(calls[0][0],'notice');
});
test('completed pre-check records its exact commit and clears pending',async()=>{
  const calls=await run(report,{env:{URL:'https://github.com/fixture/repo',CODE:'0'},files:{'precheck.md':'pass','reviewed-commit.txt':'a'.repeat(40)+'\n'}});assert(calls.some(([a,p])=>a==='comment'&&p.body.includes('a'.repeat(40))));assert(calls.some(([a,p])=>a==='add'&&p.labels[0]==='precheck-passed'));assert(calls.some(([a,p])=>a==='remove'&&p.name==='precheck-pending'));
});
test('credit check marks submissions pending before recomputation',async()=>{
  const calls=await run(creditPending,{items:[{number:12}]});assert.equal(calls[0][1].labels[0],'credit-pending');
});
test('new review clears owed credit and then clears pending',async()=>{
  const calls=await run(refresh,{files:{'credit.json':JSON.stringify({alice:{ok:true,eligible_submissions:[12]}})},items:[{number:12,user:{login:'Alice'},labels:[{name:'needs-review-credit'},{name:'credit-pending'}]}]});assert.equal(calls[0][1].name,'needs-review-credit');assert.equal(calls[1][1].labels[0],'credit-cleared');assert.equal(calls.at(-1)[1].name,'credit-pending');
});
test('revoked credit removes clearance before releasing pending state',async()=>{
  const calls=await run(refresh,{files:{'credit.json':JSON.stringify({alice:{ok:false,eligible_submissions:[1]}})},items:[{number:12,user:{login:'alice'},labels:[{name:'credit-cleared'},{name:'credit-pending'}]}]});assert.equal(calls[0][1].name,'credit-cleared');assert.equal(calls[1][1].labels[0],'needs-review-credit');assert.equal(calls.at(-1)[1].name,'credit-pending');
});
test('missing ledger identity refuses instead of assuming eligibility',async()=>{
  await assert.rejects(run(refresh,{files:{'credit.json':'{}'},items:[{number:12,user:{login:'alice'},labels:[{name:'credit-pending'}]}]}),/absent/);
});
