const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({transpileOnly:true,compilerOptions:{rootDir:'.'}});
const db=require('../api/_db');
const auth=require('../api/_auth');
const {isAtlasOwner}=require('../api/_owner');
const {handleAuthRequest}=require('../api/_auth-handler');
const {personalAction,getPersonalContext}=require('../api/_personal');
const {validateBackup,restorePersonalBackup,exportPersonalBackup}=require('../api/_backup');
const {PERSONAL_DEFAULTS,personalPreferences,paydayForecast,overtimeEstimate,weeklyPersonalReport,personalCycle}=require('../shared/personal');
const {executeTool}=require('../api/ai-proxy');
const user={id:'00000000-0000-4000-8000-000000000001',email:'owner@example.test',timezone:'Asia/Jakarta'};
const id='00000000-0000-4000-8000-000000000002';
let calls;
beforeEach(()=>{delete process.env.ATLAS_OWNER_USER_ID;delete process.env.ATLAS_OWNER_EMAIL;calls=[];
  db.queryOne=async(sql,params)=>{calls.push({sql,params});return null;};
  db.query=async(sql,params)=>{calls.push({sql,params});return [];};
  db.transaction=async work=>work(async(sql,params)=>{calls.push({sql,params});return [];});
});
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});

test('registration is closed before any database call',async()=>{const res=response();await handleAuthRequest({method:'POST',headers:{},body:{email:user.email,password:'secret'}},res,'register');assert.equal(res.statusCode,403);assert.equal(calls.length,0);});
test('explicit owner ID wins, and normalized email never grants another account access',async()=>{
  process.env.ATLAS_OWNER_USER_ID=user.id;process.env.ATLAS_OWNER_EMAIL='someone@example.test';
  assert.equal(await isAtlasOwner(user),true);assert.equal(await isAtlasOwner({...user,id}),false);
  delete process.env.ATLAS_OWNER_USER_ID;process.env.ATLAS_OWNER_EMAIL=' OWNER@EXAMPLE.TEST ';
  assert.equal(await isAtlasOwner(user),true);assert.equal(await isAtlasOwner({...user,email:'someone@example.test'}),false);assert.equal(calls.length,0);
});
test('without configuration only the pinned database owner is admitted; an empty owner table stays closed',async()=>{
  assert.equal(await isAtlasOwner(user),false);db.queryOne=async()=>({user_id:user.id});assert.equal(await isAtlasOwner(user),true);assert.equal(await isAtlasOwner({...user,id}),false);
});
test('a valid token belonging to a non-owner is rejected on every authenticated request',async()=>{
  process.env.ATLAS_OWNER_USER_ID=id;db.queryOne=async()=>user;
  const result=await auth.requireUser({headers:{authorization:`Bearer ${auth.signToken({sub:user.id})}`}});
  assert.equal(result.user,null);assert.match(result.error,/pemilik/);
});
test('login denies non-owner credentials and excludes password material from the owner response',async()=>{
  const secret=auth.hashPassword('test-password');db.queryOne=async()=>({...user,password_hash:secret.hash,salt:secret.salt});process.env.ATLAS_OWNER_USER_ID=id;
  const denied=response();await handleAuthRequest({method:'POST',headers:{},body:{email:user.email,password:'test-password'}},denied,'login');assert.equal(denied.statusCode,403);assert.equal(denied.body.token,undefined);
  process.env.ATLAS_OWNER_USER_ID=user.id;const allowed=response();await handleAuthRequest({method:'POST',headers:{},body:{email:user.email,password:'test-password'}},allowed,'login');assert.ok(allowed.body.token);assert.equal(allowed.body.user.password_hash,undefined);assert.equal(allowed.body.user.salt,undefined);
});
test('payday forecast clamps dates to month end and reserves unpaid bills without counting future salary',()=>{
  const result=paydayForecast('2026-02-20',31,1000000,[{id:'a',amount:200000,due_day:10},{id:'b',amount:300000,due_day:25},{id:'c',amount:500000,due_day:31}],[{bill_id:'a',period:'2026-02'}]);
  assert.equal(result.next_payday,'2026-02-28');assert.equal(result.days,8);assert.equal(result.reserved,300000);assert.equal(result.available,700000);assert.equal(result.daily,87500);
  assert.equal(paydayForecast('2026-12-25',25,10,[],[]).next_payday,'2027-01-25');
});
test('payday forecast preserves negative available funds and does not suggest negative daily spending',()=>{
  const r=paydayForecast('2026-11-10',25,100,[{id:'a',amount:200,due_day:12}],[]);assert.equal(r.available,-100);assert.equal(r.daily,0);
});
test('overtime uses configured rates and allowance, and rejects unknown or missing salary',()=>{
  const p=personalPreferences({...PERSONAL_DEFAULTS,base_salary:2820000,divisor:273,allowance:62500});
  assert.equal(overtimeEstimate(7,'regular',p),Math.round((2820000/273*(1.5+2*6)+62500)*100)/100);
  assert.equal(overtimeEstimate(7,'holiday',p),Math.round((2820000/173*(2*6+3)+62500)*100)/100);
  assert.throws(()=>overtimeEstimate(0,'regular',p));assert.throws(()=>overtimeEstimate(1,'other',p));assert.throws(()=>overtimeEstimate(1,'regular',PERSONAL_DEFAULTS));assert.throws(()=>personalPreferences({payday:0}));assert.throws(()=>personalPreferences({share_profile_with_ai:'true'}));
});
test('weekly report leaves missing sleep and insufficient weight measurements unknown',()=>{
  const empty=weeklyPersonalReport('2026-11-10',[],[],[],[]);assert.equal(empty.average_sleep,null);assert.equal(empty.weight_change,null);
  const r=weeklyPersonalReport('2026-11-10',[{kind:'sleep',date:'2026-11-10',sleep_hours:6},{kind:'weight',date:'2026-11-10',weight_kg:47}],[],[{date:'2026-11-04',type:'expense',amount:25000,category:'food'},{date:'2026-11-03',type:'expense',amount:100000,category:'food'}],[]);
  assert.equal(r.average_sleep,6);assert.equal(r.sleep_days,1);assert.equal(r.expense,25000);assert.equal(r.weight_change,null);
});
test('personal cycle follows overnight sleep and afternoon recovery rather than midnight',()=>{
  const r=personalCycle(Date.parse('2026-11-10T10:00:00Z'),[{kind:'sleep',start_time:'2026-11-10T00:00:00Z',end_time:'2026-11-10T08:00:00Z'},{kind:'sleep',start_time:'2026-11-11T00:00:00Z',end_time:'2026-11-11T08:00:00Z'}]);assert.equal(r.asleep,false);assert.equal(r.wake_at,'2026-11-10T08:00:00Z');
});
test('capture retries with the same ID do not write another financial transaction',async()=>{
  db.transaction=async work=>work(async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT id FROM personal_captures'))return [{id}];return [];});
  await personalAction(user.id,user.timezone,'capture',{id,kind:'expense',date:'2026-11-10',amount:25000,category:'food'});
  assert.equal(calls.filter(c=>c.sql.startsWith('INSERT INTO transactions')).length,0);
  assert.ok(calls.some(c=>c.sql.includes('ON CONFLICT DO NOTHING')));
});
test('a collision with another capture owner cannot be reported as a successful retry',async()=>{await assert.rejects(personalAction(user.id,user.timezone,'capture',{id,kind:'task',date:'2026-11-10',content:'test'}),/sudah digunakan/);});
test('duplicate bill payment cannot insert a second expense',async()=>{
  db.transaction=async work=>work(async(sql,params)=>{calls.push({sql,params});return sql.startsWith('SELECT * FROM personal_bills')?[{id,amount:200000,category:'utilities',title:'Kos'}]:[];});
  await personalAction(user.id,user.timezone,'pay_bill',{id,period:'2026-11',date:'2026-11-10',amount:200000});assert.equal(calls.filter(c=>c.sql.startsWith('INSERT INTO transactions')).length,0);
});
test('foreign projects and dates beyond their deadline never create priorities',async()=>{
  await assert.rejects(personalAction(user.id,user.timezone,'schedule_project',{id,date:'2026-11-10'}));
  db.transaction=async work=>work(async sql=>sql.startsWith('SELECT *')?[{id,status:'active',next_action:'Test',due_date:'2026-11-09'}]:[]);
  await assert.rejects(personalAction(user.id,user.timezone,'schedule_project',{id,date:'2026-11-10'}),/tenggat/);
});
test('AI proposes an editable memory draft and does not insert a memory automatically',async()=>{const r=await executeTool('propose_personal_memory',{category:'decision',content:'Fokus HUPI bulan ini'},user.id);assert.ok(r.memory_draft.client_id);assert.equal(r.memory_draft.content,'Fokus HUPI bulan ini');assert.ok(!calls.some(c=>c.sql.startsWith('INSERT')));});
test('personal context respects disabled profile sharing and bounds memory size',async()=>{
  db.queryOne=async()=>({preferences:{share_profile_with_ai:false,living:'private'}});
  db.query=async sql=>sql.includes('personal_memories')?Array.from({length:80},(_,i)=>({id:i,content:'x'.repeat(2000)})):[];
  const r=await getPersonalContext(user.id);assert.equal(r.profile,null);assert.ok(JSON.stringify(r.memories).length<11000);assert.ok(r.omitted_memories>0);
  assert.ok(JSON.stringify(r).length<=16000);
});
test('backup rejects foreign owners, auth tables, unknown formats and malformed tables',()=>{
  const backup={format:'atlas-personal',version:1,owner_id:user.id,tables:{notes:[]}};assert.equal(validateBackup(backup,user.id),0);
  assert.throws(()=>validateBackup({...backup,owner_id:id},user.id));assert.throws(()=>validateBackup({...backup,tables:{users:[]}},user.id));assert.throws(()=>validateBackup({...backup,tables:{notes:'invalid'}},user.id));
});
test('backup export excludes embeddings and never queries the users/auth table',async()=>{
  db.transaction=async work=>work(async(sql,params)=>{calls.push({sql,params});return sql.includes('FROM notes ')?[{id,user_id:user.id,content:'note',embedding:'private vector'}]:[];});
  const r=await exportPersonalBackup(user.id);assert.equal(r.tables.notes[0].embedding,undefined);assert.ok(!calls.some(c=>/FROM users\b/.test(c.sql)));assert.ok(calls.filter(c=>c.sql.startsWith('SELECT')).every(c=>c.params.includes(user.id)));
});
test('backup restore refuses foreign parent references before inserting child rows',async()=>{
  db.transaction=async work=>work(async(sql,params)=>{calls.push({sql,params});return sql.includes('information_schema.columns')?[{column_name:'id'},{column_name:'habit_id'},{column_name:'value'},{column_name:'date'}]:[];});
  await assert.rejects(restorePersonalBackup(user.id,{format:'atlas-personal',version:1,owner_id:user.id,tables:{habit_logs:[{id,habit_id:'foreign',value:1,date:'2026-11-10'}]}}),/milik akun lain/);assert.ok(!calls.some(c=>c.sql.startsWith('INSERT')));
});
test('backup conflict updates include a final ownership guard even after collision checks',async()=>{
  db.transaction=async work=>work(async(sql,params)=>{calls.push({sql,params});if(sql.includes('information_schema.columns'))return ['id','user_id','title'].map(column_name=>({column_name}));if(sql.startsWith('INSERT'))return [{id}];return [];});
  await restorePersonalBackup(user.id,{format:'atlas-personal',version:1,owner_id:user.id,tables:{notes:[{id,user_id:user.id,title:'Test'}]}});
  const insert=calls.find(c=>c.sql.startsWith('INSERT'));assert.match(insert.sql,/WHERE notes.user_id = \$4/);assert.equal(insert.params[3],user.id);
});
