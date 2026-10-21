/*
async function loadHome() {
  try {
    const data = await apiGet('/services');
    const services = data?.services || data || [];
    renderFeatured(services.slice(0, 6));

    const plans = await apiGet('/payments/plans').catch(()=>({plans:[]}));
    renderPlans(plans?.plans || plans || []);
  } catch (e) {
    window.toast?.('bad','Lỗi','Không tải được dữ liệu trang chủ.');
  }
}

function renderFeatured(list) {
  const wrap = document.getElementById('featuredServices');
  if (!wrap) return;

  const iconFor = (name='') => {
    const n = String(name).toLowerCase();
    if (n.includes('da')) return '✨';
    if (n.includes('massage')) return '💆';
    if (n.includes('triệt') || n.includes('long')) return '🫧';
    if (n.includes('nail') || n.includes('móng')) return '💅';
    if (n.includes('tóc') || n.includes('hair')) return '💇';
    return '🌿';
  };

  wrap.innerHTML = (list || []).map(s => {
    const name = window.escapeHtml?.(s.name) ?? s.name;
    const desc = window.escapeHtml?.(s.description || 'Dịch vụ nổi bật') ?? 'Dịch vụ nổi bật';
    const price = Number(s.price || 0).toLocaleString('vi-VN');
    return `
      <article class="svc-card hover">
        <div class="svc-head">
          <div class="svc-icon" aria-hidden="true">${iconFor(s.name)}</div>
          <div class="svc-meta">
            <h3 class="svc-title">${name}</h3>
            <p class="svc-desc">${desc}</p>
          </div>
          <div class="svc-price">${price} đ</div>
        </div>
        <div class="svc-actions">
          <button class="btn primary js-go-book" data-id="${Number(s.id)}">Đặt lịch</button>
          <a class="btn ghost" href="/user/services.html">Xem chi tiết</a>
        </div>
      </article>
    `;
  }).join('');

  wrap.querySelectorAll('.js-go-book').forEach(btn => {
    btn.addEventListener('click', () => {
      const svc = (list || []).find(x => Number(x.id) === Number(btn.dataset.id));
      if (!svc) return;

      // require login
      const u = localStorage.getItem('user');
      if (!u) {
        localStorage.setItem('next', '/user/services.html');
        window.location.href = '/login.html';
        return;
      }
      localStorage.setItem('booking_service', JSON.stringify(svc));
      window.location.href = '/user/booking.html';
    });
  });
}

function renderPlans(plans){
  // Backward compatible: some versions use #featuredPlans
  const wrap = document.getElementById('homePlans') || document.getElementById('featuredPlans');
  if(!wrap) return;
  const list = (plans||[]).filter(Boolean);
  if(!list.length){
    wrap.innerHTML = `<div class="muted">Chưa có gói hội viên để hiển thị.</div>`;
    return;
  }

  const tierLabel = (t)=>{
    const s = String(t||'').toLowerCase();
    if(s==='premium') return {txt:'Premium', badge:'good'};
    if(s==='gold') return {txt:'Vàng', badge:'primary'};
    return {txt:'Bạc', badge:'warn'};
  };

  wrap.innerHTML = list.map(p=>{
    const tl = tierLabel(p.tier || p.code);
    const days = Number(p.duration_days||30);
    const months = Math.round(days/30);
    const durationText = months >= 12 ? `${Math.round(months/12)} năm` : `${months} tháng`;
    const name = window.escapeHtml?.(p.name || p.code) ?? (p.name||p.code);
    const priceText = `${Number(p.price||0).toLocaleString('vi-VN')} đ`;

    return `
    <article class="card hover plan-card">
      <div class="plan-head">
        <div>
          <h3 class="plan-title">${name}</h3>
          <div class="plan-meta">
            <span class="badge soft">${tl.txt}</span>
            <span class="badge soft">${durationText}</span>
          </div>
        </div>
        <div class="badge plan-price">${priceText}</div>
      </div>

      <ul class="plan-feats">
        <li>Giảm giá tự động theo hạng khi thanh toán</li>
        <li>Ưu tiên khung giờ đẹp & xác nhận nhanh</li>
        <li>Tặng voucher định kỳ cho khách quay lại</li>
      </ul>

      <div class="plan-actions">
        <a class="btn primary" href="/user/membership.html">Xem & mua gói</a>
        <a class="btn ghost" href="#faq">Hỏi đáp</a>
      </div>
    </article>
    `;
  }).join('');
}

// If logged in, change "Đăng nhập" to "Vào tài khoản"
document.addEventListener('DOMContentLoaded', () => {
  try{
    const u = localStorage.getItem('user');
    if(u){
      const nav = document.getElementById('navLoginBtn');
      const btn = document.getElementById('homeLoginBtn');
      if(nav){ nav.textContent='Tài khoản'; nav.href='/dashboard.html'; }
      if(btn){ btn.textContent='Tài khoản'; btn.href='/dashboard.html'; }
    } else {
      // remember next for unauth
      const explore = document.getElementById('homeExploreBtn');
      if(explore){
        explore.addEventListener('click', (e)=>{
          // guard.js will redirect anyway, but keep nicer UX
          localStorage.setItem('next', '/user/services.html');
        });
      }
    }
  } catch(e){}
});

document.addEventListener('DOMContentLoaded', loadHome);
*/

