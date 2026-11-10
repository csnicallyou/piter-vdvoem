const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html','utf8');
const dataMatch = html.match(/<script id="db" type="application\/json">([\s\S]*?)<\/script>/);
assert(dataMatch,'Embedded database exists');
const db = JSON.parse(dataMatch[1]);
assert.equal(db.places.length,305,'Places retained');
assert.equal(db.routes.length,8,'Routes retained');
assert.equal(new Set(db.places.map(p => p.id)).size,db.places.length,'Unique IDs');
for (const p of db.places) {
  assert.equal(typeof p.name,'string');
  assert.equal(typeof p.category,'string');
  assert.equal((p.lat==null),(p.lon==null), 'Coordinate pairs must be complete');
}
for (const r of db.routes) for (const stop of r.stops) {
  assert(db.places.some(p=>p.id===stop.id),'Route stop is present in catalog: '+stop.id);
}
for (const pane of ['catalog','saved','allmap','routes']) assert(html.includes('id="'+pane+'"'),'Page contains '+pane);
const scripts = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const code = scripts.at(-1);
new vm.Script(code,{filename:'guide-app.js'});
const elements = new Map();
function stub(id) {
  if(!elements.has(id)){
    const obj={value:'',textContent:'',innerHTML:'',dataset:{},style:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(){},setAttribute(){},focus(){},querySelectorAll(){return [];}};
    elements.set(id,obj);
  }
  return elements.get(id);
}
const document={
  getElementById(id){if(id==='db')return {textContent:dataMatch[1]};return stub('#'+id);},
  querySelector(q){return stub(q);},
  querySelectorAll(){return [];},
  addEventListener(){},
  createElement(){return stub('a');}
};
const ctx={
  document,window:{addEventListener(){},scrollTo(){}},
  localStorage:{getItem(){return null;},setItem(){}},
  location:{hash:''},history:{replaceState(){}},
  console, setTimeout(){}, clearTimeout(){},
  Blob,URL,Intl,Date,Math,Map,Set,Number,String,Array,JSON,
  alert(){},
};
vm.createContext(ctx);
vm.runInContext(code,ctx,{timeout:5000});
assert.equal(stub('#totalPlaces').textContent,305,'Catalog initialized');
assert.equal(stub('#mappedStat').textContent,db.places.filter(p=>p.lat!=null).length,'Map count initialized');
assert.match(stub('#cards').innerHTML,/<article/,'Catalog cards rendered');
vm.runInContext("setStatus(1, 'wish')",ctx,{timeout:1000});
assert.equal(stub('#savedWishCount').textContent,1,'Saved items update when selected');
vm.runInContext("assignToDay(1, db.routes[0].day)",ctx,{timeout:1000});
assert.match(stub('#savedCards').innerHTML,/data-plan-id=/,'Saved place day selector rendered');
assert(vm.runInContext("routeStopsFor(routes[0]).some(s=>s.id===1)",ctx,{timeout:1000}),'Assigned stop appears in route');
console.log('PASS: JavaScript parses, '+db.places.length+' places, '+db.routes.length+' days, '+db.places.filter(p=>p.lat!=null).length+' pins; app initializes.');
