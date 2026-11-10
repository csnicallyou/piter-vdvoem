const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const code=fs.readFileSync('assets/app-v3.js','utf8');
const themeCode=fs.readFileSync('assets/editorial-v4.js','utf8');
const editorialCSS=fs.readFileSync('assets/editorial-v4.css','utf8');
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
assert(html.includes('assets/editorial-v4.css'),'Editorial style is linked');
assert(html.includes('assets/editorial-inner-v1.css'),'Interior redesign linked');
assert(fs.readFileSync('assets/editorial-inner-v1.css','utf8').includes('.category-art'),'Artwork styling exists');
assert(code.includes('categoryVisual(p)'),'Artwork used in venue cards');
assert(code.includes("'#detailVisual').innerHTML=categoryVisual(p)"),'Drawer uses artwork');
assert(html.includes('assets/editorial-v4.js'),'Theme controller is linked');
assert(html.includes('id="themeSwitch"'),'Theme switch exists');
for(const asset of ['site-hero-main.webp','site-heart.webp','site-star.webp','site-lily.webp','site-architecture.webp','site-water.webp']){
 assert(fs.existsSync('assets/art/'+asset),'Generated visual asset is packaged: '+asset);
 assert(html.includes('assets/art/'+asset),'Generated visual asset is used on the page: '+asset);
}
assert(editorialCSS.includes('site-hero-main.webp'),'Hero artwork has responsive styling');

assert(html.includes('id="homeRealMap"'),'Homepage contains real interactive map');
assert(!html.includes('ed-map-image"><svg'),'Fake map illustration removed');
assert(html.includes('data-home-map-cat="food"'),'Homepage has category map filters');
assert(code.includes("L.map('homeRealMap'"),'Homepage Leaflet map initializes');
assert(code.includes('function mapPin'),'Categorized map markers implemented');
assert(html.includes('class="editorial-hero"'),'Redesigned hero exists');
assert(editorialCSS.includes('data-theme="dark"'),'Dark theme has custom material tokens');
assert(editorialCSS.includes('@media(max-width:680px)'),'Mobile breakpoint exists');
new vm.Script(code,{filename:'app-v3.js'});
new vm.Script(themeCode,{filename:'editorial-v4.js'});
const elements=new Map();
function node(key){
 if(!elements.has(key)){
  const el={value:'',innerHTML:'',textContent:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(type,handler){this.listeners??={};this.listeners[type]=handler},setAttribute(){},focus(){}};
  elements.set(key,el);
 }
 return elements.get(key);
}
const docEvents={};
const document={
 documentElement:{setAttribute(name,value){this[name]=value},getAttribute(name){return this[name]}},
 getElementById(id){return id==='db'?{textContent:dataMatch[1]}:node('#'+id)},
 querySelector(sel){return node(sel)},
 querySelectorAll(){return []},
 addEventListener(name,fn){docEvents[name]=fn},
 createElement(){return {click(){},set href(v){},set download(v){}}}
};
const store=new Map();
const context={
 document,console,Math,Map,Set,Number,Array,String,Date,JSON,Intl,
 window:{scrollTo(){},addEventListener(){},matchMedia(){return {matches:false}}},
 location:{hash:''},
 history:{replaceState(){}},
 localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}},
 setTimeout(){return 1},clearTimeout(){},
 URL:{createObjectURL(){return 'blob:test'},revokeObjectURL(){}},
 Blob,
};
vm.createContext(context);
vm.runInContext(code,context,{timeout:5000});
vm.runInContext(themeCode,context,{timeout:5000});
assert.equal(document.documentElement['data-theme'],'light','Light theme is initialized');
assert.equal(node('#topCount').textContent,'305 мест','App booted');
assert.match(node('#metrics').innerHTML,/305/,'Home metrics rendered');
assert.match(node('#categories').innerHTML,/category-tile/,'Home categories rendered');
function click(dataset){
 docEvents.click({target:{closest(){return {dataset}}}});
}
click({nav:'catalog'});
assert.match(node('#catalogGrid').innerHTML,/place-card/,'Catalog cards render');
assert.match(node('#catalogGrid').innerHTML,/category-art/,'Catalog renders artwork');
assert(html.includes('id="resetCatalog"'),'Catalog reset exists');
node('#catalogSearch').listeners.input({target:{value:'nonexistent-unique-term-00000'}});
assert.match(node('#catalogGrid').innerHTML,/Ничего не найдено/,'Search filters catalog');
node('#resetCatalog').listeners.click();
assert.match(node('#catalogGrid').innerHTML,/place-card/,'Catalog reset restores results');
click({fav:'1'});
assert.equal(JSON.parse(store.get('spb-liza-anton-v2-avant'))['1'],'wish','Favorites persist');
click({nav:'favorites'});
assert.match(node('#favList').innerHTML,/Monterey/,'Saved list renders selected place');
click({nav:'routes'});
assert.match(node('#dayTabs').innerHTML,/day-tab/,'Route day tabs render');
assert.match(node('#stops').innerHTML,/stop/,'Route stops render');
assert.match(node('#stops').innerHTML,/stop-image/,'Route stops have visual previews');
click({nav:'map'});
assert.match(node('#mapCount').textContent,/123/,'Map filter count shown');
assert.match(node('#mapList').innerHTML,/map-item-image/,'Map results render thumbnails');
assert(html.includes('id="resetMap"'),'Map reset exists');
assert(html.includes('id="detailOnMap"'),'Internal map navigation exists');
assert(html.includes('id="copyRoute"'),'Copy route control exists');
node('#mapSearch').listeners.input({target:{value:'nonexistent-unique-term-00000'}});
assert.match(node('#mapCount').textContent,/0 из 123/,'Map search filters pins');
node('#resetMap').listeners.click();
assert.match(node('#mapCount').textContent,/123 из 123/,'Map reset restores pins');
assert.match(node('#homeMapCount').textContent,/123/,'Home map count shown');
assert(html.includes('data-collection="night"'),'Night collection is wired');
assert(html.includes('data-collection="architecture"'),'Architecture collection is wired');
assert(html.includes('data-collection="water"'),'Water collection is wired');
click({collection:'night'});
assert.match(node('#catalogGrid').innerHTML,/place-card/,'Curated night results render');
assert.match(node('#catalogTitle').textContent,/Бары/,'Night collection title shown');
click({nav:'catalog'});
assert.equal(node('#catalogTitle').textContent,'Найди своё место','All places resets curated collection');
click({routePreview:'2'});
assert.match(node('#routeHead').innerHTML,/Васильевский/,'Route preview selects correct day');
console.log('PASS: '+db.places.length+' places, '+db.routes.length+' itineraries, 123 map pins; home/catalog/saved/routes/map initialize.');
