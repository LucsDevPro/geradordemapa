/* app.js — mapa de campo (Prefeitura de Ponta Porã). Dados vêm de data/*.json via boot.js. */

/* ===================== BASE OFICIAL (coordenação) =====================
   [ID, rua, número, latitude, longitude, ovos] — texto original da planilha (atualização de 02/10/2026).
   Ovos = null quando não informado (ovitrampas 220 a 242 ainda sem contagem). IDs 1–242 são permanentes: nunca renumerar. */
const RAW = window.__BOOT.raw;;

/* Registro de correções. Nenhuma coordenada é alterada em silêncio:
   toda correção deve ser feita aqui e aparece no painel de conferência. */
const CORRECOES = window.__BOOT.correcoes.map(c=>({...c})); // { id, campo:'lat'|'lon'|'endereco', de, para, motivo, data, responsavel }

const CENTRO = [-22.536, -55.726];
/* Contorno do número = faixa de ovos */
const FAIXAS_OVOS=[['0 ovos','#73d7ff'],['1–20 ovos','#c0ff80'],['21–50 ovos','#ffff00'],['51–100 ovos','#f98404'],['101+ ovos','#ff0000'],['Sem informação','#800080']];
const corOvos=n=>(n===null||n===undefined)?'#800080':n<=0?'#73d7ff':n<=20?'#c0ff80':n<=50?'#ffff00':n<=100?'#f98404':'#ff0000';
const ovOn=()=>!!(document.getElementById('ovOn')&&document.getElementById('ovOn').checked);
const ovPrintOn=()=>window.__ovForce===true||!!(document.getElementById('ovPrint')&&document.getElementById('ovPrint').checked);
const GCOL = ['#d90429','#7b2cbf','#1b8a2f','#e36414','#1d4ed8','#0a9396','#c9184a','#8a6d00','#6a040f','#0b525b'];

/* Modelo pronto para dados futuros (agente, equipe, datas, ovos, situação, foto, observação, histórico, status) */
const enderecoCompleto = (rua,num) => { num=String(num||'').trim(); return (!num||/^[—–-]+$/.test(num))? rua : rua+', '+num; };
const pts = RAW.map(r => ({
  id: r[0], rua: r[1], numero: r[2], endereco: enderecoCompleto(r[1],r[2]), latRaw: r[3], lonRaw: r[4],
  lat: parseFloat(r[3]), lon: parseFloat(r[4]),
  semEndereco: /^Sem endere/i.test(r[1]),
  agente: null, equipe: null, dataInstalacao: null, dataRecolhimento: null,
  ovos: (r[5]===null||r[5]===undefined)? null : r[5], situacao: null, foto: null, observacao: null, historico: [], status: null,
  grupo: null, marker: null
}));
const byId = {}; pts.forEach(o => byId[o.id] = o);

/* ===================== DADOS ATUALIZÁVEIS (guardados neste aparelho) =====================
   A base original (RAW) nunca é apagada. Alterações importadas e registros de campo ficam em localStorage
   e são aplicados por cima dela ao abrir a página. "Voltar à base original" apaga só essas alterações. */
const STORE_KEY='ovitrampas.dados.v2';
function storeVazio(){ return {versao:2,quando:null,pts:{},agentes:null,ciclo:{},corr:[],log:[],serie:null}; }
function storeLer(){
  try{ const t=localStorage.getItem(STORE_KEY); if(t){ const d=JSON.parse(t); if(d&&d.versao===2) return Object.assign(storeVazio(),d); } }catch(e){}
  return storeVazio();
}
let STORE=storeLer();
function storeSalvar(){
  STORE.quando=new Date().toISOString();
  try{ localStorage.setItem(STORE_KEY,JSON.stringify(STORE)); return true; }catch(e){ console.warn('Não foi possível guardar:',e); return false; }
}
function aplicaPonto(o,d){
  if(d.rua!==undefined) o.rua=d.rua;
  if(d.numero!==undefined) o.numero=d.numero;
  if(d.lat!==undefined){ o.latRaw=d.lat; o.lat=parseFloat(d.lat); }
  if(d.lon!==undefined){ o.lonRaw=d.lon; o.lon=parseFloat(d.lon); }
  if(d.ovos!==undefined) o.ovosBase=(d.ovos===null)?null:d.ovos;
  o.endereco=enderecoCompleto(o.rua,o.numero); o.semEndereco=/^Sem endere/i.test(o.rua);
}
function ovosEfetivo(o){
  const h=(o.historico||[]).filter(x=>x&&x.d&&isFinite(x.n)).sort((a,b)=>a.d.localeCompare(b.d));
  return h.length? h[h.length-1].n : (o.ovosBase===undefined? o.ovos : o.ovosBase);
}
pts.forEach(o=>{ o.ovosBase=o.ovos; });
Object.keys(STORE.pts).forEach(id=>{ const o=byId[+id]; if(o) aplicaPonto(o,STORE.pts[id]); });
const PUB=window.__BOOT.pub;
Object.keys((PUB.ano&&PUB.ano.campo)||{}).forEach(id=>{ const o=byId[+id], c=PUB.ano.campo[id]; if(!o||!c) return; o.dataInstalacao=c.inst||null; o.dataRecolhimento=c.rec||null; o.historico=(c.hist||[]).map(x=>({d:x.d,n:x.n})); });
Object.keys(STORE.ciclo).forEach(id=>{ const o=byId[+id], c=STORE.ciclo[id]; if(!o||!c) return; o.dataInstalacao=c.inst||null; o.dataRecolhimento=c.rec||null; o.historico=Array.isArray(c.hist)?c.hist:[]; });
pts.forEach(o=>{ o.ovos=ovosEfetivo(o); });
if(Array.isArray(STORE.corr)) STORE.corr.forEach(x=>CORRECOES.push(x));

/* ===================== utilidades ===================== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function toast(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none',3200); }
function hav(a,b,c,d){ const p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2; return 2*6371*Math.asin(Math.sqrt(x)); }
const linkAbrir = o => `https://www.google.com/maps/search/?api=1&query=${o.latRaw},${o.lonRaw}`;
const linkNavegar = o => `https://www.google.com/maps/dir/?api=1&destination=${o.latRaw},${o.lonRaw}&travelmode=driving`;

function parseIds(str){
  const out=new Set(), bad=[];
  String(str).split(/[,;\s]+/).filter(Boolean).forEach(t=>{
    const m=t.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if(m){ let a=+m[1],b=+m[2]; if(a>b)[a,b]=[b,a]; if(a<1||b>242){bad.push(t);return;} for(let i=a;i<=b;i++) out.add(i); }
    else if(/^\d+$/.test(t)){ const n=+t; if(n>=1&&n<=242) out.add(n); else bad.push(t); }
    else bad.push(t);
  });
  return {ids:[...out].sort((a,b)=>a-b), bad};
}
function compress(ids){
  const s=[...ids].sort((a,b)=>a-b), out=[]; let i=0;
  while(i<s.length){ let j=i; while(j+1<s.length&&s[j+1]===s[j]+1) j++; out.push(j>i+1? `${s[i]}-${s[j]}` : s.slice(i,j+1).join(', ')); i=j+1; }
  return out.join(', ');
}

/* ===================== MAPA GUARDADO NO APARELHO (cache de imagens do mapa) =====================
   Toda imagem de mapa que você vê é guardada (IndexedDB); sem internet, o mapa usa o que está guardado. */
const TileDB=(()=>{
  let dbp=null;
  const abre=()=>dbp||(dbp=new Promise((res,rej)=>{
    try{ const r=indexedDB.open('ovitrampas-tiles',1); r.onupgradeneeded=()=>r.result.createObjectStore('t'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }
    catch(e){ rej(e); }
  }));
  const tx=(modo,fn)=>abre().then(db=>new Promise((res,rej)=>{
    const t=db.transaction('t',modo), st=t.objectStore('t'); let rq; try{ rq=fn(st); }catch(e){ rej(e); return; }
    t.oncomplete=()=>res(rq&&rq.result); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error);
  }));
  return {get:k=>tx('readonly',s=>s.get(k)), put:(k,v)=>tx('readwrite',s=>s.put(v,k)), has:k=>tx('readonly',s=>s.count(k)).then(n=>n>0), count:()=>tx('readonly',s=>s.count()), clear:()=>tx('readwrite',s=>s.clear())};
})();
async function tileBlob(url){
  try{ const c=await TileDB.get(url); if(c&&c.buf) return c; }catch(e){}
  const r=await fetch(url,{mode:'cors'});
  if(!r.ok) throw new Error('mapa '+r.status);
  const buf=await r.arrayBuffer(), reg={buf,type:r.headers.get('content-type')||'image/png'};
  TileDB.put(url,reg).catch(()=>{});
  return reg;
}
L.TileLayer.Cache=L.TileLayer.extend({
  createTile(coords,done){
    const img=document.createElement('img'); img.alt=''; img.setAttribute('role','presentation');
    const url=this.getTileUrl(coords);
    tileBlob(url).then(({buf,type})=>{
      const u=URL.createObjectURL(new Blob([buf],{type}));
      img.onload=()=>{ URL.revokeObjectURL(u); done(null,img); };
      img.onerror=()=>{ URL.revokeObjectURL(u); done(new Error('imagem'),img); };
      img.src=u;
    }).catch(e=>{ img.crossOrigin=''; img.onload=()=>done(null,img); img.onerror=()=>done(e,img); img.src=url; });
    return img;
  }
});

/* ===================== mapa ===================== */
const map = L.map('map',{zoomControl:true, zoomSnap:0.5}).setView(CENTRO,13);
const osm = new L.TileLayer.Cache('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true,attribution:'Mapa © Esri, HERE, Garmin, OpenStreetMap contributors'});
const sat = L.layerGroup([
  new L.TileLayer.Cache('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true,attribution:'Imagens © Esri, Maxar, Earthstar Geographics'}),
  new L.TileLayer.Cache('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true,opacity:.9})
]);
osm.addTo(map);
L.control.layers({'Mapa (ruas)':osm,'Satélite':sat},null,{position:'topright',collapsed:false}).addTo(map);
L.control.scale({imperial:false}).addTo(map);
const layer = L.layerGroup().addTo(map);
const legOv=L.control({position:'bottomleft'});
legOv.onAdd=()=>{ const d=L.DomUtil.create('div','legov'); d.innerHTML=`<details ${window.innerWidth>820?'open':''}><summary>Contorno = nº de ovos</summary>${FAIXAS_OVOS.map(([t,c])=>`<div><i style="background:${c}"></i>${t}</div>`).join('')}</details>`; L.DomEvent.disableClickPropagation(d); return d; };
$('ovOn').addEventListener('change',()=>{
  const on=ovOn(); document.body.classList.toggle('ov-on',on);
  if(on&&!$('ovPrint').checked) $('ovPrint').checked=true;
  if(on) legOv.addTo(map); else map.removeControl(legOv);
  refresh(false);
});

function zoomClass(m){
  const z=m.getZoom(), c=m.getContainer();
  c.classList.remove('z-s','z-m','z-l','z-x');
  c.classList.add(m._fixed||(z<=13?'z-s':z<=14?'z-m':z<=15?'z-l':'z-x'));
}
map.on('zoomend',()=>zoomClass(map)); zoomClass(map);

const sel = new Set();
let filter='all', field=false;

/* enquadra só os pontos informados, em zoom inteiro (nome das ruas nítido) e marcadores menores */
function fitLegivel(m,list,pad){
  m._fixed='z-m';
  const ll=list.map(o=>[o.lat,o.lon]);
  if(ll.length===1){ m.setView(ll[0],18,{animate:false}); zoomClass(m); return; }
  const b=L.latLngBounds(ll);
  let z=Math.floor(m.getBoundsZoom(b,false,L.point(pad*2,pad*2+40)));
  z=Math.max(10,Math.min(18,z));
  m.setView(b.getCenter(),z,{animate:false});
  zoomClass(m);
}
function aguardaTiles(el,ms){
  return new Promise(res=>{
    const t0=Date.now();
    (function chk(){
      const tl=[...el.querySelectorAll('.leaflet-tile')];
      const ok=tl.length&&tl.every(i=>i.classList.contains('leaflet-tile-loaded'));
      if(ok||Date.now()-t0>ms) setTimeout(res,350); else setTimeout(chk,150);
    })();
  });
}

function iconFor(o, plain){
  const c=['mk']; const isSel=!plain && sel.has(o.id);
  if(isSel) c.push('sel'); if(o.id>=100) c.push('n3');
  const bg=(!isSel && o.grupo!=null)? `--mkc:${GCOL[o.grupo%GCOL.length]}` : '';
  return L.divIcon({className:'mk-wrap',html:`<div class="${c.join(' ')}" style="${bg};--ov:${corOvos(o.ovos)}"><span class="num">${o.id}</span><svg class=\"pot\" viewBox=\"0 0 28 28\" aria-hidden=\"true\"><path d=\"M17.5 1.5l4 1.2-4.4 10.6-3.2-1z\" fill=\"#d9a15b\" stroke=\"#6b4217\" stroke-width=\"1\"/><path d=\"M5 9.5L7.3 25c.1 1 .9 1.7 1.9 1.7h9.6c1 0 1.8-.7 1.9-1.7L23 9.5z\" fill=\"#1a1a1a\" stroke=\"#fff\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><ellipse class=\"rim\" cx=\"14\" cy=\"9.5\" rx=\"9\" ry=\"3.2\" stroke=\"#fff\" stroke-width=\"1.6\"/><ellipse cx=\"14\" cy=\"9.5\" rx=\"6.4\" ry=\"2\" fill=\"#4aa8e8\"/></svg></div>`,iconSize:[0,0]});
}

function alertasDe(id){ return (VAL||[]).filter(v=>v.id===id); }
function popupHtml(o){
  const al=alertasDe(o.id).filter(v=>v.nivel!=='info');
  return `<div class="pp">
    <div class="pp-id">Ovitrampa ${o.id}</div>
    <div class="pp-addr">${esc(o.endereco)}</div>
    ${agentePopup(o)}
    <div class="pp-coord">Lat ${esc(o.latRaw)} · Lon ${esc(o.lonRaw)}</div>
    <div class="pp-coord" style="margin-top:-6px">${ovOn()?`<span style="display:inline-block;width:22px;height:12px;border-radius:6px;border:1.5px solid #111;vertical-align:-2px;background:${corOvos(o.ovos)}"></span> `:''}Ovos: <b>${o.ovos===null?'sem contagem':o.ovos}</b></div>
    ${gradeLinhaPopup(o)}
    ${cicloLinhaPopup(o)}
    ${serieLinhaPopup(o)}
    <a class="btn" target="_blank" rel="noopener" href="${linkAbrir(o)}">Abrir no Google Maps</a>
    <a class="btn nav" target="_blank" rel="noopener" href="${linkNavegar(o)}">Navegar até a ovitrampa</a>
    <button class="btn" type="button" onclick="abreCiclo(${o.id})">Registrar / histórico</button>
    <button class="btn" type="button" onclick="toggleSel(${o.id})">${sel.has(o.id)?'Remover da seleção':'Selecionar'}</button>
    ${al.length?`<div class="pp-warn">⚠ ${al.map(a=>esc(a.tipo)).join('; ')} — conferir coordenada</div>`:''}
  </div>`;
}
pts.forEach(o=>{
  o.marker=L.marker([o.lat,o.lon],{icon:iconFor(o),title:'Ovitrampa '+o.id,riseOnHover:true,keyboard:true});
  o.marker.bindPopup(()=>popupHtml(o),{maxWidth:300,autoPanPadding:[40,40]});
});

function inFilter(o){ if(filter==='all') return true; const [a,b]=filter.split('-').map(Number); return o.id>=a&&o.id<=b; }
function visibleList(){ return field ? pts.filter(o=>sel.has(o.id)) : pts.filter(inFilter); }
function fitTo(list){
  if(!list.length) return;
  if(list.length===1){ map.setView([list[0].lat,list[0].lon],17); return; }
  map.fitBounds(L.latLngBounds(list.map(o=>[o.lat,o.lon])),{padding:[60,60],maxZoom:17});
}
function refresh(fit){
  const vis=new Set(visibleList().map(o=>o.id));
  pts.forEach(o=>{ const on=layer.hasLayer(o.marker); if(vis.has(o.id)){ if(!on) layer.addLayer(o.marker);} else if(on) layer.removeLayer(o.marker); });
  $('cVis').textContent=vis.size; $('cSel').textContent=sel.size;
  $('fieldMode').checked=field;
  $('ids').value = compress(sel);
  document.querySelectorAll('#chips .chip').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.f===filter)));
  if(fit) fitTo(visibleList());
  if(window.__modulosOk){ atualizaRota(); atualizaGen(); }
}
function reicon(ids){ (ids||pts.map(o=>o.id)).forEach(id=>byId[id].marker.setIcon(iconFor(byId[id]))); }

window.toggleSel = function(id){
  if(sel.has(id)) sel.delete(id); else sel.add(id);
  reicon([id]); refresh(false);
  const m=byId[id].marker; if(m.isPopupOpen()) m.setPopupContent(popupHtml(byId[id]));
};

/* filtros */
document.querySelectorAll('#chips .chip').forEach(b=>b.addEventListener('click',()=>{
  filter=b.dataset.f; field=false; refresh(true);
}));
$('selFilter').addEventListener('click',()=>{
  const l=pts.filter(inFilter); l.forEach(o=>sel.add(o.id)); reicon(l.map(o=>o.id)); refresh(false);
  toast(`${l.length} ovitrampas adicionadas à seleção`);
});

/* mapa de campo */
$('apply').addEventListener('click',()=>{
  const {ids,bad}=parseIds($('ids').value);
  if(bad.length) toast('Não reconhecido: '+bad.join(', '));
  if(!ids.length){ if(!bad.length) toast('Digite os números das ovitrampas.'); return; }
  const old=[...sel]; sel.clear(); ids.forEach(i=>sel.add(i));
  reicon([...new Set([...old,...ids])]);
  field=true; refresh(true); closeMenu();
});
$('clear').addEventListener('click',()=>{ const old=[...sel]; sel.clear(); reicon(old); field=false; refresh(true); });
$('fieldMode').addEventListener('change',e=>{
  if(e.target.checked && !sel.size){ e.target.checked=false; toast('Selecione ao menos uma ovitrampa.'); return; }
  field=e.target.checked; refresh(true);
});

/* pesquisa */
function buscar(txt){
  const t=norm(txt.trim()); if(!t) return [];
  if(/^\d+$/.test(t)){ const n=+t; const exact=byId[n]; const rest=pts.filter(o=>o.id!==n&&String(o.id).startsWith(t)).slice(0,6); return exact?[exact,...rest]:rest; }
  return pts.filter(o=>norm(o.endereco).includes(t)).slice(0,12);
}
function irPara(o){
  if(!visibleList().includes(o)){ filter='all'; field=false; refresh(false); toast('Filtro redefinido para “Todos” para mostrar este ponto.'); }
  closeMenu(); $('sres').style.display='none';
  map.setView([o.lat,o.lon],Math.max(map.getZoom(),17));
  setTimeout(()=>o.marker.openPopup(),250);
}
$('q').addEventListener('input',e=>{
  const r=buscar(e.target.value), box=$('sres');
  if(!e.target.value.trim()){ box.style.display='none'; return; }
  box.innerHTML = r.length? r.map(o=>`<button type="button" data-id="${o.id}"><b>${o.id}</b><span>${esc(o.endereco)}<small>${esc(o.latRaw)}, ${esc(o.lonRaw)}</small></span></button>`).join('') : '<div style="padding:12px;color:#587079">Nada encontrado.</div>';
  box.style.display='block';
});
$('q').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const r=buscar(e.target.value); if(r[0]) irPara(r[0]); } });
$('sres').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) irPara(byId[+b.dataset.id]); });
document.addEventListener('click',e=>{ if(!e.target.closest('.search')) $('sres').style.display='none'; });

/* menu móvel */
function closeMenu(){ document.body.classList.remove('menu-open'); setTimeout(()=>map.invalidateSize(),50); }
function setMenuHidden(h){
  document.body.classList.toggle('menu-hidden',h);
  try{ localStorage.setItem('menuHidden',h?'1':'0'); }catch(e){}
  setTimeout(()=>map.invalidateSize(),60); setTimeout(()=>map.invalidateSize(),280);
}
$('hideMenu').addEventListener('click',()=>setMenuHidden(true));
$('menuBtn').addEventListener('click',()=>{ document.body.classList.add('menu-open'); if(document.body.classList.contains('menu-hidden')) setMenuHidden(false); });
try{ if(localStorage.getItem('menuHidden')==='1'&&window.innerWidth>820){ document.body.classList.add('menu-hidden'); setTimeout(()=>map.invalidateSize(),100); } }catch(e){}
$('closeMenu').addEventListener('click',closeMenu);

/* ===================== agrupamento por proximidade (prévia) ===================== */
function kmeans(list,k){
  const kx=Math.cos(-22.5*Math.PI/180);
  const P=list.map(o=>[o.lon*kx,o.lat]);
  const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
  let first=0; P.forEach((p,i)=>{ if(p[0]<P[first][0]) first=i; });
  const C=[P[first].slice()];
  while(C.length<k){ let best=-1,bd=-1; P.forEach((p,i)=>{ const d=Math.min(...C.map(c=>d2(p,c))); if(d>bd){bd=d;best=i;} }); C.push(P[best].slice()); }
  let asg=new Array(P.length).fill(0);
  for(let it=0;it<40;it++){
    let moved=false;
    P.forEach((p,i)=>{ let b=0,bd=Infinity; C.forEach((c,j)=>{ const d=d2(p,c); if(d<bd){bd=d;b=j;} }); if(asg[i]!==b){asg[i]=b;moved=true;} });
    C.forEach((c,j)=>{ const m=P.filter((_,i)=>asg[i]===j); if(m.length){ c[0]=m.reduce((s,p)=>s+p[0],0)/m.length; c[1]=m.reduce((s,p)=>s+p[1],0)/m.length; } });
    if(!moved) break;
  }
  return asg;
}
let grupos=[];
$('group').addEventListener('click',()=>{
  const list=visibleList(); if(list.length<2){ toast('Poucos pontos visíveis para agrupar.'); return; }
  const size=Math.max(5,Math.min(60,+$('gsize').value||20));
  const k=Math.max(1,Math.round(list.length/size));
  const asg=kmeans(list,k);
  pts.forEach(o=>o.grupo=null);
  const buckets=Array.from({length:k},()=>[]);
  list.forEach((o,i)=>buckets[asg[i]].push(o));
  grupos=buckets.filter(b=>b.length).sort((a,b)=>Math.min(...a.map(o=>o.lon))-Math.min(...b.map(o=>o.lon)));
  grupos.forEach((g,i)=>g.forEach(o=>o.grupo=i));
  reicon(); renderGrupos(); toast(`${grupos.length} grupos criados`);
});
$('ungroup').addEventListener('click',()=>{ pts.forEach(o=>o.grupo=null); grupos=[]; reicon(); renderGrupos(); });
function renderGrupos(){
  $('groups').innerHTML=grupos.map((g,i)=>`<button type="button" data-g="${i}"><i style="background:${GCOL[i%GCOL.length]}"></i>G${i+1} · ${g.length}</button>`).join('');
}
$('groups').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  const g=grupos[+b.dataset.g]; const old=[...sel]; sel.clear(); g.forEach(o=>sel.add(o.id));
  reicon([...new Set([...old,...g.map(o=>o.id)])]); field=true; refresh(true); closeMenu();
  toast(`Grupo G${+b.dataset.g+1}: ${compress(g.map(o=>o.id))}`);
});

