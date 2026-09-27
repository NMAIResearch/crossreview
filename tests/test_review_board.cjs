// Purpose: check reviewer counting, optional fields and incomplete GitHub responses.
const test=require('node:test'), assert=require('node:assert/strict');
const board=require('../docs/review-board.js');
const submissions=[{number:12,user:{login:'maker'}}];
const notice=(login='reader',extra={})=>({number:20,state:'open',user:{login,type:'User'},labels:[{name:'review-in-progress'}],body:'### Submission issue number\n\n12\n',...extra});
test('counts distinct declared people, not duplicate notices',()=>{
  const n=board.activeReviewers(submissions,[notice(),notice('READER'),notice('second')]);
  assert.equal(n.get(12).length,2);
});
test('closed, own, bot, wrong-label, malformed and unrelated notices do not count',()=>{
  const n=board.activeReviewers(submissions,[notice('maker'),notice('reader',{state:'closed'}),notice('bot',{user:{login:'robot',type:'Bot'}}),notice('reader',{labels:[{name:'review'}]}),notice('reader',{body:'### Submission issue number\n\n12 and 13'}),notice('reader',{body:'### Submission issue number\n\n13'}),notice('reader',{pull_request:{}})]);
  assert.deepEqual(n.get(12),[]);
});
test('optional domain is absent without a response',()=>{
  assert.equal(board.field('### Your domain experience (optional)\n\n_No response_','Your domain experience (optional)'),'');
  assert.equal(board.field('', 'Project domain (optional)'),'');
});
test('issue reference accepts only one positive safe issue number',()=>{
  assert.equal(board.submissionNumber({body:'### Submission issue number\n\n#12'}),12);
  for(const x of ['0','-1','1.2','9007199254740992','https://example.com/12']) assert.equal(board.submissionNumber({body:'### Submission issue number\n\n'+x}),null);
});
test('fetches further pages before declaring counts complete',async()=>{
  let calls=0;
  const rows=await board.issues('owner/project','review-in-progress','open',async()=>({ok:true,json:async()=>++calls===1?Array.from({length:100},(_,i)=>notice('reader',{number:i+1})):[notice('second')]}));
  assert.equal(calls,2);assert.equal(rows.length,101);
});
test('fails rather than claiming zero for a refused or malformed response',async()=>{
  await assert.rejects(board.issues('owner/project','review-in-progress','open',async()=>({ok:false})),/unavailable/);
  await assert.rejects(board.issues('owner/project','review-in-progress','open',async()=>({ok:true,json:async()=>({})})),/Unexpected/);
});
test('bounded pagination fails without returning a partial count',async()=>{
  let calls=0;
  await assert.rejects(board.issues('owner/project','review-in-progress','open',async()=>{calls++;return {ok:true,json:async()=>Array.from({length:100},()=>notice())}}),/page limit/);
  assert.equal(calls,10);
});
test('invalid repository never initiates a fetch',async()=>{
  await assert.rejects(board.issues('owner/project?redirect=elsewhere','review','all',()=>{throw new Error('must not fetch')}),/Invalid repository/);
});
test('queue requires both completed checks and no blocking label',()=>{
  const item={state:'open',labels:[{name:'precheck-passed'},{name:'credit-cleared'}]};
  assert.equal(board.eligible(item),true);
  for(const name of ['precheck-pending','precheck-failed','credit-pending','needs-review-credit']) assert.equal(board.eligible({...item,labels:[...item.labels,{name}]}),false);
  assert.equal(board.eligible({...item,state:'closed'}),false);
  assert.equal(board.eligible({...item,labels:[{name:'precheck-passed'}]}),false);
  assert.equal(board.eligible({...item,labels:[{name:'credit-cleared'}]}),false);
});
