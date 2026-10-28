/* gestao.js — painel da gestão (somente leitura). Dados vêm de data/*.json via boot.js. */

const FAIXAS=[['0 ovos','#73d7ff'],['1–20 ovos','#c0ff80'],['21–50 ovos','#ffff00'],['51–100 ovos','#f98404'],['101+ ovos','#ff0000'],['Sem informação','#800080']];
const COR_EQ={1:'#007ECA',2:'#00A651',3:'#C98A00',4:'#E0182D'};
const $=id=>document.getElementById(id);
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const banda=v=>(v===null||v===undefined)?5:v<=0?0:v<=20?1:v<=50?2:v<=100?3:4;
const corOvos=v=>FAIXAS[banda(v)][1];
const fPct=x=>x===null||x===undefined?'—':x.toFixed(1).replace('.',',')+'%';
const fNum=x=>x===null||x===undefined?'—':String(Math.round(x*10)/10).replace('.',',');
const parseISO=s=>{ const [y,m,d]=String(s).split('-').map(Number); return new Date(y,m-1,d); };
function semEpi(s){ const d=parseISO(s), sab=new Date(d); sab.setDate(d.getDate()+(6-d.getDay())); const qua=new Date(sab); qua.setDate(sab.getDate()-3);
  const ano=qua.getFullYear(), j4=new Date(ano,0,4), ini=new Date(j4); ini.setDate(j4.getDate()-j4.getDay()); const dom=new Date(sab); dom.setDate(sab.getDate()-6);
  return {ano,sem:Math.round((dom-ini)/(7*864e5))+1}; }