/* ===================== validação das coordenadas ===================== */
function validar(){
  const out=[]; const add=(o,nivel,tipo,msg)=>out.push({id:o?o.id:null,nivel,tipo,msg,end:o?o.endereco:'',lat:o?o.latRaw:'',lon:o?o.lonRaw:''});
  const dec=/^-?\d{1,3}\.\d+$/, casas=s=>(s.split('.')[1]||'').length;
  pts.forEach(o=>{
    if(!dec.test(o.latRaw)) add(o,'erro','Formato da latitude','Latitude não está em formato decimal: '+o.latRaw);
    if(!dec.test(o.lonRaw)) add(o,'erro','Formato da longitude','Longitude não está em formato decimal: '+o.lonRaw);
    if(!isFinite(o.lat)||!isFinite(o.lon)) { add(o,'erro','Valor inválido','Não foi possível converter as coordenadas em número.'); return; }
    if(o.lat<-23.0||o.lat>-22.2||o.lon<-56.0||o.lon>-55.3) add(o,'erro','Fora de Ponta Porã','Coordenada fora da região esperada do município.');
    if(Math.min(casas(o.latRaw),casas(o.lonRaw))<=4) add(o,'atenção','Precisão baixa','Coordenada com 4 casas decimais ou menos (erro possível de ~10 m).');
    if(o.ovos===null) add(o,'info','Sem contagem de ovos','Contagem de ovos não informada na base.');
    if(o.semEndereco) add(o,'info','Sem endereço','Endereço não informado na base; localizar só pelas coordenadas.');
  });
  const ok=pts.filter(o=>isFinite(o.lat)&&isFinite(o.lon));
  /* grupos geográficos separados */
  const par=ok.map((_,i)=>i); const f=i=>par[i]===i?i:(par[i]=f(par[i]));
  for(let i=0;i<ok.length;i++) for(let j=i+1;j<ok.length;j++) if(hav(ok[i].lat,ok[i].lon,ok[j].lat,ok[j].lon)<1.5) par[f(i)]=f(j);
  const comps={}; ok.forEach((o,i)=>(comps[f(i)]=comps[f(i)]||[]).push(o));
  const lista=Object.values(comps).sort((a,b)=>b.length-a.length), main=lista[0]||[];
  lista.slice(1).forEach(c=>{
    const dist=Math.min(...c.flatMap(a=>main.map(b=>hav(a.lat,a.lon,b.lat,b.lon))));
    const ids=compress(c.map(o=>o.id));
    c.forEach(o=>add(o,'atenção','Grupo geográfico isolado',`Faz parte de um conjunto de ${c.length} pontos (${ids}) a ${dist.toFixed(1)} km do grupo principal. Confirmar se a região está correta.`));
  });
  /* sobreposição e isolamento */
  ok.forEach((a,i)=>{
    let nn=Infinity;
    ok.forEach((b,j)=>{ if(i===j) return; const d=hav(a.lat,a.lon,b.lat,b.lon)*1000; if(d<nn) nn=d; if(j>i&&d<25) add(a,'atenção','Pontos quase sobrepostos',`A ${d.toFixed(0)} m da ovitrampa ${b.id}. Pode ser duplicidade.`), add(b,'atenção','Pontos quase sobrepostos',`A ${d.toFixed(0)} m da ovitrampa ${a.id}. Pode ser duplicidade.`); });
    if(nn>600 && main.includes(a)) add(a,'info','Ponto isolado',`Vizinho mais próximo a ${nn.toFixed(0)} m — conferir se não é erro de digitação.`);
  });
  /* componentes idênticos */
  [['latRaw','Latitude'],['lonRaw','Longitude']].forEach(([k,nome])=>{
    const m={}; ok.forEach(o=>{ if(casas(o[k])>=6)(m[o[k]]=m[o[k]]||[]).push(o); });
    Object.entries(m).filter(([,l])=>l.length>1).forEach(([v,l])=>l.forEach(o=>add(o,'atenção',nome+' repetida',`${nome} ${v} idêntica nas ovitrampas ${l.map(x=>x.id).join(', ')}. Pode ser cópia.`)));
  });
  const rank={erro:0,'atenção':1,info:2};
  return out.sort((a,b)=>(a.id-b.id)||(rank[a.nivel]-rank[b.nivel]));
}
let VAL=validar();

function renderSummary(){
  const c={erro:0,'atenção':0,info:0}; VAL.forEach(v=>c[v.nivel]++);
  const ptsComAlerta=new Set(VAL.filter(v=>v.nivel!=='info').map(v=>v.id)).size;
  $('valsum').innerHTML=`<span class="pill erro">${c.erro} erros</span><span class="pill atenção">${c['atenção']} atenções</span><span class="pill info">${c.info} informativos</span>`;
  $('valnote').textContent=`Formato decimal e região verificados nos 242 pontos. ${ptsComAlerta} pontos pedem conferência manual. Nenhuma coordenada foi alterada.`;
  $('valInfo').textContent=`Formato decimal, região esperada, grupos isolados, pontos sobrepostos e precisão foram verificados automaticamente. A lista indica o que conferir; as coordenadas originais foram mantidas.`;
  $('corrInfo').textContent=CORRECOES.length? '' : 'Nenhuma coordenada foi corrigida. Se isso for necessário, a alteração deve ser registrada em CORRECOES (id, campo, valor antigo, valor novo, motivo, data) e aparecerá aqui.';
}
function renderVal(){
  const lv=$('vlvl').value;
  $('vbody').innerHTML=VAL.filter(v=>!lv||v.nivel===lv).map(v=>`<tr>
    <td>${v.id?`<button class="idb" type="button" data-id="${v.id}">${v.id}</button>`:'—'}</td>
    <td><span class="lvl ${v.nivel}">${v.nivel}</span></td><td>${esc(v.tipo)}</td>
    <td>${esc(v.msg)}<br><small style="color:#587079">${esc(v.end)}</small></td>
    <td style="white-space:nowrap;font-variant-numeric:tabular-nums">${esc(v.lat)}<br>${esc(v.lon)}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum alerta neste filtro.</td></tr>';
  if(CORRECOES.length){ $('corrInfo').innerHTML=CORRECOES.map(c=>`#${c.id} ${esc(c.campo)}: ${esc(c.de)} → ${esc(c.para)} (${esc(c.motivo)}, ${esc(c.data)})`).join('<br>'); }
}
$('openVal').addEventListener('click',()=>{ renderVal(); $('val').style.display='flex'; });
$('vclose').addEventListener('click',()=>$('val').style.display='none');
$('val').addEventListener('click',e=>{ if(e.target===$('val')) $('val').style.display='none'; });
$('vlvl').addEventListener('change',renderVal);
$('vbody').addEventListener('click',e=>{ const b=e.target.closest('.idb'); if(!b) return; $('val').style.display='none'; irPara(byId[+b.dataset.id]); });
function baixar(nome,conteudo,tipo){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([conteudo],{type:tipo})); a.download=nome; document.body.appendChild(a); a.click(); a.remove(); }
$('csv').addEventListener('click',()=>{
  const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const linhas=[['ID','Nível','Tipo','Descrição','Endereço','Latitude','Longitude'].join(';')].concat(VAL.map(v=>[v.id||'',v.nivel,q(v.tipo),q(v.msg),q(v.end),v.lat,v.lon].join(';')));
  baixar('conferencia-coordenadas-ovitrampas.csv','\ufeff'+linhas.join('\n'),'text/csv;charset=utf-8');
});
$('json').addEventListener('click',()=>{
  const base=pts.map(({marker,grupo,latRaw,lonRaw,semEndereco,...r})=>r);
  baixar('base-ovitrampas.json',JSON.stringify({gerado:new Date().toISOString(),correcoes:CORRECOES,ovitrampas:base},null,2),'application/json');
});

/* ===================== GRID DE QUADRÍCULAS (padrão 400 m) =====================
   O grid é GLOBAL (calculado com as 242 ovitrampas), então a quadrícula "F12" é a mesma em qualquer mapa/agente.
   Linhas norte-sul / leste-oeste. A1 = canto noroeste (o "início" do grid); colunas em letras, linhas em números.
   Origem: automática (melhor centralização), centralizada numa ovitrampa, ou manual (lat/lon ou clique no mapa). */
const GREF=-22.55*Math.PI/180;
const M_LAT=111132.92-559.82*Math.cos(2*GREF)+1.175*Math.cos(4*GREF);
const M_LON=111412.84*Math.cos(GREF)-93.5*Math.cos(3*GREF);
const gx=lon=>lon*M_LON, gy=lat=>lat*M_LAT, glon=x=>x/M_LON, glat=y=>y/M_LAT;
pts.forEach(o=>{ o.gx=gx(o.lon); o.gy=gy(o.lat); });
const colLabel=n=>{ let t=''; n++; while(n>0){ const r=(n-1)%26; t=String.fromCharCode(65+r)+t; n=Math.floor((n-1)/26); } return t; };
let G=null;
const gradePrintOn=()=>!!(G&&$('gPrint').checked);

function melhorOffset(s){
  const avalia=(ax,ay)=>{ let t=0; for(const o of pts){ const c=Math.floor((o.gx-ax)/s), r=Math.floor((o.gy-ay)/s); t+=Math.hypot(o.gx-(ax+(c+.5)*s),o.gy-(ay+(r+.5)*s)); } return t/pts.length; };
  let b={v:Infinity,ax:0,ay:0}; const st=Math.max(10,s/40);
  for(let a=0;a<s;a+=st) for(let c=0;c<s;c+=st){ const v=avalia(a,c); if(v<b.v) b={v,ax:a,ay:c}; }
  const f=st/5, A=b.ax, B=b.ay;
  for(let a=A-st;a<=A+st;a+=f) for(let c=B-st;c<=B+st;c+=f){ const v=avalia(a,c); if(v<b.v) b={v,ax:a,ay:c}; }
  return b;
}
function celula(g,x,y){
  const c=Math.floor((x-g.x0)/g.s), r=Math.floor((g.y0-y)/g.s), dentro=c>=0&&r>=0&&c<g.cols&&r<g.rows;
  const cx=g.x0+(c+.5)*g.s, cy=g.y0-(r+.5)*g.s;
  return {c,r,dentro,code:dentro?colLabel(c)+(r+1):'—',dist:Math.hypot(x-cx,y-cy),cx,cy};
}
function gradeCalcula(){
  const s=Math.max(50,Math.min(5000,+$('gSize').value||400)), modo=$('gModo').value;
  const xs=pts.map(o=>o.gx), ys=pts.map(o=>o.gy);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  let x0,y0;
  if(modo==='manual'){
    const la=parseFloat(String($('gLat').value).replace(',','.')), lo=parseFloat(String($('gLon').value).replace(',','.'));
    if(!isFinite(la)||!isFinite(lo)||la>-22||la<-23||lo>-55||lo<-56) return {erro:'Informe a latitude e a longitude do início (canto noroeste), ou use “Marcar no mapa”.'};
    x0=gx(lo); y0=gy(la);
  }else{
    let ax,ay;
    if(modo==='centro'){ const o=byId[Math.round(+$('gCid').value)]; if(!o) return {erro:'Informe um número de ovitrampa de 1 a 242.'}; ax=o.gx-s/2; ay=o.gy-s/2; }
    else { const b=melhorOffset(s); ax=b.ax; ay=b.ay; }
    x0=ax+Math.floor((minX-ax)/s)*s; y0=ay+Math.ceil((maxY-ay)/s)*s;
  }
  const g={s,modo,x0,y0,cols:Math.max(1,Math.ceil((maxX-x0)/s)),rows:Math.max(1,Math.ceil((y0-minY)/s))};
  let soma=0,n=0,perto=0,fora=0; const cont={};
  pts.forEach(o=>{ const ci=celula(g,o.gx,o.gy); if(!ci.dentro){ fora++; return; } soma+=ci.dist; n++; if(ci.dist<=s/4) perto++; cont[ci.code]=(cont[ci.code]||0)+1; });
  g.st={media:n?soma/n:0,pct:n?100*perto/n:0,multi:Object.values(cont).filter(v=>v>1).length,fora,ocupadas:Object.keys(cont).length};
  return g;
}
function cantosCelulas(lista){
  const out=[]; if(!G) return out;
  lista.forEach(o=>{ const ci=celula(G,o.gx,o.gy); if(!ci.dentro) return;
    [[0,0],[1,0],[0,1],[1,1]].forEach(([i,j])=>out.push({lat:glat(G.y0-(ci.r+j)*G.s),lon:glon(G.x0+(ci.c+i)*G.s)})); });
  return out;
}
function gradeLinhaPopup(o){
  if(!G||!($('gOn').checked||$('gPrint').checked)) return '';
  const ci=celula(G,o.gx,o.gy);
  return ci.dentro?`<div class="pp-coord" style="margin-top:-6px">Quadrícula <b>${ci.code}</b> · a ${Math.round(ci.dist)} m do centro${ci.dist>limiteCentro()?' <b style="color:#C62828">⚠ longe do centro</b>':''}</div>`:`<div class="pp-warn">Fora do grid atual</div>`;
}

/* --- desenho na tela (Leaflet) --- */
const gridLayer=L.layerGroup(), gridDyn=L.layerGroup();
const gridCor=()=>map.hasLayer(sat)?'#ffd60a':'#1a56db';
function gradeRotulos(){
  gridDyn.clearLayers();
  if(!G||!$('gOn').checked) return;
  const z=map.getZoom(); if(z<13) return;
  const b=map.getBounds().pad(.05), s=G.s, cor=gridCor(), sat_=map.hasLayer(sat);
  const c0=Math.max(0,Math.floor((gx(b.getWest())-G.x0)/s)), c1=Math.min(G.cols-1,Math.floor((gx(b.getEast())-G.x0)/s));
  const r0=Math.max(0,Math.floor((G.y0-gy(b.getNorth()))/s)), r1=Math.min(G.rows-1,Math.floor((G.y0-gy(b.getSouth()))/s));
  if((c1-c0+1)*(r1-r0+1)>420) return;
  const sh=sat_?'-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000':'-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 0 3px #fff';
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++){
    const x=G.x0+c*s, y=G.y0-r*s;
    L.marker([glat(y),glon(x)],{interactive:false,keyboard:false,icon:L.divIcon({className:'mk-wrap',iconSize:[0,0],html:`<div class="gl" style="color:${cor};text-shadow:${sh}">${colLabel(c)}${r+1}</div>`})}).addTo(gridDyn);
    if(z>=15){
      const cx=x+s/2, cy=y-s/2, a=12;
      L.polyline([[glat(cy),glon(cx-a)],[glat(cy),glon(cx+a)]],{color:cor,weight:1.8,opacity:.9,interactive:false}).addTo(gridDyn);
      L.polyline([[glat(cy-a),glon(cx)],[glat(cy+a),glon(cx)]],{color:cor,weight:1.8,opacity:.9,interactive:false}).addTo(gridDyn);
    }
  }
}
function gradeTela(){
  gridLayer.clearLayers(); gridDyn.clearLayers();
  const on=$('gOn').checked&&G;
  [gridLayer,gridDyn].forEach(l=>{ if(on&&!map.hasLayer(l)) l.addTo(map); if(!on&&map.hasLayer(l)) map.removeLayer(l); });
  if(!on) return;
  const s=G.s, cor=gridCor(), yb=G.y0-G.rows*s, xr=G.x0+G.cols*s;
  for(let c=0;c<=G.cols;c++){ const x=G.x0+c*s; L.polyline([[glat(G.y0),glon(x)],[glat(yb),glon(x)]],{color:cor,weight:(c===0||c===G.cols)?2.8:1.4,opacity:.85,interactive:false}).addTo(gridLayer); }
  for(let r=0;r<=G.rows;r++){ const y=G.y0-r*s; L.polyline([[glat(y),glon(G.x0)],[glat(y),glon(xr)]],{color:cor,weight:(r===0||r===G.rows)?2.8:1.4,opacity:.85,interactive:false}).addTo(gridLayer); }
  L.marker([glat(G.y0),glon(G.x0)],{zIndexOffset:900,icon:L.divIcon({className:'mk-wrap',iconSize:[0,0],html:'<div class="gflag">⚑ INÍCIO DO GRID · A1</div>'})})
    .bindPopup(`<b>Início do grid (A1)</b><br>Canto noroeste<br>Lat ${glat(G.y0).toFixed(6)}<br>Lon ${glon(G.x0).toFixed(6)}`).addTo(gridLayer);
  gradeRotulos();
}
function gradeAtualiza(){
  $('gCentro').style.display=$('gModo').value==='centro'?'flex':'none';
  $('gManual').style.display=$('gModo').value==='manual'?'block':'none';
  const g=gradeCalcula();
  if(g&&g.erro){ G=null; $('gInfo').textContent=g.erro; gradeTela(); return; }
  G=g;
  const st=G.st;
  $('gInfo').innerHTML=`<b>Início do grid (A1, canto noroeste):</b><br>${glat(G.y0).toFixed(6)}, ${glon(G.x0).toFixed(6)}<br>${G.cols}×${G.rows} quadrículas de ${G.s} m · colunas A–${colLabel(G.cols-1)}, linhas 1–${G.rows}<br>Ovitrampas ficam, em média, a <b>${Math.round(st.media)} m</b> do centro (${Math.round(st.pct)}% a até ${Math.round(G.s/4)} m)<br>${st.ocupadas} quadrículas com ovitrampa · ${st.multi} com 2 ou mais`+(st.fora?` · <b style="color:var(--err)">${st.fora} fora do grid</b>`:'');
  if(G.modo==='auto'||G.modo==='centro'){ $('gLat').value=glat(G.y0).toFixed(6); $('gLon').value=glon(G.x0).toFixed(6); }
  gradeTela();
}
['gOn','gPrint'].forEach(id=>$(id).addEventListener('change',()=>{ if(id==='gOn'&&$('gOn').checked&&!$('gPrint').checked) $('gPrint').checked=true; gradeAtualiza(); }));
['gSize','gModo','gCid','gLat','gLon'].forEach(id=>$(id).addEventListener('change',gradeAtualiza));
$('gPick').addEventListener('click',()=>{
  closeMenu(); toast('Toque no mapa no ponto onde o grid deve COMEÇAR (canto noroeste, A1).');
  map.getContainer().style.cursor='crosshair';
  map.once('click',e=>{
    map.getContainer().style.cursor='';
    $('gLat').value=e.latlng.lat.toFixed(6); $('gLon').value=e.latlng.lng.toFixed(6);
    $('gModo').value='manual'; $('gOn').checked=true; $('gPrint').checked=true; gradeAtualiza();
    toast('Início do grid marcado (A1).');
  });
});
map.on('moveend zoomend',gradeRotulos);
map.on('baselayerchange',gradeTela);

/* --- desenho no print (canvas) --- */
function desenhaGrade(ctx,proj,k,satelite){
  if(!G) return;
  const cor=satelite?'#ffd60a':'#1a56db', halo=satelite?'rgba(0,0,0,.85)':'rgba(255,255,255,.9)', s=G.s, yb=G.y0-G.rows*s, xr=G.x0+G.cols*s;
  const P=(x,y)=>proj(glat(y),glon(x));
  const traco=(x1,y1,x2,y2,w)=>{ const a=P(x1,y1), b=P(x2,y2);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=halo; ctx.lineWidth=w+2.6*k; ctx.stroke();
    ctx.strokeStyle=cor; ctx.lineWidth=w; ctx.stroke(); };
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  for(let c=0;c<=G.cols;c++){ const x=G.x0+c*s; traco(x,G.y0,x,yb,(c===0||c===G.cols?3:1.8)*k); }
  for(let r=0;r<=G.rows;r++){ const y=G.y0-r*s; traco(G.x0,y,xr,y,(r===0||r===G.rows?3:1.8)*k); }
  const a=P(G.x0,G.y0), b=P(G.x0+s,G.y0), pw=Math.hypot(b.x-a.x,b.y-a.y);
  const W=ctx.canvas.width, H=ctx.canvas.height;
  ctx.textAlign='left'; ctx.textBaseline='top'; ctx.font=`800 ${14*k}px ${FONTE}`;
  for(let c=0;c<G.cols;c++) for(let r=0;r<G.rows;r++){
    const nw=P(G.x0+c*s,G.y0-r*s), ce=P(G.x0+(c+.5)*s,G.y0-(r+.5)*s);
    if(ce.x<-pw||ce.y<-pw||ce.x>W+pw||ce.y>H+pw) continue;
    if(pw>60*k){ const t=colLabel(c)+(r+1); ctx.lineWidth=4.5*k; ctx.strokeStyle=halo; ctx.strokeText(t,nw.x+6*k,nw.y+5*k); ctx.fillStyle=cor; ctx.fillText(t,nw.x+6*k,nw.y+5*k); }
    if(pw>100*k){ const ar=11*k; ctx.beginPath(); ctx.moveTo(ce.x-ar,ce.y); ctx.lineTo(ce.x+ar,ce.y); ctx.moveTo(ce.x,ce.y-ar); ctx.lineTo(ce.x,ce.y+ar);
      ctx.strokeStyle=halo; ctx.lineWidth=4.2*k; ctx.stroke(); ctx.strokeStyle=cor; ctx.lineWidth=2*k; ctx.stroke(); }
  }
  if(a.x>0&&a.y>0&&a.x<W&&a.y<H){
    const t='⚑ INÍCIO · A1'; ctx.font=`800 ${13*k}px ${FONTE}`; const tw=ctx.measureText(t).width;
    rr(ctx,a.x,a.y-26*k,tw+16*k,24*k,6*k); ctx.fillStyle=cor; ctx.fill(); ctx.lineWidth=2*k; ctx.strokeStyle='#fff'; ctx.stroke();
    ctx.fillStyle=satelite?'#000':'#fff'; ctx.textBaseline='middle'; ctx.fillText(t,a.x+8*k,a.y-14*k);
  }
  ctx.restore();
}

