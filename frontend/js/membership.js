let _membershipPlans = [];
let _membershipMe = null;

function tierBadge(tier) {
  const t = String(tier || '').toLowerCase();
  if (t === 'premium') return { label: 'Premium', badge: 'good' };
  if (t === 'gold') return { label: 'Vàng', badge: 'primary' };
  return { label: 'Bạc', badge: 'warn' };
}

function currentSubscription() {
  return _membershipMe?.subscription || null;
}

function currentPlanCode() {
  return String(currentSubscription()?.plan?.code || '').trim().toLowerCase();
}

function currentPlanPrice() {
  return Number(currentSubscription()?.plan?.price || 0);
}

function renderMembershipHeroNote() {
  const hero = document.getElementById('membershipHeroNote');
  if (!hero) return;

  const sub = currentSubscription();
  if (!sub?.plan) {
    hero.innerHTML = `
      <div class="small muted">
        Chọn gói thành viên để kích hoạt ưu đãi theo hạng khi thanh toán dịch vụ.
      </div>
    `;
    return;
  }

  const plan = sub.plan;
  const diffRule = 'Nếu gói mới cao hơn, bạn chỉ thanh toán phần chênh lệch. Nếu bằng hoặc thấp hơn, hệ thống đổi ngay và không hoàn phần dư.';
  hero.innerHTML = `
    <div class="small muted">
      Gói hiện tại: <b>${escapeHtml(plan.name || plan.code || 'Gói thành viên')}</b>
      · Hết hạn: <b>${escapeHtml(sub.end_at ? formatDateTime(sub.end_at) : 'Chưa xác định')}</b>
    </div>
    <div class="small muted" style="margin-top:6px">${diffRule}</div>
  `;
}

function planActionMeta(plan) {
  const activeCode = currentPlanCode();
  const activeSub = currentSubscription();
  if (!activeSub?.plan) {
    return { text: 'Mua gói', disabled: false, kind: 'buy', hint: '' };
  }

  if (String(plan.code || '').trim().toLowerCase() === activeCode) {
    return { text: 'Gói hiện tại', disabled: true, kind: 'current', hint: 'Bạn đang sử dụng gói này.' };
  }

  const diff = Number(plan.price || 0) - currentPlanPrice();
  if (diff > 0) {
    return {
      text: 'Đổi gói',
      disabled: false,
      kind: 'change-pay',
      hint: `Thanh toán thêm ${formatVND(diff)} để chuyển sang gói này.`
    };
  }

  if (diff === 0) {
    return {
      text: 'Đổi gói',
      disabled: false,
      kind: 'change-free',
      hint: 'Đổi gói ngay, không cần thanh toán thêm.'
    };
  }

  return {
    text: 'Đổi gói',
    disabled: false,
    kind: 'change-credit',
    hint: 'Đổi gói ngay, phần chênh lệch dư sẽ không được hoàn lại.'
  };
}

function planDetailMeta(plan) {
  const action = planActionMeta(plan);
  const activeSub = currentSubscription();
  const activePlan = activeSub?.plan || null;
  const diff = Number(plan.price || 0) - currentPlanPrice();

  if (!activePlan) {
    return {
      title: 'Thông tin gói',
      summary: 'Bạn chưa có gói thành viên đang hoạt động.',
      compare: `Khi mua gói này, hệ thống sẽ tạo thanh toán ${formatVND(Number(plan.price || 0))}.`
    };
  }

  if (String(plan.code || '').trim().toLowerCase() === currentPlanCode()) {
    return {
      title: 'Gói hiện tại',
      summary: `Bạn đang sử dụng ${activePlan.name || activePlan.code}.`,
      compare: activeSub?.end_at
        ? `Gói này đang hiệu lực đến ${formatDateTime(activeSub.end_at)}.`
        : 'Gói này đang hoạt động trên tài khoản của bạn.'
    };
  }

  if (diff > 0) {
    return {
      title: 'Đổi gói có thanh toán thêm',
      summary: `Chuyển từ ${activePlan.name || activePlan.code} sang ${plan.name || plan.code}.`,
      compare: `Bạn cần thanh toán thêm ${formatVND(diff)} để hoàn tất đổi gói.`
    };
  }

  if (diff === 0) {
    return {
      title: 'Đổi gói ngay',
      summary: `Hai gói có cùng mức giá ${formatVND(Number(plan.price || 0))}.`,
      compare: 'Hệ thống sẽ đổi sang gói mới ngay mà không cần thanh toán thêm.'
    };
  }

  return {
    title: 'Đổi gói ngay',
    summary: `Gói mới thấp hơn gói hiện tại ${formatVND(Math.abs(diff))}.`,
    compare: 'Hệ thống sẽ đổi sang gói mới ngay, phần chênh lệch dư không được hoàn lại.'
  };
}

