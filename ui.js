/* ui.js — conjunto de ícones (traço contínuo, 24 px) e pequenos ajustes de interface comuns às páginas */
(function(){
  'use strict';
  const P={
    users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6.2 4.5 2.2 4.5 5"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    chart:'<path d="M5 20V11M12 20V4M19 20v-6"/>',
    printer:'<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    database:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    download:'<path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16"/>',
    upload:'<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 20h16"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    camera:'<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    route:'<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
    grid:'<path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/>',
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    play:'<path d="M7 4.5v15l12-7.5z"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
    file:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    alert:'<path d="M12 4l9.5 16.5H2.5z"/><path d="M12 10v4.5M12 17.5v.5"/>',
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    trend:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    back:'<path d="M19 12H5m0 0l6-6m-6 6l6 6"/>',
    share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    map:'<path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/>'
  };
  const svg=n=>'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(P[n]||'')+'</svg>';
  window.ico=n=>'<i class="i">'+svg(n)+'</i>';
  window.hidrata=function(raiz){ (raiz||document).querySelectorAll('i[data-ico]').forEach(el=>{ el.classList.add('i'); el.innerHTML=svg(el.dataset.ico); el.removeAttribute('data-ico'); }); };
  function modais(){
    document.querySelectorAll('.overlay .modal').forEach(m=>{
      if(m.querySelector('.modal-x')) return;
      const b=document.createElement('button'); b.type='button'; b.className='modal-x'; b.setAttribute('aria-label','Fechar'); b.innerHTML=svg('x');
      b.addEventListener('click',()=>{ const f=m.querySelector('[id$="Fechar"],#vclose,[id$="close"]'); if(f) f.click(); else m.closest('.overlay').style.display='none'; });
      m.appendChild(b);
    });
  }
  function iniciar(){ window.hidrata(); modais(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar); else iniciar();
})();
