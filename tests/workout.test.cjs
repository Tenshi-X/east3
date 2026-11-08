const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ transpileOnly:true, compilerOptions:{rootDir:'.'} });
const { buildWorkoutWeek, weekStart, weeklyReport, gpsStep, elapsedSeconds, formatPace } = require('../shared/workout');
const { shiftTimes, dayAdd } = require('../shared/life');
const { validateSession, saveWorkoutSession } = require('../api/_workout');
const { handleDataRequest } = require('../api/_data-handler');
const db = require('../api/_db'), auth = require('../api/_auth');
const tz = 'Asia/Jakarta';
const shift = (date,code) => ({date,code,...shiftTimes(date,code,tz)});
const base = () => ({client_id:'42e46516-37a5-4ab7-827c-25ebee1ed458',date:'2026-10-17',activity_type:'jogging',duration_seconds:1200,distance_meters:2500,distance_source:'gps',notes:'Jogging santai',exercise_progress:[],template_id:null,started_at:'2026-10-17T01:00:00Z',ended_at:'2026-10-17T01:20:00Z'});
test('weekly plan starts Monday across month/year boundaries and alternates 3 strength / 2 easy runs', () => {
  assert.equal(weekStart('2027-01-01'),'2026-12-28');
  const days = buildWorkoutWeek({date:'2026-11-02',timezone:tz});
  assert.deepEqual(days.map(d=>d.activity),['workout','jogging','workout','rest','workout','jogging','rest']);
  assert.deepEqual(days.filter(d=>d.activity==='workout').map(d=>d.template),['a','b','c']);
});
test('night recovery, extended shifts and low sleep override workouts without colliding with sleep or work', () => {
  const days = buildWorkoutWeek({date:'2026-11-02',timezone:tz,shifts:[shift('2026-11-01','3'),shift('2026-11-03','1&2'),shift('2026-11-05','2')],wellness:[{date:'2026-11-04',kind:'sleep',sleep_hours:4}]});
  assert.ok(days.slice(0,3).every(d=>d.activity==='rest'));
  const thursday = days[3];
  assert.equal(thursday.activity,'workout');
  assert.ok(Date.parse(thursday.end_time) <= Date.parse(shift('2026-11-05','2').start_time)-30*60000);
});
test('late actual strength sessions enforce 48 hours before the next recommended strength session', () => {
  const days=buildWorkoutWeek({date:'2026-11-02',timezone:tz,sessions:[{date:'2026-11-01',activity_type:'workout',started_at:'2026-11-01T13:00:00Z'}]});
  assert.equal(days[0].activity,'jogging');
  assert.equal(days[1].activity,'jogging');
  assert.equal(days[2].activity,'workout');
});
test('completed rest snapshots survive shift changes and never count as workout sessions', () => {
  const snapshot={date:'2026-11-02',activity:'rest',title:'Pemulihan',template:'',minutes:0,start_time:null,end_time:null,reason:'Shift panjang',shift:'1&2'};
  const days=buildWorkoutWeek({date:'2026-11-02',timezone:tz,checkins:[{date:snapshot.date,completed:true,snapshot}]});
  assert.equal(days[0].activity,'rest');
  assert.equal(days[0].completed,true);
  const report=weeklyReport('2026-11-02',[],days);
  assert.equal(report.sessions,0);assert.equal(report.duration_seconds,0);assert.equal(report.completed_days,1);
});
test('weekly report weights pace by distance and excludes missing distance and adjacent weeks', () => {
  const r=weeklyReport('2026-11-02',[
    {date:'2026-11-02',activity_type:'jogging',duration_seconds:600,distance_meters:1000},
    {date:'2026-11-03',activity_type:'jogging',duration_seconds:1200,distance_meters:3000},
    {date:'2026-11-04',activity_type:'jogging',duration_seconds:300},
    {date:'2026-11-05',duration_minutes:30},
    {date:'2026-11-09',activity_type:'jogging',duration_seconds:9999,distance_meters:50000},
  ]);
  assert.equal(r.sessions,4);assert.equal(r.strength,1);assert.equal(r.distance_meters,4000);assert.equal(r.pace_seconds,450);assert.equal(r.duration_seconds,3900);
  assert.equal(formatPace(359.9),'6:00 /km');
});
test('GPS ignores poor accuracy, stationary jitter, out-of-order fixes, teleportation and suspension gaps', () => {
  const p={latitude:-6.2,longitude:106.8,accuracy:8,timestamp:100000};
  assert.equal(gpsStep(null,{...p,accuracy:100}).previous,null);
  assert.equal(gpsStep(p,{...p,timestamp:110000}).meters,0);
  assert.equal(gpsStep(p,{...p,latitude:p.latitude+.001,timestamp:90000}).previous,p);
  assert.equal(gpsStep(p,{...p,latitude:p.latitude+1,timestamp:110000}).meters,0);
  const step=gpsStep(p,{...p,latitude:p.latitude+.0002,timestamp:110000});
  assert.ok(step.meters>20 && step.meters<25);
  assert.equal(gpsStep(p,{...p,latitude:p.latitude+.001,timestamp:150000}).meters,0);
});
test('elapsed time excludes pauses and does not depend on interval tick counts', () => {
  assert.equal(elapsedSeconds({elapsed:90000,runningSince:1000},32000),121);
  assert.equal(elapsedSeconds({elapsed:90000,runningSince:null},999999),90);
});
test('session validation rejects invented duration, future date, non-finite distance and malformed set data', () => {
  assert.equal(validateSession(base(),tz).distance_meters,2500);
  for(const delta of [{date:dayAdd(new Date().toISOString().slice(0,10),2)},{duration_seconds:0},{duration_seconds:5000},{distance_meters:NaN},{activity_type:'workout'},{distance_source:'none'},{client_id:'not-uuid'},{exercise_progress:[{id:'plank',reps:20,unit:'seconds',sets:[true,'yes']}]}]) assert.throws(()=>validateSession({...base(),...delta},tz));
});
test('session retries use an account-scoped idempotency key; all resource reads require authentication', async () => {
  const queries=[];
  db.transaction=async work=>work(async(sql,params)=>{queries.push({sql,params});return [{id:'same-session'}];});
  await saveWorkoutSession('owner-A',tz,base());
  assert.match(queries[0].sql,/ON CONFLICT \(user_id,client_id\)/);
  assert.equal(queries[0].params[0],'owner-A');
  auth.requireUser=async()=>({user:null,error:'Unauthorized'});
  const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  await handleDataRequest({method:'GET',headers:{},query:{date:'2026-11-02'}},res,'workout_tracker');
  assert.equal(res.statusCode,401);
});
