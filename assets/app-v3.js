
'use strict';
(function(){
 const db=JSON.parse(document.getElementById('db').textContent);
 const places=db.places||[], routes=db.routes||[];
 const byId=new Map(places.map(p=>[String(p.id),p]));
 const STORAGE='spb-liza-anton-v2-avant';
 const PLAN='spb-liza-anton-dayplans-v1';
 const ORDER='spb-liza-anton-route-order-v1';
 const $=s=>document.querySelector(s);
 const $$=s=>Array.from(document.querySelectorAll(s));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>Number(n).toLocaleString('ru-RU')+' ₽';
 const categories=[...new Set(places.map(p=>p.category))];
 const icons={'Поесть — рестораны':'🍴','Кофе, десерты и перекус':'☕','Бары и напитки':'🍸','Игры и активные развлечения':'🎱','Кино, кабаре и клубы':'🎭','Заброшки, форты и руины':'🏚️','Музеи и планетарии':'🏛️','Галереи и арт-пространства':'🖼️','Дворцы, особняки и архитектура':'🏰','Прогулки и природа':'🌿','Храмы и кладбища':'⛪','Магазины и необычные места':'🛍️'};
 const ico=p=>icons[typeof p==='string'?p:p.category]||'📍';
 const artForCategory=c=>{
  if(/ресторан|кофе|десерт|перекус|бар|напитк/i.test(c))return 'site-water.webp';
  if(/музе|галере|арт|дворц|архитект|храм|кладбищ/i.test(c))return 'site-architecture.webp';
  if(/прогул|природ|отдых/i.test(c))return 'site-water.webp';
  return 'site-hero-main.webp';
 };
 const categoryArt=p=>'./assets/art/'+artForCategory(typeof p==='string'?p:p.category);
 const categoryVisual=p=>'<img class="category-art" src="'+categoryArt(p)+'" alt="" loading="lazy" decoding="async"><span class="category-symbol" aria-hidden="true">'+ico(p)+'</span>';
 
 const geo=places.filter(p=>p.lat!=null&&p.lon!=null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)));
 const load=(k,fallback)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'?v:fallback}catch(e){return fallback}};
 let states=load(STORAGE,{}),plans=load(PLAN,{}),orders=load(ORDER,{});
 let page='home',cat='',search='',status='',price='',sort='name',catalogPage=0,showOnly='all',collection='';
 let dayIndex=0,selectedPlace=null,map=null,mapLayer=null,routeMap=null,routeLayer=null;
 let mapCat='',mapSearch='',mapOnly='all',mapFocus=null,mapInitialized=false;
 let toastTimeout=0;
 const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(states));localStorage.setItem(PLAN,JSON.stringify(plans));localStorage.setItem(ORDER,JSON.stringify(orders))}catch(e){}};
 const getStatus=id=>states[String(id)]||'other';
 const hasPrice=p=>p.price_two!==null&&p.price_two!==undefined;
 const knownCost=items=>items.filter(hasPrice).reduce((s,p)=>s+Number(p.price_two),0);
 const routeDate=r=>new Date(r.day+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
 const searchUrl=p=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.lat!=null&&p.lon!=null?p.lat+','+p.lon:(p.verified_address||p.name+' '+(p.area||'Санкт-Петербург')));
 const placeWhere=p=>p.verified_address||((p.area||'').includes('уточнить')?'Расположение уточняется':p.area)||'Расположение уточняется';
 const catId=i=>'cat-'+i;
 function notify(message){const e=$('#toast');e.textContent=message;e.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>e.classList.remove('visible'),2600)}
 function updateGlobal(){
  $('#topCount').textContent=places.length+' мест';
  $('#navSaveCount').textContent=places.filter(p=>['wish','must'].includes(getStatus(p.id))).length;
  $('#navMapCount').textContent=geo.length;
  $('#topPage').textContent={home:'Обзор',catalog:'Все места',map:'Карта',favorites:'Сохранённое',routes:'Планировщик'}[page]||'Обзор';
 }
 function navigate(target){
  if(!$('#page-'+target))return;
  page=target;
  $$('.page').forEach(e=>e.classList.toggle('active',e.id==='page-'+target));
  $$('[data-nav]').forEach(e=>{const active=e.dataset.nav===target;e.classList.toggle('active',active);e.setAttribute('aria-current',active?'page':'false')});
  updateGlobal();
  if(target==='home')renderHome();
  if(target==='catalog')renderCatalog();
  if(target==='favorites')renderFavorites();
  if(target==='routes')renderRoutes();
  if(target==='map'){initMap();renderMap();}
  try{history.replaceState(null,'','#'+target)}catch(e){}
  window.scrollTo({top:0,behavior:'auto'});
 }
 function renderHome(){
  const saved=places.filter(p=>['wish','must'].includes(getStatus(p.id)));
  const done=places.filter(p=>getStatus(p.id)==='done');
  $('#metrics').innerHTML=[
   [places.length,'Мест в каталоге'],[geo.length,'На карте'],[saved.length,'Сохранили'],[done.length,'Посетили']
  ].map(x=>'<div class="metric glass"><strong>'+x[0]+'</strong><span>'+x[1]+'</span></div>').join('');
  const counts=Object.fromEntries(categories.map(c=>[c,places.filter(p=>p.category===c).length]));
  const editorialNames={'Поесть — рестораны':'Еда','Кофе, десерты и перекус':'Кофе','Бары и напитки':'Бары','Игры и активные развлечения':'Игры','Заброшки, форты и руины':'Необычное','Музеи и планетарии':'Культура','Прогулки и природа':'Прогулки'};
  const spotlight=categories.map((c,i)=>({c,i})).filter(({c})=>c in editorialNames).slice(0,6);
  $('#categories').innerHTML=spotlight.map(({c,i})=>'<button class="category-tile" data-category="'+i+'" style="--category-background:url(&quot;'+categoryArt(c)+'&quot;)"><span class="category-icon">'+ico(c)+'</span><div><strong>'+esc(editorialNames[c])+'</strong><br><small>'+counts[c]+' мест</small></div></button>').join('');
  $('#homeSaved').textContent=saved.length+' мест в избранном';
  $('#homeRoutes').textContent=routes.length+' дней';
 }
 function statusLabel(st){return {wish:'♡ Хочу',must:'★ Обязательно',done:'✓ Посетили'}[st]||'Добавить'}
 function renderChips(container,active,action){
  container.innerHTML='<button class="chip '+(!active?'active':'')+'" data-'+action+'="">Все</button>'+categories.map((c,i)=>'<button class="chip '+(c===active?'active':'')+'" data-'+action+'="'+i+'">'+ico(c)+' '+esc(c)+'</button>').join('');
 }
 function filteredCatalog(){
  const q=search.toLowerCase().trim();
  let list=places.filter(p=>{
   if(cat&&p.category!==cat)return false;
   if(collection==='night'&&p.category!=='Бары и напитки')return false;
   if(collection==='architecture'&&!/Дворцы|Заброшки|Музеи|Галереи/.test(p.category))return false;
   if(collection==='water'&&!/вода|вод|река|речк|озер|залив|мост|остров|берег|канал|порт|набереж/i.test((p.name||'')+' '+(p.note||'')+' '+(p.area||'')))return false;
   if(q&&!((p.name||'')+' '+(p.area||'')+' '+(p.note||'')+' '+(p.verified_address||'')).toLowerCase().includes(q))return false;
   if(status&&getStatus(p.id)!==status)return false;
   if(price==='known'&&!hasPrice(p))return false;
   if(price==='unknown'&&hasPrice(p))return false;
   if(price==='free'&&(!hasPrice(p)||Number(p.price_two)!==0))return false;
   return true;
  });
  list.sort((a,b)=>{
   if(sort==='cheap')return (hasPrice(a)?a.price_two:Infinity)-(hasPrice(b)?b.price_two:Infinity);
   if(sort==='expensive')return (hasPrice(b)?b.price_two:-1)-(hasPrice(a)?a.price_two:-1);
   if(sort==='category')return a.category.localeCompare(b.category,'ru')||a.name.localeCompare(b.name,'ru');
   return a.name.localeCompare(b.name,'ru');
  });
  return list;
 }
 function placeCard(p){
  const st=getStatus(p.id),tag=st==='other'?'':statusLabel(st);
  return '<article class="place-card glass">'+
   '<div class="place-visual">'+categoryVisual(p)+(tag?'<span class="place-status">'+tag+'</span>':'')+
   '<button class="heart '+(st==='wish'||st==='must'?'selected':'')+'" data-fav="'+p.id+'" aria-label="Добавить в избранное">'+(st==='wish'||st==='must'?'♥':'♡')+'</button></div>'+
   '<div class="type">'+esc(p.category)+'</div>'+
   '<h3>'+esc(p.name)+'</h3>'+
   '<div class="meta">'+esc(placeWhere(p))+'</div>'+
   '<div class="card-end"><span class="price">'+(hasPrice(p)?money(p.price_two)+' / двое':'Цена уточняется')+'</span><button class="mini-link" data-detail="'+p.id+'">Подробнее ↗</button></div></article>';
 }
 function renderCatalog(){
  renderChips($('#catalogChips'),cat,'pick-category');
  $('#catalogSearch').value=search;
  $('#catalogStatus').value=status;
  $('#catalogPrice').value=price;
  $('#catalogSort').value=sort;
  const all=filteredCatalog();const per=18;const pages=Math.max(1,Math.ceil(all.length/per));
  catalogPage=Math.min(catalogPage,pages-1);
  $('#catalogTitle').textContent=({night:'Бары и вечерний город',architecture:'Архитектура и индустрия',water:'У воды и набережных'})[collection]||'Найди своё место';
  $('#catalogCount').textContent='Найдено '+all.length+' из '+places.length+(collection?' · тематическая подборка':'');
  $('#catalogGrid').innerHTML=all.slice(catalogPage*per,(catalogPage+1)*per).map(placeCard).join('')||'<div class="empty"><strong>Ничего не найдено</strong>Попробуй изменить поиск или фильтры.</div>';
  $('#pager').innerHTML=pages>1?'<button class="btn" data-page-step="-1" '+(catalogPage===0?'disabled':'')+'>← Назад</button><span>'+ (catalogPage+1)+' / '+pages+'</span><button class="btn" data-page-step="1" '+(catalogPage===pages-1?'disabled':'')+'>Вперёд →</button>':'';
 }
 function setStatus(id,next){
  id=String(id);
  states[id]=getStatus(id)===next?'other':next;
  save();updateGlobal();renderHome();
  if(page==='catalog')renderCatalog();
  if(page==='favorites')renderFavorites();
  if(page==='map')renderMap(false);
  if(selectedPlace===id)$('#detailStatus').value=getStatus(id);
  notify(states[id]==='other'?'Место убрано из списка':'Отметка сохранена');
 }
 function changeDay(id,date){
  if(date)plans[String(id)]=date;else delete plans[String(id)];
  save();renderFavorites();if(page==='routes')renderRoutes();notify(date?'Добавлено в план '+date.slice(8)+'.11':'Убрано из плана');
 }
 function dayOptions(id){
  return '<option value="">Без даты</option>'+routes.map(r=>'<option value="'+r.day+'" '+(plans[String(id)]===r.day?'selected':'')+'>'+routeDate(r)+' · '+esc(r.title)+'</option>').join('');
 }
 function renderFavorites(){
  const chosen=places.filter(p=>getStatus(p.id)!=='other');
  const will=chosen.filter(p=>getStatus(p.id)==='wish'),must=chosen.filter(p=>getStatus(p.id)==='must'),done=chosen.filter(p=>getStatus(p.id)==='done');
  $('#favStats').innerHTML=[['♡',will.length,'Хочу'],['★',must.length,'Точно'],['✓',done.length,'Были']].map(x=>'<div><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div>').join('');
  $('#favBudget').textContent=(will.length+must.length)?money(knownCost(will.concat(must)))+' + неизвестные цены':'—';
  $('#favFilter').value=showOnly;
  const list=chosen.filter(p=>showOnly==='all'||getStatus(p.id)===showOnly).sort((a,b)=>(getStatus(a.id)==='must'?-1:1)-(getStatus(b.id)==='must'?-1:1));
  $('#favList').innerHTML=list.map(p=>'<article class="fav-row glass"><span class="fav-icon">'+categoryVisual(p)+'</span><div><h3>'+esc(p.name)+'</h3><small>'+esc(p.category)+' · '+statusLabel(getStatus(p.id))+(hasPrice(p)?' · '+money(p.price_two):'')+'</small></div><div class="fav-actions"><select aria-label="Выбрать день" data-day-assign="'+p.id+'">'+dayOptions(p.id)+'</select><button class="btn small" data-detail="'+p.id+'">↗</button><button class="btn small" data-remove="'+p.id+'" aria-label="Убрать из избранного">×</button></div></article>').join('')||'<div class="empty"><strong>Здесь пока пусто</strong>Добавь места в каталоге — они появятся здесь.</div>';
 }
 function routeStops(r){
  const m=new Map();
  for(const s of r.stops)m.set(String(s.id),{...s,from:'original'});
  for(const [id,date] of Object.entries(plans)){
   if(date===r.day&&byId.has(id)&&!m.has(id))m.set(id,{id:Number(id),name:byId.get(id).name,time:'—',note:'Добавлено из избранного',from:'custom'});
  }
  const original=Array.from(m.values());
  const order=orders[r.day]||[];
  return original.sort((a,b)=>{
   const ia=order.indexOf(String(a.id)),ib=order.indexOf(String(b.id));
   return (ia===-1?10000+Array.from(m.keys()).indexOf(String(a.id)):ia)-(ib===-1?10000+Array.from(m.keys()).indexOf(String(b.id)):ib);
  });
 }
 function reorderStop(id,step){
  const r=routes[dayIndex],stops=routeStops(r);
  const i=stops.findIndex(x=>String(x.id)===String(id)),j=i+Number(step);
  if(i<0||j<0||j>=stops.length)return;
  const a=stops.map(x=>String(x.id));[a[i],a[j]]=[a[j],a[i]];orders[r.day]=a;save();renderRoutes();
 }
 function renderRoutes(){
  $('#dayTabs').innerHTML=routes.map((r,i)=>'<button class="day-tab '+(i===dayIndex?'selected':'')+'" data-route-day="'+i+'"><span>'+routeDate(r)+'</span><small>'+routeStops(r).length+' мест</small></button>').join('');
  const r=routes[dayIndex],stops=routeStops(r),ps=stops.map(s=>byId.get(String(s.id))).filter(Boolean);
  $('#routeHead').innerHTML='<h3>'+esc(r.title)+'</h3><p class="plan-sub">'+esc(r.subtitle||'')+'</p>';
  $('#routeMetrics').innerHTML='<span>⌖ '+stops.length+' остановок</span><span>◈ '+(ps.some(hasPrice)?money(knownCost(ps)):'Цена не указана')+' / двое</span>';
  $('#stops').innerHTML=stops.map((s,i)=>'<div class="stop"><span class="time">'+esc(s.time||'—')+'</span><span class="stop-image">'+(byId.get(String(s.id))?categoryVisual(byId.get(String(s.id))):'')+'</span><div class="stop-description"><h3>'+esc(s.name)+'</h3><small>'+esc(s.note||'')+'</small></div><div class="stop-actions"><button title="Выше" data-reorder="'+s.id+'" data-direction="-1" '+(i===0?'disabled':'')+'>↑</button><button title="Ниже" data-reorder="'+s.id+'" data-direction="1" '+(i===stops.length-1?'disabled':'')+'>↓</button>'+(s.from==='custom'?'<button title="Удалить из дня" data-unassign="'+s.id+'">×</button>':'')+'</div></div>').join('');
  updateRouteMap(stops);
  const pts=ps.filter(p=>p.lat!=null&&p.lon!=null);
  const url=pts.length>1?'https://www.google.com/maps/dir/?api=1&origin='+pts[0].lat+','+pts[0].lon+'&destination='+pts.at(-1).lat+','+pts.at(-1).lon+'&waypoints='+encodeURIComponent(pts.slice(1,-1).map(p=>p.lat+','+p.lon).join('|'))+'&travelmode=walking':'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(r.title+' Санкт-Петербург');
  $('#openDirections').href=url;
 }
 function updateRouteMap(stops){
  if(!window.L)return;
  if(!routeMap){
   routeMap=L.map('routeMap',{scrollWheelZoom:false}).setView([59.94,30.31],10);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(routeMap);
   routeLayer=L.layerGroup().addTo(routeMap);
  }
  routeLayer.clearLayers();
  const coords=[];
  stops.forEach((s,i)=>{const p=byId.get(String(s.id));if(!p||p.lat==null)return;
   const point=[p.lat,p.lon];coords.push(point);
   L.marker(point).bindPopup('<b>'+esc(p.name)+'</b><br>'+esc(s.time)).addTo(routeLayer);
  });
  if(coords.length>1)L.polyline(coords,{color:'#376b6b',weight:4,dashArray:'6,7'}).addTo(routeLayer);
  if(coords.length)routeMap.fitBounds(L.latLngBounds(coords).pad(.2),{maxZoom:13});
  setTimeout(()=>routeMap.invalidateSize(),120);
 }
 function mapFiltered(){
  const q=mapSearch.trim().toLowerCase();
  return geo.filter(p=>(!mapCat||p.category===mapCat)&&(!q||(p.name+' '+(p.area||'')).toLowerCase().includes(q))&&(mapOnly!=='saved'||getStatus(p.id)!=='other'));
 }
 function initMap(){
  if(mapInitialized||!window.L)return;
  map=L.map('placesMap',{zoomControl:true,scrollWheelZoom:false}).setView([59.94,30.31],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  mapLayer=L.layerGroup().addTo(map);
  mapInitialized=true;
  setTimeout(()=>map.invalidateSize(),150);
 }
 function renderMap(fit=true){
  $('#mapSearch').value=mapSearch;
  $('#mapCategory').innerHTML='<option value="">Все категории</option>'+categories.map((c,i)=>'<option value="'+i+'" '+(mapCat===c?'selected':'')+'>'+ico(c)+' '+esc(c)+'</option>').join('');
  $('#mapOnly').value=mapOnly;
  const pts=mapFiltered();
  $('#mapCount').textContent=pts.length+' из '+geo.length+' точек';
  $('#mapMissing').textContent=(places.length-geo.length)+' мест без подтверждённых координат';
  $('#mapList').innerHTML=pts.map(p=>'<button class="map-list-item" data-focus="'+p.id+'"><span class="map-item-image">'+categoryVisual(p)+'</span><span><b>'+esc(p.name)+'</b><small>'+esc(p.category)+'</small></span></button>').join('')||'<div class="empty">Точек не найдено</div>';
  if(!mapInitialized)return;
  mapLayer.clearLayers();
  const bounds=[];
  pts.forEach(p=>{
   const point=[p.lat,p.lon],st=getStatus(p.id);
   const html='<div class="marker '+(st==='done'?'done':st==='wish'||st==='must'?'saved':'')+'">'+ico(p)+'</div>';
   const marker=L.marker(point,{icon:L.divIcon({className:'glass-marker',html,iconSize:[39,39],iconAnchor:[19,35],popupAnchor:[0,-30]})});
   marker.bindPopup('<strong>'+esc(p.name)+'</strong><small>'+esc(p.category)+'</small><div><button data-map-detail="'+p.id+'">Подробнее ↗</button><button data-map-save="'+p.id+'">♡ Сохранить</button></div>');
   marker.addTo(mapLayer);
   if(mapFocus===String(p.id)){setTimeout(()=>{map.setView(point,14);marker.openPopup()},80)}
   bounds.push(point);
  });
  if(fit&&bounds.length)map.fitBounds(L.latLngBounds(bounds).pad(.12),{maxZoom:12});
  setTimeout(()=>map.invalidateSize(),120);
 }
 function showDetail(id){
  const p=byId.get(String(id));if(!p)return;
  selectedPlace=String(id);
  $('#detailVisual').innerHTML=categoryVisual(p);
  $('#detailCategory').textContent=p.category;
  $('#detailTitle').textContent=p.name;
  $('#detailDescription').textContent=p.note||'Описание и информация о посещении пока уточняются.';
  $('#detailAddress').textContent=placeWhere(p);
  $('#detailPrice').textContent=hasPrice(p)?money(p.price_two)+' за двоих':'Стоимость ещё не проверена';
  $('#detailCoordinates').textContent=p.lat!=null?'Место нанесено на карту':'Координаты пока не установлены';
  $('#detailMaps').href=searchUrl(p);
  $('#detailSource').style.display=p.source?'inline-flex':'none';
  $('#detailSource').href=p.source||'#';
  $('#detailStatus').value=getStatus(p.id);
  $('#detailDay').innerHTML=dayOptions(p.id);
  $('#detailModal').classList.add('open');$('#detailModal').setAttribute('aria-hidden','false');
  $('#closeDetail').focus();
 }
 function closeDetail(){ $('#detailModal').classList.remove('open');$('#detailModal').setAttribute('aria-hidden','true');selectedPlace=null }
 function exportData(){
  const blob=new Blob([JSON.stringify({version:4,choices:states,dayPlans:plans,routeOrders:orders,exported:new Date().toISOString()},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='piter-vdvoem-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importData(file){
  try{
   const data=JSON.parse(await file.text());
   if(!data.choices||typeof data.choices!=='object'||Array.isArray(data.choices))throw Error('Неверный формат');
   states=data.choices;
   if(data.dayPlans&&typeof data.dayPlans==='object')plans=data.dayPlans;
   if(data.routeOrders&&typeof data.routeOrders==='object')orders=data.routeOrders;
   save();navigate(page);notify('Данные восстановлены');
  }catch(e){notify('Не удалось импортировать данные')}
 }
 function bind(){
  document.addEventListener('click',e=>{
   const button=e.target.closest('button,[data-nav],[data-detail]');if(!button)return;
   const d=button.dataset;
   if(d.collection){collection=d.collection;cat='';search='';status='';price='';sort='name';catalogPage=0;navigate('catalog');return}
   if(d.routePreview!==undefined){dayIndex=Number(d.routePreview);navigate('routes');return}
   if(d.nav){navigate(d.nav);return}
   if(d.category!==undefined){collection='';cat=categories[Number(d.category)];catalogPage=0;navigate('catalog');return}
   if(d['pickCategory']!==undefined){collection='';cat=d.pickCategory===''?'':categories[Number(d.pickCategory)];catalogPage=0;renderCatalog();return}
   if(d.fav){setStatus(d.fav,getStatus(d.fav)==='must'?'must':'wish');return}
   if(d.detail){showDetail(d.detail);return}
   if(d['mapDetail']){showDetail(d.mapDetail);return}
   if(d['mapSave']){setStatus(d.mapSave,'wish');return}
   if(d.remove){states[String(d.remove)]='other';save();updateGlobal();renderFavorites();notify('Убрано из списка');return}
   if(d['pageStep']){catalogPage+=Number(d.pageStep);renderCatalog();window.scrollTo({top:0,behavior:'smooth'});return}
   if(d['routeDay']!==undefined){dayIndex=Number(d.routeDay);renderRoutes();return}
   if(d.reorder){reorderStop(d.reorder,d.direction);return}
   if(d.unassign){delete plans[String(d.unassign)];save();renderRoutes();notify('Убрано из этого дня');return}
   if(d.focus){mapFocus=String(d.focus);renderMap(false);return}
  });
  $('#catalogSearch').addEventListener('input',e=>{search=e.target.value;catalogPage=0;renderCatalog()});
  $('#catalogStatus').addEventListener('change',e=>{status=e.target.value;catalogPage=0;renderCatalog()});
  $('#catalogPrice').addEventListener('change',e=>{price=e.target.value;catalogPage=0;renderCatalog()});
  $('#catalogSort').addEventListener('change',e=>{sort=e.target.value;renderCatalog()});
  $('#favFilter').addEventListener('change',e=>{showOnly=e.target.value;renderFavorites()});
  $('#favList').addEventListener('change',e=>{if(e.target.matches('[data-day-assign]'))changeDay(e.target.dataset.dayAssign,e.target.value)});
  $('#mapSearch').addEventListener('input',e=>{mapSearch=e.target.value;mapFocus=null;renderMap()});
  $('#mapCategory').addEventListener('change',e=>{mapCat=e.target.value===''?'':categories[Number(e.target.value)];mapFocus=null;renderMap()});
  $('#mapOnly').addEventListener('change',e=>{mapOnly=e.target.value;renderMap()});
  $('#detailStatus').addEventListener('change',e=>{if(selectedPlace){setStatus(selectedPlace,e.target.value);$('#detailStatus').value=getStatus(selectedPlace)}});
  $('#detailDay').addEventListener('change',e=>{if(selectedPlace){changeDay(selectedPlace,e.target.value)}});
  $('#detailOnMap').addEventListener('click',()=>{
    if(!selectedPlace)return;
    const p=byId.get(selectedPlace);
    if(!p||p.lat==null||p.lon==null){notify('Координаты этого места ещё уточняются');return}
    mapCat='';mapOnly='all';mapSearch='';mapFocus=selectedPlace;
    closeDetail();navigate('map');
  });
  $('#resetCatalog').addEventListener('click',()=>{
    cat='';collection='';search='';status='';price='';sort='name';catalogPage=0;renderCatalog();
  });
  $('#resetMap').addEventListener('click',()=>{
    mapCat='';mapSearch='';mapOnly='all';mapFocus=null;renderMap(true);
  });
  $('#copyRoute').addEventListener('click',async()=>{
    const route=routes[dayIndex];if(!route)return;
    const stops=routeStops(route);
    const text='Питер вдвоём · '+routeDate(route)+' · '+route.title+'\n\n'+stops.map((s,i)=>(i+1)+'. '+(s.time||'—')+' — '+s.name+(s.note?' · '+s.note:'')).join('\n')+'\n\nПлан предварительный: проверьте часы работы и транспорт.';
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text)}
      else{const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();if(!document.execCommand('copy'))throw Error('copy failed');el.remove()}
      notify('Маршрут скопирован');
    }catch(e){notify('Не удалось скопировать — проверьте доступ к буферу обмена')}
  });
  $('#closeDetail').onclick=closeDetail;
  $('#detailModal').addEventListener('click',e=>{if(e.target.id==='detailModal')closeDetail()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail()});
  $('#exportBtn').onclick=exportData;
  $('#importBtn').onchange=e=>{if(e.target.files&&e.target.files[0])importData(e.target.files[0]);e.target.value=''};
  window.addEventListener('hashchange',()=>{const name=location.hash.slice(1);if(['home','catalog','map','favorites','routes'].includes(name)&&name!==page)navigate(name)});
 }
 function start(){
  $('#catalogTitle').textContent='Найди своё место';
  $('#mapTotal').textContent=geo.length;
  bind();
  updateGlobal();
  renderHome();
  const p=location.hash.slice(1);
  navigate(['home','catalog','map','favorites','routes'].includes(p)?p:'home');
 }
 start();
})();
