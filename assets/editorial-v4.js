'use strict';
(function(){
  const key='piter-vdvoem-theme-v1';
  const root=document.documentElement;
  const toggle=document.getElementById('themeSwitch');
  if(!toggle)return;
  function stored(){try{return localStorage.getItem(key)}catch(e){return null}}
  function save(value){try{localStorage.setItem(key,value)}catch(e){}}
  const preferred=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  function apply(value){
    const theme=value==='dark'?'dark':'light';
    root.setAttribute('data-theme',theme);
    toggle.textContent=theme==='dark'?'☀':'☾';
    toggle.setAttribute('aria-label',theme==='dark'?'Включить светлую тему':'Включить тёмную тему');
    toggle.setAttribute('title',theme==='dark'?'Светлая тема':'Тёмная тема');
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='dark'?'#141419':'#eee9e8');
  }
  apply(stored()||preferred);
  toggle.addEventListener('click',()=>{
    const theme=root.getAttribute('data-theme')==='dark'?'light':'dark';
    apply(theme);save(theme);
  });
  const count=document.getElementById('homeMapCount');
  const mapCount=document.getElementById('navMapCount');
  if(count&&mapCount) count.textContent=mapCount.textContent+' точек на карте ↗';
  function syncNav(){
    const active=location.hash.replace('#','')||'home';
    document.querySelectorAll('.ed-topnav [data-nav]').forEach(button=>{
      const on=button.dataset.nav===active;
      button.classList.toggle('active',on);
      button.setAttribute('aria-current',on?'page':'false');
    });
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-nav]'))requestAnimationFrame(syncNav);
  });
  window.addEventListener('hashchange',syncNav);
  syncNav();
})();