/* ===================== relatório de campo ===================== */
let folhaAtual=null;
function selList(){ return [...sel].sort((a,b)=>a-b).map(id=>byId[id]); }
function infoSel(){
  const ids=[...sel]; if(!ids.length) return null;
  const ags=[...new Set(ids.map(id=>AG_POR_ID[id]).filter(Boolean))];
  if(ags.length===1) return infoAg(ags[0]);
  const eqs=[...new Set(ags.map(a=>a.equipe))];
  if(eqs.length===1&&eqs[0]) return {agente:'',area:'',zona:null,equipe:'Equipe '+eqs[0],eqCor:COR_EQ[eqs[0]]};
  return null;
}
function infoTela(){
  const man={agente:$('agNome').value.trim(),equipe:$('agEquipe').value.trim()}, auto=infoSel()||{};
  return {agente:man.agente||auto.agente||'',area:auto.area||'',zona:auto.zona||null,equipe:man.equipe||auto.equipe||'',eqCor:man.equipe?null:(auto.eqCor||null)};
}
const slug=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);
const nomeFolha=(lista,info)=>nomeArq(lista)+(info&&info.agente?'_'+slug(info.agente):'');
async function abrirFolha(){
  const lista=selList();
  if(!lista.length){ toast('Selecione ao menos uma ovitrampa para gerar o mapa.'); return; }
  $('sheet').style.display='block'; document.body.style.overflow='hidden';
  $('sheetImg').style.display='none'; $('sheetLoad').style.display='block'; $('sheetLoad').textContent='Gerando relatório em alta resolução…';
  $('sStatus').textContent='';
  $('sShare').style.display=(navigator.canShare&&navigator.canShare({files:[new File([''],'a.png',{type:'image/png'})]}))?'inline-block':'none';
  try{
    const info=infoTela(), r=await gerarImagem(lista,tituloLista(lista),null,info);
    folhaAtual={cv:r.cv,lista,info,modo:r.modo};
    const b=await toBlobP(r.cv), im=$('sheetImg');
    if(im.dataset.u) URL.revokeObjectURL(im.dataset.u);
    im.dataset.u=URL.createObjectURL(b); im.src=im.dataset.u;
    im.style.display='block'; $('sheetLoad').style.display='none';
    $('sStatus').textContent=`${r.cv.width}×${r.cv.height} px`+(r.modo==='raster'?' · modo reserva':'');
  }catch(e){ console.error(e); $('sheetLoad').textContent='Não foi possível gerar o relatório. Confira a internet e tente de novo.'; }
}
function fecharFolha(){ $('sheet').style.display='none'; document.body.style.overflow=''; setTimeout(()=>map.invalidateSize(),50); }
$('gen').addEventListener('click',abrirFolha);
$('sBack').addEventListener('click',fecharFolha);
$('sPrint').addEventListener('click',()=>{ if(!folhaAtual){ toast('Aguarde o relatório terminar de carregar.'); return; } const t=document.title; document.title='Relatório de campo - ovitrampas '+compress(folhaAtual.lista.map(o=>o.id)); window.print(); setTimeout(()=>document.title=t,500); });
$('sPng').addEventListener('click',async()=>{
  if(!folhaAtual){ toast('Aguarde o relatório terminar de carregar.'); return; }
  try{ baixarArq(await toBlobP(folhaAtual.cv),nomeFolha(folhaAtual.lista,folhaAtual.info)+'.png'); }catch(e){ console.error(e); toast('Não foi possível salvar a imagem.'); }
});
$('sPdf').addEventListener('click',async()=>{
  if(!folhaAtual){ toast('Aguarde o relatório terminar de carregar.'); return; }
  try{ await carregaLib('jspdf'); }catch(e){ toast('PDF indisponível (biblioteca não carregou).'); return; }
  try{ const p=novoPdf(folhaAtual.cv); pdfAdd(p,folhaAtual.cv,false); baixarArq(p.output('blob'),nomeFolha(folhaAtual.lista,folhaAtual.info)+'.pdf'); }
  catch(e){ console.error(e); toast('Não foi possível gerar o PDF.'); }
});
$('sShare').addEventListener('click',async()=>{
  if(!folhaAtual) return;
  try{ await navigator.share({files:[new File([await toBlobP(folhaAtual.cv)],nomeFolha(folhaAtual.lista,folhaAtual.info)+'.png',{type:'image/png'})],title:'Relatório de campo — ovitrampas'}); }
  catch(e){ if(e.name!=='AbortError') toast('Não foi possível compartilhar. Use “Salvar PNG”.'); }
});
$('sWa').addEventListener('click',()=>{
  const l=selList();
  const ag=infoTela().agente; const txt=`*Ovitrampas — Ponta Porã/MS*\n`+(ag?`Agente: ${ag}\n`:'')+`${l.length} ponto(s) para visita\n\n`+l.map(o=>`*${o.id}* — ${o.endereco}${o.ovos!==null?` (ovos: ${o.ovos})`:''}\n${linkNavegar(o)}`).join('\n\n');
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
});

/* ================= PRINT DO MAPA (PNG / PDF) =================
   Nitidez: o mapa do print é redesenhado como VETOR (ruas e nomes em alta resolução, 3× ou 4×),
   com nomes de ruas maiores, contorno branco forte e sem rótulos de comércio. Os marcadores são
   desenhados direto no canvas (sem foto ampliada). Cada folha leva cabeçalho + lista com endereço. */
let shotCanvas=null, shotBlob=null, shotNome='ovitrampas', shotLista=[];
const nomeArq = lista => 'ovitrampas_'+compress(lista.map(o=>o.id)).replace(/[^0-9a-z-]+/gi,'_').slice(0,60);
const SUB='Ponta Porã/MS · Vigilância em Saúde / Endemias';
const COR_PADRAO='#ffc21a';
/* Logo da Prefeitura (embutido) e paleta do relatório extraída do logo */
const LOGO=new Image(); LOGO.src=SITE.raiz+'assets/img/logo.png';
const PAL={navy:'#002B68',blue:'#007ECA',green:'#00B93B',yellow:'#FFB900',red:'#FF1339'};
const textoSobre=hex=>{ const n=parseInt(hex.slice(1),16), r=n>>16, g=(n>>8)&255, b=n&255; return (0.299*r+0.587*g+0.114*b)>150?'#111':'#fff'; };
const FONTE='"Archivo","Segoe UI",system-ui,-apple-system,sans-serif';
const pad=(n,l)=>String(n).padStart(l,'0');
const toBlobP=(cv,tipo,q)=>new Promise(r=>cv.toBlob(r,tipo||'image/png',q));
const tituloLista=lista=>{ const ids=lista.map(o=>o.id); const a=AGS.find(a=>a.lista.length===ids.length&&a.lista.every((o,i)=>o.id===ids[i])); return a?rotAg(a):'Relatório de campo — Ovitrampas '+compress(ids); };
let pastaDest=null;
async function salvarNaPasta(blob,nome){
  try{ const partes=nome.split('/'); let dir=pastaDest; for(const p of partes.slice(0,-1)) dir=await dir.getDirectoryHandle(p,{create:true}); const fh=await dir.getFileHandle(partes[partes.length-1],{create:true}); const w=await fh.createWritable(); await w.write(blob); await w.close(); if(!bRodando) toast(`Salvo na pasta “${pastaDest.name}”: ${nome}`); }
  catch(e){ console.warn(e); pastaDest=null; $('pastaNome').textContent='Não foi possível gravar na pasta; usando Downloads.'; anexaBaixar(blob,nome); }
}
function anexaBaixar(blob,nome){ nome=nome.replace(/\//g,' - '); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),8000); if(!bRodando) toast(`“${nome}” foi para a pasta Downloads (Transferências) do navegador.`); }
function baixarArq(blob,nome){ if(pastaDest) salvarNaPasta(blob,nome); else anexaBaixar(blob,nome); }
$('pasta').addEventListener('click',async()=>{
  if(!window.showDirectoryPicker){ toast('Este navegador não deixa escolher pasta. Os arquivos vão para Downloads (Transferências). Use Chrome/Edge no computador para escolher.'); return; }
  try{ pastaDest=await window.showDirectoryPicker({mode:'readwrite'}); $('pastaNome').textContent='Salvando em: '+pastaDest.name; }catch(e){}
});
async function fontes(){ try{ await Promise.all(['400','600','800'].map(w=>document.fonts.load(`${w} 20px Archivo`))); }catch(e){} try{ if(!LOGO.complete) await LOGO.decode(); }catch(e){} }

/* nitidez automática (usado só no modo reserva, quando o mapa vetorial não está disponível) */
function afinar(cv,a){
  const ctx=cv.getContext('2d'), w=cv.width, h=cv.height;
  const src=ctx.getImageData(0,0,w,h), d=src.data, out=ctx.createImageData(w,h), o=out.data;
  const c=1+4*a;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      if(x===0||y===0||x===w-1||y===h-1){ o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];o[i+3]=d[i+3]; continue; }
      const u=i-w*4, v=i+w*4;
      for(let k=0;k<3;k++){
        let val=c*d[i+k]-a*(d[u+k]+d[v+k]+d[i-4+k]+d[i+4+k]);
        o[i+k]=val<0?0:val>255?255:val;
      }
      o[i+3]=255;
    }
  }
  ctx.putImageData(out,0,0);
}

/* ---------- mapa vetorial (MapLibre + OpenFreeMap) ---------- */
function carregaMapLibre(){ return carregaLib('maplibre'); }
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';

/* multiplica tamanhos de texto do estilo (inclusive os que mudam com o zoom) */
function escalaExpr(v,k){
  if(typeof v==='number') return v*k;
  if(Array.isArray(v)){
    const op=v[0];
    if(op==='interpolate'||op==='interpolate-hcl'||op==='interpolate-lab') return v.map((x,i)=>(i>=4&&i%2===0)?escalaExpr(x,k):x);
    if(op==='step') return v.map((x,i)=>(i===2||(i>=4&&i%2===0))?escalaExpr(x,k):x);
    if(JSON.stringify(v).includes('"zoom"')) return v;
    return ['*',k,v];
  }
  if(v&&typeof v==='object'&&Array.isArray(v.stops)) return {...v,stops:v.stops.map(([z,val])=>[z,escalaExpr(val,k)])};
  return v;
}
function ajustaEstilo(js,satelite){
  js.layers.forEach(l=>{
    if(l.type!=='symbol') return;
    l.layout=l.layout||{}; l.paint=l.paint||{};
    if(/^poi|shield/i.test(l.id)){ l.layout.visibility='none'; return; }   /* tira comércio/ícones: sobra o nome das ruas */
    if(!l.layout['text-field']) return;
    const rua=/highway-name/i.test(l.id), k=rua?1.7:1.3;
    l.layout['text-size']=escalaExpr(l.layout['text-size']!==undefined?l.layout['text-size']:16,k);
    l.layout['text-padding']=2;
    if(rua) l.layout['symbol-spacing']=170;
    l.paint['text-halo-width']=rua?2.6:2; l.paint['text-halo-blur']=0;
    if(satelite){ l.paint['text-color']='#ffffff'; l.paint['text-halo-color']='rgba(0,0,0,.9)'; }
    else{ l.paint['text-halo-color']='#ffffff'; if(rua) l.paint['text-color']='#101820'; }
  });
  if(satelite){
    js.sources.sat={type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19};
    js.layers=[{id:'sat',type:'raster',source:'sat'}].concat(js.layers.filter(l=>l.type==='symbol'));
  }
  return js;
}
function estiloRaster(satelite){
  const E='esri://server.arcgisonline.com/ArcGIS/rest/services/';
  const src=p=>({type:'raster',tiles:[E+p+'/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19});
  if(satelite) return {version:8,sources:{a:src('World_Imagery'),b:src('Reference/World_Transportation')},layers:[{id:'a',type:'raster',source:'a'},{id:'b',type:'raster',source:'b',paint:{'raster-opacity':.9}}]};
  return {version:8,sources:{a:src('World_Street_Map')},layers:[{id:'a',type:'raster',source:'a'}]};
}
function maxPR(cw,ch,pedido){
  let lim=4096;
  try{ const c=document.createElement('canvas'), g=c.getContext('webgl2')||c.getContext('webgl');
    if(g){ lim=Math.min(g.getParameter(g.MAX_RENDERBUFFER_SIZE),g.getParameter(g.MAX_TEXTURE_SIZE),8192); const e=g.getExtension('WEBGL_lose_context'); if(e) e.loseContext(); } }catch(e){}
  return Math.max(1,Math.min(pedido,lim/Math.max(cw,ch)));
}
function esperaIdle(m,ms){
  return new Promise(res=>{
    let fim=false; const t=setTimeout(()=>f(),ms);
    function f(){ if(fim) return; fim=true; clearTimeout(t); m.off('idle',f); setTimeout(res,250); }
    m.on('idle',f); m.triggerRepaint();
  });
}
async function criaRenderer(satelite,cw,ch,PR,modo){
  await carregaMapLibre(); registraProtocolo();
  const holder=document.createElement('div');
  holder.style.cssText=`position:fixed;left:0;top:0;width:${cw}px;height:${ch}px;z-index:-1;pointer-events:none;background:#fff`;
  document.body.appendChild(holder);
  let m=null;
  try{
    let style;
    if(modo==='vetor'){ const resp=await fetch(STYLE_URL); if(!resp.ok) throw new Error('estilo '+resp.status); style=ajustaEstilo(await resp.json(),satelite); }
    else style=estiloRaster(satelite);
    m=new maplibregl.Map({container:holder,style,center:[-55.7,-22.54],zoom:14,interactive:false,attributionControl:false,
      preserveDrawingBuffer:true,pixelRatio:PR,fadeDuration:0,maxZoom:19.5});
    await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error('timeout do mapa')),25000);
      m.once('load',()=>{ clearTimeout(t); res(); });
      m.on('error',e=>{ if(!m.isStyleLoaded()){ clearTimeout(t); rej((e&&e.error)||new Error('estilo')); } });
    });
  }catch(e){ try{ m&&m.remove(); }catch(_){} holder.remove(); throw e; }
  return {render:lista=>renderMapa(m,lista,cw,satelite,modo), destroy(){ try{ m.remove(); }catch(_){} holder.remove(); }};
}

/* marcador (pote + número) desenhado direto no canvas, nítido em qualquer resolução */
function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function desenhaMarcador(ctx,x,y,o,s){
  const cor=(o.grupo!=null)?GCOL[o.grupo%GCOL.length]:COR_PADRAO;
  const S=34*s, sc=S/28, f=19*s, txt=String(o.id);
  ctx.save();
  /* ponto exato no chão: anel branco + miolo da cor */
  ctx.beginPath(); ctx.arc(x,y,6*s,0,Math.PI*2); ctx.fillStyle=cor; ctx.fill();
  ctx.lineWidth=2.5*s; ctx.strokeStyle='#fff'; ctx.stroke();
  ctx.lineWidth=1*s; ctx.strokeStyle='#000'; ctx.beginPath(); ctx.arc(x,y,7.8*s,0,Math.PI*2); ctx.stroke();
  ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=5*s; ctx.shadowOffsetY=2*s;
  ctx.save(); ctx.translate(x-14*sc,y-S-2*s); ctx.scale(sc,sc); ctx.lineJoin='round';
  let p=new Path2D('M17.5 1.5l4 1.2-4.4 10.6-3.2-1z'); ctx.fillStyle='#d9a15b'; ctx.fill(p); ctx.strokeStyle='#6b4217'; ctx.lineWidth=1; ctx.stroke(p);
  p=new Path2D('M5 9.5L7.3 25c.1 1 .9 1.7 1.9 1.7h9.6c1 0 1.8-.7 1.9-1.7L23 9.5z'); ctx.fillStyle='#1a1a1a'; ctx.fill(p); ctx.strokeStyle='#fff'; ctx.lineWidth=1.8; ctx.stroke(p);
  ctx.beginPath(); ctx.ellipse(14,9.5,9,3.2,0,0,Math.PI*2); ctx.fillStyle=cor; ctx.fill(); ctx.stroke();
  ctx.shadowColor='transparent';
  ctx.beginPath(); ctx.ellipse(14,9.5,6.4,2,0,0,Math.PI*2); ctx.fillStyle='#4aa8e8'; ctx.fill();
  ctx.restore();
  ctx.font=`900 ${f}px ${FONTE}`; const tw=ctx.measureText(txt).width;
  const h=f*1.25+6*s, w=Math.max(S*1.0,tw+20*s), px=x-w/2, py=y-S-2*s+6*s-h;
  rr(ctx,px,py,w,h,h/2);
  if(ovPrintOn()){                                                                                   /* contorno = faixa de ovos (versão leve) */
    ctx.shadowColor='rgba(0,0,0,.6)'; ctx.lineWidth=8.5*s; ctx.strokeStyle='#000'; ctx.stroke();
    ctx.shadowColor='transparent'; ctx.lineWidth=6.5*s; ctx.strokeStyle=corOvos(o.ovos); ctx.stroke();
    ctx.fillStyle=cor; ctx.fill(); ctx.lineWidth=1.3*s; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.stroke();
  } else {                                                                                           /* padrão: preto + anel branco */
    ctx.shadowColor='rgba(0,0,0,.6)'; ctx.lineWidth=7*s; ctx.strokeStyle='#000'; ctx.stroke();
    ctx.shadowColor='transparent'; ctx.lineWidth=4*s; ctx.strokeStyle='#fff'; ctx.stroke();
    ctx.fillStyle=cor; ctx.fill();
  }
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.shadowColor='transparent';
  if(textoSobre(cor)!=='#111'){ ctx.lineWidth=3*s; ctx.lineJoin='round'; ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.strokeText(txt,x,py+h/2+.5*s); }
  ctx.fillStyle=textoSobre(cor); ctx.fillText(txt,x,py+h/2+.5*s);                           /* número branco com borda escura */
  ctx.restore();
}
function desenhaPontos(ctx,P,s,rotulos){
  if(window.ESTILO_PONTOS==='ponto'){
    [...P].sort((a,b)=>(a.o.ovos||0)-(b.o.ovos||0)).forEach(({o,x,y})=>{
      ctx.beginPath(); ctx.arc(x,y,10.5*s,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x,y,8.4*s,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
      ctx.beginPath(); ctx.arc(x,y,6.2*s,0,Math.PI*2); ctx.fillStyle=corOvos(o.ovos); ctx.fill(); });
    return;
  }
  P=[...P].sort((a,b)=>a.y-b.y);
  const ocup=P.map(({x,y})=>[x-30*s,y-64*s,x+30*s,y+10*s]);
  P.forEach(({o,x,y})=>desenhaMarcador(ctx,x,y,o,s));
  if(!rotulos||P.length>15) return;
  const hit=r=>ocup.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]);
  P.forEach(({o,x,y})=>{
    if(o.semEndereco||!o.endereco) return;
    ctx.save();
    const txt=ajustaTexto(ctx,o.endereco,380*s,800,17*s,12*s);
    const w=ctx.measureText(txt).width, h=17*s*1.2;
    const cand=[[x-w/2,y+12*s],[x+26*s,y-h/2-12*s],[x-26*s-w,y-h/2-12*s],[x-w/2,y-68*s-h]];
    let esc=null;
    for(const [lx,ly] of cand){ const rc=[lx-3*s,ly-3*s,lx+w+3*s,ly+h+3*s]; if(!hit(rc)){ esc=[lx,ly,rc]; break; } }
    if(!esc){ const [lx,ly]=cand[0]; esc=[lx,ly,[lx,ly,lx+w,ly+h]]; }
    ocup.push(esc[2]);
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.lineJoin='round';
    ctx.lineWidth=5*s; ctx.strokeStyle='#fff'; ctx.strokeText(txt,esc[0],esc[1]);
    ctx.fillStyle='#0b1b22'; ctx.fillText(txt,esc[0],esc[1]);
    ctx.restore();
  });
}
async function renderMapa(m,lista,cw,satelite,modo){
  m.resize();
  if(lista.length===1) m.jumpTo({center:[lista[0].lon,lista[0].lat],zoom:17.5});
  else{
    const bb=new maplibregl.LngLatBounds(); lista.forEach(o=>bb.extend([o.lon,o.lat])); if(gradePrintOn()) cantosCelulas(lista).forEach(p=>bb.extend([p.lon,p.lat]));
    m.fitBounds(bb,{padding:{top:125,bottom:75,left:85,right:85},maxZoom:18,duration:0});
  }
  await esperaIdle(m,20000);
  const gl=m.getCanvas(), k=gl.width/cw;
  const out=document.createElement('canvas'); out.width=gl.width; out.height=gl.height;
  const ctx=out.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,out.width,out.height); ctx.drawImage(gl,0,0);
  if(modo!=='vetor') afinar(out,.5);
  const proj=(la,lo)=>{ const p=m.project([lo,la]); return {x:p.x*k,y:p.y*k}; };
  if(gradePrintOn()) desenhaGrade(ctx,proj,k,satelite);
  const ordRota=(rotaMapaOn()&&!window.__semRota&&lista.length>=2&&lista.length<=60)?rotaOrdem(lista):null;
  if(ordRota) desenhaRotaLinha(ctx,proj,k,ordRota);
  desenhaPontos(ctx,lista.map(o=>{ const p=m.project([o.lon,o.lat]); return {o,x:p.x*k,y:p.y*k}; }),k*(lista.length>60?.6:lista.length>20?.8:1),true);
  if(ordRota) desenhaRotaNumeros(ctx,proj,k,ordRota);
  const txt=modo==='vetor'?'© OpenStreetMap contributors · OpenFreeMap'+(satelite?' · Imagens © Esri':''):(satelite?'Imagens © Esri, Maxar, Earthstar Geographics':'Mapa © Esri, HERE, Garmin, OpenStreetMap contributors');
  ctx.font=`${11*k}px ${FONTE}`; ctx.textAlign='left'; ctx.textBaseline='middle'; const tw=ctx.measureText(txt).width;
  ctx.fillStyle='rgba(255,255,255,.88)'; ctx.fillRect(out.width-tw-14*k,out.height-20*k,tw+14*k,20*k);
  ctx.fillStyle='#222'; ctx.fillText(txt,out.width-tw-7*k,out.height-10*k);
  return out;
}