function serviceImageUrl(service) {
  return String(service?.image_url || '/assets/services/default-service.svg');
}

function requireLoginThenRedirect(service) {
  const user = localStorage.getItem('user');
  if (!user) {
    localStorage.setItem('next', '/user/services.html');
    window.location.href = '/login.html';
    return;
  }
  localStorage.setItem('booking_service', JSON.stringify(service));
  window.location.href = '/user/booking.html';
}

async function loadHome() {
  try {
    const data = await apiGet('/services');
    const services = data?.services || data || [];
    renderFeatured(services.slice(0, 6));

    const plans = await apiGet('/payments/plans').catch(() => ({ plans: [] }));
    renderPlans(plans?.plans || plans || []);
  } catch (error) {
    window.toast?.('bad', 'Lỗi', 'Không tải được dữ liệu trang chủ.');
  }
}

function renderFeatured(list) {
  const wrap = document.getElementById('featuredServices');
  if (!wrap) return;

  wrap.innerHTML = (list || [])
    .map((service) => {
      const name = window.escapeHtml?.(service.name) ?? service.name;
      const description =
        window.escapeHtml?.(service.description || 'Liệu trình nổi bật của BeautyCare.') ??
        'Liệu trình nổi bật của BeautyCare.';
      const price = Number(service.price || 0).toLocaleString('vi-VN');
      const image = serviceImageUrl(service);

      return `
        <article class="svc-card hover svc-card--photo">
          <div class="svc-cover">
            <img src="${escapeHtml(image)}" alt="${name}" loading="lazy">
          </div>
          <div class="svc-head">
            <div class="svc-meta">
              <h3 class="svc-title">${name}</h3>
              <p class="svc-desc">${description}</p>
            </div>
            <div class="svc-price">${price} đ</div>
          </div>
          <div class="svc-actions">
            <button class="btn primary js-go-book" data-id="${Number(service.id)}">Đặt lịch</button>
            <a class="btn ghost" href="/user/service-detail.html?id=${Number(service.id)}">Xem chi tiết</a>
          </div>
        </article>
      `;
    })
    .join('');

  wrap.querySelectorAll('.js-go-book').forEach((button) => {
    button.addEventListener('click', () => {
      const service = (list || []).find((item) => Number(item.id) === Number(button.dataset.id));
      if (!service) return;
      requireLoginThenRedirect(service);
    });
  });
}

function renderPlans(plans) {
  const wrap = document.getElementById('homePlans') || document.getElementById('featuredPlans');
  if (!wrap) return;

  const list = (plans || []).filter(Boolean);
  if (!list.length) {
    wrap.innerHTML = '<div class="muted">Chưa có gói hội viên để hiển thị.</div>';
    return;
  }

  const tierLabel = (tier) => {
    const value = String(tier || '').toLowerCase();
    if (value === 'premium') return { txt: 'Premium', badge: 'good' };
    if (value === 'gold') return { txt: 'Vàng', badge: 'primary' };
    return { txt: 'Bạc', badge: 'warn' };
  };

  wrap.innerHTML = list
    .map((plan) => {
      const tier = tierLabel(plan.tier || plan.code);
      const days = Number(plan.duration_days || 30);
      const months = Math.max(1, Math.round(days / 30));
      const durationText = months >= 12 ? `${Math.round(months / 12)} năm` : `${months} tháng`;
      const rawName = plan.name || plan.code;
      const name = window.escapeHtml?.(rawName) ?? rawName;
      const priceText = `${Number(plan.price || 0).toLocaleString('vi-VN')} đ`;

      return `
        <article class="card hover plan-card">
          <div class="plan-head">
            <div>
              <h3 class="plan-title">${name}</h3>
              <div class="plan-meta">
                <span class="badge soft">${tier.txt}</span>
                <span class="badge soft">${durationText}</span>
              </div>
            </div>
            <div class="badge plan-price">${priceText}</div>
          </div>

          <ul class="plan-feats">
            <li>Giảm giá tự động theo hạng khi thanh toán</li>
            <li>Ưu tiên khung giờ đẹp và xác nhận nhanh</li>
            <li>Tặng voucher định kỳ cho khách quay lại</li>
          </ul>

          <div class="plan-actions">
            <a class="btn primary" href="/user/membership.html">Xem và mua gói</a>
            <a class="btn ghost" href="#faq">Xem hỏi đáp</a>
          </div>
        </article>
      `;
    })
    .join('');
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    const user = localStorage.getItem('user');
    if (user) {
      const navButton = document.getElementById('navLoginBtn');
      const homeButton = document.getElementById('homeLoginBtn');
      if (navButton) {
        navButton.textContent = 'Tài khoản';
        navButton.href = '/user/profile.html';
      }
      if (homeButton) {
        homeButton.textContent = 'Tài khoản';
        homeButton.href = '/user/profile.html';
      }
    } else {
      const exploreButton = document.getElementById('homeExploreBtn');
      if (exploreButton) {
        exploreButton.addEventListener('click', () => {
          localStorage.setItem('next', '/user/services.html');
        });
      }
    }
  } catch (_) {}
});

document.addEventListener('DOMContentLoaded', loadHome);