function setMembershipDetailText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

function fillPlanDetail(planCode) {
  const plan = _membershipPlans.find((item) => String(item.code) === String(planCode));
  if (!plan) return;

  const tier = tierBadge(plan.tier);
  const action = planActionMeta(plan);
  const detail = planDetailMeta(plan);
  const activeSub = currentSubscription();
  const activePlan = activeSub?.plan || null;
  const diff = Number(plan.price || 0) - currentPlanPrice();

  setMembershipDetailText('planDetailName', plan.name || 'Gói thành viên');
  setMembershipDetailText('planDetailCode', plan.code || '—');
  setMembershipDetailText('planDetailTier', tier.label);
  setMembershipDetailText('planDetailDuration', `${Number(plan.duration_days || 0)} ngày`);
  setMembershipDetailText('planDetailPrice', formatVND(Number(plan.price || 0)));
  setMembershipDetailText('planDetailStatusTitle', detail.title);
  setMembershipDetailText('planDetailStatusSummary', detail.summary);
  setMembershipDetailText('planDetailCompare', detail.compare);
  setMembershipDetailText('planDetailCurrentPlan', activePlan ? (activePlan.name || activePlan.code || '—') : 'Chưa có');
  setMembershipDetailText('planDetailCurrentPrice', activePlan ? formatVND(Number(activePlan.price || 0)) : '—');
  setMembershipDetailText('planDetailDiff', activePlan ? formatVND(Math.abs(diff)) : formatVND(Number(plan.price || 0)));
  setMembershipDetailText('planDetailResult', action.hint || 'Sẵn sàng kích hoạt gói.');

  const tierBadgeEl = document.getElementById('planDetailTierBadge');
  if (tierBadgeEl) tierBadgeEl.className = `badge ${tier.badge}`.trim();

  const actionBtn = document.getElementById('btnPlanDetailAction');
  if (actionBtn) {
    actionBtn.dataset.code = String(plan.code || '');
    actionBtn.disabled = Boolean(action.disabled);
    actionBtn.textContent = action.text;
  }
}

function openPlanDetail(planCode) {
  fillPlanDetail(planCode);
  openModal('planDetailModal');
}

