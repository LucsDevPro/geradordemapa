/* sw.js — service worker do sistema de ovitrampas.
   · Arquivos do sistema: guardados na instalação (o sistema abre sem internet).
   · Bibliotecas pesadas (PDF, ZIP, QR, mapa vetorial): guardadas em segundo plano, sem atrasar a instalação.
   · data/manifest.json: sempre tenta a rede e cai no que está guardado.
   · data/*.json?v=…: versionados; uma vez guardados, não são baixados de novo.
   · Páginas: rede primeiro (para receber atualizações), guardado como reserva. */
const VERSAO='462a0c85';
const C_SISTEMA='ovi-sistema-'+VERSAO, C_DADOS='ovi-dados';
const CRITICOS=[
"./",
"index.html",
"gestao.html",
"assets/css/app.css?v=462a0c85",
"assets/css/base.css?v=462a0c85",
"assets/css/gestao.css?v=462a0c85",
"assets/css/legacy.css?v=462a0c85",
"assets/css/tokens.css?v=462a0c85",
"assets/fonts/archivo-400.woff2",
"assets/fonts/archivo-600.woff2",
"assets/fonts/archivo-800.woff2",
"assets/img/favicon.png",
"assets/img/icone-192.png",
"assets/img/logo-2x.png",
"assets/img/logo.png",
"assets/vendor/leaflet.js?v=462a0c85",
"assets/vendor/leaflet.css?v=462a0c85",
"assets/vendor/images/layers.png",
"assets/vendor/images/layers-2x.png",
"assets/vendor/images/marker-icon.png",
"assets/js/app.js?v=462a0c85",
"assets/js/boot.js?v=462a0c85",
"assets/js/gestao.js?v=462a0c85",
"assets/js/ui.js?v=462a0c85"
];
const PESADOS=[
"assets/vendor/html2canvas.min.js?v=462a0c85",
"assets/vendor/jspdf.umd.min.js?v=462a0c85",
"assets/vendor/jszip.min.js?v=462a0c85",
"assets/vendor/maplibre-gl.css?v=462a0c85",
"assets/vendor/maplibre-gl.js?v=462a0c85",
"assets/vendor/qrcode.js?v=462a0c85"
];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(C_SISTEMA);
    await c.addAll(CRITICOS);
    PESADOS.forEach(u=>c.add(u).catch(()=>{}));          /* em segundo plano */
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k.startsWith('ovi-sistema-')&&k!==C_SISTEMA) await caches.delete(k);
    await self.clients.claim();
  })());
});

const mesmaOrigem=u=>new URL(u).origin===self.location.origin;
async function redePrimeiro(req,cacheNome,ms){
  const c=await caches.open(cacheNome);
  try{
    const r=await Promise.race([fetch(req),new Promise((_,rej)=>setTimeout(()=>rej(new Error('lento')),ms||5000))]);
    if(r&&r.ok) c.put(req,r.clone());
    return r;
  }catch(err){
    const g=await c.match(req,{ignoreSearch:false})||await c.match(req,{ignoreSearch:true});
    if(g) return g;
    throw err;
  }
}
async function cachePrimeiro(req,cacheNome){
  const c=await caches.open(cacheNome), g=await c.match(req);
  if(g) return g;
  const r=await fetch(req); if(r&&r.ok) c.put(req,r.clone()); return r;
}
async function dadoVersionado(req){
  const c=await caches.open(C_DADOS), g=await c.match(req);
  if(g) return g;
  const r=await fetch(req);
  if(r&&r.ok){
    const u=new URL(req.url);                              /* descarta versões antigas do mesmo arquivo */
    for(const k of await c.keys()){ const x=new URL(k.url); if(x.pathname===u.pathname&&x.search!==u.search) c.delete(k); }
    c.put(req,r.clone());
  }
  return r;
}
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET'||!mesmaOrigem(req.url)) return;
  const u=new URL(req.url), p=u.pathname;
  if(req.mode==='navigate'){
    e.respondWith(redePrimeiro(req,C_SISTEMA,4000).catch(async()=>(await caches.match(u.pathname.endsWith('gestao.html')?'gestao.html':'index.html',{ignoreSearch:true}))||Response.error()));
    return;
  }
  if(/\/data\/manifest\.json$/.test(p)){ e.respondWith(redePrimeiro(req,C_DADOS,4000)); return; }
  if(/\/data\/[^/]+\.json$/.test(p)){ e.respondWith(dadoVersionado(req)); return; }
  if(/\/assets\//.test(p)){ e.respondWith(cachePrimeiro(req,C_SISTEMA).catch(()=>caches.match(req,{ignoreSearch:true}))); return; }
});