/* ---------- folha final: cabeçalho + mapa + lista de endereços ---------- */
function ajustaTexto(ctx,txt,max,peso,tam,min){
  let t=tam; ctx.font=`${peso} ${t}px ${FONTE}`;
  while(ctx.measureText(txt).width>max&&t>min){ t-=.5; ctx.font=`${peso} ${t}px ${FONTE}`; }
  if(ctx.measureText(txt).width>max){ while(txt.length>1&&ctx.measureText(txt+'…').width>max) txt=txt.slice(0,-1); txt+='…'; }
  return txt;
}
function comporFolha(mapCv,lista,titulo,info){
  info=info||{};
  const gr=gradePrintOn()?G:null;
  const W=mapCv.width, u=W/1000, n=lista.length, comLista=n>=1&&n<=20, rowH=(n>10?50:62)*u, mx=24*u;
  const INK=PAL.navy, BR=PAL.blue, CL='#EEF4FA', LN='#C5D6E8', MUTE='#5B7391', RISCO='#9DB0C6';
  const ordem=(rotaRelOn()&&n>=2)?rotaOrdem(lista):lista, comRota=ordem!==lista;
  const urlR=(rotaRelOn()&&comLista&&n<=10&&typeof qrcode==='function')?urlRota(ordem):null;
  const mh=mapCv.height*(W-2*mx)/W, hHead=128*u, hInfo=100*u, hSecT=comLista?64*u:0, hTh=comLista?38*u:0, hRows=comLista?n*rowH:0;
  const temOvos=comLista&&lista.some(o=>o.ovos!==null&&o.ovos!==undefined), hTot=temOvos?48*u:0, hLeg=ovPrintOn()?40*u:0, hQR=urlR?172*u:0, hFoot=56*u;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=Math.round(hHead+hInfo+mh+16*u+hSecT+hTh+hRows+hTot+hLeg+hQR+hFoot);
  const c=cv.getContext('2d');
  c.fillStyle='#fff'; c.fillRect(0,0,cv.width,cv.height);
  /* cabeçalho com o logo da Prefeitura */
  c.textBaseline='alphabetic'; c.textAlign='left';
  const lh=100*u, lw=LOGO.naturalWidth?lh*LOGO.naturalWidth/LOGO.naturalHeight:0, ly=(hHead-8*u-lh)/2;
  if(lw){ c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(LOGO,mx,ly,lw,lh); }
  const tx=mx+(lw?lw+26*u:0);
  if(lw){ c.fillStyle=LN; c.fillRect(tx-13*u,ly+8*u,2*u,lh-16*u); }
  c.fillStyle=INK;
  c.fillText(ajustaTexto(c,titulo,W-tx-mx-210*u,800,34*u,19*u),tx,ly+lh/2-2*u);
  c.font=`700 ${15*u}px ${FONTE}`; c.fillStyle=BR; c.fillText(SUB,tx,ly+lh/2+24*u);
  rr(c,W-mx-190*u,ly+14*u,190*u,lh-28*u,14*u); c.fillStyle=BR; c.fill();
  c.textAlign='center'; c.fillStyle='#fff'; c.font=`800 ${34*u}px ${FONTE}`; c.fillText(String(n),W-mx-142*u,ly+lh/2+6*u);
  c.font=`700 ${15*u}px ${FONTE}`; c.textAlign='left'; c.fillText(n>1?'ovitrampas':'ovitrampa',W-mx-116*u,ly+lh/2-4*u); c.fillText(new Date().toLocaleDateString('pt-BR'),W-mx-116*u,ly+lh/2+18*u);
  faixaLogo(c,W,hHead-8*u,8*u);
  /* cartões de informação */
  const gap=14*u, iy=hHead+18*u, ih=hInfo-30*u, tot4=W-2*mx-3*gap, fr=[.27,.33,.24,.16];
  const eqTxt=info.equipe?(info.equipe+(info.zona?' · Zona '+info.zona:'')):(info.zona?'Zona '+info.zona:'');
  const cards=[['AGENTE',info.agente||''],['ÁREA',info.area||''],['EQUIPE · ZONA',eqTxt],['DATA DA VISITA','']];
  let cx0=mx;
  cards.forEach(([lab,val],i)=>{
    const cw=tot4*fr[i], x=cx0; cx0+=cw+gap;
    rr(c,x,iy,cw,ih,10*u); c.fillStyle=CL; c.fill(); c.strokeStyle=LN; c.lineWidth=1.5*u; c.stroke();
    c.textAlign='left'; c.fillStyle=MUTE; c.font=`800 ${12.5*u}px ${FONTE}`; c.fillText(lab,x+14*u,iy+22*u);
    let tx0=x+14*u, mw=cw-28*u;
    if(val&&i===2&&info.eqCor){ c.beginPath(); c.arc(x+22*u,iy+ih-23*u,7*u,0,Math.PI*2); c.fillStyle=info.eqCor; c.fill(); tx0=x+36*u; mw=cw-50*u; }
    if(val){ c.fillStyle=INK; c.fillText(ajustaTexto(c,val,mw,800,22*u,12*u),tx0,iy+ih-14*u); }
    else{ c.fillStyle=RISCO; c.fillRect(x+14*u,iy+ih-16*u,cw-28*u,1.5*u); }
  });
  /* mapa com cantos arredondados */
  const my=hHead+hInfo;
  c.save(); rr(c,mx,my,W-2*mx,mh,14*u); c.clip(); c.drawImage(mapCv,0,0,mapCv.width,mapCv.height,mx,my,W-2*mx,mh); c.restore();
  rr(c,mx,my,W-2*mx,mh,14*u); c.strokeStyle=INK; c.lineWidth=3*u; c.stroke();
  if(hLeg) legendaOvos(c,u,mx,my+mh+10*u+hLeg/2-6*u,MUTE,INK);
  let y=my+mh+22*u+hLeg;
  if(comLista){
    c.textAlign='left'; c.fillStyle=INK; c.font=`800 ${24*u}px ${FONTE}`; c.fillText('Endereços das ovitrampas',mx,y+24*u);
    c.fillStyle=BR; c.fillRect(mx,y+34*u,60*u,4*u); c.fillStyle=PAL.yellow; c.fillRect(mx+60*u,y+34*u,30*u,4*u);
    if(gr){ c.textAlign='right'; c.fillStyle=MUTE; c.font=`600 ${13*u}px ${FONTE}`; c.fillText(`Grade ${gr.s} m · A1 = ${glat(gr.y0).toFixed(5)}, ${glon(gr.x0).toFixed(5)} · “+” = centro`,W-mx,y+22*u); c.textAlign='left'; }
    y+=hSecT-10*u;
    const sh=comRota?36*u:0;
    const col=gr?{vis:[mx,sh],n:[mx+sh,70*u],e:[mx+84*u+sh,272*u-sh],q:[mx+362*u,118*u],v:[mx+488*u,64*u],d:[mx+562*u,120*u],o:[mx+692*u,160*u],k:[W-mx-52*u,40*u]}:{vis:[mx,sh],n:[mx+sh,70*u],e:[mx+84*u+sh,336*u-sh],v:[mx+432*u,70*u],d:[mx+512*u,140*u],o:[mx+672*u,176*u],k:[W-mx-52*u,40*u]};
    rr(c,mx,y,W-2*mx,hTh,8*u); c.fillStyle=INK; c.fill();
    c.fillStyle='#fff'; c.font=`800 ${14*u}px ${FONTE}`; c.textBaseline='middle';
    c.textAlign='center'; c.fillText('Nº',col.n[0]+col.n[1]/2,y+hTh/2); c.fillText('OVOS',col.v[0]+col.v[1]/2,y+hTh/2); c.fillText('OK',col.k[0]+col.k[1]/2,y+hTh/2);
    if(comRota){ c.font=`800 ${10.5*u}px ${FONTE}`; c.fillText('VISITA',col.vis[0]+col.vis[1]/2+2*u,y+hTh/2); c.font=`800 ${14*u}px ${FONTE}`; }
    c.textAlign='left'; c.fillText('ENDEREÇO / COORDENADAS',col.e[0],y+hTh/2); if(gr) c.fillText('QUADRÍCULA',col.q[0],y+hTh/2); c.fillText(gr?'INSTALAÇÃO':'DATA INSTALAÇÃO',col.d[0],y+hTh/2); c.fillText('OBSERVAÇÕES',col.o[0],y+hTh/2);
    y+=hTh; c.textBaseline='alphabetic';
    ordem.forEach((o,i)=>{
      const ry=y+i*rowH;
      if(i%2===0){ c.fillStyle=CL; c.fillRect(mx,ry,W-2*mx,rowH); }
      if(comRota){ c.beginPath(); c.arc(col.vis[0]+col.vis[1]/2+2*u,ry+rowH/2,13*u,0,Math.PI*2); c.fillStyle=INK; c.fill(); c.fillStyle='#fff'; c.font=`800 ${15*u}px ${FONTE}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(i+1),col.vis[0]+col.vis[1]/2+2*u,ry+rowH/2+u); c.textBaseline='alphabetic'; }
      const ph=32*u, pw=Math.min(62*u,col.n[1]-4*u), cor=(o.grupo!=null)?GCOL[o.grupo%GCOL.length]:COR_PADRAO;
      rr(c,col.n[0]+(col.n[1]-pw)/2,ry+(rowH-ph)/2,pw,ph,ph/2); if(ovPrintOn()){ c.lineWidth=8*u; c.strokeStyle='#000'; c.stroke(); c.lineWidth=6*u; c.strokeStyle=corOvos(o.ovos); c.stroke(); c.fillStyle=cor; c.fill(); c.lineWidth=1.2*u; c.strokeStyle='rgba(0,0,0,.7)'; c.stroke(); } else { c.fillStyle=cor; c.fill(); c.lineWidth=2.5*u; c.strokeStyle='#fff'; c.stroke(); }
      c.fillStyle=textoSobre(cor); c.font=`800 ${20*u}px ${FONTE}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(o.id),col.n[0]+col.n[1]/2,ry+rowH/2+u);
      c.textAlign='left'; c.textBaseline='alphabetic'; c.fillStyle=INK;
      c.fillText(ajustaTexto(c,o.endereco,col.e[1],800,19*u,12*u),col.e[0],ry+rowH/2-3*u);
      c.font=`400 ${13.5*u}px ${FONTE}`; c.fillStyle=MUTE; c.fillText(`${o.latRaw}, ${o.lonRaw}`,col.e[0],ry+rowH/2+17*u);
      if(gr){ const ci=celula(gr,o.gx,o.gy), longe=ci.dentro&&ci.dist>limiteCentro(); c.textAlign='left'; c.fillStyle=BR; c.font=`800 ${21*u}px ${FONTE}`; c.fillText(ci.code,col.q[0],ry+rowH/2-3*u);
        c.fillStyle=longe?'#C62828':MUTE; c.font=`${longe?800:400} ${12.5*u}px ${FONTE}`; c.fillText(ci.dentro?`${Math.round(ci.dist)} m do centro${longe?' ⚠':''}`:'fora do grid',col.q[0],ry+rowH/2+17*u); }
      { const ov=o.ovos; c.textAlign='center'; c.textBaseline='middle'; c.font=`800 ${24*u}px ${FONTE}`;
        c.fillStyle=(ov===null||ov===undefined)?RISCO:INK; c.fillText((ov===null||ov===undefined)?'—':String(ov),col.v[0]+col.v[1]/2,ry+rowH/2+u);
        c.textAlign='left'; c.textBaseline='alphabetic'; }
      c.fillStyle=RISCO; c.fillRect(col.d[0],ry+rowH-16*u,col.d[1]-10*u,1.5*u); c.fillRect(col.o[0],ry+rowH-16*u,col.o[1],1.5*u);
      c.fillStyle=RISCO; c.font=`400 ${13*u}px ${FONTE}`; c.fillText('  /    /',col.d[0],ry+rowH-20*u);
      c.fillStyle='#fff'; rr(c,col.k[0]+4*u,ry+(rowH-30*u)/2,30*u,30*u,6*u); c.fill(); c.strokeStyle=INK; c.lineWidth=2*u; c.stroke();
    });
    c.strokeStyle=LN; c.lineWidth=1.5*u; c.strokeRect(mx,y,W-2*mx,hRows);
    y+=hRows;
    if(temOvos){
      const tot=lista.reduce((t,o)=>t+(o.ovos||0),0), sem=lista.filter(o=>o.ovos===null||o.ovos===undefined).length;
      c.fillStyle='#DCE9F5'; c.fillRect(mx,y,W-2*mx,hTot); c.strokeStyle=LN; c.strokeRect(mx,y,W-2*mx,hTot);
      c.textBaseline='middle'; c.textAlign='right'; c.fillStyle=INK; c.font=`800 ${15*u}px ${FONTE}`; c.fillText('TOTAL DE OVOS NESTA LISTA',col.v[0]-14*u,y+hTot/2+u);
      c.textAlign='center'; c.font=`800 ${26*u}px ${FONTE}`; c.fillStyle=INK; c.fillText(String(tot),col.v[0]+col.v[1]/2,y+hTot/2+u);
      if(sem){ c.textAlign='left'; c.font=`400 ${12.5*u}px ${FONTE}`; c.fillStyle=MUTE; c.fillText(`${sem} ovitrampa${sem>1?'s':''} sem contagem de ovos`,col.d[0],y+hTot/2+u); }
      c.textBaseline='alphabetic'; c.textAlign='left'; y+=hTot;
    }
    if(urlR){
      const qy=y+18*u, tam=136*u;
      if(desenhaQR(c,urlR,mx,qy,tam)){
        c.strokeStyle=LN; c.lineWidth=1.5*u; c.strokeRect(mx,qy,tam,tam);
        const qx=mx+tam+22*u; c.textAlign='left'; c.fillStyle=INK; c.font=`800 ${19*u}px ${FONTE}`; c.fillText('Rota sugerida no Google Maps',qx,qy+32*u);
        c.fillStyle=MUTE; c.font=`400 ${14*u}px ${FONTE}`; c.fillText('Aponte a câmera do celular para o QR. A rota parte da sua localização atual.',qx,qy+58*u);
        c.fillStyle=INK; c.font=`800 ${15*u}px ${FONTE}`; c.fillText(ajustaTexto(c,'Ordem de visita (ovitrampas): '+ordem.map(o=>o.id).join(' → '),W-mx-qx,800,15*u,10*u),qx,qy+90*u);
        c.fillStyle=MUTE; c.font=`400 ${12.5*u}px ${FONTE}`; c.fillText('Menor caminho calculado entre os pontos. Pode ser percorrido ao contrário, se for mais prático.',qx,qy+116*u);
      }
      y+=hQR;
    }
  }
  c.fillStyle=LN; c.fillRect(mx,y+14*u,W-2*mx,1.5*u);
  c.textAlign='left'; c.fillStyle=MUTE; c.font=`400 ${12*u}px ${FONTE}`;
  c.fillText('O número no mapa é o ID permanente da ovitrampa.'+(comLista?' Marque “OK” ao concluir cada ponto.':' Lista de endereços disponível para até 20 ovitrampas por mapa.'),mx,y+36*u);
  c.textAlign='right'; c.fillText('Gerado em '+new Date().toLocaleString('pt-BR'),W-mx,y+36*u);
  return cv;
}
/* faixa com as cores do logo */
function faixaLogo(c,W,y,h){ [[PAL.navy,.38],[PAL.blue,.30],[PAL.green,.14],[PAL.yellow,.11],[PAL.red,.07]].reduce((x,[col,p])=>{ c.fillStyle=col; c.fillRect(x,y,Math.ceil(W*p)+1,h); return x+W*p; },0); }
/* legenda do contorno por ovos (linha única) */
function legendaOvos(c,u,x0,ly,cMute,cInk){
  c.textBaseline='middle'; c.textAlign='left'; c.font=`800 ${12.5*u}px ${FONTE}`; c.fillStyle=cMute;
  let lx=x0; const t0='CONTORNO = Nº DE OVOS:'; c.fillText(t0,lx,ly); lx+=c.measureText(t0).width+16*u;
  FAIXAS_OVOS.forEach(([t,col])=>{ const tt=t.replace(' ovos','');
    rr(c,lx,ly-7*u,24*u,14*u,7*u); c.fillStyle=col; c.fill(); c.lineWidth=1.8*u; c.strokeStyle='#111'; c.stroke();
    c.fillStyle=cInk; c.font=`700 ${12.5*u}px ${FONTE}`; c.fillText(tt,lx+31*u,ly); lx+=31*u+c.measureText(tt).width+16*u; });
  c.textBaseline='alphabetic';
}

const faixaTxt=l=>{ const ids=l.map(o=>o.id); return ids.length>1&&ids.length<=6&&ids.every((v,i)=>i===0||v===ids[i-1]+1)?`${ids[0]} a ${ids[ids.length-1]}`:(ids.length>6?compress(ids):ids.join(', ')); };

/* --- reserva: captura da tela com nitidez aplicada --- */
async function printRaster(lista){
  const salvo={c:map.getCenter(),z:map.getZoom(),field:field,fixed:map._fixed};
  try{
    map.closePopup();
    if(sel.size){ field=true; refresh(false); }
    map.invalidateSize();
    fitLegivel(map,gradePrintOn()?lista.concat(cantosCelulas(lista)):lista,60);
    await aguardaTiles($('map'),9000);
    await carregaLib('html2canvas');
    const cv=await html2canvas($('map'),{useCORS:true,scale:3,logging:false,backgroundColor:'#ffffff',
      ignoreElements:el=>el.classList&&(el.classList.contains('leaflet-control-zoom')||el.classList.contains('leaflet-control-layers')||el.classList.contains('leaflet-marker-pane')||el.classList.contains('leaflet-shadow-pane')||el.classList.contains('leaflet-popup-pane'))});
    afinar(cv,0.55);
    const el=$('map'), k=cv.width/el.clientWidth, ctx=cv.getContext('2d'), fator=lista.length>60?.6:lista.length>20?.8:1;
    await fontes();
    if(gradePrintOn()) desenhaGrade(ctx,(la,lo)=>{ const p=map.latLngToContainerPoint([la,lo]); return {x:p.x*k,y:p.y*k}; },k,map.hasLayer(sat));
    desenhaPontos(ctx,lista.map(o=>{ const p=map.latLngToContainerPoint([o.lat,o.lon]); return {o,x:p.x*k,y:p.y*k}; }),k*fator*0.9,true);
    return cv;
  } finally {
    field=salvo.field; map._fixed=salvo.fixed; refresh(false);
    map.setView(salvo.c,salvo.z,{animate:false}); zoomClass(map);
  }
}

/* uma imagem pronta (vetorial; se falhar, cai na captura da tela) */
async function gerarImagem(lista,titulo,dim,info){
  try{ await carregaLib('qrcode'); }catch(e){}
  const r0=$('map').getBoundingClientRect();
  const cw=1000, ch=dim?dim.ch:(r0.width>50?Math.max(560,Math.min(950,Math.round(1000*r0.height/r0.width))):1000);
  let mapCv, modo=$('fundo').value||'esri';
  try{
    const PR=maxPR(cw,ch,+$('qual').value||3);
    await fontes();
    const r=await criaRenderer(map.hasLayer(sat),cw,ch,PR,modo);
    try{ mapCv=await r.render(lista); } finally{ r.destroy(); }
  }catch(e){ console.warn('Mapa vetorial indisponível, usando reserva:',e); modo='raster'; mapCv=await printRaster(lista); }
  await fontes();
  return {cv:comporFolha(mapCv,lista,titulo,info||infoTela()),modo};
}

/* PDF: A4, uma folha por imagem */
function novoPdf(cv){ return new window.jspdf.jsPDF({orientation:cv.width>cv.height?'l':'p',unit:'mm',format:'a4',compress:true}); }
function pdfAdd(pdf,cv,novaPagina){
  const land=cv.width>cv.height;
  if(novaPagina) pdf.addPage('a4',land?'l':'p');
  const W=pdf.internal.pageSize.getWidth(), H=pdf.internal.pageSize.getHeight(), mg=6;
  const k=Math.min((W-2*mg)/cv.width,(H-2*mg)/cv.height), iw=cv.width*k, ih=cv.height*k;
  pdf.addImage(cv.toDataURL('image/jpeg',.94),'JPEG',(W-iw)/2,mg,iw,ih,undefined,'FAST');
}

function mostrarPrint(cv,lista,modo){
  shotCanvas=cv; shotLista=lista; shotNome=nomeArq(lista);
  cv.toBlob(b=>{
    shotBlob=b;
    if($('shotImg').dataset.u) URL.revokeObjectURL($('shotImg').dataset.u);
    const u=URL.createObjectURL(b); $('shotImg').src=u; $('shotImg').dataset.u=u;
    $('shotInf').textContent=`${lista.length} ovitrampa(s) · ${cv.width}×${cv.height} px · `+(modo==='vetor'?'fundo vetorial OpenStreetMap':modo==='esri'?'mesmo mapa da tela (Esri) + nome das ruas das ovitrampas em texto nítido':'modo reserva: captura da tela (o mapa em alta resolução não carregou) + nomes das ruas nítidos');
    $('shotShare').style.display=(navigator.canShare&&navigator.canShare({files:[new File([b],'a.png',{type:'image/png'})]}))?'':'none';
    $('shotDlg').style.display='flex';
  },'image/png');
}

$('shotBtn').addEventListener('click',async()=>{
  const btn=$('shotBtn'); btn.disabled=true; btn.textContent='Gerando…';
  try{
    const lista=sel.size? selList() : visibleList();
    if(!lista.length){ toast('Nenhuma ovitrampa para o print.'); return; }
    const r=await gerarImagem(lista,tituloLista(lista));
    mostrarPrint(r.cv,lista,r.modo);
  }catch(e){ console.error(e); toast('Não foi possível gerar o print. Confira a internet e tente de novo.'); }
  finally{ btn.disabled=false; btn.innerHTML=ico('camera')+'<span>Print do mapa</span>'; }
});
$('shotClose').addEventListener('click',()=>{ $('shotDlg').style.display='none'; });
$('shotPng').addEventListener('click',()=>{ if(shotBlob) baixarArq(shotBlob,shotNome+'.png'); });
$('shotShare').addEventListener('click',async()=>{
  try{ await navigator.share({files:[new File([shotBlob],shotNome+'.png',{type:'image/png'})],title:'Mapa — ovitrampas'}); }
  catch(e){ if(e.name!=='AbortError') toast('Não foi possível compartilhar. Use “Salvar PNG”.'); }
});
$('shotPdf').addEventListener('click',async()=>{
  try{ await carregaLib('jspdf'); }catch(e){ toast('PDF indisponível (biblioteca não carregou). Use “Salvar PNG”.'); return; }
  try{ const pdf=novoPdf(shotCanvas); pdfAdd(pdf,shotCanvas,false); pdf.save(shotNome+'.pdf'); }
  catch(e){ console.error(e); toast('Não foi possível gerar o PDF. Use “Salvar PNG”.'); }
});

/* ================= MAPAS POR AGENTE (lotes de 5) ================= */
/* ===================== AGENTES, ÁREAS E EQUIPES (planilha da coordenação) =====================
   [zona, área, agente, ovitrampa inicial, final, equipe]. Zonas 43 e 44 ainda sem agente/equipe definidos. */
