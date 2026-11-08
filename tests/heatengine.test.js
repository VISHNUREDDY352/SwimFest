// Heat engine tests: run with `npm test`
const E = require('../frontend/core/heatengine.js');
const test = require('node:test');
const assert = require('assert');

test('heat engine: lanes, heats, order, schedule, relays, circle seeding', () => {
assert.deepStrictEqual(E.laneOrder(8), [4,5,3,6,2,7,1,8]);
assert.deepStrictEqual(E.laneOrder(6), [3,4,2,5,1,6]);
assert.deepStrictEqual(E.laneOrder(10), [5,6,4,7,3,8,2,9,1,10]);
const mk = (n, ev='50m Freestyle', extra={}) => Array.from({length:n}, (_, i) => ({ entryId:'e'+i+ev, swimId:'s'+i, name:'Sw'+String(i).padStart(2,'0'), gender:'Boy', category:'U-12', event:ev, seedMs: i===n-1 ? null : 30000 + i*100, academy:'A'+(i%3), ...extra }));
const pools = [{ id:'P1', label:'Main', lanes:8, categories:['U-10','U-12','U-14','U-16'] }];
// 9 swimmers, 8 lanes: first heat must have >= 3
let r = E.generate(mk(9), pools);
let ev = r.events[0];
assert.strictEqual(ev.heats.length, 2);
assert.deepStrictEqual(ev.heats.map(h => h.count), [3, 6]);
// fastest swimmer in lane 4 of last heat
const last = ev.heats[1];
assert.strictEqual(last.lanes[3].name, 'Sw00');
// NT swimmer in the first (slowest) heat
assert.ok(ev.heats[0].lanes.some(l => !l.empty && l.seedMs == null));
// 10 lanes: fastest in lane 5
r = E.generate(mk(10), [{ ...pools[0], lanes:10 }]);
assert.strictEqual(r.events[0].heats[0].lanes[4].name, 'Sw00');
// event order: 50m before 100m, freestyle before backstroke; numbering global across pools
const p2 = [{ id:'P1', label:'A', lanes:8, categories:['U-12'] }, { id:'P2', label:'B', lanes:6, categories:['U-14'] }];
const entries = [...mk(3,'100m Freestyle'), ...mk(3,'50m Freestyle'), ...mk(3,'50m Backstroke'), ...mk(2,'50m Freestyle').map(e=>({...e, category:'U-14', entryId:e.entryId+'x'}))];
r = E.generate(entries, p2);
assert.deepStrictEqual(r.events.map(e => [e.eventNum, e.poolId, e.eventName]), [[1,'P1','50m Freestyle'],[2,'P1','100m Freestyle'],[3,'P1','50m Backstroke'],[4,'P2','50m Freestyle']]);
// schedule: separate clocks per pool
E.schedule(r.events, { start: 510, buffers: { short:2, mid:3, relay:3.5 } });
assert.strictEqual(r.events[3].heats[0].startMin, 510);
assert.strictEqual(r.events[1].heats[0].startMin, 512);
// 400m uses double mid buffer
const ev400 = E.generate(mk(16,'400m Freestyle'), pools).events; E.schedule(ev400, {start:0, buffers:{short:2,mid:3,relay:3.5}});
assert.strictEqual(ev400[0].heats[1].startMin, 6);
// relays: 9 swimmers from 2 academies -> teams, one lane per team; rows share lane
const rel = Array.from({length:9}, (_, i) => ({ entryId:'r'+i, swimId:'s'+i, name:'R'+i, gender:'Girl', category:'U-12', event:'4×50m Freestyle Relay', seedMs:null, academy: i<5?'Alpha':'Beta', isRelay:true }));
r = E.generate([...rel, ...mk(4)], pools);
const relEv = r.events.find(e => e.isRelay);
assert.strictEqual(relEv.units, 3);                       // Alpha A (4), Alpha B (1), Beta (4)
assert.strictEqual(r.events[r.events.length-1], relEv);   // relays last
const rows = E.toHeatRows([relEv]);
assert.strictEqual(rows.length, 9);
assert.strictEqual(new Set(rows.map(x => x.lane_number)).size, 3);
// circle seeding: 24 swimmers, 8 lanes, 3 heats -> fastest 3 swimmers in different heats
r = E.generate(mk(24), pools, { seeding:'circle' });
const heatOf = n => r.events[0].heats.findIndex(h => h.lanes.some(l => l.name === n));
assert.deepStrictEqual([heatOf('Sw00'), heatOf('Sw01'), heatOf('Sw02')], [2,1,0]);
assert.ok(r.events[0].heats.every(h => h.count === 8));
// unrouted
r = E.generate(mk(3).map(e => ({...e, category:'U-16'})), [{ ...pools[0], categories:['U-10'] }]);
assert.strictEqual(r.unrouted.length, 3);

});
