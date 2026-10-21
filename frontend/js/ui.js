(function(){
  // ===== helpers =====
  window.getUser = function(){
    try{ return JSON.parse(localStorage.getItem('user') || 'null'); }catch(e){ return null; }
  }
  window.formatVND = function(n){
    const num = Number(n || 0);
    try{
      return num.toLocaleString('vi-VN') + ' ₫';
    }catch(e){
      return String(num) + ' ₫';
    }
  }
  window.formatDateTime = function(iso){
    if(!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString('vi-VN');
  }

  // ===== toast =====
  const zone = document.createElement('div');
  zone.className = 'toast-zone';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(zone));

  window.toast = function(type, title, message, timeout=2600){
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.innerHTML = `
      <div class="dot"></div>
      <div style="flex:1;min-width:0">
        <b>${window.escapeHtml(title || '')}</b>
        <p>${window.escapeHtml(message || '')}</p>
      </div>
    `;
    zone.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; }, timeout);
    setTimeout(()=>{ t.remove(); }, timeout + 350);
  }

  // ===== modal =====
  window.openModal = function(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.add('open');
  }
  window.closeModal = function(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.remove('open');
  }

  // close modal on backdrop click
  document.addEventListener('click', (e)=>{
    const closeBtn = e.target?.closest?.('.js-close-modal');
    if(closeBtn){
      const target = closeBtn.getAttribute('data-modal') || closeBtn.closest('.modal-backdrop')?.id;
      if(target) closeModal(target);
      return;
    }

    const back = e.target?.closest?.('.modal-backdrop');
    if(back && e.target === back){
      back.classList.remove('open');
    }
  });

  // ===== nav active =====
  window.markActiveNav = function(){
    const path = location.pathname.split('/').pop();
    document.querySelectorAll('[data-nav]').forEach(a=>{
      const target = a.getAttribute('data-nav');
      if(!target) return;
      if(target === path) a.classList.add('active');
    });
  }

  // ===== topbar user =====
  window.renderTopbarUser = function(){
    const u = getUser();
    const nameEl = document.getElementById('topbarUserName');
    const roleEl = document.getElementById('topbarRole');
    const memberEl = document.getElementById('topbarMember');

    if(nameEl) nameEl.textContent = u?.name || u?.email || 'Khách';
    if(roleEl){
      if(u?.role === 'admin') roleEl.textContent = 'Admin';
      else roleEl.textContent = 'User';
    }
    if(memberEl){
      const mRaw = (u?.member || 'silver').toLowerCase();
      const mapText = { silver: 'Bạc', gold: 'Vàng', premium: 'Premium' };
      const text = mapText[mRaw] || u?.member || 'Bạc';
      memberEl.textContent = text;

      memberEl.classList.remove('good','warn','primary','bad');
      if(mRaw === 'silver') memberEl.classList.add('warn');
      else if(mRaw === 'gold') memberEl.classList.add('primary');
      else if(mRaw === 'premium') memberEl.classList.add('good');
      else memberEl.classList.add('primary');
    }
  }

  window.escapeHtml = function(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    markActiveNav();
    renderTopbarUser();
  });
})();
