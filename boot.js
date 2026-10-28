/* boot.js — carregamento comum às duas páginas:
   · dados em arquivos (data/manifest.json + enderecos.json + agentes.json + AAAA.json), com cache por versão;
   · bibliotecas pesadas só quando necessárias (PDF, ZIP, QR, mapa vetorial);
   · service worker (funcionamento sem internet e atualização controlada). */
(function(){
  'use strict';
  const SCRIPT=document.currentScript, RAIZ=new URL('../../',SCRIPT.src).href, VERSAO='462a0c85';
  window.SITE={raiz:RAIZ,versao:VERSAO};

  /* ---- hash FNV-1a (mesmo cálculo de tools/atualizar_dados.py) ---- */
  window.fnv1a=txt=>{ const b=new TextEncoder().encode(txt); let h=0x811c9dc5; for(let i=0;i<b.length;i++){ h^=b[i]; h=Math.imul(h,0x01000193)>>>0; } return h.toString(16).padStart(8,'0'); };

  /* ---- bibliotecas sob demanda ---- */
  const LIBS={
    maplibre:{js:'assets/vendor/maplibre-gl.js',css:'assets/vendor/maplibre-gl.css',ok:()=>!!window.maplibregl},
    jspdf:{js:'assets/vendor/jspdf.umd.min.js',ok:()=>!!window.jspdf},
    jszip:{js:'assets/vendor/jszip.min.js',ok:()=>!!window.JSZip},
    qrcode:{js:'assets/vendor/qrcode.js',ok:()=>typeof window.qrcode==='function'},
    html2canvas:{js:'assets/vendor/html2canvas.min.js',ok:()=>typeof window.html2canvas==='function'}
  }, pend={};
  function script(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('Não foi possível carregar '+src)); document.head.appendChild(s); }); }
  window.carregaScript=src=>script(RAIZ+src+'?v='+VERSAO);
  window.carregaLib=nome=>{
    const L=LIBS[nome]; if(!L) return Promise.reject(new Error('biblioteca desconhecida: '+nome));
    if(L.ok()) return Promise.resolve();
    if(pend[nome]) return pend[nome];
    if(L.css&&!document.querySelector('link[data-lib="'+nome+'"]')){ const l=document.createElement('link'); l.rel='stylesheet'; l.href=RAIZ+L.css+'?v='+VERSAO; l.dataset.lib=nome; document.head.appendChild(l); }
    return pend[nome]=script(RAIZ+L.js+'?v='+VERSAO).then(()=>{ if(!L.ok()) throw new Error('biblioteca '+nome+' carregou, mas não iniciou'); }).catch(e=>{ delete pend[nome]; throw e; });
  };

  /* ---- dados: manifest sempre revalidado; arquivos versionados (?v=) ficam no cache do navegador ---- */
  const memo={};
  async function json(url,opt){ const r=await fetch(url,opt); if(!r.ok) throw new Error(url.replace(RAIZ,'')+' → HTTP '+r.status); return r.json(); }
  window.Dados={
    manifest(){ return memo.manifest||(memo.manifest=json(RAIZ+'data/manifest.json',{cache:'no-cache'}).catch(async e=>{ delete memo.manifest; throw e; })); },
    async arquivo(chave){ const m=await this.manifest(), a=m.arquivos[chave]; if(!a) return null; return memo[chave]||(memo[chave]=json(RAIZ+'data/'+a.url+'?v='+a.v).catch(e=>{ delete memo[chave]; throw e; })); },
    ano(ano){ return this.arquivo(String(ano)); },
    limpa(){ Object.keys(memo).forEach(k=>delete memo[k]); }
  };
  const ultimo=a=>{ for(let i=a.length-1;i>=0;i--) if(a[i]!==null&&a[i]!==undefined) return a[i]; return null; };
  /* estrutura usada pelo mapa de campo: [id, rua, número, lat, lon, ovos atuais] */
  window.Dados.paraApp=(m,ender,ag,ano)=>{
    const serie=ano?ano.serie:{}, atual=ano&&ano.atual?ano.atual:{};
    const raw=ender.ovitrampas.map(o=>{ const v=atual[o.id]!==undefined?atual[o.id]:(serie[o.id]?ultimo(serie[o.id]):null); return [o.id,o.rua,o.numero,o.lat,o.lon,v]; });
    return {raw,agentes:ag.agentes.map(a=>[a.zona,a.area,a.nome,a.ini,a.fim,a.equipe]),correcoes:ender.correcoes||[],pub:{manifest:m,enderecos:ender,agentes:ag,ano}};
  };

  /* ---- tela de carregamento / erro ---- */
  function aviso(titulo,texto){ const s=document.getElementById('splash'); if(!s) return; s.classList.add('erro'); s.querySelector('[data-splash-txt]').innerHTML='<b>'+titulo+'</b><br>'+texto; }
  window.splashFim=()=>{ const s=document.getElementById('splash'); if(s){ s.classList.add('fim'); setTimeout(()=>s.remove(),400); } };
  window.bootErro=e=>{ console.error(e); aviso('Não foi possível carregar os dados.',location.protocol==='file:'
    ?'Esta página precisa ser aberta pelo endereço do site (GitHub Pages) ou por um servidor local, por exemplo <code>python -m http.server</code> na pasta do projeto. Abrir o arquivo direto do disco não permite ler os dados.'
    :'Confira a conexão e tente de novo. ('+(e&&e.message||e)+')'); };

  /* ---- service worker ---- */
  if('serviceWorker' in navigator&&location.protocol!=='file:'){
    navigator.serviceWorker.register(RAIZ+'sw.js?v='+VERSAO).then(reg=>{
      reg.addEventListener('updatefound',()=>{ const n=reg.installing; if(n) n.addEventListener('statechange',()=>{ if(n.state==='installed'&&navigator.serviceWorker.controller) document.dispatchEvent(new Event('nova-versao')); }); });
    }).catch(e=>console.warn('Service worker indisponível:',e));
  }
  document.addEventListener('nova-versao',()=>{
    if(document.getElementById('banner-versao')) return;
    const b=document.createElement('div'); b.id='banner-versao'; b.setAttribute('role','status');
    b.innerHTML='<span>Há uma nova versão do sistema.</span><button type="button" class="btn btn-sm btn-primary">Atualizar agora</button>';
    b.querySelector('button').onclick=()=>location.reload(); document.body.appendChild(b);
  });

  /* ---- inicialização do mapa de campo ---- */
  if(document.body.dataset.pagina==='app'){
    (async()=>{
      try{
        const m=await Dados.manifest(), [e,a,y]=await Promise.all([Dados.arquivo('enderecos'),Dados.arquivo('agentes'),m.ano_atual?Dados.ano(m.ano_atual):null]);
        window.__BOOT=Dados.paraApp(m,e,a,y);
        await carregaScript('assets/js/app.js');
        window.splashFim();
      }catch(e){ window.bootErro(e); }
    })();
  }
})();