const PART=['de','da','do','dos','das','e'];
const titulo=t=>String(t||'').toLowerCase().split(' ').map((w,i)=>/^(i|ii|iii|iv|v)$/.test(w)?w.toUpperCase():w==='p.p.'?'P.P.':(i>0&&PART.includes(w))?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const _ini=0; let D=null, PTS=[], AGS=[], POR_ID={}, filtro=null, ordem={k:'ovos',d:-1}, mapa=null, camada=null;

function prepara(){
  PTS=D.ovitrampas.map(o=>{ const h=(o.hist||[]).filter(x=>x&&x.d&&isFinite(x.n)).sort((a,b)=>a.d.localeCompare(b.d));
    const ov=h.length?h[h.length-1].n:(o.ovos===undefined?null:o.ovos);
    return {id:o.id,rua:o.rua||'',numero:o.numero||'',end:o.rua?(o.rua+(o.numero&&!/^[—–-]+$/.test(o.numero)?', '+o.numero:'')):'',lat:parseFloat(o.lat),lon:parseFloat(o.lon),ovos:ov,hist:h,inst:o.inst||'',rec:o.rec||''}; });
  const byId={}; PTS.forEach(o=>byId[o.id]=o);
  AGS=D.agentes.map(([zona,area,nome,ini,fim,equipe])=>({zona,area:area?titulo(area):'',nome:nome||'',ini,fim,equipe,lista:PTS.filter(o=>o.id>=ini&&o.id<=fim)}));
  POR_ID={}; AGS.forEach(a=>a.lista.forEach(o=>POR_ID[o.id]=a));
  preparaSerie();
}
const nomeAg=a=>a.nome||('Zona '+a.zona), eqTxt=a=>a.equipe?'Equipe '+a.equipe:'Sem equipe';
function indic(l){ const r={n:l.length,com:0,pos:0,ovos:0,b:[0,0,0,0,0,0]}; l.forEach(o=>{ r.b[banda(o.ovos)]++; if(o.ovos!==null&&o.ovos!==undefined){ r.com++; r.ovos+=o.ovos; if(o.ovos>0) r.pos++; } }); r.ipo=r.com?100*r.pos/r.com:null; r.imo=r.pos?r.ovos/r.pos:null; return r; }
const agFil=()=>AGS.filter(a=>filtro===null||(filtro===0?!a.equipe:a.equipe===filtro));
const ptsFil=()=>agFil().flatMap(a=>a.lista);

function chips(){
  const eqs=[...new Set(AGS.map(a=>a.equipe).filter(Boolean))].sort();
  $('chips').innerHTML=[`<button class="chip ${filtro===null?'on':''}" data-f="">Todas</button>`].concat(eqs.map(e=>`<button class="chip ${filtro===e?'on':''}" data-f="${e}" style="${filtro===e?'':'border-color:'+COR_EQ[e]}">Equipe ${e}</button>`)).concat(AGS.some(a=>!a.equipe)?[`<button class="chip ${filtro===0?'on':''}" data-f="0">Sem equipe</button>`]:[]).join(' ');
}
function kpis(l){ const r=indic(l);
  $('kpis').innerHTML=[[fPct(r.ipo),'IPO'],[fNum(r.imo),'IDO · ovos por positiva'],[fNum(r.com?r.ovos/r.com:null),'IDV · ovos por ovitrampa'],[r.pos+' de '+r.com,'Positivas / com contagem'],[r.ovos,'Total de ovos'],[r.n-r.com,'Sem contagem']].map(([v,t])=>`<div class="kpi"><b>${v}</b><span>${t}</span></div>`).join('');
  const mx=Math.max(1,...r.b);
  $('dist').innerHTML=FAIXAS.map(([t,c],i)=>`<div class="bandbar"><i style="background:${c};width:${Math.max(2,Math.round(r.b[i]/mx*50))}%"></i><span><b>${r.b[i]}</b> · ${t}</span></div>`).join('');
}
function mapaRender(l){
  if(!mapa){
    mapa=L.map('mapa',{scrollWheelZoom:false});
    const ruas=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Mapa © Esri, HERE, Garmin, OpenStreetMap'});
    const sat=L.layerGroup([L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagens © Esri, Maxar'}),L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,opacity:.9})]);
    ruas.addTo(mapa); L.control.layers({'Ruas':ruas,'Satélite':sat},null,{collapsed:true}).addTo(mapa); camada=L.layerGroup().addTo(mapa);
    mapa.on('click',()=>mapa.scrollWheelZoom.enable());
  }
  camada.clearLayers(); const ll=[];
  l.slice().sort((a,b)=>(a.ovos||0)-(b.ovos||0)).forEach(o=>{ if(!isFinite(o.lat)||!isFinite(o.lon)) return; ll.push([o.lat,o.lon]);
    const a=POR_ID[o.id], h=o.hist.slice(-4).reverse();
    L.circleMarker([o.lat,o.lon],{radius:8,color:'#111',weight:2,fillColor:corOvos(o.ovos),fillOpacity:.95})
      .bindPopup(`<b>Ovitrampa ${o.id}</b>${o.end?'<br>'+esc(o.end):''}<br>Ovos: <b>${o.ovos===null?'sem contagem':o.ovos}</b>${a?`<br>${esc(nomeAg(a))} · ${esc(eqTxt(a))}<br>${esc(a.area)}`:''}${h.length?'<br><small>'+h.map(x=>x.d.split('-').reverse().join('/')+': '+x.n).join(' · ')+'</small>':''}`).addTo(camada); });
  if(ll.length) mapa.fitBounds(ll,{padding:[30,30],maxZoom:17}); setTimeout(()=>mapa.invalidateSize(),50);
  $('leg').innerHTML=FAIXAS.map(([t,c])=>`<span><i style="background:${c}"></i>${t}</span>`).join('');
}
function tabelaEquipes(){
  const chaves=[...new Set(AGS.map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  const linhas=chaves.map(k=>{ const ags=AGS.filter(a=>(a.equipe||0)===k), l=ags.flatMap(a=>a.lista), r=indic(l); return {k,ags,r,nome:k?'Equipe '+k:'Sem equipe'}; });
  const g=indic(AGS.flatMap(a=>a.lista));
  $('eqTab').innerHTML=`<table><thead><tr><th>Equipe</th><th class="n">Agentes</th><th class="n">Ovitrampas</th><th class="n">Com contagem</th><th class="n">Positivas</th><th class="n">IPO</th><th class="n">Ovos</th><th class="n">IDO</th></tr></thead><tbody>${linhas.map(x=>`<tr><td><b style="color:${x.k?COR_EQ[x.k]:'#587079'}">● ${x.nome}</b></td><td class="n">${x.ags.length}</td><td class="n">${x.r.n}</td><td class="n">${x.r.com}</td><td class="n">${x.r.pos}</td><td class="n">${fPct(x.r.ipo)}</td><td class="n"><b>${x.r.ovos}</b></td><td class="n">${fNum(x.r.imo)}</td></tr>`).join('')}<tr style="background:#dce9f5;font-weight:800"><td>Total</td><td class="n">${AGS.length}</td><td class="n">${g.n}</td><td class="n">${g.com}</td><td class="n">${g.pos}</td><td class="n">${fPct(g.ipo)}</td><td class="n">${g.ovos}</td><td class="n">${fNum(g.imo)}</td></tr></tbody></table>`;
}
function tabelaAgentes(){
  const k=ordem.k, d=ordem.d;
  const l=agFil().map(a=>({a,i:indic(a.lista)}));
  const val={zona:x=>x.a.zona,nome:x=>(x.a.nome||'~').toLowerCase(),area:x=>x.a.area.toLowerCase(),ovit:x=>x.i.n,pos:x=>x.i.pos,ipo:x=>x.i.ipo===null?-1:x.i.ipo,ovos:x=>x.i.ovos,imo:x=>x.i.imo===null?-1:x.i.imo}[k];
  l.sort((x,y)=>{ const a=val(x), b=val(y); return (a<b?-1:a>b?1:x.a.zona-y.a.zona)*d; });
  const th=(c,t,n)=>`<th class="${n?'n':''}"><button data-k="${c}" type="button">${t}${k===c?(d>0?' ▲':' ▼'):''}</button></th>`;
  $('agTab').innerHTML=`<table><thead><tr>${th('zona','Zona',1)}${th('nome','Agente')}${th('area','Área')}<th>Equipe</th>${th('ovit','Ovit.',1)}${th('pos','Positivas',1)}${th('ipo','IPO',1)}${th('ovos','Ovos',1)}${th('imo','IDO',1)}</tr></thead><tbody>${l.map(({a,i})=>`<tr><td class="n">${a.zona}</td><td>${esc(nomeAg(a))}</td><td>${esc(a.area||'—')}</td><td>${esc(eqTxt(a))}</td><td class="n">${i.n}</td><td class="n">${i.pos}</td><td class="n">${fPct(i.ipo)}</td><td class="n"><b>${i.ovos}</b></td><td class="n">${fNum(i.imo)}</td></tr>`).join('')}</tbody></table>`;
}
function criticos(l){
  const c=l.filter(o=>o.ovos>0).sort((a,b)=>b.ovos-a.ovos||a.id-b.id).slice(0,25);
  $('crit').innerHTML=c.length?`<table><thead><tr><th>ID</th>${D.identificado&&D.identificado.enderecos===false?'':'<th>Endereço</th>'}<th>Agente</th><th>Equipe</th><th class="n">Ovos</th></tr></thead><tbody>${c.map(o=>{ const a=POR_ID[o.id]; return `<tr><td><span class="pill">${o.id}</span></td>${D.identificado&&D.identificado.enderecos===false?'':`<td>${esc(o.end||'—')}</td>`}<td>${esc(a?nomeAg(a):'—')}</td><td>${esc(a?eqTxt(a):'—')}</td><td class="n"><span class="ch" style="background:${corOvos(o.ovos)}"></span><b>${o.ovos}</b></td></tr>`; }).join('')}</tbody></table>`:'<p style="padding:14px;margin:0">Nenhuma ovitrampa positiva.</p>';
}
function evolucao(l){
  const m={}; l.forEach(o=>o.hist.forEach(h=>{ const s=semEpi(h.d), k=s.ano+'-'+String(s.sem).padStart(2,'0'); const e=m[k]||(m[k]={ano:s.ano,sem:s.sem,n:0,pos:0,ovos:0}); e.n++; e.ovos+=h.n; if(h.n>0) e.pos++; }));
  const ks=Object.keys(m).sort().map(k=>m[k]);
  if(!ks.length){ $('evo').innerHTML='<div class="cx"><p class="nota" style="margin:0">Ainda não há registros semanais. Quando os agentes registrarem as contagens no aplicativo e os dados forem publicados, a evolução por semana epidemiológica aparece aqui.</p></div>'; return; }
  const W=720,H=130,bw=W/ks.length, mx=Math.max(1,...ks.map(e=>e.ovos));
  $('evo').innerHTML=`<div class="cx"><svg viewBox="0 0 ${W} ${H+30}" width="100%" role="img" aria-label="Total de ovos por semana epidemiológica">${ks.map((e,i)=>{ const h=Math.max(2,e.ovos/mx*H); return `<rect x="${i*bw+8}" y="${H-h}" width="${bw-16}" height="${h}" rx="5" fill="#007ECA"/><text x="${i*bw+bw/2}" y="${H-h-5}" font-size="13" font-weight="800" text-anchor="middle" fill="#002B68">${e.ovos}</text><text x="${i*bw+bw/2}" y="${H+18}" font-size="12" text-anchor="middle" fill="#5B7391">SE ${e.sem}</text>`; }).join('')}</svg>
  <div class="tw" style="margin-top:10px"><table><thead><tr><th>Semana epidemiológica</th><th class="n">Contagens</th><th class="n">Positivas</th><th class="n">IPO</th><th class="n">Ovos</th><th class="n">IDO</th></tr></thead><tbody>${ks.map(e=>`<tr><td>SE ${e.sem}/${e.ano}</td><td class="n">${e.n}</td><td class="n">${e.pos}</td><td class="n">${fPct(100*e.pos/e.n)}</td><td class="n"><b>${e.ovos}</b></td><td class="n">${fNum(e.pos?e.ovos/e.pos:null)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function cardsEquipes(){
  const chaves=[...new Set(agFil().map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  $('eqCards').innerHTML=chaves.map(k=>{ const ags=agFil().filter(a=>(a.equipe||0)===k), l=ags.flatMap(a=>a.lista), r=indic(l), cor=k?COR_EQ[k]:'#587079';
    return `<div class="eqcard"><header style="background:${cor}"><span>${k?'Equipe '+k:'Sem equipe'}</span><span>${ags.length} agentes · ${r.n} ovitrampas</span></header><div class="corpo"><div class="mini">${[[fPct(r.ipo),'IPO'],[fNum(r.imo),'IDO'],[r.pos+'/'+r.com,'Positivas'],[r.ovos,'Total de ovos']].map(([v,t])=>`<div><b>${v}</b><span>${t}</span></div>`).join('')}</div>
    <div class="tw"><table><thead><tr><th class="n">Zona</th><th>Agente</th><th>Área</th><th class="n">Ovit.</th><th class="n">Posit.</th><th class="n">IPO</th><th class="n">Ovos</th><th class="n">IDO</th></tr></thead><tbody>${ags.slice().sort((a,b)=>a.zona-b.zona).map(a=>{ const i=indic(a.lista); return `<tr><td class="n">${a.zona}</td><td>${esc(nomeAg(a))}</td><td>${esc(a.area||'—')}</td><td class="n">${i.n}</td><td class="n">${i.pos}</td><td class="n">${fPct(i.ipo)}</td><td class="n"><b>${i.ovos}</b></td><td class="n">${fNum(i.imo)}</td></tr>`; }).join('')}</tbody></table></div></div></div>`; }).join('');
}
function render(){
  const l=ptsFil(); chips(); kpis(l); mapaRender(l); tabelaEquipes(); tabelaAgentes(); criticos(l); evolucao(l); cardsEquipes();
  if(aba==='mensal') mensalRender(); if(aba==='focos') focosRender();
  const q=D.gerado?new Date(D.gerado).toLocaleString('pt-BR'):null;
  $('atual').textContent=q?'Dados de '+q:'';
  $('rod').innerHTML=`<b>IPO</b> = ovitrampas positivas (com 1 ovo ou mais) ÷ ovitrampas com contagem. <b>IDO</b> = total de ovos ÷ ovitrampas positivas. <b>IDV</b> = total de ovos ÷ ovitrampas com contagem. Ovitrampas sem contagem não entram nos cálculos.<br>Fonte: arquivos de dados publicados em ${q||'—'}${D.ano?' · ano '+D.ano:''} · Gerado em ${new Date().toLocaleString('pt-BR')}.`;
  $('aviso').innerHTML='';
  updUrl();
}
let ENDER=null, AGEN=null, MAN=null, anoSel=null;
/* monta o objeto D (formato usado pelas telas) a partir dos arquivos data/: endereços + agentes + um ano */
function montaD(m,ender,ag,Y){
  const serie=(Y&&Y.serie)||{}, campo=(Y&&Y.campo)||{}, atual=(Y&&Y.atual)||{};
  const ult=a=>{ for(let i=a.length-1;i>=0;i--) if(a[i]!==null&&a[i]!==undefined) return a[i]; return null; };
  const ovitrampas=ender.ovitrampas.map(o=>{ const c=campo[o.id]||{}; const v=atual[o.id]!==undefined?atual[o.id]:(serie[o.id]?ult(serie[o.id]):null);
    return {id:o.id,rua:o.rua,numero:o.numero,lat:o.lat,lon:o.lon,ovos:v,inst:c.inst,rec:c.rec,hist:c.hist||[]}; });
  const extras=(Y&&Y.extras)?Object.keys(Y.extras).map(k=>{ const e=(ender.extras||[]).find(x=>x.id===k)||{}; return {id:k,lat:e.lat,lon:e.lon,base:Y.extras[k].base,serie:Y.extras[k].serie}; }):[];
  return {gerado:m.atualizado,identificado:{nomes:ag.agentes.some(a=>a.nome),enderecos:ender.ovitrampas.some(o=>o.rua)},ovitrampas,
    agentes:ag.agentes.map(a=>[a.zona,a.area,a.nome,a.ini,a.fim,a.equipe]),meses:Y?Y.meses:[],serie,base:Y?Y.base:{},multi:Y?Y.multi:{},extras,ano:Y?Y.ano:null,anos:m.anos};
}
function seletorAno(){
  const s=$('selAno'); if(!s) return;
  s.innerHTML=(MAN.anos||[]).slice().reverse().map(a=>`<option value="${a}" ${a===anoSel?'selected':''}>${a}</option>`).join('');
  s.parentElement.style.display=(MAN.anos||[]).length>1?'inline-flex':'none';
}
async function carrega(novoAno){
  try{
    MAN=await Dados.manifest(); ENDER=await Dados.arquivo('enderecos'); AGEN=await Dados.arquivo('agentes');
    anoSel=novoAno||anoSel||MAN.ano_atual;
    const Y=anoSel?await Dados.ano(anoSel):null;
    D=montaD(MAN,ENDER,AGEN,Y); D._fonte='dados.json';
  }catch(e){ window.bootErro(e); return; }
  if(window.splashFim) window.splashFim();
  seletorAno(); prepara(); render();
}
function mostraAba(a){
  aba=a; ['resumo','mensal','focos'].forEach(t=>{ $('tab-'+t).classList.toggle('off',t!==a); });
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===a));
  if(a==='mensal') mensalRender(); else if(timer){ clearInterval(timer); timer=null; }
  if(a==='focos') focosRender();
  if(a==='resumo') setTimeout(()=>mapa&&mapa.invalidateSize(),60);
  updUrl();
}
function updUrl(){ try{ const u=new URL(location.href); filtro===null?u.searchParams.delete('equipe'):u.searchParams.set('equipe',filtro); aba==='resumo'?u.searchParams.delete('aba'):u.searchParams.set('aba',aba); (aba==='mensal'&&MESES.length)?u.searchParams.set('mes',MESES[mesSel]):u.searchParams.delete('mes'); history.replaceState(null,'',u); }catch(e){} }
function imprime(tudo){
  const atual=aba;
  const depois=()=>{ setTimeout(()=>{ mapa&&mapa.invalidateSize(); mapaM&&mapaM.invalidateSize(); setTimeout(()=>window.print(),500); },150); };
  window.onafterprint=()=>{ window.onafterprint=null; mostraAba(atual); };
  if(tudo){ ['resumo','mensal','focos'].forEach(t=>$('tab-'+t).classList.remove('off')); aba='mensal'; mensalRender(); focosRender(); }
  depois();
}
document.addEventListener('click',e=>{
  const c=e.target.closest('.chip[data-f]'); if(c){ filtro=c.dataset.f===''?null:+c.dataset.f; render(); return; }
  const tb=e.target.closest('#tabs button'); if(tb){ mostraAba(tb.dataset.t); return; }
  const hm=e.target.closest('[data-heat]'); if(hm){ metHeat=hm.dataset.heat; if(timer){ clearInterval(timer); timer=null; } mensalRender(); return; }
  const mm=e.target.closest('[data-m]'); if(mm&&aba==='mensal'){ mesSel=+mm.dataset.m; if(timer){ clearInterval(timer); timer=null; } atualizaMes(false); return; }
  const b=e.target.closest('th button[data-k]'); if(b){ const k=b.dataset.k; ordem=ordem.k===k?{k,d:-ordem.d}:{k,d:(k==='nome'||k==='area'||k==='zona')?1:-1}; tabelaAgentes(); }
});
document.addEventListener('input',e=>{ if(e.target.id==='kRng'){ kFoco=+e.target.value; focosRender(); const r=$('kRng'); if(r){ r.focus(); } } });
$('btnImp').addEventListener('click',()=>imprime(false));
$('btnImpTudo').addEventListener('click',()=>imprime(true));
$('btnRec').addEventListener('click',()=>{ Dados.limpa(); carrega(); });
if($('selAno')) $('selAno').addEventListener('change',e=>{ mesInit=false; Dados.limpa(); carrega(+e.target.value); });
/* ===================== ANÁLISE MENSAL E FOCOS (série do ano) ===================== */
const MES_PT=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MES_LONGO=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const rotMes=m=>MES_PT[+m.slice(5,7)-1]+'/'+m.slice(2,4);
const nomeMes=m=>MES_LONGO[+m.slice(5,7)-1]+' de '+m.slice(0,4);
let mesInit=false, MESES=[], SERIE={}, BASE={}, EXTRAS=[], MULTI={}, mesSel=0, aba='resumo', mapaM=null, camM=null, extM=null, timer=null, kFoco=6, metHeat='ipo';
const temSerie=()=>MESES.length>0;
function preparaSerie(){
  MESES=D.meses||[]; SERIE=D.serie||{}; BASE=D.base||{}; MULTI=D.multi||{};
  EXTRAS=(D.extras||[]).map(e=>({id:e.id,lat:parseFloat(e.lat),lon:parseFloat(e.lon),base:e.base,serie:e.serie||[],ovos:(e.serie||[]).length?e.serie[e.serie.length-1]:null}));
  if(!mesInit&&MESES.length){ mesSel=MESES.length-1; mesInit=true; }
  if(mesSel>=MESES.length||mesSel<0) mesSel=Math.max(0,MESES.length-1);
}
const vMes=(o,i)=>{ const a=SERIE[o.id]; return (a&&a[i]!==undefined)?a[i]:null; };
function metMes(l,i){
  let n=0,pos=0,ov=0,bs=0;
  l.forEach(o=>{ const v=vMes(o,i); if(v===null) return; n++; ov+=v; if(v>0) pos++; if(BASE[o.id]!==undefined) bs+=BASE[o.id]; });
  return {n,pos,ov,ipo:n?100*pos/n:null,ido:pos?ov/pos:null,idv:n?ov/n:null,rel:bs?ov/bs:null};
}
const fOv=x=>x===null||x===undefined?'—':(Math.round(x*10)/10).toLocaleString('pt-BR');
const fDelta=(a,b,pp)=>{ if(a===null||b===null||a===undefined||b===undefined) return '—'; const d=a-b; const t=pp?(d>=0?'+':'')+d.toFixed(1).replace('.',',')+' p.p.':(b?((d>=0?'+':'')+(100*d/b).toFixed(1).replace('.',',')+'%'):'—'); return `<span class="${d>0?'sobe':d<0?'desce':''}">${d>0?'▲':d<0?'▼':'■'} ${t}</span>`; };
const corMes=i=>i===mesSel?'#002B68':'#007ECA';

/* ---- gráficos em SVG ---- */
function svgBarras(vals,fmt,cor,h){
  h=h||140; const n=vals.length, W=720, bw=W/n, mx=Math.max(1e-9,...vals.filter(v=>v!==null));
  return `<svg viewBox="0 0 ${W} ${h+34}" width="100%" role="img">${vals.map((v,i)=>{ const hh=v===null?0:Math.max(2,v/mx*h);
    return `<g class="mb" data-m="${i}" style="cursor:pointer"><rect x="${i*bw}" y="0" width="${bw}" height="${h+34}" fill="transparent"/><rect x="${i*bw+9}" y="${h-hh+16}" width="${bw-18}" height="${hh}" rx="5" fill="${i===mesSel?'#002B68':cor}"/><text x="${i*bw+bw/2}" y="${h-hh+11}" font-size="12.5" font-weight="800" text-anchor="middle" fill="#002B68">${v===null?'—':fmt(v)}</text><text x="${i*bw+bw/2}" y="${h+31}" font-size="12.5" font-weight="${i===mesSel?800:500}" text-anchor="middle" fill="${i===mesSel?'#002B68':'#5B7391'}">${rotMes(MESES[i])}</text></g>`; }).join('')}</svg>`;
}
function svgLinhas(series,h){
  h=h||150; const n=MESES.length, W=720, bw=W/n, all=series.flatMap(s=>s.vals.filter(v=>v!==null)), mx=Math.max(1e-9,...all);
  const X=i=>i*bw+bw/2, Y=v=>h-(v/mx)*h+14;
  return `<svg viewBox="0 0 ${W} ${h+36}" width="100%" role="img">${[0,.5,1].map(t=>`<line x1="0" x2="${W}" y1="${Y(mx*t)}" y2="${Y(mx*t)}" stroke="#E1EAF3"/>`).join('')}
  ${series.map(s=>{ const pts=s.vals.map((v,i)=>v===null?null:[X(i),Y(v)]).filter(Boolean); return `<polyline fill="none" stroke="${s.cor}" stroke-width="3.5" stroke-linejoin="round" points="${pts.map(p=>p.join(',')).join(' ')}"/>`+s.vals.map((v,i)=>v===null?'':`<circle cx="${X(i)}" cy="${Y(v)}" r="${i===mesSel?6:3.8}" fill="${s.cor}" stroke="#fff" stroke-width="2"/>`+((i===mesSel||i===n-1)?`<text x="${X(i)}" y="${Y(v)-10}" font-size="12.5" font-weight="800" text-anchor="middle" fill="${s.cor}">${fOv(v)}</text>`:'')).join(''); }).join('')}
  ${MESES.map((m,i)=>`<g class="mb" data-m="${i}" style="cursor:pointer"><rect x="${i*bw}" y="${h+18}" width="${bw}" height="22" fill="transparent"/><text x="${X(i)}" y="${h+32}" font-size="12.5" font-weight="${i===mesSel?800:500}" text-anchor="middle" fill="${i===mesSel?'#002B68':'#5B7391'}">${rotMes(m)}</text></g>`).join('')}</svg>`;
}
function spark(vals,w,h){
  w=w||110; h=h||24; const mx=Math.max(1,...vals.filter(v=>v!==null)), bw=w/vals.length;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle">${vals.map((v,i)=>v===null?`<line x1="${i*bw+2}" x2="${i*bw+bw-2}" y1="${h-1}" y2="${h-1}" stroke="#C5D6E8" stroke-width="2"/>`:`<rect x="${i*bw+1}" y="${h-Math.max(2,v/mx*h)}" width="${bw-2}" height="${Math.max(2,v/mx*h)}" fill="${corOvos(v)}" stroke="#222" stroke-width=".8"/>`).join('')}</svg>`;
}
const mixC=(a,b,t)=>{ const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)); const x=p(a),y=p(b); return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join(''); };
const escala=t=>t<=.5?mixC('#EAF3FB','#FFD166',t*2):mixC('#FFD166','#E5383B',(t-.5)*2);

/* ---- aba Análise mensal ---- */
function mensalRender(){
  const box=$('tab-mensal');
  if(!temSerie()){ box.innerHTML='<div class="cx"><h2>Análise mensal</h2><p>Ainda não há série mensal publicada. No mapa de campo: <b>Dados e conferência → Importar planilha ou backup</b> (planilha “contaovos-contagens”), depois <b>Publicar dados para a gestão</b> e envie o dados.json ao GitHub.</p></div>'; return; }
  const l=ptsFil(), n=MESES.length, M=MESES.map((_,i)=>metMes(l,i)), a=M[mesSel], ant=mesSel>0?M[mesSel-1]:null;
  const chipsM=`<div class="filtros noprint">${MESES.map((m,i)=>`<button class="chip ${i===mesSel?'on':''}" data-m="${i}">${rotMes(m)}</button>`).join(' ')}<button class="chip" id="btnPlay" type="button">${timer?'⏸ Parar':'▶ Animar'}</button></div>`;
  const kp=[[fPct(a.ipo),'IPO',ant?fDelta(a.ipo,ant.ipo,true):''],[fOv(a.ido),'IDO (ovos por positiva)',ant?fDelta(a.ido,ant.ido):''],[fOv(a.idv),'IDV (ovos por ovitrampa)',ant?fDelta(a.idv,ant.idv):''],[a.pos+' de '+a.n,'Positivas / ovitrampas',''],[fOv(a.ov),'Total de ovos',ant?fDelta(a.ov,ant.ov):''],[a.rel===null?'—':Math.round(a.rel*100)+'%','Em relação à média histórica','']];
  let h=`<h2>Análise de ${nomeMes(MESES[mesSel])}</h2>${chipsM}
  <div class="kpis">${kp.map(([v,t,d])=>`<div class="kpi"><b>${v}</b><span>${t}</span><small>${d||'&nbsp;'}</small></div>`).join('')}</div>`;
  if(MULTI[MESES[mesSel]]) h+=`<div class="aviso">Em ${nomeMes(MESES[mesSel])} cada ovitrampa teve ${MULTI[MESES[mesSel]]} leituras. Os números usam a <b>média</b> das leituras do mês.</div>`;
  h+=`<section><h2>Insights do período</h2><div class="cx"><ul class="ins">${insights(M).map(x=>`<li>${x}</li>`).join('')}</ul></div></section>`;
  h+=`<section class="duas3"><div class="cx"><h3>IPO por mês (%)</h3>${svgBarras(M.map(x=>x.ipo),v=>v.toFixed(0)+'%','#007ECA')}</div><div class="cx"><h3>Média de ovos: IDO e IDV</h3>${svgLinhas([{nome:'IDO',cor:'#E0182D',vals:M.map(x=>x.ido)},{nome:'IDV',cor:'#00A651',vals:M.map(x=>x.idv)}])}<div class="leg"><span><i style="background:#E0182D"></i>IDO · ovos por ovitrampa positiva</span><span><i style="background:#00A651"></i>IDV · ovos por ovitrampa</span></div></div></section>`;
  h+=`<section class="duas3"><div class="cx"><h3>Total de ovos por mês</h3>${svgBarras(M.map(x=>x.ov),v=>Math.round(v).toLocaleString('pt-BR'),'#FFB900')}</div><div class="cx"><h3>Comparação com a média histórica</h3>${svgLinhas([{nome:'rel',cor:'#7B2CBF',vals:M.map(x=>x.rel===null?null:x.rel*100)}])}<p class="nota">100% = o mesmo nível da média histórica de cada ovitrampa. Acima de 100%: mais ovos que o habitual.</p></div></section>`;
  h+=`<section><h2>Mês a mês</h2><div class="tw"><table><thead><tr><th>Mês</th><th class="n">Ovitrampas</th><th class="n">Positivas</th><th class="n">IPO</th><th class="n">Δ IPO</th><th class="n">Ovos</th><th class="n">Δ ovos</th><th class="n">IDO</th><th class="n">IDV</th><th class="n">vs histórico</th></tr></thead><tbody>${M.map((x,i)=>`<tr class="${i===mesSel?'sel':''}" data-m="${i}" style="cursor:pointer"><td><b>${nomeMes(MESES[i]).split(' de ')[0]}</b>${MULTI[MESES[i]]?' <small title="média de 2 leituras">*</small>':''}</td><td class="n">${x.n}</td><td class="n">${x.pos}</td><td class="n">${fPct(x.ipo)}</td><td class="n">${i?fDelta(x.ipo,M[i-1].ipo,true):'—'}</td><td class="n"><b>${Math.round(x.ov).toLocaleString('pt-BR')}</b></td><td class="n">${i?fDelta(x.ov,M[i-1].ov):'—'}</td><td class="n">${fOv(x.ido)}</td><td class="n">${fOv(x.idv)}</td><td class="n">${x.rel===null?'—':Math.round(x.rel*100)+'%'}</td></tr>`).join('')}</tbody></table></div>${Object.keys(MULTI).length?'<p class="nota">* Mês com mais de uma leitura por ovitrampa: usa-se a média das leituras.</p>':''}</section>`;
  h+=`<section><h2>Mapa do mês</h2><div class="cx"><div class="noprint" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><input type="range" id="rng" min="0" max="${n-1}" value="${mesSel}" style="flex:1;min-width:180px"><b id="rngTxt">${nomeMes(MESES[mesSel])}</b><label style="font-weight:700;font-size:13px"><input type="checkbox" id="chkExtras" ${$('chkExtras')&&!$('chkExtras').checked?'':'checked'}> pontos estratégicos</label></div><div id="mapaM"></div><div class="leg">${FAIXAS.map(([t,c])=>`<span><i style="background:${c}"></i>${t}</span>`).join('')}<span><i style="background:#fff;border-radius:3px;transform:rotate(45deg)"></i>ponto estratégico/extra</span></div></div></section>`;
  h+=`<section><h2>Mapa de calor: equipes e áreas por mês</h2><div class="filtros noprint"><b style="color:var(--navy)">Métrica:</b> ${[['ipo','IPO %'],['idv','IDV · ovos por ovitrampa'],['ov','Total de ovos']].map(([k,t])=>`<button class="chip ${metHeat===k?'on':''}" data-heat="${k}">${t}</button>`).join(' ')}</div><div class="tw" style="max-height:620px" id="heat">${heatHtml()}</div></section>`;
  h+=`<section><h2>Quem mais mudou em ${rotMes(MESES[mesSel])}</h2>${variacaoHtml()}</section>`;
  box.innerHTML=h; mapaMensal();
}
function insights(M){
  const v=(f)=>M.map(f), idx=(arr,fn)=>arr.reduce((b,x,i)=>x!==null&&(b<0||fn(x,arr[b]))?i:b,-1);
  const ipo=v(x=>x.ipo), idv=v(x=>x.idv), out=[];
  const pk=idx(ipo,(a,b)=>a>b), vl=idx(ipo,(a,b)=>a<b), pkd=idx(idv,(a,b)=>a>b), vld=idx(idv,(a,b)=>a<b), u=M.length-1;
  out.push(`<b>Positividade:</b> pico em ${nomeMes(MESES[pk]).split(' de ')[0]} (${fPct(ipo[pk])}) e menor valor em ${nomeMes(MESES[vl]).split(' de ')[0]} (${fPct(ipo[vl])}).`);
  out.push(`<b>Densidade de ovos (IDV):</b> máxima em ${nomeMes(MESES[pkd]).split(' de ')[0]} (${fOv(idv[pkd])} ovos por ovitrampa) e mínima em ${nomeMes(MESES[vld]).split(' de ')[0]} (${fOv(idv[vld])}).`);
  if(u>0){ const d=ipo[u]-ipo[u-1], dd=idv[u]-idv[u-1]; out.push(`<b>Último mês (${rotMes(MESES[u])}):</b> IPO ${fPct(ipo[u])} (${d>=0?'+':''}${d.toFixed(1).replace('.',',')} p.p. vs ${rotMes(MESES[u-1])}) e IDV ${fOv(idv[u])} (${dd>=0?'+':''}${fOv(dd)}). ${d>0&&dd>0?'Os dois indicadores subiram.':d<0&&dd<0?'Os dois indicadores caíram.':'Os indicadores se moveram em sentidos diferentes.'}`); }
  const l=ptsFil(), est=l.map(o=>({o,s:SERIE[o.id]||[]})).filter(x=>x.s.length);
  const pers=est.filter(x=>x.s.filter(y=>y!==null&&y>0).length>=6).length;
  if(est.length) out.push(`<b>Focos persistentes:</b> ${pers} ovitrampa(s) ficaram positivas em 6 ou mais meses (ver aba “Focos e alertas”).`);
  const ac=l.filter(o=>BASE[o.id]!==undefined&&vMes(o,u)!==null&&vMes(o,u)>BASE[o.id]);
  out.push(`<b>Acima do habitual:</b> ${ac.length} de ${l.filter(o=>vMes(o,u)!==null).length} ovitrampas estão acima da própria média histórica em ${rotMes(MESES[u])}.`);
  const eq=[...new Set(AGS.map(a=>a.equipe).filter(Boolean))].sort().map(e=>({e,m:metMes(AGS.filter(a=>a.equipe===e).flatMap(a=>a.lista),u)})).filter(x=>x.m.ipo!==null).sort((a,b)=>b.m.ipo-a.m.ipo);
  if(filtro===null&&eq.length>1) out.push(`<b>Equipes em ${rotMes(MESES[u])}:</b> maior IPO na Equipe ${eq[0].e} (${fPct(eq[0].m.ipo)}); menor na Equipe ${eq[eq.length-1].e} (${fPct(eq[eq.length-1].m.ipo)}).`);
  return out;
}
function heatHtml(){
  const linhas=[]; const eqs=[...new Set(agFil().map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  const val=(lst,i)=>{ const m=metMes(lst,i); return metHeat==='ipo'?m.ipo:metHeat==='idv'?m.idv:(m.n?m.ov:null); };
  eqs.forEach(k=>{ const ags=agFil().filter(a=>(a.equipe||0)===k); linhas.push({tit:true,nome:k?'Equipe '+k:'Sem equipe',cor:k?COR_EQ[k]:'#587079',v:MESES.map((_,i)=>val(ags.flatMap(a=>a.lista),i))});
    ags.slice().sort((a,b)=>a.zona-b.zona).forEach(a=>linhas.push({nome:`${a.zona} · ${nomeAg(a)} · ${a.area||'—'}`,v:MESES.map((_,i)=>val(a.lista,i))})); });
  const mxA=Math.max(1e-9,...linhas.filter(x=>!x.tit).flatMap(x=>x.v.filter(y=>y!==null))), mxE=Math.max(1e-9,...linhas.filter(x=>x.tit).flatMap(x=>x.v.filter(y=>y!==null)));
  const fmt=v=>v===null?'—':metHeat==='ipo'?v.toFixed(0)+'%':Math.round(v).toLocaleString('pt-BR');
  return `<table class="heat"><thead><tr><th style="min-width:230px">Equipe / agente · área</th>${MESES.map((m,i)=>`<th class="n ${i===mesSel?'selc':''}" data-m="${i}" style="cursor:pointer">${rotMes(m)}</th>`).join('')}</tr></thead><tbody>${linhas.map(r=>`<tr class="${r.tit?'tit':''}"><td style="${r.tit?'font-weight:800;color:'+r.cor:''}">${r.tit?'● ':''}${esc(r.nome)}</td>${r.v.map((x,i)=>{ const mx=r.tit?mxE:mxA, t=x===null?0:Math.min(1,x/mx); return `<td class="n ${i===mesSel?'selc':''}" style="background:${x===null?'#f7f7f7':escala(t)};color:${t>.8?'#fff':'#0f2a33'}">${fmt(x)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
function variacaoHtml(){
  if(mesSel===0) return '<p class="nota">Selecione um mês depois do primeiro para comparar com o anterior.</p>';
  const rows=agFil().map(a=>{ const x=metMes(a.lista,mesSel), y=metMes(a.lista,mesSel-1); return {a,x,y,d:x.ov-y.ov}; }).filter(r=>r.x.n&&r.y.n);
  const sobe=rows.filter(r=>r.d>0).sort((p,q)=>q.d-p.d).slice(0,8), desce=rows.filter(r=>r.d<0).sort((p,q)=>p.d-q.d).slice(0,8);
  const tb=(t,l,cor)=>`<div><h3 style="color:${cor}">${t}</h3><div class="tw"><table><thead><tr><th>Agente · área</th><th class="n">${rotMes(MESES[mesSel-1])}</th><th class="n">${rotMes(MESES[mesSel])}</th><th class="n">Δ ovos</th></tr></thead><tbody>${l.length?l.map(r=>`<tr><td>${esc(nomeAg(r.a))} · ${esc(r.a.area||'—')}<br><small>${esc(eqTxt(r.a))}</small></td><td class="n">${fOv(r.y.ov)}</td><td class="n">${fOv(r.x.ov)}</td><td class="n"><b style="color:${cor}">${r.d>0?'+':''}${fOv(r.d)}</b></td></tr>`).join(''):'<tr><td colspan="4">Nenhuma.</td></tr>'}</tbody></table></div></div>`;
  return `<div class="duas2">${tb('Mais subiram (ovos)',sobe,'#C62828')}${tb('Mais caíram (ovos)',desce,'#0a7a2f')}</div>`;
}
function mapaMensal(){
  const el=$('mapaM'); if(!el) return;
  if(mapaM){ mapaM.remove(); mapaM=null; }
  mapaM=L.map('mapaM',{scrollWheelZoom:false});
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Mapa © Esri, HERE, Garmin, OpenStreetMap'}).addTo(mapaM);
  camM=L.layerGroup().addTo(mapaM); extM=L.layerGroup().addTo(mapaM);
  mapaMesPontos(true);
  $('rng').addEventListener('input',e=>{ mesSel=+e.target.value; atualizaMes(false); });
  $('chkExtras').addEventListener('change',()=>mapaMesPontos(false));
  const b=$('btnPlay'); if(b) b.onclick=()=>{ if(timer){ clearInterval(timer); timer=null; b.textContent='▶ Animar'; return; } b.textContent='⏸ Parar'; timer=setInterval(()=>{ mesSel=(mesSel+1)%MESES.length; atualizaMes(false); if(mesSel===MESES.length-1){ clearInterval(timer); timer=null; const bb=$('btnPlay'); if(bb) bb.textContent='▶ Animar'; } },1300); };
  setTimeout(()=>mapaM&&mapaM.invalidateSize(),60);
}
function mapaMesPontos(ajusta){
  if(!mapaM) return; camM.clearLayers(); extM.clearLayers(); const ll=[], i=mesSel;
  ptsFil().filter(o=>vMes(o,i)!==null&&isFinite(o.lat)).sort((a,b)=>vMes(a,i)-vMes(b,i)).forEach(o=>{ const v=vMes(o,i), a=POR_ID[o.id]; ll.push([o.lat,o.lon]);
    L.circleMarker([o.lat,o.lon],{radius:8,color:'#111',weight:2,fillColor:corOvos(v),fillOpacity:.95}).bindPopup(`<b>Ovitrampa ${o.id}</b>${o.end?'<br>'+esc(o.end):''}<br>${rotMes(MESES[i])}: <b>${fOv(v)} ovos</b>${BASE[o.id]!==undefined?`<br>Média histórica: ${BASE[o.id]}`:''}${a?`<br>${esc(nomeAg(a))} · ${esc(eqTxt(a))}`:''}<br>${spark(SERIE[o.id]||[],150,28)}<br><small>${MESES.map(rotMes).join(' · ')}</small>`).addTo(camM); });
  if($('chkExtras')&&$('chkExtras').checked&&i===MESES.length-1) EXTRAS.filter(e=>e.serie[i]!==null&&e.serie[i]!==undefined&&isFinite(e.lat)).forEach(e=>{ const v=e.serie[i];
    L.marker([e.lat,e.lon],{icon:L.divIcon({className:'',iconSize:[16,16],html:`<div style="width:14px;height:14px;transform:rotate(45deg);background:${corOvos(v)};border:2px solid #111"></div>`})}).bindPopup(`<b>Ponto ${esc(e.id)}</b><br>${rotMes(MESES[i])}: <b>${fOv(v)} ovos</b>${e.base!==null?`<br>Média histórica: ${e.base}`:''}`).addTo(extM); ll.push([e.lat,e.lon]); });
  if(ajusta&&ll.length) mapaM.fitBounds(ll,{padding:[30,30],maxZoom:17});
}
function atualizaMes(refazTudo){ if(aba==='mensal'){ if(refazTudo){ mensalRender(); } else { const keep=mapaM?mapaM.getBounds():null; const r=$('rng'); const s=document.scrollingElement.scrollTop; mensalRender(); if(keep&&mapaM) mapaM.fitBounds(keep); document.scrollingElement.scrollTop=s; } } updUrl(); }

/* ---- aba Focos e alertas ---- */
function focosRender(){
  const box=$('tab-focos');
  if(!temSerie()){ box.innerHTML='<div class="cx"><h2>Focos e alertas</h2><p>Disponível quando a série mensal for publicada (veja a aba “Análise mensal”).</p></div>'; return; }
  const l=ptsFil(), u=MESES.length-1;
  const est=l.map(o=>{ const s=SERIE[o.id]||[], lei=s.filter(x=>x!==null&&x!==undefined).length, pos=s.filter(x=>x!==null&&x>0).length, tot=s.reduce((t,x)=>t+(x||0),0); let mx=-1,mi=-1; s.forEach((x,i)=>{ if(x!==null&&x>mx){ mx=x; mi=i; } }); return {o,s,lei,pos,tot,mx,mi}; }).filter(x=>x.lei);
  const pers=est.filter(x=>x.pos>=kFoco).sort((a,b)=>b.pos-a.pos||b.tot-a.tot);
  const rank=est.slice().sort((a,b)=>b.tot-a.tot).slice(0,15);
  const picos=est.filter(x=>x.mx>=300).sort((a,b)=>b.mx-a.mx);
  const acima=est.filter(x=>BASE[x.o.id]!==undefined&&x.s[u]!==null&&x.s[u]!==undefined&&x.s[u]>BASE[x.o.id]&&BASE[x.o.id]>=0).map(x=>({...x,r:BASE[x.o.id]?x.s[u]/BASE[x.o.id]:null})).sort((a,b)=>(b.s[u]-BASE[b.o.id])-(a.s[u]-BASE[a.o.id])).slice(0,12);
  const novas=est.filter(x=>x.lei===1&&x.s[u]!==null&&x.s[u]!==undefined);
  const dist=[...Array(MESES.length+1)].map((_,k)=>est.filter(x=>x.pos===k).length);
  const mid=x=>`<span class="pill">${x.o.id}</span>`, endc=x=>esc(x.o.end||'—'), ag=x=>{ const a=POR_ID[x.o.id]; return a?esc(nomeAg(a))+' · '+esc(eqTxt(a)):'—'; };
  const semEnd=D.identificado&&D.identificado.enderecos===false;
  let h=`<h2>Focos e alertas</h2>
  <section><div class="cx"><h3>Ovitrampas positivas em quantos meses?</h3><div class="bandbars">${dist.map((c,k)=>`<div class="bandbar"><i style="background:${k>=kFoco?'#E0182D':'#007ECA'};width:${Math.max(2,Math.round(c/Math.max(1,...dist)*55))}%"></i><span><b>${c}</b> · ${k} ${k===1?'mês':'meses'}</span></div>`).join('')}</div></div></section>
  <section><h2>Focos persistentes</h2><div class="filtros noprint"><label style="font-weight:700">Positivas em pelo menos <b id="kTxt">${kFoco}</b> meses <input type="range" id="kRng" min="2" max="${MESES.length}" value="${kFoco}" style="vertical-align:middle"></label></div>
  <div class="tw">${pers.length?`<table><thead><tr><th>ID</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">Meses +</th><th class="n">Ovos no ano</th><th>${MESES.map(rotMes)[0]} → ${rotMes(MESES[u])}</th><th class="n">Pico</th></tr></thead><tbody>${pers.map(x=>`<tr><td>${mid(x)}</td>${semEnd?'':`<td>${endc(x)}</td>`}<td>${ag(x)}</td><td class="n"><b>${x.pos}</b>/${x.lei}</td><td class="n">${fOv(x.tot)}</td><td>${spark(x.s)}</td><td class="n">${fOv(x.mx)} <small>(${rotMes(MESES[x.mi])})</small></td></tr>`).join('')}</tbody></table>`:'<p style="padding:14px;margin:0">Nenhuma ovitrampa com esse critério.</p>'}</div><p class="nota">${pers.length} ovitrampa(s). Ovitrampas que seguem positivas mês após mês indicam criadouros próximos que merecem inspeção.</p></section>
  <section><h2>Ranking do ano: mais ovos acumulados</h2><div class="tw"><table><thead><tr><th>ID</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">Ovos no ano</th><th class="n">Meses +</th><th>Evolução</th></tr></thead><tbody>${rank.map(x=>`<tr><td>${mid(x)}</td>${semEnd?'':`<td>${endc(x)}</td>`}<td>${ag(x)}</td><td class="n"><b>${fOv(x.tot)}</b></td><td class="n">${x.pos}/${x.lei}</td><td>${spark(x.s)}</td></tr>`).join('')}</tbody></table></div></section>
  <section><h2>Acima da própria média histórica em ${rotMes(MESES[u])}</h2><div class="tw">${acima.length?`<table><thead><tr><th>ID</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">${rotMes(MESES[u])}</th><th class="n">Média histórica</th><th class="n">Razão</th></tr></thead><tbody>${acima.map(x=>`<tr><td>${mid(x)}</td>${semEnd?'':`<td>${endc(x)}</td>`}<td>${ag(x)}</td><td class="n"><b>${fOv(x.s[u])}</b></td><td class="n">${BASE[x.o.id]}</td><td class="n">${x.r===null?'—':x.r.toFixed(1).replace('.',',')+'×'}</td></tr>`).join('')}</tbody></table>`:'<p style="padding:14px;margin:0">Nenhuma ovitrampa acima da média histórica.</p>'}</div></section>
  <section><h2>Contagens muito altas para conferir (300 ovos ou mais)</h2><div class="tw">${picos.length?`<table><thead><tr><th>ID</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">Maior contagem</th><th>Mês</th><th class="n">Média histórica</th></tr></thead><tbody>${picos.map(x=>`<tr><td>${mid(x)}</td>${semEnd?'':`<td>${endc(x)}</td>`}<td>${ag(x)}</td><td class="n"><b>${fOv(x.mx)}</b></td><td>${rotMes(MESES[x.mi])}</td><td class="n">${BASE[x.o.id]===undefined?'—':BASE[x.o.id]}</td></tr>`).join('')}</tbody></table>`:'<p style="padding:14px;margin:0">Nenhuma.</p>'}</div><p class="nota">Valores extremos podem ser reais, mas vale conferir a leitura e o preenchimento.</p></section>`;
  const ex=EXTRAS.filter(e=>e.ovos!==null&&e.ovos!==undefined), exPos=ex.filter(e=>e.ovos>0), mm=metMes(l,u);
  h+=`<section><h2>Pontos estratégicos e outros pontos (${rotMes(MESES[u])})</h2><div class="cx">${ex.length?`<p><b>${ex.length}</b> pontos extras, <b>${exPos.length}</b> positivos (IPO ${fPct(100*exPos.length/ex.length)}), ${fOv(ex.reduce((t,e)=>t+e.ovos,0))} ovos no total. Na malha de ovitrampas no mesmo mês: IPO ${fPct(mm.ipo)}.</p><div class="tw" style="max-height:340px"><table><thead><tr><th>Ponto</th><th class="n">Ovos</th><th class="n">Média histórica</th><th>Local</th></tr></thead><tbody>${ex.slice().sort((a,b)=>b.ovos-a.ovos).map(e=>`<tr><td><b>${esc(e.id)}</b></td><td class="n">${fOv(e.ovos)}</td><td class="n">${e.base===null?'—':e.base}</td><td>${isFinite(e.lat)?`<a href="https://www.google.com/maps?q=${e.lat},${e.lon}" target="_blank" rel="noopener">mapa</a>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p>Sem pontos extras.</p>'}<p class="nota">Esses pontos aparecem só no último mês e não entram nos indicadores mensais da malha, para não quebrar a comparação entre os meses.</p></div></section>`;
  h+=`<section><h2>Qualidade dos dados</h2><div class="cx"><ul class="ins"><li><b>${novas.length}</b> ovitrampa(s) entraram só em ${rotMes(MESES[u])} e ainda não têm histórico${novas.length&&novas.every(x=>x.tot===0)?' (todas com 0 ovos)':''}.</li>${Object.keys(MULTI).map(m=>`<li>${nomeMes(m)}: ${MULTI[m]} leituras por ovitrampa. A análise usa a média; somar os registros dobraria os ovos e levaria o IPO acima de 100%.</li>`).join('')}${est.filter(x=>x.lei<MESES.length&&x.lei>1).length?`<li>${est.filter(x=>x.lei<MESES.length&&x.lei>1).length} ovitrampa(s) com leituras em apenas parte dos meses.</li>`:''}</ul></div></section>`;
  box.innerHTML=h;
}

try{ const q=new URL(location.href).searchParams; const p=q.get('equipe'); if(p!==null&&p!=='') filtro=+p; const ab=q.get('aba'); if(ab==='mensal'||ab==='focos') aba=ab; window.__mesParam=q.get('mes'); }catch(e){}
async function iniciar(){ await carrega(); if(window.__mesParam&&MESES.indexOf(window.__mesParam)>=0) mesSel=MESES.indexOf(window.__mesParam); if(aba!=='resumo') mostraAba(aba); }
iniciar();