const AGENTES_RAW=window.__BOOT.agentes;
const COR_EQ={1:'#007ECA',2:'#00A651',3:'#C98A00',4:'#E0182D'};
const tituloPT=t=>String(t).toLowerCase().split(' ').map((w,i)=>/^(i|ii|iii|iv|v)$/.test(w)?w.toUpperCase():w==='p.p.'?'P.P.':(i>0&&['de','da','do','dos','das','e'].includes(w))?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const AGS=[]; const AG_POR_ID={};
function montaAgentes(raw){
  AGS.length=0; Object.keys(AG_POR_ID).forEach(k=>delete AG_POR_ID[k]);
  raw.forEach(([zona,area,nome,ini,fim,equipe])=>{
    const a={zona,area:area?tituloPT(area):'',nome,ini,fim,equipe,lista:pts.filter(o=>o.id>=ini&&o.id<=fim)};
    AGS.push(a); a.lista.forEach(o=>{ AG_POR_ID[o.id]=a; });
  });
}
montaAgentes(STORE.agentes||AGENTES_RAW);
const nomeAg=a=>a.nome||('Agente '+a.zona), eqTxt=a=>a.equipe?'Equipe '+a.equipe:'Sem equipe';
const faixa=a=>a.fim>a.ini?`${a.ini}–${a.fim}`:String(a.ini);
const rotAg=a=>`Zona ${a.zona} — Ovitrampas ${a.fim>a.ini?a.ini+' a '+a.fim:a.ini}`;
const infoAg=a=>({agente:a.nome,area:a.area,zona:a.zona,equipe:a.equipe?'Equipe '+a.equipe:'',eqCor:a.equipe?COR_EQ[a.equipe]:null});
function agentePopup(o){
  const a=AG_POR_ID[o.id]; if(!a) return '';
  return `<div class="pp-coord" style="margin-top:-6px">Agente <b>${esc(a.nome||'não definido')}</b> · ${esc(eqTxt(a))} · Zona ${a.zona}${a.area?'<br>'+esc(a.area):''}</div>`;
}
const cmpNome=(x,y)=>(x.nome?0:1)-(y.nome?0:1)||norm(x.nome).localeCompare(norm(y.nome),'pt')||x.zona-y.zona;
function ordenaAg(l,modo){
  const c=[...l];
  if(modo==='nome') c.sort(cmpNome);
  else if(modo==='zona') c.sort((x,y)=>x.zona-y.zona);
  else c.sort((x,y)=>((x.equipe||9)-(y.equipe||9))||cmpNome(x,y));
  return c;
}
let agEq=null;
function renderAgentes(){
  const modo=$('agOrd').value, q=norm($('agBusca').value.trim());
  const eqs=[...new Set(AGS.map(a=>a.equipe).filter(Boolean))].sort();
  $('agEq').innerHTML=`<button type="button" data-f="" class="${agEq===null?'on':''}">Todas</button>`+eqs.map(e=>`<button type="button" data-f="${e}" class="${agEq===e?'on':''}" style="${agEq===e?'':`border-color:${COR_EQ[e]}`}">Equipe ${e}</button>`).join('');
  let l=agentesListados();
  const row=a=>`<button type="button" class="ag" data-z="${a.zona}"><span class="agn">${esc(nomeAg(a))}</span><span class="aga">${esc(a.area||'Área não informada')}</span><span class="agm">Zona ${a.zona} · ovitrampas ${faixa(a)}</span><i class="eqc" style="background:${a.equipe?COR_EQ[a.equipe]:'#7a8b90'}">${a.equipe?'Eq. '+a.equipe:'sem eq.'}</i></button>`;
  let h='';
  if(modo==='equipe'){
    let atual='#';
    l.forEach(a=>{
      const k=a.equipe||0;
      if(k!==atual){ atual=k; const g=l.filter(x=>(x.equipe||0)===k); const nO=g.reduce((t,x)=>t+x.lista.length,0);
        h+=`<div class="agh" style="--c:${k?COR_EQ[k]:'#7a8b90'}"><span>${k?'Equipe '+k:'Sem equipe'} · ${g.length} agente${g.length>1?'s':''} · ${nO} ovitrampas</span>${k?`<button type="button" data-eq="${k}">ver equipe no mapa</button>`:''}</div>`; }
      h+=row(a);
    });
  } else h=l.map(row).join('');
  $('agents').innerHTML=h||'<div style="padding:14px;color:var(--mute)">Nenhum agente encontrado.</div>';
  $('bInfo').textContent=`${AGS.filter(a=>a.nome).length} agentes com nome · ${eqs.length} equipes · ${pts.length} ovitrampas (zonas 43 e 44 ainda sem agente).`;
  resumoLote();
}
function selecionaIds(ids){
  const old=[...sel]; sel.clear(); ids.forEach(id=>sel.add(id));
  reicon([...new Set([...old,...ids])]); field=true; refresh(true); closeMenu();
}
$('agents').addEventListener('click',e=>{
  const eb=e.target.closest('button[data-eq]');
  if(eb){ const eq=+eb.dataset.eq, g=AGS.filter(a=>a.equipe===eq); selecionaIds(g.flatMap(a=>a.lista.map(o=>o.id)));
    toast(`Equipe ${eq}: ${g.length} agentes · ${g.reduce((t,a)=>t+a.lista.length,0)} ovitrampas`); return; }
  const b=e.target.closest('button.ag'); if(!b) return;
  const a=AGS.find(x=>x.zona===+b.dataset.z);
  document.querySelectorAll('#agents button.ag').forEach(x=>x.classList.toggle('on',x===b));
  selecionaIds(a.lista.map(o=>o.id));
  toast(`${rotAg(a)} · ${eqTxt(a)}`);
});
$('agEq').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; agEq=b.dataset.f===''?null:+b.dataset.f; renderAgentes(); });
$('agOrd').addEventListener('change',renderAgentes);
$('agBusca').addEventListener('input',renderAgentes);

function agentesListados(){
  const modo=$('agOrd').value, q=norm($('agBusca').value.trim());
  return ordenaAg(AGS.filter(a=>(agEq===null||a.equipe===agEq)&&(!q||norm([a.nome,a.area,'zona '+a.zona,a.ini+'-'+a.fim,eqTxt(a)].join(' ')).includes(q))),modo);
}
const loteAlvo=agentesListados;
function resumoLote(){ const l=loteAlvo(); $('bResumo').textContent=`${l.length} agente(s) · ${l.reduce((t,a)=>t+a.lista.length,0)} ovitrampas serão gerados.`; $('bGo').textContent=l.length?`GERAR MAPAS DOS ${l.length} AGENTES LISTADOS`:'NENHUM AGENTE NA LISTA'; }

let bCancel=false, bRodando=false;
const bTxt=t=>{ $('bTxt').textContent=t; }, bBar=f=>{ $('bBar').style.width=Math.round(f*100)+'%'; };
$('bCancel').addEventListener('click',()=>{ bCancel=true; $('bCancel').disabled=true; bTxt('Cancelando após o mapa atual…'); });
$('bDone').addEventListener('click',()=>{ $('batchDlg').style.display='none'; });
const seguro=t=>String(t).replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim();
async function gerarLote(){
  if(bRodando) return;
  const alvo=loteAlvo();
  if(!alvo.length){ toast('Nenhum agente nesse filtro.'); return; }
  const doPng=$('bPng').checked, doPdf=$('bPdf').checked, doAll=$('bAll').checked;
  if(!doPng&&!doPdf&&!doAll){ toast('Marque ao menos um formato (PNG ou PDF).'); return; }
  if(doPdf||doAll){ try{ await carregaLib('jspdf'); }catch(e){ toast('A biblioteca de PDF não carregou. Confira a internet e tente de novo.'); return; } }
  const total=alvo.length, satelite=map.hasLayer(sat), cw=1000, ch=850;
  bRodando=true; bCancel=false; closeMenu();
  $('batchT').textContent='Gerando mapas dos agentes…'; $('bCancel').disabled=false; $('bCancel').style.display=''; $('bDone').style.display='none';
  bBar(0); bTxt('Carregando mapa…'); $('batchDlg').style.display='flex';
  if(!pastaDest){ try{ await carregaLib('jszip'); }catch(e){} }
  try{ await carregaLib('qrcode'); }catch(e){}
  const zip=(window.JSZip&&!pastaDest)?new JSZip():null;
  const entrega=async(nome,blob)=>{ if(zip) zip.file(nome,blob); else{ baixarArq(blob,nome); await new Promise(r=>setTimeout(r,pastaDest?50:500)); } };
  let rend=null, feitos=0; const falhas=[], pdfsEq={};
  try{
    rend=await criaRenderer(satelite,cw,ch,maxPR(cw,ch,+$('qual').value||3),$('fundo').value||'esri');
    await fontes();
    for(let i=0;i<alvo.length;i++){
      if(bCancel) break;
      const a=alvo[i], titulo=rotAg(a);
      bTxt(`${feitos+falhas.length+1} de ${total} · ${nomeAg(a)} · ${eqTxt(a)}`); bBar((feitos+falhas.length)/total);
      const pasta=seguro(eqTxt(a)), stem=seguro(`Zona ${pad(a.zona,2)} - ${a.nome||'sem agente'} - ovitrampas ${pad(a.ini,3)}-${pad(a.fim,3)}`);
      try{
        let mapCv; try{ mapCv=await rend.render(a.lista); }catch(e){ mapCv=await rend.render(a.lista); }   /* 1 nova tentativa */
        const cv=comporFolha(mapCv,a.lista,titulo,infoAg(a));
        if(doPng) await entrega(`${pasta}/${stem}.png`,await toBlobP(cv));
        if(doPdf){ const p=novoPdf(cv); pdfAdd(p,cv,false); await entrega(`${pasta}/${stem}.pdf`,p.output('blob')); }
        if(doAll){ const k=eqTxt(a); if(!pdfsEq[k]){ pdfsEq[k]=novoPdf(cv); pdfAdd(pdfsEq[k],cv,false); } else pdfAdd(pdfsEq[k],cv,true); }
        feitos++;
      }catch(e){ console.error(e); falhas.push(a.zona); }
      await new Promise(r=>setTimeout(r,30));
    }
    if(feitos){
      bBar(1);
      for(const k of Object.keys(pdfsEq)) await entrega(`${seguro(k)} - todos os agentes.pdf`,pdfsEq[k].output('blob'));
      const nomeZip='mapas-ovitrampas_'+(agEq===null?'todas-as-equipes':'equipe-'+agEq)+($('agBusca').value.trim()?'_busca':'')+'.zip';
      if(zip){ bTxt('Compactando arquivos…'); baixarArq(await zip.generateAsync({type:'blob',compression:'STORE'}),nomeZip); }
    }
    $('batchT').textContent=bCancel?'Geração cancelada':(falhas.length?'Concluído com avisos':'Concluído');
    bTxt(`${feitos} de ${total} mapa(s) gerado(s).`+(falhas.length?` Falharam as zonas: ${falhas.join(', ')} — gere-as de novo pelo campo “Da zona … à …”.`:'')+(feitos&&!zip?' (Arquivos salvos um a um.)':'')+(feitos?(pastaDest?` Salvos na pasta “${pastaDest.name}”, em subpastas por equipe.`:' Veja a pasta Downloads (Transferências) do navegador.'):''));
  }catch(e){
    console.error(e);
    $('batchT').textContent='Não foi possível gerar';
    bTxt('O mapa não carregou (internet instável ou bloqueada). Confira a conexão e tente de novo. Detalhe: '+(e&&e.message||e));
  }finally{
    if(rend) rend.destroy();
    bRodando=false; $('bCancel').style.display='none'; $('bDone').style.display='';
  }
}
$('bGo').addEventListener('click',gerarLote);


document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if($('batchDlg').style.display==='flex'){ if(bRodando) $('bCancel').click(); else $('batchDlg').style.display='none'; } else if($('shotDlg').style.display==='flex') $('shotDlg').style.display='none'; else if($('sheet').style.display==='block') fecharFolha(); else ['impDlg','indDlg','cicloDlg','gridDlg','pubDlg','val'].forEach(id=>{ $(id).style.display='none'; }); } });