function renderPlans() {
  const holder = document.getElementById('plans');
  if (!holder) return;

  if (_membershipPlans.length === 0) {
    holder.innerHTML = `<div class="card">Không có gói nào.</div>`;
    return;
  }

  holder.innerHTML = _membershipPlans
    .map((p) => {
      const tb = tierBadge(p.tier);
      const action = planActionMeta(p);
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${escapeHtml(p.name)}</div>
              <div class="card-subtitle">Mã: <b>${escapeHtml(p.code)}</b> • Thời hạn: <b>${escapeHtml(p.duration_days)} ngày</b></div>
            </div>
            <span class="badge ${tb.badge}">${tb.label}</span>
          </div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:12px">
            <div>
              <div class="small">Giá</div>
              <div style="font-size:24px;font-weight:800">${formatVND(p.price)}</div>
              <div class="small muted" style="margin-top:8px">${escapeHtml(action.hint || ' ')}</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
              <button
                class="btn ghost js-plan-detail"
                data-code="${escapeHtml(p.code)}"
                type="button"
              >Xem chi tiết</button>
              <button
                class="btn primary js-buy-plan"
                data-code="${escapeHtml(p.code)}"
                type="button"
                ${action.disabled ? 'disabled' : ''}
              >${escapeHtml(action.text)}</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

async function loadPlans() {
  const holder = document.getElementById('plans');
  if (!holder) return;

  holder.innerHTML = `<div class="card"><div class="skeleton" style="height:120px"></div></div>`;

  const [plansRs, meRs] = await Promise.all([
    apiFetch('/payments/plans', { method: 'GET' }),
    apiFetch('/auth/me', { method: 'GET' })
  ]);

  const { res: plansRes, data: plansData } = plansRs;
  const { res: meRes, data: meData } = meRs;

  if (!plansRes.ok) {
    toast('bad', 'Không tải được gói', (plansData && plansData.message) ? plansData.message : 'Vui lòng thử lại.');
    return;
  }

  if (meRes.ok && meData) {
    _membershipMe = meData;
    localStorage.setItem('user', JSON.stringify(meData));
    renderTopbarUser?.();
  } else {
    _membershipMe = null;
  }

  _membershipPlans = Array.isArray(plansData?.plans) ? plansData.plans : [];
  renderMembershipHeroNote();
  renderPlans();
}

async function startPlanPurchase(planCode) {
  const provider = (document.getElementById('provider')?.value || 'vnpay').trim();
  const btns = document.querySelectorAll('button');
  btns.forEach((b) => (b.disabled = true));
  try {
    const { res, data } = await apiFetch('/payments/subscribe', {
      method: 'POST',
      body: JSON.stringify({ provider, planCode, returnBase: window.FRONTEND_URL })
    });
    if (!res.ok) {
      toast('bad', 'Không thể tạo thanh toán', (data && data.message) ? data.message : 'Vui lòng thử lại.');
      return;
    }
    if (data && data.redirectUrl) {
      toast('good', 'Đang chuyển đến cổng thanh toán', 'Vui lòng hoàn tất thanh toán để kích hoạt gói.');
      setTimeout(() => (window.location.href = data.redirectUrl), 400);
      return;
    }
    toast('bad', 'Thiếu redirectUrl', 'Backend không trả về link thanh toán.');
  } finally {
    setTimeout(() => btns.forEach((b) => (b.disabled = false)), 600);
  }
}

async function startPlanChange(planCode) {
  const provider = (document.getElementById('provider')?.value || 'vnpay').trim();
  const targetPlan = _membershipPlans.find((item) => String(item.code) === String(planCode));
  const currentPlan = currentSubscription()?.plan || null;
  if (!targetPlan || !currentPlan) return;

  const diff = Number(targetPlan.price || 0) - Number(currentPlan.price || 0);
  let confirmText = `Đổi từ gói ${currentPlan.name || currentPlan.code} sang ${targetPlan.name || targetPlan.code}?`;
  if (diff > 0) {
    confirmText += `\nBạn sẽ thanh toán thêm ${formatVND(diff)}.`;
  } else if (diff < 0) {
    confirmText += `\nGói cũ đang cao hơn ${formatVND(Math.abs(diff))}; hệ thống sẽ đổi ngay và không hoàn lại phần dư.`;
  } else {
    confirmText += '\nHai gói có cùng giá, hệ thống sẽ đổi ngay.';
  }
  if (!confirm(confirmText)) return;

  const btns = document.querySelectorAll('button');
  btns.forEach((b) => (b.disabled = true));
  try {
    const { res, data } = await apiFetch('/payments/change-subscription', {
      method: 'POST',
      body: JSON.stringify({ provider, planCode, returnBase: window.FRONTEND_URL })
    });

    if (!res.ok) {
      toast('bad', 'Không thể đổi gói', (data && data.message) ? data.message : 'Vui lòng thử lại.');
      return;
    }

    if (data?.redirectUrl) {
      toast('good', 'Đang chuyển đến cổng thanh toán', `Vui lòng thanh toán thêm ${formatVND(Number(data.diffAmount || data.amount || 0))} để đổi gói.`);
      setTimeout(() => (window.location.href = data.redirectUrl), 400);
      return;
    }

    if (data?.mode === 'instant') {
      const { res: meRes, data: meData } = await apiFetch('/auth/me', { method: 'GET' });
      if (meRes.ok && meData) {
        _membershipMe = meData;
        localStorage.setItem('user', JSON.stringify(meData));
        renderTopbarUser?.();
      }
      renderMembershipHeroNote();
      renderPlans();
      toast('good', 'Đã đổi gói', data?.message || 'Hệ thống đã chuyển sang gói mới.');
      return;
    }

    toast('warn', 'Đổi gói', 'Yêu cầu đã được ghi nhận.');
  } finally {
    setTimeout(() => btns.forEach((b) => (b.disabled = false)), 600);
  }
}

async function handlePlanAction(planCode) {
  const activeSub = currentSubscription();
  if (!activeSub?.plan) {
    return startPlanPurchase(planCode);
  }
  return startPlanChange(planCode);
}

document.addEventListener('DOMContentLoaded', loadPlans);

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const d = t.closest('.js-plan-detail');
  if (d) {
    e.preventDefault();
    openPlanDetail(d.dataset.code);
    return;
  }
  const b = t.closest('.js-buy-plan');
  if (b) {
    e.preventDefault();
    handlePlanAction(b.dataset.code);
    return;
  }
  const modalAction = t.closest('#btnPlanDetailAction');
  if (modalAction) {
    e.preventDefault();
    closeModal('planDetailModal');
    handlePlanAction(modalAction.dataset.code);
  }
});
