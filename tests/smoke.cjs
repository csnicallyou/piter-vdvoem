const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const code=fs.readFileSync('assets/app-v3.js','utf8');
const dataMatch=html.match(/<script id="db" type="application\/json">([\s\S]*?)<\/script>/);
assert(dataMatch,'Embedded catalog data is present');
const db=JSON.parse(dataMatch[1]);
assert.equal(db.places.length,305,'All original places preserved');
assert.equal(db.routes.length,8,'All itinerary days preserved');
assert.equal(new Set(db.places.map(p=>p.id)).size,305,'Unique place IDs');
assert.equal(db.places.filter(p=>p.lat!=null).length,123,'Map coordinate coverage retained');
for(const p of db.places){assert.equal(p.lat==null,p.lon==null,'Coordinate pairs are complete')}
for(const day of db.routes){for(const stop of day.stops)assert(db.places.some(p=>p.id===stop.id),'Route stop exists '+stop.id)}
for(const page of ['home','catalog','map','favorites','routes'])assert(html.includes('id="page-'+page+'"'),'Page exists '+page);
assert(html.includes('assets/app-v3.css'),'Style is linked');
assert(html.includes('assets/app-v3.js'),'App is linked');
new vm.Script(code,{filename:'app-v3.js'});
const elements=new Map();
function node(key){
 if(!elements.has(key)){
  const el={value:'',innerHTML:'',textContent:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},setAttribute(){},focus(){}};
  elements.set(key,el);
 }
 return elements.get(key);
}
const docEvents={};
const document={
 getElementById(id){return id==='db'?{textContent:dataMatch[1]}:node('#'+id)},
 querySelector(sel){return node(sel)},
 querySelectorAll(){return []},
 addEventListener(name,fn){docEvents[name]=fn},
 createElement(){return {click(){},set href(v){},set download(v){}}}
};
const store=new Map();
const context={
 document,console,Math,Map,Set,Number,Array,String,Date,JSON,Intl,
 window:{scrollTo(){},addEventListener(){}},
 location:{hash:''},
 history:{replaceState(){}},
 localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}},
 setTimeout(){return 1},clearTimeout(){},
 URL:{createObjectURL(){return 'blob:test'},revokeObjectURL(){}},
 Blob,
};
vm.createContext(context);
vm.runInContext(code,context,{timeout:5000});
assert.equal(node('#topCount').textContent,'305 мест','App booted');
assert.match(node('#metrics').innerHTML,/305/,'Home metrics rendered');
assert.match(node('#categories').innerHTML,/category-tile/,'Home categories rendered');
function click(dataset){
 docEvents.click({target:{closest(){return {dataset}}}});
}
click({nav:'catalog'});
assert.match(node('#catalogGrid').innerHTML,/place-card/,'Catalog cards render');
click({fav:'1'});
assert.equal(JSON.parse(store.get('spb-liza-anton-v2-avant'))['1'],'wish','Favorites persist');
click({nav:'favorites'});
assert.match(node('#favList').innerHTML,/Monterey/,'Saved list renders selected place');
click({nav:'routes'});
assert.match(node('#dayTabs').innerHTML,/day-tab/,'Route day tabs render');
assert.match(node('#stops').innerHTML,/stop/,'Route stops render');
click({nav:'map'});
assert.match(node('#mapCount').textContent,/123/,'Map filter count shown');
console.log('PASS: '+db.places.length+' places, '+db.routes.length+' itineraries, 123 map pins; home/catalog/saved/routes/map initialize.');