/* ===================== IMPORTAR / EXPORTAR / ATUALIZAR ===================== */
const nk=t=>norm(String(t==null?'':t)).replace(/[^a-zº°0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const limpa=t=>String(t==null?'':t).replace(/\*/g,'').trim();
const distM=(la1,lo1,la2,lo2)=>Math.hypot((la2-la1)*110574,(lo2-lo1)*102500);
function dividirLinha(l,d){
  const out=[]; let cur='', q=false;
  for(let i=0;i<l.length;i++){ const ch=l[i];
    if(q){ if(ch==='"'){ if(l[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; }
    else if(ch==='"') q=true; else if(ch===d){ out.push(cur); cur=''; } else cur+=ch; }
  out.push(cur); return out.map(x=>x.trim());
}
function lerTabela(txt){
  const L=txt.replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!L.length) return [];
  const pipe=L.filter(l=>l.startsWith('|')).length>=Math.max(1,Math.ceil(L.length/2));
  if(pipe) return L.filter(l=>!(/^\|?[\s:|-]+\|?$/.test(l)&&/-{2,}/.test(l))).map(l=>l.replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim()));
  const am=L.slice(0,8).join('\n'), cont=ch=>am.split(ch).length-1;
  const d=cont('\t')>0?'\t':(cont(';')>0&&cont(';')>=cont(',')?';':',');
  return L.map(l=>dividirLinha(l,d));
}
function mapaColunas(h){
  const m={};
  h.forEach((t,i)=>{ const k=nk(t);
    if(m.id===undefined&&/^(id|cod|codigo|ovitrampa|n ovitrampa|numero da ovitrampa)$/.test(k)) m.id=i;
    else if(m.rua===undefined&&/^(rua|endereco|logradouro|via)\b/.test(k)) m.rua=i;
    else if(m.num===undefined&&/^(n|nº|n°|no|num|numero)$/.test(k)) m.num=i;
    else if(m.lat===undefined&&/^lat/.test(k)) m.lat=i;
    else if(m.lon===undefined&&/^(lon|lng|long)/.test(k)) m.lon=i;
    else if(m.ovos===undefined&&/ovos/.test(k)) m.ovos=i;
    else if(m.area===undefined&&/^area/.test(k)) m.area=i;
    else if(m.agente===undefined&&/^agente/.test(k)) m.agente=i;
    else if(m.faixa===undefined&&/^ovitrampas$/.test(k)) m.faixa=i;
    else if(m.zona===undefined&&/^zona/.test(k)) m.zona=i;
    else if(m.equipe===undefined&&/^equipe/.test(k)) m.equipe=i;
  });
  return m;
}
const coordTxt=t=>{ t=limpa(t).replace(',','.'); return /^-?\d{1,3}\.\d+$/.test(t)?t:null; };
const coordOk=(la,lo)=>{ const a=parseFloat(la),b=parseFloat(lo); return a<=-22.2&&a>=-23&&b<=-55.3&&b>=-56; };

function planoDePontos(L,col){
  const mud=[], ign=[]; let lidas=0;
  L.forEach((r,i)=>{
    const id=parseInt(limpa(r[col.id]),10);
    if(!(id>=1&&byId[id])){ if(limpa(r.join(''))) ign.push(`linha ${i+1}: ID inválido (${limpa(r[col.id])||'vazio'})`); return; }
    lidas++;
    const o=byId[id], m=[];
    if(col.ovos!==undefined){ const v=limpa(r[col.ovos]); if(/^\d+$/.test(v)){ const n=parseInt(v,10); if(n!==o.ovosBase) m.push({t:'ovos',de:o.ovosBase,para:n}); } }
    if(col.rua!==undefined){ const v=limpa(r[col.rua]); if(v&&v!==o.rua) m.push({t:'rua',de:o.rua,para:v}); }
    if(col.num!==undefined){ const v=limpa(r[col.num]); if(v!==''&&v!==String(o.numero||'')) m.push({t:'num',de:o.numero||'',para:v}); }
    if(col.lat!==undefined&&col.lon!==undefined){
      const la=coordTxt(r[col.lat]), lo=coordTxt(r[col.lon]);
      if(la&&lo){ if(!coordOk(la,lo)) ign.push(`ID ${id}: coordenada fora da região de Ponta Porã (${la}, ${lo})`);
        else{ const d=distM(o.lat,o.lon,parseFloat(la),parseFloat(lo)); if(d>0.5) m.push({t:'coord',de:o.latRaw+', '+o.lonRaw,para:la+', '+lo,d,lat:la,lon:lo}); } }
      else if(limpa(r[col.lat])||limpa(r[col.lon])) ign.push(`ID ${id}: coordenada em formato não reconhecido`);
    }
    if(m.length) mud.push({id,m});
  });
  return {tipo:'pontos',lidas,mud,ign};
}
function planoDeAgentes(L,col){
  const rows=[], ign=[];
  L.forEach((r,i)=>{
    const faixa=limpa(r[col.faixa]).split(/[-–—]/).map(x=>parseInt(x,10));
    const ini=faixa[0], fim=faixa.length>1?faixa[1]:faixa[0];
    const zona=parseInt(limpa(r[col.zona]),10), eq=parseInt(limpa(r[col.equipe]),10);
    if(!(ini>=1&&fim>=ini&&fim<=pts.length)){ if(limpa(r.join(''))) ign.push(`linha ${i+1}: faixa de ovitrampas inválida`); return; }
    rows.push([isFinite(zona)?zona:rows.length+1, limpa(r[col.area]||''), limpa(r[col.agente]||''), ini, fim, isFinite(eq)?eq:null]);
  });
  /* completa ovitrampas sem agente */
  const cob=new Set(); rows.forEach(r=>{ for(let k=r[3];k<=r[4];k++) cob.add(k); });
  let zmax=Math.max(0,...rows.map(r=>r[0])), ini=null; const extra=[];
  for(let k=1;k<=pts.length+1;k++){ const sem=k<=pts.length&&!cob.has(k); if(sem&&ini===null) ini=k; if(!sem&&ini!==null){ extra.push([++zmax,'','',ini,k-1,null]); ini=null; } }
  return {tipo:'agentes',rows:rows.concat(extra),ign,extra};
}

/* ---- planilha mensal (ex.: "contaovos-contagens-...csv": uma linha por ovitrampa e mês) ---- */
const MESES_PT=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const rotMes=m=>MESES_PT[+m.slice(5,7)-1]+'/'+m.slice(2,4);
function colunasMensal(h){
  const m={}; h.forEach((t,i)=>{ const k=nk(t);
    if(m.mes===undefined&&/^mes$/.test(k)) m.mes=i;
    else if(m.id===undefined&&/^ovitrampa( numero.*)?$/.test(k)) m.id=i;
    else if(m.reg===undefined&&/^registros$/.test(k)) m.reg=i;
    else if(m.ovos===undefined&&/^soma de ovos$/.test(k)) m.ovos=i;
    else if(m.media===undefined&&/^media de ovos$/.test(k)) m.media=i;
    else if(m.base===undefined&&/^media de media historica/.test(k)) m.base=i;
    else if(m.lat===undefined&&/^latitude/.test(k)) m.lat=i;
    else if(m.lon===undefined&&/^longitude/.test(k)) m.lon=i; });
  return (m.mes!==undefined&&m.id!==undefined&&(m.media!==undefined||m.ovos!==undefined))?m:null;
}
function planoMensal(rows,col){
  const num=t=>{ t=limpa(t).replace(',','.'); return /^-?\d+(\.\d+)?$/.test(t)?parseFloat(t):null; };
  const set=new Set(), v={}, base={}, ex={}, multi={}, geo={}, ign=[];
  rows.forEach((r,i)=>{
    const mes=limpa(r[col.mes]), idt=limpa(r[col.id]);
    if(!/^\d{4}-\d{2}$/.test(mes)||!idt){ if(limpa(r.join(''))) ign.push(`linha ${i+2}: mês ou ovitrampa vazios`); return; }
    const reg=col.reg!==undefined?(num(r[col.reg])||1):1;
    let val=col.media!==undefined?num(r[col.media]):null; if(val===null&&col.ovos!==undefined){ const o=num(r[col.ovos]); val=o===null?null:o/reg; }
    if(val===null){ ign.push(`linha ${i+2}: sem contagem de ovos`); return; }
    set.add(mes); if(reg>1) multi[mes]=Math.max(multi[mes]||0,reg);
    const b=col.base!==undefined?num(r[col.base]):null, la=col.lat!==undefined?coordTxt(r[col.lat]):null, lo=col.lon!==undefined?coordTxt(r[col.lon]):null;
    const n=/^\d+$/.test(idt)?parseInt(idt,10):null;
    if(n!==null&&n>=1&&n<=pts.length){ (v[n]||(v[n]={}))[mes]=val; if(b!==null) base[n]=b; if(la&&lo&&(!geo[n]||mes>=geo[n].mes)) geo[n]={mes,la,lo}; }
    else{ const e=ex[idt]||(ex[idt]={v:{},base:null,lat:null,lon:null,mes:''}); e.v[mes]=val; if(b!==null) e.base=b; if(la&&lo&&mes>=e.mes){ e.lat=la; e.lon=lo; e.mes=mes; } }
  });
  const ms=[...set].sort(); if(!ms.length) return {tipo:'erro',msg:'Não achei meses com contagens nessa planilha.'};
  const ultimo=ms[ms.length-1], L=[];
  Object.keys(v).forEach(id=>{ const x=v[id][ultimo], g=geo[id]; if(x===undefined) return; L.push([id,'','','','',String(Math.round(x))]); });
  const pontos=planoDePontos(L,{id:0,ovos:5});
  const div=[]; Object.keys(geo).forEach(id=>{ const g=geo[id], o=byId[id]; if(!o) return; const d=distM(o.lat,o.lon,parseFloat(g.la),parseFloat(g.lo)); if(d>50) div.push({id:+id,d}); }); div.sort((a,b)=>b.d-a.d);
  return {tipo:'mensal',ms,v,base,ex,multi,ultimo,nMalha:Object.keys(v).length,nExtras:Object.keys(ex).length,ign,pontos,div};
}
function guardaSerie(p){
  const S=STORE.serie||(STORE.serie={meses:[],v:{},base:{},extras:{},multi:{},importado:null});
  S.meses=[...new Set(S.meses.concat(p.ms))].sort();
  Object.keys(p.v).forEach(id=>{ S.v[id]=Object.assign(S.v[id]||{},p.v[id]); });
  Object.keys(p.base).forEach(id=>{ S.base[id]=p.base[id]; });
  Object.keys(p.ex).forEach(k=>{ const e=S.extras[k]||(S.extras[k]={v:{},base:null,lat:null,lon:null}); Object.assign(e.v,p.ex[k].v); if(p.ex[k].base!==null) e.base=p.ex[k].base; if(p.ex[k].lat){ e.lat=p.ex[k].lat; e.lon=p.ex[k].lon; } });
  Object.assign(S.multi,p.multi); S.importado=new Date().toISOString(); _serieMemo=null;
}
/* série mensal para os balões: dados publicados (data/AAAA.json) + o que foi importado neste aparelho */
let _serieMemo=null;
function serieCompleta(){
  if(_serieMemo) return _serieMemo;
  const Y=PUB.ano, S={meses:[],v:{}};
  if(Y){ S.meses=Y.meses.slice(); Object.keys(Y.serie).forEach(id=>{ const d={}; Y.serie[id].forEach((x,i)=>{ if(x!==null) d[Y.meses[i]]=x; }); S.v[id]=d; }); }
  const L=STORE.serie;
  if(L){ S.meses=[...new Set(S.meses.concat(L.meses))].sort(); Object.keys(L.v).forEach(id=>{ S.v[id]=Object.assign(S.v[id]||{},L.v[id]); }); }
  return _serieMemo=S;
}
function serieLinhaPopup(o){
  const S=serieCompleta(), d=S.v[o.id]; if(!d||!S.meses.length) return '';
  const vals=S.meses.map(m=>d[m]===undefined?null:d[m]), mx=Math.max(1,...vals.map(x=>x||0)), bl='▁▂▃▄▅▆▇█';
  const sp=vals.map(x=>x===null?'·':bl[Math.min(7,Math.floor((x/mx)*7.999))]).join('');
  const pico=vals.reduce((b,x,i)=>x!==null&&x>(b.v)?{v:x,i}:b,{v:-1,i:-1});
  return `<div class="pp-linha">${S.meses.length} meses: <span class="spark-txt">${sp}</span> · pico ${Math.round(pico.v)} (${rotMes(S.meses[pico.i])})</div>`;
}
function planoImport(txt){
  txt=String(txt||'').trim(); if(!txt) return null;
  if(txt[0]==='{'){
    let j; try{ j=JSON.parse(txt); }catch(e){ return {tipo:'erro',msg:'O JSON está inválido.'}; }
    if(j&&j.store&&j.store.versao===2) return {tipo:'backup',store:j.store};
    if(j&&Array.isArray(j.ovitrampas)){
      const L=j.ovitrampas.map(x=>[x.id,x.rua!==undefined?x.rua:x.endereco,x.numero!==undefined?x.numero:'',x.latRaw||String(x.lat),x.lonRaw||String(x.lon),x.ovos==null?'':x.ovos]);
      return planoDePontos(L,{id:0,rua:1,num:2,lat:3,lon:4,ovos:5});
    }
    return {tipo:'erro',msg:'JSON não reconhecido.'};
  }
  const L=lerTabela(txt); if(!L.length) return {tipo:'erro',msg:'Não consegui ler a tabela.'};
  const temCab=!/^\d+$/.test(limpa(L[0][0]));
  if(temCab){
    const cm=colunasMensal(L[0]); if(cm) return planoMensal(L.slice(1),cm);
    const col=mapaColunas(L[0]), dados=L.slice(1);
    if(col.agente!==undefined&&col.faixa!==undefined) return planoDeAgentes(dados,col);
    if(col.id!==undefined) return planoDePontos(dados,col);
    return {tipo:'erro',msg:'Não achei as colunas. Use: ID, Rua, Nº, Latitude, Longitude, Ovos (ou Área, Agente, Ovitrampas, Zona, Equipe).'};
  }
  if(L[0].length>=5) return planoDePontos(L,{id:0,rua:1,num:2,lat:3,lon:4,ovos:5});
  return {tipo:'erro',msg:'Tabela sem cabeçalho e com poucas colunas.'};
}
let impPlano=null;
const nomeCampo={ovos:'Ovos',rua:'Rua',num:'Nº',coord:'Coordenadas'};
function renderImport(){
  const p=impPlano, box=$('impPrev'); $('impAplicar').disabled=true; $('impOpc').style.display='none'; $('impSerieW').style.display='none';
  if(!p){ box.innerHTML=''; return; }
  if(p.tipo==='erro'){ box.innerHTML=`<p class="err">${esc(p.msg)}</p>`; return; }
  if(p.tipo==='backup'){ const n=Object.keys(p.store.pts||{}).length, c=Object.keys(p.store.ciclo||{}).length;
    box.innerHTML=`<p class="ok">Backup reconhecido.</p><p>${n} ovitrampa(s) com alteração, ${c} com registro de campo${p.store.agentes?', lista de agentes':''}. Aplicar <b>substitui</b> os dados guardados neste aparelho por este backup.</p>`; $('impAplicar').disabled=false; return; }
  if(p.tipo==='agentes'){
    const eqs={}; p.rows.forEach(r=>{ const k=r[5]?'Equipe '+r[5]:'Sem equipe'; eqs[k]=(eqs[k]||0)+1; });
    box.innerHTML=`<p class="ok">Lista de agentes reconhecida: ${p.rows.length} linhas.</p><p>${Object.keys(eqs).sort().map(k=>`${k}: ${eqs[k]}`).join(' · ')}</p>`
      +(p.extra.length?`<p class="aviso">${p.extra.length} faixa(s) de ovitrampas sem agente foram mantidas como “sem agente”: ${p.extra.map(r=>r[3]+'–'+r[4]).join(', ')}.</p>`:'')
      +(p.ign.length?`<p class="aviso">Ignoradas: ${esc(p.ign.slice(0,6).join('; '))}</p>`:'');
    $('impAplicar').disabled=!p.rows.length; return; }
  if(p.tipo==='mensal'){
    const mm=Object.keys(p.multi).map(m=>rotMes(m)+' ('+p.multi[m]+' leituras por ovitrampa)');
    $('impSerieW').style.display='flex'; $('impOpc').style.display='flex'; $('impAplicar').disabled=false;
    box.innerHTML=`<p class="ok">Planilha mensal reconhecida: ${p.ms.length} meses (${rotMes(p.ms[0])} a ${rotMes(p.ultimo)}), ${p.nMalha} ovitrampas da malha e ${p.nExtras} pontos extras (estratégicos/outros).</p>`
      +(mm.length?`<p class="aviso">Mês com mais de uma leitura: ${esc(mm.join(', '))}. A série usa a <b>média</b> das leituras do mês (somar dobraria os ovos e passaria de 100% no IPO).</p>`:'')
      +(p.ign.length?`<p class="aviso">Ignorado: ${esc(p.ign.slice(0,4).join('; '))}</p>`:'')
      +(p.div.length?`<p class="aviso">${p.div.length} coordenada(s) da planilha diferem mais de 50 m da base e <b>não serão alteradas</b> (a planilha traz médias arredondadas). Confira: ${esc(p.div.slice(0,10).map(x=>x.id+' ('+Math.round(x.d)+' m)').join(', '))}${p.div.length>10?' …':''}.</p>`:'')+`<p><b>Último mês (${rotMes(p.ultimo)}) × base atual:</b></p>`+htmlPontos(p.pontos);
    return;
  }
  box.innerHTML=htmlPontos(p); if(p.mud.length){ $('impOpc').style.display='flex'; $('impAplicar').disabled=false; }
}
function htmlPontos(p){
  const cont={ovos:0,rua:0,num:0,coord:0,grande:0}; p.mud.forEach(x=>x.m.forEach(y=>{ cont[y.t]++; if(y.t==='coord'&&y.d>50) cont.grande++; }));
  let h=`<p class="ok">${p.lidas} ovitrampa(s) reconhecida(s).</p><p><b>${p.mud.length}</b> com mudança · ovos: ${cont.ovos} · rua: ${cont.rua} · nº: ${cont.num} · coordenadas: ${cont.coord}${cont.grande?` (<span class="aviso">${cont.grande} acima de 50 m</span>)`:''}</p>`;
  if(p.ign.length) h+=`<p class="aviso">Ignorado: ${esc(p.ign.slice(0,6).join('; '))}${p.ign.length>6?` … (+${p.ign.length-6})`:''}</p>`;
  if(p.mud.length){
    const linhas=[]; p.mud.forEach(x=>x.m.forEach(y=>linhas.push(`<tr><td>${x.id}</td><td>${nomeCampo[y.t]}</td><td>${esc(y.de===null?'—':y.de)}</td><td>${esc(y.para)}${y.t==='coord'?` <small class="${y.d>50?'aviso':''}">(${Math.round(y.d)} m${y.d>50?' ⚠':''})</small>`:''}</td></tr>`)));
    h+=`<div class="tw" style="max-height:30vh"><table><thead><tr><th>ID</th><th>Campo</th><th>Atual</th><th>Novo</th></tr></thead><tbody>${linhas.slice(0,150).join('')}</tbody></table></div>${linhas.length>150?`<p class="hint">Mostrando as 150 primeiras de ${linhas.length} mudanças.</p>`:''}`;
  } else h+='<p>Nada para atualizar nas ovitrampas: a planilha é igual à base atual.</p>';
  return h;
}
function analisaImport(){ impPlano=planoImport($('impTxt').value); renderImport(); }
function fechaImport(){ $('impDlg').style.display='none'; }
function aplicaPlanoPontos(p){
  const opO=$('impOvos').checked, opE=$('impEnd').checked, opC=$('impCoord').checked, opB=$('impCoordBig').checked;
  const r={nO:0,nE:0,nC:0,pulouC:0,ids:new Set()};
  p.mud.forEach(x=>{
    const d=STORE.pts[x.id]||(STORE.pts[x.id]={});
    x.m.forEach(y=>{
      if(y.t==='ovos'&&opO){ d.ovos=y.para; r.nO++; r.ids.add(x.id); }
      else if(y.t==='rua'&&opE){ d.rua=y.para; r.nE++; r.ids.add(x.id); }
      else if(y.t==='num'&&opE){ d.numero=y.para; r.nE++; r.ids.add(x.id); }
      else if(y.t==='coord'){ if(opC&&(y.d<=50||opB)){
          const c={id:x.id,campo:'lat/lon',de:y.de,para:y.para,motivo:'Planilha importada ('+Math.round(y.d)+' m)',data:iso(new Date()),responsavel:'Importação'};
          d.lat=y.lat; d.lon=y.lon; r.nC++; r.ids.add(x.id); CORRECOES.push(c); STORE.corr.push(c); } else r.pulouC++; }
    });
    aplicaPonto(byId[x.id],d); if(!Object.keys(d).length) delete STORE.pts[x.id];
  });
  return r;
}
function aplicaImport(){
  const p=impPlano; if(!p||p.tipo==='erro') return;
  let resumo='';
  if(p.tipo==='backup'){
    STORE=Object.assign(storeVazio(),p.store); if(!storeSalvar()){ toast('Não foi possível guardar neste aparelho.'); return; }
    toast('Backup restaurado. Recarregando…'); setTimeout(()=>location.reload(),600); return;
  }
  if(p.tipo==='agentes'){
    STORE.agentes=p.rows; montaAgentes(p.rows); resumo=`lista de agentes importada (${p.rows.length} linhas)`;
    STORE.log.push({q:new Date().toISOString(),tipo:'agentes',resumo}); storeSalvar();
    recalcTudo(); fechaImport(); toast('Lista de agentes atualizada.'); return;
  }
  const partes=[]; let r;
  if(p.tipo==='mensal'){
    if($('impSerie').checked){ guardaSerie(p); partes.push(`série mensal (${p.ms.length} meses)`); }
    r=aplicaPlanoPontos(p.pontos);
  } else r=aplicaPlanoPontos(p);
  partes.push(`ovos: ${r.nO} · rua/nº: ${r.nE} · coordenadas: ${r.nC}`+(r.pulouC?` (${r.pulouC} não aplicadas)`:''));
  resumo=partes.join(' · ');
  STORE.log.push({q:new Date().toISOString(),tipo:p.tipo,resumo});
  const ok=storeSalvar();
  recalcTudo([...r.ids]); fechaImport();
  toast((ok?'Atualizado: ':'Atualizado (SEM guardar no aparelho): ')+resumo);
}
function recalcTudo(ids){
  pts.forEach(o=>{ o.ovos=ovosEfetivo(o); o.endereco=enderecoCompleto(o.rua,o.numero); });
  (ids||pts.map(o=>o.id)).forEach(id=>{ const o=byId[id]; o.gx=gx(o.lon); o.gy=gy(o.lat); o.marker.setLatLng([o.lat,o.lon]); o.marker.setIcon(iconFor(o)); });
  VAL=validar(); renderSummary(); renderAgentes(); gradeAtualiza(); atualizaIndicadores(); atualizaDadosInfo(); refresh(false); atualizaRota();
}
function atualizaDadosInfo(){
  const n=Object.keys(STORE.pts).length, c=Object.keys(STORE.ciclo).length, q=STORE.quando?new Date(STORE.quando).toLocaleString('pt-BR'):'';
  const pub=PUB.manifest.atualizado?new Date(PUB.manifest.atualizado).toLocaleString('pt-BR'):'—';
  $('dadosInfo').textContent=(n||c||STORE.agentes||STORE.serie)
    ? `Dados publicados em ${pub}. Alterações guardadas só neste aparelho (${q}): ${n} ovitrampa(s) alterada(s), ${c} com registro de campo${STORE.agentes?', lista de agentes importada':''}${STORE.serie?', série mensal':''}. Use “Publicar dados para a gestão” para levá-las ao site.`
    : `Dados publicados em ${pub}. Nenhuma alteração guardada neste aparelho.`;
}
$('impAbrir').addEventListener('click',()=>{ $('impTxt').value=''; $('impFile').value=''; impPlano=null; renderImport(); $('impDlg').style.display='flex'; closeMenu(); });
$('impFechar').addEventListener('click',fechaImport);
let impT=null; $('impTxt').addEventListener('input',()=>{ clearTimeout(impT); impT=setTimeout(analisaImport,250); });
$('impFile').addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $('impTxt').value=String(r.result||''); analisaImport(); }; r.readAsText(f,'utf-8'); });
$('impAplicar').addEventListener('click',aplicaImport);
/* exportações */
const csvCel=t=>{ t=String(t==null?'':t); return /[;"\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
$('expCsv').addEventListener('click',()=>{
  const cab=['ID','Rua','Nº','Latitude','Longitude','Ovos','Zona','Agente','Área','Equipe','Quadrícula','Distância do centro (m)','Instalada em','Recolhida em','Última contagem em'];
  const lin=pts.map(o=>{ const a=AG_POR_ID[o.id]||{}, ci=G?celula(G,o.gx,o.gy):null, h=(o.historico||[]).slice().sort((x,y)=>x.d.localeCompare(y.d)), ult=h.length?h[h.length-1].d:'';
    return [o.id,o.rua,o.numero||'',o.latRaw.replace('.',','),o.lonRaw.replace('.',','),o.ovos===null?'':o.ovos,a.zona||'',a.nome||'',a.area||'',a.equipe?'Equipe '+a.equipe:'',ci&&ci.dentro?ci.code:'',ci&&ci.dentro?Math.round(ci.dist):'',o.dataInstalacao||'',o.dataRecolhimento||'',ult].map(csvCel).join(';'); });
  baixar('base-ovitrampas.csv','\ufeff'+[cab.join(';')].concat(lin).join('\n'),'text/csv;charset=utf-8');
});
$('expJson').addEventListener('click',()=>{
  baixar('backup-ovitrampas-'+iso(new Date())+'.json',JSON.stringify({app:'ovitrampas-ponta-pora',exportado:new Date().toISOString(),store:STORE},null,1),'application/json');
});
$('resetBase').addEventListener('click',()=>{
  if(!confirm('Apagar as alterações guardadas neste aparelho (importações e registros de campo) e voltar aos dados publicados?\n\nFaça um Backup (JSON) antes, se quiser guardar.')) return;
  try{ localStorage.removeItem(STORE_KEY); }catch(e){}
  location.reload();
});
/* ===================== REGISTRO DE CAMPO (instalação, recolhimento, contagens semanais) ===================== */
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dataBR=s=>s?String(s).split('-').reverse().join('/'):'—';
const parseISO=s=>{ const [y,m,d]=String(s).split('-').map(Number); return new Date(y,m-1,d); };
/* semana epidemiológica (domingo a sábado; SE 1 = semana com a maioria dos dias em janeiro) */
function semEpi(s){
  const d=parseISO(s), sab=new Date(d); sab.setDate(d.getDate()+(6-d.getDay()));
  const qua=new Date(sab); qua.setDate(sab.getDate()-3);
  const ano=qua.getFullYear(), j4=new Date(ano,0,4), ini=new Date(j4); ini.setDate(j4.getDate()-j4.getDay());
  const dom=new Date(sab); dom.setDate(sab.getDate()-6);
  return {ano,sem:Math.round((dom-ini)/(7*864e5))+1};
}
let cic=null;
window.abreCiclo=function(id){
  const o=byId[id]; if(!o) return; map.closePopup();
  cic={id,inst:o.dataInstalacao||'',rec:o.dataRecolhimento||'',hist:JSON.parse(JSON.stringify(o.historico||[]))};
  const a=AG_POR_ID[id];
  $('cicT').textContent='Ovitrampa '+id;
  $('cicSub').textContent=o.endereco+(a?` · ${a.nome||'Zona '+a.zona} · ${eqTxt(a)}`:'')+(o.ovosBase!==null?` · contagem da base: ${o.ovosBase} ovos`:' · sem contagem na base');
  $('cicInst').value=cic.inst; $('cicRec').value=cic.rec; $('cicData').value=iso(new Date()); $('cicN').value=''; $('cicMsg').textContent='';
  cicRender(); $('cicloDlg').style.display='flex';
};
function cicRender(){
  const h=cic.hist.slice().sort((a,b)=>b.d.localeCompare(a.d));
  $('cicLista').innerHTML=h.length?`<div class="tw" style="max-height:24vh"><table><thead><tr><th>Data</th><th>Sem. epid.</th><th>Ovos</th><th></th></tr></thead><tbody>${h.map(x=>{ const se=semEpi(x.d); return `<tr><td>${dataBR(x.d)}</td><td>SE ${se.sem}/${se.ano}</td><td><b>${x.n}</b></td><td><button class="btn ghost" type="button" data-del="${x.d}" aria-label="Remover contagem">✕</button></td></tr>`; }).join('')}</tbody></table></div>`:'<p class="hint">Nenhuma contagem registrada ainda. A contagem mais recente passa a valer para o mapa e os indicadores.</p>';
  const g=cic.hist.slice().sort((a,b)=>a.d.localeCompare(b.d)).slice(-16);
  if(g.length>=2){
    const mx=Math.max(1,...g.map(x=>x.n)), W=560, H=110, bw=W/g.length;
    $('cicGraf').innerHTML=`<svg viewBox="0 0 ${W} ${H+22}" width="100%" role="img" aria-label="Evolução das contagens">${g.map((x,i)=>{ const h2=Math.max(2,x.n/mx*H); return `<rect x="${i*bw+6}" y="${H-h2}" width="${bw-12}" height="${h2}" rx="4" fill="${corOvos(x.n)}" stroke="#111" stroke-width="1.5"/><text x="${i*bw+bw/2}" y="${H-h2-4}" font-size="12" font-weight="800" text-anchor="middle" fill="#002B68">${x.n}</text><text x="${i*bw+bw/2}" y="${H+15}" font-size="10.5" text-anchor="middle" fill="#5B7391">${x.d.slice(8)}/${x.d.slice(5,7)}</text>`; }).join('')}</svg>`;
  } else $('cicGraf').innerHTML='';
}
$('cicLista').addEventListener('click',e=>{ const b=e.target.closest('button[data-del]'); if(!b) return; cic.hist=cic.hist.filter(x=>x.d!==b.dataset.del); cicRender(); });
$('cicAdd').addEventListener('click',()=>{
  const d=$('cicData').value, n=$('cicN').value.trim();
  if(!d){ $('cicMsg').textContent='Informe a data da contagem.'; return; }
  if(!/^\d+$/.test(n)){ $('cicMsg').textContent='Informe a quantidade de ovos (número inteiro, 0 ou mais).'; return; }
  cic.hist=cic.hist.filter(x=>x.d!==d); cic.hist.push({d,n:parseInt(n,10)}); $('cicN').value=''; $('cicMsg').textContent='Contagem adicionada. Clique em Salvar para guardar.'; cicRender();
});
$('cicFechar').addEventListener('click',()=>{ $('cicloDlg').style.display='none'; cic=null; });
$('cicSalvar').addEventListener('click',()=>{
  if(!cic) return;
  const inst=$('cicInst').value, rec=$('cicRec').value;
  if(inst&&rec&&rec<inst){ $('cicMsg').textContent='A data de recolhimento não pode ser anterior à de instalação.'; return; }
  const o=byId[cic.id], vazio=!inst&&!rec&&!cic.hist.length;
  if(vazio) delete STORE.ciclo[cic.id]; else STORE.ciclo[cic.id]={inst,rec,hist:cic.hist};
  o.dataInstalacao=inst||null; o.dataRecolhimento=rec||null; o.historico=cic.hist;
  const ok=storeSalvar(); const id=cic.id; $('cicloDlg').style.display='none'; cic=null;
  recalcTudo([id]); toast(ok?`Ovitrampa ${id}: registro salvo.`:'Registro aplicado, mas NÃO foi possível guardar neste aparelho. Faça um backup.');
});
function cicloLinhaPopup(o){
  const h=(o.historico||[]).length; if(!o.dataInstalacao&&!o.dataRecolhimento&&!h) return '';
  return `<div class="pp-coord" style="margin-top:-6px">${o.dataInstalacao?'Instalada '+dataBR(o.dataInstalacao):''}${o.dataRecolhimento?' · Recolhida '+dataBR(o.dataRecolhimento):''}${h?` · ${h} contagem(ns)`:''}</div>`;
}
/* ===================== INDICADORES (IPO, IDO, ovos) ===================== */
const bandaOvos=v=>(v===null||v===undefined)?5:v<=0?0:v<=20?1:v<=50?2:v<=100?3:4;
function indic(lista){
  const r={n:lista.length,com:0,pos:0,ovos:0,bandas:[0,0,0,0,0,0]};
  lista.forEach(o=>{ const v=o.ovos; r.bandas[bandaOvos(v)]++; if(v!==null&&v!==undefined){ r.com++; r.ovos+=v; if(v>0) r.pos++; } });
  r.ipo=r.com?100*r.pos/r.com:null; r.imo=r.pos?r.ovos/r.pos:null; return r;
}
const fPct=x=>x===null||x===undefined?'—':x.toFixed(1).replace('.',',')+'%';
const fNum=x=>x===null||x===undefined?'—':String(Math.round(x*10)/10).replace('.',',');
function equipesDados(){
  const chaves=[...new Set(AGS.map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  return chaves.map(k=>{ const ags=AGS.filter(a=>(a.equipe||0)===k), lista=ags.flatMap(a=>a.lista); return {eq:k,nome:k?'Equipe '+k:'Sem equipe',ags,lista,ind:indic(lista)}; });
}
function atualizaIndicadores(){
  const r=indic(pts);
  $('kpiResumo').innerHTML=[[fPct(r.ipo),'IPO'],[fNum(r.imo),'IDO'],[r.pos+'/'+r.com,'Positivas'],[r.ovos,'Total de ovos'],[r.com,'Com contagem'],[r.n-r.com,'Sem contagem']].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
}
function criticas(lista,max){ return lista.filter(o=>o.ovos>0).sort((a,b)=>b.ovos-a.ovos||a.id-b.id).slice(0,max); }
function evolucaoSE(){
  const m={}; pts.forEach(o=>(o.historico||[]).forEach(h=>{ const se=semEpi(h.d), k=se.ano+'-'+String(se.sem).padStart(2,'0'); const e=m[k]||(m[k]={ano:se.ano,sem:se.sem,ovos:0,n:0}); e.ovos+=h.n; e.n++; }));
  return Object.keys(m).sort().map(k=>m[k]);
}
function htmlIndicadores(){
  const g=indic(pts), eqs=equipesDados(), ord=$('indOrd').value;
  let h=`<div class="indkpis">${[[fPct(g.ipo),'IPO'],[fNum(g.imo),'IDO'],[g.pos+' de '+g.com,'Positivas / com contagem'],[g.ovos,'Total de ovos'],[g.n-g.com,'Sem contagem']].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
  const mx=Math.max(1,...g.bandas);
  h+='<div class="tabv"><h3>Distribuição por faixa de ovos</h3>'+FAIXAS_OVOS.map(([t,c],i)=>`<div class="bandbar"><i style="background:${c};width:${Math.max(2,Math.round(g.bandas[i]/mx*42))}%"></i><span><b>${g.bandas[i]}</b> · ${t}</span></div>`).join('')+'</div>';
  h+=`<div class="tabv"><h3>Por equipe</h3><div class="tw"><table><thead><tr><th>Equipe</th><th>Agentes</th><th>Ovitrampas</th><th>Com contagem</th><th>Positivas</th><th>IPO</th><th>Ovos</th><th>IDO</th></tr></thead><tbody>${eqs.map(e=>`<tr><td><b>${e.nome}</b></td><td>${e.ags.length}</td><td>${e.ind.n}</td><td>${e.ind.com}</td><td>${e.ind.pos}</td><td>${fPct(e.ind.ipo)}</td><td>${e.ind.ovos}</td><td>${fNum(e.ind.imo)}</td></tr>`).join('')}</tbody></table></div></div>`;
  let ags=AGS.map(a=>({a,i:indic(a.lista)}));
  ags.sort((x,y)=>ord==='zona'?x.a.zona-y.a.zona:ord==='ipo'?(y.i.ipo||-1)-(x.i.ipo||-1):ord==='imo'?(y.i.imo||-1)-(x.i.imo||-1):y.i.ovos-x.i.ovos||x.a.zona-y.a.zona);
  h+=`<div class="tabv"><h3>Por agente / área</h3><div class="tw"><table><thead><tr><th>Zona</th><th>Agente</th><th>Área</th><th>Equipe</th><th>Ovit.</th><th>Positivas</th><th>IPO</th><th>Ovos</th><th>IDO</th></tr></thead><tbody>${ags.map(({a,i})=>`<tr><td>${a.zona}</td><td><button class="idb" type="button" data-ag="${a.zona}">${esc(nomeAg(a))}</button></td><td>${esc(a.area||'—')}</td><td>${esc(eqTxt(a))}</td><td>${i.n}</td><td>${i.pos}</td><td>${fPct(i.ipo)}</td><td><b>${i.ovos}</b></td><td>${fNum(i.imo)}</td></tr>`).join('')}</tbody></table></div></div>`;
  const cr=criticas(pts,25);
  h+=`<div class="tabv"><h3>Pontos mais críticos (maior nº de ovos)</h3>${cr.length?`<div class="tw"><table><thead><tr><th>ID</th><th>Endereço</th><th>Agente</th><th>Quadrícula</th><th>Ovos</th></tr></thead><tbody>${cr.map(o=>{ const a=AG_POR_ID[o.id], ci=G?celula(G,o.gx,o.gy):null; return `<tr><td><button class="idb" type="button" data-id="${o.id}">${o.id}</button></td><td>${esc(o.endereco)}</td><td>${esc(a?nomeAg(a)+' · '+eqTxt(a):'—')}</td><td>${ci&&ci.dentro?ci.code:'—'}</td><td><span style="display:inline-block;width:20px;height:11px;border-radius:6px;border:1.5px solid #111;background:${corOvos(o.ovos)};vertical-align:-1px"></span> <b>${o.ovos}</b></td></tr>`; }).join('')}</tbody></table></div>`:'<p class="hint">Nenhuma ovitrampa positiva.</p>'}</div>`;
  const ev=evolucaoSE();
  if(ev.length){ const m=Math.max(1,...ev.map(e=>e.ovos)), W=560, H=110, bw=W/ev.length;
    h+=`<div class="tabv"><h3>Evolução semanal (registros de campo)</h3><svg viewBox="0 0 ${W} ${H+24}" width="100%">${ev.map((e,i)=>{ const hh=Math.max(2,e.ovos/m*H); return `<rect x="${i*bw+6}" y="${H-hh}" width="${bw-12}" height="${hh}" rx="4" fill="#007ECA"/><text x="${i*bw+bw/2}" y="${H-hh-4}" font-size="12" font-weight="800" text-anchor="middle" fill="#002B68">${e.ovos}</text><text x="${i*bw+bw/2}" y="${H+16}" font-size="10.5" text-anchor="middle" fill="#5B7391">SE ${e.sem}</text>`; }).join('')}</svg><p class="hint">Soma dos ovos registrados por semana epidemiológica (${ev.reduce((t,e)=>t+e.n,0)} contagens).</p></div>`; }
  return h;
}
function abreIndicadores(){ $('indBody').innerHTML=htmlIndicadores(); $('indDlg').style.display='flex'; closeMenu(); }
$('indAbrir').addEventListener('click',abreIndicadores);
$('indFechar').addEventListener('click',()=>{ $('indDlg').style.display='none'; });
$('indOrd').addEventListener('change',()=>{ $('indBody').innerHTML=htmlIndicadores(); });
$('indBody').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.ag){ const a=AGS.find(x=>x.zona===+b.dataset.ag); $('indDlg').style.display='none'; selecionaIds(a.lista.map(o=>o.id)); toast(`${rotAg(a)} · ${eqTxt(a)}`); }
  else if(b.dataset.id){ const id=+b.dataset.id; $('indDlg').style.display='none'; selecionaIds([id]); setTimeout(()=>byId[id].marker.openPopup(),400); }
});
$('indCsv').addEventListener('click',()=>{
  const cab=['Equipe','Zona','Agente','Área','Ovitrampas','Com contagem','Positivas','IPO (%)','Total de ovos','IDO'];
  const lin=AGS.map(a=>{ const i=indic(a.lista); return [eqTxt(a),a.zona,a.nome,a.area,faixa(a),i.com,i.pos,i.ipo===null?'':fNum(i.ipo),i.ovos,i.imo===null?'':fNum(i.imo)].map(csvCel).join(';'); });
  baixar('indicadores-por-agente.csv','\ufeff'+[cab.join(';')].concat(lin).join('\n'),'text/csv;charset=utf-8');
});

/* ===================== RESUMO GERENCIAL (PDF, 1 página geral + 2 por equipe) ===================== */
function paginaA4(){ const W=2400,H=3394, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const c=cv.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,W,H); return {cv,c,W,H,u:W/1000}; }
function cabPag(pg,titulo,sub,cor){
  const {c,u,W}=pg, mx=24*u, hHead=128*u, lh=100*u, lw=LOGO.naturalWidth?lh*LOGO.naturalWidth/LOGO.naturalHeight:0, ly=(hHead-8*u-lh)/2;
  c.textBaseline='alphabetic'; c.textAlign='left';
  if(lw){ c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(LOGO,mx,ly,lw,lh); }
  const tx=mx+(lw?lw+26*u:0); if(lw){ c.fillStyle='#C5D6E8'; c.fillRect(tx-13*u,ly+8*u,2*u,lh-16*u); }
  c.fillStyle=PAL.navy; c.fillText(ajustaTexto(c,titulo,W-tx-mx-200*u,800,34*u,19*u),tx,ly+lh/2-2*u);
  c.font=`700 ${15*u}px ${FONTE}`; c.fillStyle=PAL.blue; c.fillText(sub,tx,ly+lh/2+24*u);
  rr(c,W-mx-170*u,ly+24*u,170*u,lh-48*u,12*u); c.fillStyle=cor||PAL.blue; c.fill();
  c.fillStyle=textoSobre(cor||PAL.blue); c.textAlign='center'; c.font=`800 ${17*u}px ${FONTE}`; c.fillText(new Date().toLocaleDateString('pt-BR'),W-mx-85*u,ly+lh/2+6*u); c.textAlign='left';
  faixaLogo(c,W,hHead-8*u,8*u); return hHead;
}
function kpisPag(pg,y,itens){
  const {c,u,W}=pg, mx=24*u, gap=12*u, n=itens.length, w=(W-2*mx-gap*(n-1))/n, h=88*u;
  itens.forEach(([v,l],i)=>{ const x=mx+i*(w+gap); rr(c,x,y,w,h,10*u); c.fillStyle='#EEF4FA'; c.fill(); c.strokeStyle='#C5D6E8'; c.lineWidth=1.5*u; c.stroke();
    c.textAlign='center'; c.fillStyle=PAL.navy; c.font=`800 ${32*u}px ${FONTE}`; c.fillText(String(v),x+w/2,y+50*u); c.fillStyle='#5B7391'; c.font=`800 ${11.5*u}px ${FONTE}`; c.fillText(l.toUpperCase(),x+w/2,y+74*u); });
  c.textAlign='left'; return y+h;
}
function tituloSecao(pg,y,t){ const {c,u}=pg, mx=24*u; c.textAlign='left'; c.fillStyle=PAL.navy; c.font=`800 ${22*u}px ${FONTE}`; c.fillText(t,mx,y+22*u); c.fillStyle=PAL.blue; c.fillRect(mx,y+32*u,60*u,4*u); c.fillStyle=PAL.yellow; c.fillRect(mx+60*u,y+32*u,30*u,4*u); return y+48*u; }
function tabelaPag(pg,y,cols,linhas,opt){
  opt=opt||{}; const {c,u,W}=pg, mx=24*u, tw=W-2*mx, rowH=(opt.rowH||40)*u, hh=34*u, soma=cols.reduce((t,k)=>t+k.w,0);
  const xs=[]; let x=mx; cols.forEach(k=>{ const w=tw*k.w/soma; xs.push([x,w]); x+=w; });
  rr(c,mx,y,tw,hh,7*u); c.fillStyle=PAL.navy; c.fill();
  c.fillStyle='#fff'; c.font=`800 ${12.5*u}px ${FONTE}`; c.textBaseline='middle';
  cols.forEach((k,i)=>{ c.textAlign=k.a==='r'?'right':k.a==='c'?'center':'left'; const px=k.a==='r'?xs[i][0]+xs[i][1]-10*u:k.a==='c'?xs[i][0]+xs[i][1]/2:xs[i][0]+10*u; c.fillText(k.t,px,y+hh/2+u); });
  const todas=opt.total?linhas.concat([opt.total]):linhas;
  todas.forEach((r,j)=>{ const ry=y+hh+j*rowH, tot=opt.total&&j===linhas.length;
    c.fillStyle=tot?'#DCE9F5':(j%2===0?'#EEF4FA':'#fff'); c.fillRect(mx,ry,tw,rowH);
    cols.forEach((k,i)=>{ const v=k.f(r); c.textAlign=k.a==='r'?'right':k.a==='c'?'center':'left'; const px=k.a==='r'?xs[i][0]+xs[i][1]-10*u:k.a==='c'?xs[i][0]+xs[i][1]/2:xs[i][0]+10*u;
      c.fillStyle=PAL.navy; c.font=`${(k.b||tot)?800:600} ${15*u}px ${FONTE}`; c.fillText(ajustaTexto(c,String(v),xs[i][1]-18*u,(k.b||tot)?800:600,15*u,9*u),px,ry+rowH/2+u); });
  });
  c.strokeStyle='#C5D6E8'; c.lineWidth=1.5*u; c.strokeRect(mx,y+hh,tw,rowH*todas.length); c.textBaseline='alphabetic'; c.textAlign='left';
  return y+hh+rowH*todas.length;
}
function rodapePag(pg,n,total,txt){ const {c,u,W,H}=pg, mx=24*u; c.fillStyle='#C5D6E8'; c.fillRect(mx,H-46*u,W-2*mx,1.5*u); c.fillStyle='#5B7391'; c.font=`400 ${12*u}px ${FONTE}`; c.textAlign='left'; c.fillText(txt,mx,H-22*u); c.textAlign='right'; c.fillText(`Página ${n} de ${total} · gerado em ${new Date().toLocaleString('pt-BR')}`,W-mx,H-22*u); c.textAlign='left'; }
function mapaPag(pg,y,mapCv){ const {c,u,W}=pg, mx=24*u, w=W-2*mx, h=mapCv.height*w/mapCv.width;
  c.save(); rr(c,mx,y,w,h,14*u); c.clip(); c.drawImage(mapCv,mx,y,w,h); c.restore(); rr(c,mx,y,w,h,14*u); c.strokeStyle=PAL.navy; c.lineWidth=3*u; c.stroke();
  legendaOvos(c,u,mx,y+h+24*u,'#5B7391',PAL.navy); return y+h+46*u; }
async function gerarResumoGerencial(){
  if(bRodando) return;
  try{ await carregaLib('jspdf'); }catch(e){ toast('A biblioteca de PDF não carregou. Confira a internet e tente de novo.'); return; }
  bRodando=true; bCancel=false; closeMenu(); $('indDlg').style.display='none';
  $('batchT').textContent='Gerando resumo gerencial…'; $('bCancel').disabled=false; $('bCancel').style.display=''; $('bDone').style.display='none';
  bBar(0); bTxt('Carregando mapa…'); $('batchDlg').style.display='flex';
  const satelite=map.hasLayer(sat), cw=1000, ch=540;
  let rend=null, pdf=null, nPag=0; const salvoOv=window.__ovForce, salvoEst=window.ESTILO_PONTOS, salvoRota=window.__semRota;
  try{
    window.__ovForce=true; window.ESTILO_PONTOS='ponto'; window.__semRota=true;
    rend=await criaRenderer(satelite,cw,ch,maxPR(cw,ch,2.4),$('fundo').value||'esri'); await fontes();
    const eqs=equipesDados().filter(e=>e.eq), tot=1+eqs.length*2, geral=indic(pts), todasEq=equipesDados();
    const add=cv=>{ if(!pdf) pdf=novoPdf(cv); pdfAdd(pdf,cv,nPag>0); nPag++; bBar(nPag/tot); };
    const colsEq=[{t:'Equipe',w:140,f:e=>e.nome,b:1},{t:'Agentes',w:80,a:'r',f:e=>e.ags.length},{t:'Ovitrampas',w:100,a:'r',f:e=>e.ind.n},{t:'Com contagem',w:110,a:'r',f:e=>e.ind.com},{t:'Positivas',w:90,a:'r',f:e=>e.ind.pos},{t:'IPO',w:80,a:'r',f:e=>fPct(e.ind.ipo)},{t:'Ovos',w:80,a:'r',f:e=>e.ind.ovos},{t:'IDO',w:70,a:'r',f:e=>fNum(e.ind.imo)}];
    /* página geral */
    bTxt(`Página 1 de ${tot} · visão geral`);
    let mapCv=await rend.render(pts), pg=paginaA4(), y=cabPag(pg,'Resumo gerencial — ovitrampas','Ponta Porã/MS · Vigilância em Saúde / Endemias');
    y=kpisPag(pg,y+18*pg.u,[[fPct(geral.ipo),'IPO'],[fNum(geral.imo),'IDO'],[geral.pos+'/'+geral.com,'Positivas'],[geral.ovos,'Total de ovos'],[geral.n,'Ovitrampas'],[geral.n-geral.com,'Sem contagem']]);
    y=mapaPag(pg,y+14*pg.u,mapCv); y=tituloSecao(pg,y+10*pg.u,'Resumo por equipe');
    tabelaPag(pg,y,colsEq,todasEq,{rowH:44,total:{nome:'Total',ags:AGS.filter(a=>a.nome||true),ind:geral}});
    rodapePag(pg,1,tot,'IPO = positivas ÷ ovitrampas com contagem · IDO = ovos ÷ positivas (média de ovos por ovitrampa positiva). Mapa: cor do ponto = faixa de ovos.'); add(pg.cv);
    for(const e of eqs){
      if(bCancel) break;
      bTxt(`Página ${nPag+1} de ${tot} · ${e.nome}`); await new Promise(r=>setTimeout(r,20));
      const cor=COR_EQ[e.eq]; mapCv=await rend.render(e.lista); pg=paginaA4();
      y=cabPag(pg,'Resumo gerencial — '+e.nome,`${e.ags.length} agentes · ${e.ind.n} ovitrampas · Ponta Porã/MS`,cor);
      y=kpisPag(pg,y+18*pg.u,[[fPct(e.ind.ipo),'IPO'],[fNum(e.ind.imo),'IDO'],[e.ind.pos+'/'+e.ind.com,'Positivas'],[e.ind.ovos,'Total de ovos'],[e.ags.length,'Agentes'],[e.ind.n-e.ind.com,'Sem contagem']]);
      y=mapaPag(pg,y+14*pg.u,mapCv); y=tituloSecao(pg,y+4*pg.u,'Agentes da equipe');
      const linhas=e.ags.slice().sort((a,b)=>a.zona-b.zona).map(a=>({a,i:indic(a.lista)}));
      tabelaPag(pg,y,[{t:'Zona',w:50,f:r=>r.a.zona},{t:'Agente',w:150,f:r=>r.a.nome||'—',b:1},{t:'Área',w:230,f:r=>r.a.area||'—'},{t:'Ovit.',w:60,a:'r',f:r=>r.i.n},{t:'Posit.',w:60,a:'r',f:r=>r.i.pos},{t:'IPO',w:70,a:'r',f:r=>fPct(r.i.ipo)},{t:'Ovos',w:70,a:'r',f:r=>r.i.ovos},{t:'IDO',w:60,a:'r',f:r=>fNum(r.i.imo)}],linhas,{rowH:36});
      rodapePag(pg,nPag+1,tot,e.nome+' · cor do ponto no mapa = faixa de ovos.'); add(pg.cv);
      /* página 2 da equipe: críticas + distribuição */
      pg=paginaA4(); y=cabPag(pg,e.nome+' — pontos críticos','Maiores contagens de ovos e distribuição por faixa',cor);
      y=tituloSecao(pg,y+22*pg.u,'Distribuição por faixa de ovos'); const mxb=Math.max(1,...e.ind.bandas), c=pg.c, u=pg.u;
      FAIXAS_OVOS.forEach(([t,col],i)=>{ const by=y+i*40*u; rr(c,24*u,by,Math.max(26*u,e.ind.bandas[i]/mxb*600*u),26*u,13*u); c.fillStyle=col; c.fill(); c.lineWidth=2*u; c.strokeStyle='#111'; c.stroke();
        c.fillStyle=PAL.navy; c.font=`800 ${16*u}px ${FONTE}`; c.textBaseline='middle'; c.fillText(`${e.ind.bandas[i]}  ·  ${t}`,24*u+Math.max(26*u,e.ind.bandas[i]/mxb*600*u)+14*u,by+14*u); c.textBaseline='alphabetic'; });
      y+=6*40*u+16*u; y=tituloSecao(pg,y,'Ovitrampas com mais ovos (até 25)');
      const cr=criticas(e.lista,25);
      if(cr.length) tabelaPag(pg,y,[{t:'ID',w:44,a:'c',f:o=>o.id,b:1},{t:'Endereço',w:300,f:o=>o.endereco},{t:'Agente',w:130,f:o=>{ const a=AG_POR_ID[o.id]; return a?nomeAg(a):'—'; }},{t:'Quadr.',w:60,a:'c',f:o=>{ const ci=G?celula(G,o.gx,o.gy):null; return ci&&ci.dentro?ci.code:'—'; }},{t:'Ovos',w:60,a:'r',f:o=>o.ovos,b:1}],cr,{rowH:40});
      else{ c.fillStyle=PAL.navy; c.font=`600 ${16*u}px ${FONTE}`; c.fillText('Nenhuma ovitrampa positiva nesta equipe.',24*u,y+24*u); }
      rodapePag(pg,nPag+1,tot,e.nome); add(pg.cv);
    }
    if(pdf&&nPag){ baixarArq(pdf.output('blob'),'Resumo gerencial - ovitrampas.pdf'); $('batchT').textContent=bCancel?'Resumo cancelado (parcial)':'Concluído'; bTxt(`${nPag} página(s) geradas.`+(pastaDest?` Salvo na pasta “${pastaDest.name}”.`:' Veja a pasta Downloads (Transferências).')); }
    else{ $('batchT').textContent='Cancelado'; bTxt('Nenhuma página gerada.'); }
  }catch(e){ console.error(e); $('batchT').textContent='Não foi possível gerar'; bTxt('Erro ao gerar o resumo: '+(e&&e.message||e)); }
  finally{ window.__ovForce=salvoOv; window.ESTILO_PONTOS=salvoEst; window.__semRota=salvoRota; if(rend) rend.destroy(); bRodando=false; $('bCancel').style.display='none'; $('bDone').style.display=''; }
}
$('resGer').addEventListener('click',gerarResumoGerencial);
$('indPdf').addEventListener('click',gerarResumoGerencial);
/* ===================== ROTA SUGERIDA + QR ===================== */
const rotaRelOn=()=>!!($('rotaRel')&&$('rotaRel').checked);
const rotaMapaOn=()=>!!($('rotaMapa')&&$('rotaMapa').checked);
/* menor caminho aberto entre os pontos (exato até 12 pontos; acima disso, vizinho mais próximo + 2-opt) */
function rotaOrdem(lista){
  const n=lista.length; if(n<=2) return [...lista];
  const P=lista.map(o=>[o.gx,o.gy]), D=(i,j)=>Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]);
  let ord;
  if(n<=12){
    const N=1<<n, INF=1e18, dp=new Float64Array(N*n).fill(INF), pr=new Int16Array(N*n).fill(-1);
    for(let i=0;i<n;i++) dp[(1<<i)*n+i]=0;
    for(let m=1;m<N;m++) for(let j=0;j<n;j++){
      const v=dp[m*n+j]; if(v>=INF||!(m&(1<<j))) continue;
      for(let k=0;k<n;k++){ if(m&(1<<k)) continue; const nm=m|(1<<k), nv=v+D(j,k); if(nv<dp[nm*n+k]){ dp[nm*n+k]=nv; pr[nm*n+k]=j; } }
    }
    let best=INF,bj=0; const full=N-1;
    for(let j=0;j<n;j++) if(dp[full*n+j]<best){ best=dp[full*n+j]; bj=j; }
    ord=[]; let m=full,j=bj; while(j!==-1){ ord.push(j); const pj=pr[m*n+j]; m^=(1<<j); j=pj; } ord.reverse();
  } else {
    let ini=0; for(let i=1;i<n;i++) if(P[i][0]-P[i][1]<P[ini][0]-P[ini][1]) ini=i;
    const usado=new Set([ini]); ord=[ini];
    while(ord.length<n){ const u=ord[ord.length-1]; let b=-1,bd=1e18; for(let i=0;i<n;i++) if(!usado.has(i)&&D(u,i)<bd){ bd=D(u,i); b=i; } usado.add(b); ord.push(b); }
    let melhorou=true, it=0;
    while(melhorou&&it++<60){ melhorou=false;
      for(let i=0;i<n-2;i++) for(let j=i+2;j<n;j++){
        const a=ord[i],b=ord[i+1],c=ord[j],d=j+1<n?ord[j+1]:null;
        const antes=D(a,b)+(d!==null?D(c,d):0), depois=D(a,c)+(d!==null?D(b,d):0);
        if(depois<antes-1e-6){ ord=ord.slice(0,i+1).concat(ord.slice(i+1,j+1).reverse(),ord.slice(j+1)); melhorou=true; }
      }
    }
  }
  const sc=i=>P[i][0]-P[i][1];                          /* começa pela ponta mais a noroeste */
  if(sc(ord[0])>sc(ord[ord.length-1])) ord.reverse();
  return ord.map(i=>lista[i]);
}
const rotaDist=ord=>ord.reduce((t,o,i)=>i?t+Math.hypot(o.gx-ord[i-1].gx,o.gy-ord[i-1].gy):0,0);
/* link do Google Maps: destino = última; paradas = as anteriores; sem origem => parte da localização do celular */
function urlRota(ordem){
  const c=o=>o.latRaw+','+o.lonRaw;
  if(ordem.length===1) return 'https://www.google.com/maps/search/?api=1&query='+c(ordem[0]);
  const dest=ordem[ordem.length-1], via=ordem.slice(0,-1);
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+c(dest)+'&waypoints='+via.map(c).join('%7C');
}
function desenhaQR(ctx,texto,x,y,tam){
  if(typeof qrcode!=='function') return false;
  try{
    const qr=qrcode(0,'M'); qr.addData(texto); qr.make();
    const n=qr.getModuleCount(), q=4, cel=tam/(n+2*q);
    ctx.fillStyle='#fff'; ctx.fillRect(x,y,tam,tam); ctx.fillStyle='#000';
    for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c)) ctx.fillRect(x+(q+c)*cel,y+(q+r)*cel,Math.ceil(cel),Math.ceil(cel));
    return true;
  }catch(e){ console.warn('QR:',e); return false; }
}
/* --- no print (canvas): linha tracejada antes dos pinos e números depois --- */
function desenhaRotaLinha(ctx,proj,k,ordem){
  if(ordem.length<2) return;
  ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath(); ordem.forEach((o,i)=>{ const p=proj(o.lat,o.lon); if(i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); });
  ctx.setLineDash([14*k,9*k]); ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=7*k; ctx.stroke();
  ctx.strokeStyle='#0A3D91'; ctx.lineWidth=3.6*k; ctx.stroke(); ctx.restore();
}
function desenhaRotaNumeros(ctx,proj,k,ordem){
  if(ordem.length<2) return;
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=`800 ${13*k}px ${FONTE}`;
  ordem.forEach((o,i)=>{ const p=proj(o.lat,o.lon), x=p.x+26*k, y=p.y-34*k;
    ctx.beginPath(); ctx.arc(x,y,11.5*k,0,Math.PI*2); ctx.fillStyle='#0A3D91'; ctx.fill(); ctx.lineWidth=2.4*k; ctx.strokeStyle='#fff'; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.fillText(String(i+1),x,y+.5*k); });
  ctx.restore();
}
/* --- na tela (Leaflet) --- */
const rotaLayer=L.layerGroup().addTo(map);
function atualizaRota(){
  rotaLayer.clearLayers();
  if(!rotaMapaOn()||sel.size<2||sel.size>60) return;
  const ord=rotaOrdem(selList());
  L.polyline(ord.map(o=>[o.lat,o.lon]),{color:'#0A3D91',weight:4,opacity:.9,dashArray:'10 8',interactive:false}).addTo(rotaLayer);
  ord.forEach((o,i)=>L.marker([o.lat,o.lon],{interactive:false,keyboard:false,zIndexOffset:700,icon:L.divIcon({className:'mk-wrap',iconSize:[0,0],html:`<div class="rotanum">${i+1}</div>`})}).addTo(rotaLayer));
}
$('rotaMapa').addEventListener('change',()=>{ atualizaRota(); if($('rotaMapa').checked&&sel.size<2) toast('Selecione 2 ou mais ovitrampas (ou um agente) para ver a rota.'); });
/* ===================== ANÁLISE DO GRID + KML ===================== */
const limiteCentro=()=>G?Math.round(G.s*0.375):150;
function analiseGrid(){
  if(!G) return null;
  const cel={}; pts.forEach(o=>{ const ci=celula(G,o.gx,o.gy); if(!ci.dentro) return; (cel[ci.code]||(cel[ci.code]={c:ci.c,r:ci.r,ids:[]})).ids.push(o.id); });
  const lim=limiteCentro();
  const multi=Object.keys(cel).filter(k=>cel[k].ids.length>1).sort((a,b)=>cel[a].c-cel[b].c||cel[a].r-cel[b].r);
  const longe=pts.map(o=>({o,ci:celula(G,o.gx,o.gy)})).filter(x=>x.ci.dentro&&x.ci.dist>lim).sort((a,b)=>b.ci.dist-a.ci.dist);
  const fora=pts.filter(o=>!celula(G,o.gx,o.gy).dentro);
  const lac=[];
  for(let c=0;c<G.cols;c++) for(let r=0;r<G.rows;r++){
    const code=colLabel(c)+(r+1); if(cel[code]) continue;
    let viz=0; for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){ if(!dc&&!dr) continue; const cc=c+dc, rr_=r+dr; if(cc<0||rr_<0) continue; if(cel[colLabel(cc)+(rr_+1)]) viz++; }
    if(viz>=4) lac.push({c,r,code,viz});
  }
  return {cel,multi,longe,fora,lac,lim};
}
let lacLayer=L.layerGroup();
function celaLatLngs(c,r){ const x0=G.x0+c*G.s, y0=G.y0-r*G.s; return [[glat(y0),glon(x0)],[glat(y0-G.s),glon(x0+G.s)]]; }
function desenhaLacunas(){
  lacLayer.clearLayers();
  if(!$('gdLac').checked||!G){ if(map.hasLayer(lacLayer)) map.removeLayer(lacLayer); return; }
  const a=analiseGrid(); a.lac.forEach(l=>L.rectangle(celaLatLngs(l.c,l.r),{color:'#d9480f',weight:1.5,dashArray:'5 5',fillColor:'#ff922b',fillOpacity:.22,interactive:false}).addTo(lacLayer));
  if(!map.hasLayer(lacLayer)) lacLayer.addTo(map);
}
function abreAnaliseGrid(){
  if(!G){ toast('Defina o início do grid primeiro (Camadas do mapa › Grid).'); return; }
  const a=analiseGrid(), n=Object.keys(a.cel).length;
  let h=`<p class="hint">Grade de ${G.s} m · ${G.cols}×${G.rows} quadrículas · ${n} com ovitrampa. “Longe do centro” = mais de ${a.lim} m (3/8 do lado da quadrícula).</p>`;
  h+=`<div class="tabv"><h3>Quadrículas com 2 ou mais ovitrampas (${a.multi.length})</h3>${a.multi.length?a.multi.map(k=>`<span class="cellb" data-cel="${a.cel[k].c},${a.cel[k].r}" title="Ovitrampas ${a.cel[k].ids.join(', ')}">${k}: ${a.cel[k].ids.join(', ')}</span>`).join(''):'<p class="hint">Nenhuma.</p>'}</div>`;
  h+=`<div class="tabv"><h3>Ovitrampas longe do centro da quadrícula (${a.longe.length})</h3>${a.longe.length?`<div class="tw" style="max-height:30vh"><table><thead><tr><th>ID</th><th>Endereço</th><th>Quadrícula</th><th>Distância</th></tr></thead><tbody>${a.longe.map(x=>`<tr><td><button class="idb" type="button" data-id="${x.o.id}">${x.o.id}</button></td><td>${esc(x.o.endereco)}</td><td>${x.ci.code}</td><td><b>${Math.round(x.ci.dist)} m</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Todas dentro do limite.</p>'}</div>`;
  h+=`<div class="tabv"><h3>Lacunas: quadrículas sem ovitrampa cercadas por outras (${a.lac.length})</h3>${a.lac.length?a.lac.map(l=>`<span class="cellb" data-cel="${l.c},${l.r}">${l.code}</span>`).join(''):'<p class="hint">Nenhuma lacuna interna.</p>'}<p class="hint">Considera lacuna a quadrícula vazia com 4 ou mais vizinhas ocupadas. Ligue “Destacar lacunas” para vê-las no mapa.</p></div>`;
  if(a.fora.length) h+=`<div class="tabv"><h3>Fora do grid (${a.fora.length})</h3><p>${a.fora.map(o=>o.id).join(', ')}</p></div>`;
  $('gdBody').innerHTML=h; $('gdLac').checked=map.hasLayer(lacLayer); $('gridDlg').style.display='flex'; closeMenu();
}
$('gAnalise').addEventListener('click',abreAnaliseGrid);
$('gdFechar').addEventListener('click',()=>{ $('gridDlg').style.display='none'; });
$('gdLac').addEventListener('change',desenhaLacunas);
$('gdBody').addEventListener('click',e=>{
  const ce=e.target.closest('[data-cel]'), b=e.target.closest('button[data-id]');
  if(ce){ const [c,r]=ce.dataset.cel.split(',').map(Number); $('gridDlg').style.display='none'; if(!$('gOn').checked){ $('gOn').checked=true; if(!$('gPrint').checked) $('gPrint').checked=true; gradeAtualiza(); } map.fitBounds(celaLatLngs(c,r),{padding:[40,40],maxZoom:17}); }
  else if(b){ const id=+b.dataset.id; $('gridDlg').style.display='none'; selecionaIds([id]); setTimeout(()=>byId[id].marker.openPopup(),400); }
});
function exportaKML(){
  if(!G){ toast('Defina o início do grid primeiro.'); return; }
  const a=analiseGrid(), ocup=new Set(Object.keys(a.cel)), x=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const kc=hex=>'ff'+hex.slice(5,7)+hex.slice(3,5)+hex.slice(1,3);      /* #RRGGBB -> aaBBGGRR */
  let k='<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Ovitrampas — Ponta Porã</name>\n';
  k+='<Style id="grade"><LineStyle><color>ff91510f</color><width>1.5</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>\n';
  FAIXAS_OVOS.forEach(([t,c],i)=>{ k+=`<Style id="f${i}"><IconStyle><color>${kc(c)}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>\n`; });
  k+='<Folder><name>Grid '+G.s+' m</name>\n';
  for(let c=0;c<G.cols;c++) for(let r=0;r<G.rows;r++){
    let perto=false; for(let dc=-1;dc<=1&&!perto;dc++) for(let dr=-1;dr<=1;dr++){ const cc=c+dc, rr_=r+dr; if(cc>=0&&rr_>=0&&ocup.has(colLabel(cc)+(rr_+1))){ perto=true; break; } }
    if(!perto) continue;
    const x0=G.x0+c*G.s, y0=G.y0-r*G.s, pt=[[x0,y0],[x0+G.s,y0],[x0+G.s,y0-G.s],[x0,y0-G.s],[x0,y0]].map(([px,py])=>glon(px).toFixed(7)+','+glat(py).toFixed(7)+',0').join(' ');
    k+=`<Placemark><name>${colLabel(c)+(r+1)}</name><styleUrl>#grade</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${pt}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n`;
  }
  k+='</Folder>\n<Folder><name>Ovitrampas</name>\n';
  pts.forEach(o=>{ const ag=AG_POR_ID[o.id], ci=celula(G,o.gx,o.gy);
    const desc=`${x(o.endereco)}<br/>Ovos: ${o.ovos===null?'sem contagem':o.ovos}<br/>Agente: ${x(ag?nomeAg(ag):'—')} · ${x(ag?eqTxt(ag):'')}<br/>Quadrícula: ${ci.dentro?ci.code+' ('+Math.round(ci.dist)+' m do centro)':'fora do grid'}`;
    k+=`<Placemark><name>${o.id}</name><description><![CDATA[${desc}]]></description><styleUrl>#f${bandaOvos(o.ovos)}</styleUrl><Point><coordinates>${o.lonRaw},${o.latRaw},0</coordinates></Point></Placemark>\n`; });
  k+='</Folder></Document></kml>';
  baixar('ovitrampas-grid.kml',k,'application/vnd.google-earth.kml+xml');
}
$('gKml').addEventListener('click',exportaKML);
$('gdKml').addEventListener('click',exportaKML);
/* ===================== USO SEM INTERNET (guardar mapa no aparelho) ===================== */
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
const URL_CAMADAS={ruas:[ESRI+'World_Street_Map/MapServer/tile/{z}/{y}/{x}'],sat:[ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}',ESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}']};
const lonX=(lon,z)=>Math.floor((lon+180)/360*Math.pow(2,z));
const latY=(lat,z)=>{ const r=lat*Math.PI/180; return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z)); };
function tilesDe(bb,zmin,zmax,modelos){
  const out=[];
  for(let z=zmin;z<=zmax;z++){
    const x0=lonX(bb.w,z), x1=lonX(bb.e,z), y0=latY(bb.n,z), y1=latY(bb.s,z);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) modelos.forEach(m=>out.push(m.replace('{z}',z).replace('{x}',x).replace('{y}',y)));
  }
  return out;
}
function bboxAlvo(escopo){
  if(escopo==='cidade'){ const la=pts.map(o=>o.lat), lo=pts.map(o=>o.lon); return {n:Math.max(...la)+.004,s:Math.min(...la)-.004,w:Math.min(...lo)-.004,e:Math.max(...lo)+.004}; }
  if(sel.size){ const l=selList(), la=l.map(o=>o.lat), lo=l.map(o=>o.lon); return {n:Math.max(...la)+.006,s:Math.min(...la)-.006,w:Math.min(...lo)-.006,e:Math.max(...lo)+.006}; }
  const b=map.getBounds(); return {n:b.getNorth(),s:b.getSouth(),w:b.getWest(),e:b.getEast()};
}
function modelosDe(camada){ return camada==='ruas'?URL_CAMADAS.ruas:camada==='sat'?URL_CAMADAS.sat:URL_CAMADAS.ruas.concat(URL_CAMADAS.sat); }
async function atualizaOffStatus(){
  try{ const n=await TileDB.count(); $('offStatus').textContent=n?`${n} imagens do mapa guardadas neste aparelho (≈ ${Math.round(n*20/1024)} MB). Sem internet, o mapa usa elas.`:'Nenhuma imagem do mapa guardada ainda. Tudo que você vê com internet fica guardado automaticamente.'; }
  catch(e){ $('offStatus').textContent='Este navegador não permite guardar o mapa (armazenamento bloqueado).'; }
}
let offCancel=false, offRodando=false;
async function guardaMapa(){
  if(offRodando){ offCancel=true; return; }
  const escopo=$('offEscopo').value, camada=$('offCamada').value;
  const zmin=escopo==='cidade'?12:14, zmax=escopo==='cidade'?16:18;
  const todos=tilesDe(bboxAlvo(escopo),zmin,zmax,modelosDe(camada));
  if(todos.length>4000){ toast(`São ${todos.length} imagens — escolha uma área menor (selecione um agente).`); return; }
  if(todos.length>1500&&!confirm(`Serão ${todos.length} imagens (≈ ${Math.round(todos.length*22/1024)} MB). Continuar?`)) return;
  offRodando=true; offCancel=false; $('offBaixar').textContent='Cancelar'; $('offBarW').style.display='block';
  try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  let feitos=0, falhas=0, jaTinha=0, i=0;
  const trabalha=async()=>{ while(i<todos.length&&!offCancel){ const u=todos[i++];
    try{ if(await TileDB.has(u)) jaTinha++; else await tileBlob(u); }catch(e){ falhas++; }
    feitos++; if(feitos%8===0||feitos===todos.length){ $('offBar').style.width=Math.round(feitos/todos.length*100)+'%'; $('offProg').textContent=`${feitos} de ${todos.length} imagens…`; } } };
  await Promise.all(Array.from({length:6},trabalha));
  offRodando=false; $('offBaixar').textContent='Guardar mapa no aparelho'; $('offBarW').style.display='none';
  $('offProg').textContent=(offCancel?'Cancelado. ':'Concluído. ')+`${feitos-falhas-jaTinha} novas, ${jaTinha} já estavam guardadas`+(falhas?`, ${falhas} falharam (sem internet ou bloqueio).`:'.');
  atualizaOffStatus();
}
$('offBaixar').addEventListener('click',guardaMapa);
$('offLimpar').addEventListener('click',async()=>{ if(!confirm('Apagar o mapa guardado neste aparelho?')) return; try{ await TileDB.clear(); }catch(e){} atualizaOffStatus(); toast('Mapa guardado apagado.'); });
window.addEventListener('offline',()=>toast('Sem internet: usando o mapa guardado neste aparelho.'));
window.addEventListener('online',()=>toast('Internet de volta.'));
/* o print (MapLibre) também lê do mesmo cache */
let protoOk=false;
function registraProtocolo(){
  if(protoOk||!window.maplibregl) return; protoOk=true;
  maplibregl.addProtocol('esri',async params=>{ const u='https://'+params.url.slice('esri://'.length); const r=await tileBlob(u); return {data:r.buf}; });
}
/* ===================== PUBLICAR DADOS PARA A PÁGINA DA GESTÃO (gestao.html + dados.json) ===================== */
/* ===================== PUBLICAÇÃO: pacote data/ (enderecos, agentes, anos e manifest) =====================
   Parte dos arquivos JÁ publicados (nada se perde), aplica por cima as alterações guardadas neste aparelho
   e gera um .zip com a pasta data/ para enviar ao GitHub. */
function dadosDoCampo(ano,id){
  const c=STORE.ciclo[id]; if(!c) return null;
  const a=String(ano), r={}; if(c.inst&&c.inst.startsWith(a)) r.inst=c.inst; if(c.rec&&c.rec.startsWith(a)) r.rec=c.rec;
  const h=(c.hist||[]).filter(x=>x.d.startsWith(a)).map(x=>({d:x.d,n:x.n})).sort((p,q)=>p.d.localeCompare(q.d)); if(h.length) r.hist=h;
  return Object.keys(r).length?r:null;
}
async function montaAnoParaPublicar(ano,ultimo){
  const pub=(PUB.ano&&PUB.ano.ano===ano)?PUB.ano:await Dados.ano(ano);
  const Y=pub?JSON.parse(JSON.stringify(pub)):{esquema:2,ano,meses:[],multi:{},serie:{},base:{},extras:{},campo:{},atual:{}};
  const ant=Y.meses, dic=(arr)=>{ const d={}; arr.forEach((x,i)=>{ if(x!==null&&x!==undefined) d[ant[i]]=x; }); return d; };
  const S={}; Object.keys(Y.serie).forEach(k=>{ S[k]=dic(Y.serie[k]); });
  const X={}; Object.keys(Y.extras||{}).forEach(k=>{ X[k]={base:Y.extras[k].base,v:dic(Y.extras[k].serie)}; });
  const L=STORE.serie, deste=m=>m.startsWith(String(ano)); let meses=ant.slice();
  if(L){
    meses=[...new Set(ant.concat(L.meses.filter(deste)))].sort();
    Object.keys(L.v).forEach(id=>{ const d=S[id]||(S[id]={}); Object.keys(L.v[id]).forEach(m=>{ if(deste(m)) d[m]=L.v[id][m]; }); });
    Object.keys(L.base).forEach(id=>{ Y.base[id]=L.base[id]; });
    Object.keys(L.extras).forEach(k=>{ const e=X[k]||(X[k]={base:null,v:{}}); Object.keys(L.extras[k].v).forEach(m=>{ if(deste(m)) e.v[m]=L.extras[k].v[m]; }); if(L.extras[k].base!==null) e.base=L.extras[k].base; });
    Object.keys(L.multi).forEach(m=>{ if(deste(m)) Y.multi[m]=L.multi[m]; });
  }
  const arr=(d)=>meses.map(m=>d[m]!==undefined?d[m]:null);
  Y.meses=meses;
  Y.serie={}; Object.keys(S).sort((a,b)=>a-b).forEach(k=>{ Y.serie[k]=arr(S[k]); });
  Y.extras={}; Object.keys(X).sort().forEach(k=>{ Y.extras[k]={base:X[k].base,serie:arr(X[k].v)}; });
  Y.base=Object.fromEntries(Object.keys(Y.base).sort((a,b)=>a-b).map(k=>[k,Y.base[k]]));
  Y.multi=Object.fromEntries(Object.keys(Y.multi).sort().map(k=>[k,Y.multi[k]]));
  Y.campo=Y.campo||{};
  Object.keys(STORE.ciclo).forEach(id=>{ const c=dadosDoCampo(ano,id); if(c) Y.campo[id]=c; else delete Y.campo[id]; });
  Y.atual=Y.atual||{};
  if(ultimo) Object.keys(STORE.pts).forEach(id=>{ const v=STORE.pts[id].ovos; if(v===undefined) return; const s=Y.serie[id], ult=s?[...s].reverse().find(x=>x!==null):undefined; if(ult===v) delete Y.atual[id]; else Y.atual[id]=v; });
  return Y;
}
async function montaPublicacao(opc){
  const r3=v=>Number(v).toFixed(3), tx=o=>JSON.stringify(o)+'\n', M0=PUB.manifest;
  const E0=PUB.enderecos, exMap={}; (E0.extras||[]).forEach(e=>{ exMap[e.id]=e; });
  if(STORE.serie) Object.keys(STORE.serie.extras).forEach(k=>{ const e=STORE.serie.extras[k]; if(!exMap[k]&&e.lat&&e.lon) exMap[k]={id:k,lat:e.lat,lon:e.lon}; });
  const ender={esquema:2,
    ovitrampas:pts.map(o=>({id:o.id,rua:opc.end?o.rua:'',numero:opc.end?(o.numero||''):'',lat:opc.end?o.latRaw:r3(o.lat),lon:opc.end?o.lonRaw:r3(o.lon)})),
    extras:Object.keys(exMap).sort().map(k=>({id:k,lat:opc.end?exMap[k].lat:r3(exMap[k].lat),lon:opc.end?exMap[k].lon:r3(exMap[k].lon)})),
    correcoes:CORRECOES.map(c=>({id:c.id,campo:c.campo,de:c.de,para:c.para,motivo:c.motivo,data:c.data,responsavel:c.responsavel}))};
  const agentes={esquema:2,agentes:(STORE.agentes||AGENTES_RAW).map(([zona,area,nome,ini,fim,equipe])=>({zona,area,nome:opc.nomes?nome:'',ini,fim,equipe}))};
  const anos=new Set(M0.anos); if(PUB.ano) anos.add(PUB.ano.ano);
  if(STORE.serie) STORE.serie.meses.forEach(m=>anos.add(+m.slice(0,4)));
  Object.keys(STORE.ciclo).forEach(id=>{ const c=STORE.ciclo[id]; [c.inst,c.rec].concat((c.hist||[]).map(h=>h.d)).forEach(d=>{ if(d) anos.add(+d.slice(0,4)); }); });
  const lista=[...anos].sort(), ultimo=lista[lista.length-1], arquivos={};
  const man={esquema:2,atualizado:new Date().toISOString().replace(/\.\d+Z$/,'Z'),anos:lista,ano_atual:ultimo,arquivos:JSON.parse(JSON.stringify(M0.arquivos||{}))};
  const txE=tx(ender), txA=tx(agentes); arquivos['enderecos.json']=txE; arquivos['agentes.json']=txA;
  man.arquivos.enderecos={url:'enderecos.json',v:fnv1a(txE)}; man.arquivos.agentes={url:'agentes.json',v:fnv1a(txA)};
  for(const ano of lista){
    const mudou=(PUB.ano&&PUB.ano.ano===ano)||(STORE.serie&&STORE.serie.meses.some(m=>m.startsWith(String(ano))))||Object.keys(STORE.ciclo).some(id=>dadosDoCampo(ano,id)!==null)||Object.keys(STORE.pts).some(id=>STORE.pts[id].ovos!==undefined&&ano===ultimo);
    if(!mudou&&man.arquivos[ano]) continue;
    const Y=await montaAnoParaPublicar(ano,ano===ultimo), t=tx(Y);
    arquivos[ano+'.json']=t; man.arquivos[ano]={url:ano+'.json',v:fnv1a(t),meses:Y.meses};
  }
  Object.keys(man.arquivos).forEach(k=>{ if(/^\d{4}$/.test(k)&&!lista.includes(+k)) delete man.arquivos[k]; });
  arquivos['manifest.json']=tx(man);
  return {arquivos,manifest:man};
}
$('pubAbrir').addEventListener('click',()=>{ $('pubDlg').style.display='flex'; closeMenu(); });
$('pubFechar').addEventListener('click',()=>{ $('pubDlg').style.display='none'; });
$('pubBaixar').addEventListener('click',async()=>{
  const b=$('pubBaixar'); b.disabled=true;
  try{
    await carregaLib('jszip');
    const r=await montaPublicacao({nomes:$('pubNomes').checked,end:$('pubEnd').checked});
    const zip=new JSZip(); Object.keys(r.arquivos).forEach(n=>zip.file('data/'+n,r.arquivos[n]));
    baixarArq(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),'dados-publicacao-'+iso(new Date())+'.zip');
    $('pubMsg').innerHTML='Pacote gerado: '+Object.keys(r.arquivos).map(n=>`<b>${n}</b> (${Math.max(1,Math.round(r.arquivos[n].length/1024))} KB)`).join(' · ')+'.<br>Extraia o .zip e envie a pasta <b>data</b> ao GitHub (Add file → Upload files), substituindo os arquivos.';
  }catch(e){ console.error(e); $('pubMsg').textContent='Não foi possível gerar o pacote: '+(e&&e.message||e); }
  finally{ b.disabled=false; }
});

/* texto do botão "Mapa de campo" acompanha a seleção */
function atualizaGen(){
  const b=$('gen'); if(!b) return; const ids=[...sel];
  if(!ids.length){ b.textContent='SELECIONE UM AGENTE ACIMA'; return; }
  const a=AGS.find(x=>x.lista.length===ids.length&&x.lista.every(o=>sel.has(o.id)));
  b.textContent=a?('GERAR MAPA DE CAMPO · '+nomeAg(a).toUpperCase()):('GERAR MAPA DE CAMPO · '+ids.length+' SELECIONADAS');
}

/* ===================== início ===================== */
renderSummary(); renderAgentes(); gradeAtualiza(); atualizaIndicadores(); atualizaDadosInfo(); atualizaOffStatus(); atualizaGen(); window.__modulosOk=true; refresh(false);
fitTo(pts);
