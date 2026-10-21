
document.addEventListener('DOMContentLoaded', () => {
  const bodyEl = document.getElementById('subsBody');
  const statusEl = document.getElementById('subStatus');
  const searchEl = document.getElementById('subSearch');
  const reloadBtn = document.getElementById('btnReloadSubs');

  function rowHtml(s) {
    const start = s.start_at ? formatDateTime(s.start_at) : '';
    const end = s.end_at ? formatDateTime(s.end_at) : '';
    const user = `${escapeHtml(s.user_email)}<div class="small muted">${escapeHtml(s.user_name || '')}</div>`;
    const plan = `${escapeHtml(s.plan_name)}<div class="small muted">${escapeHtml(s.plan_code)} • ${escapeHtml(s.plan_tier)} • ${formatVND(s.plan_price)}</div>`;

    const statusOptions = ['pending','active','cancelled','expired'].map(st =>
      `<option value="${st}" ${String(s.status).toLowerCase()===st?'selected':''}>${st}</option>`
    ).join('');

    const autoChecked = s.auto_renew ? 'checked' : '';
    const autoText = s.auto_renew ? 'Bật' : 'Tắt';

    return `
      <tr>
        <td>${s.id}</td>
        <td>${user}</td>
        <td>${plan}</td>
        <td>
          <select class="input" data-act="status" data-id="${s.id}" style="min-width:120px">${statusOptions}</select>
        </td>
        <td style="text-align:center">
          <label class="auto-toggle" title="Auto renew">
            <input type="checkbox" data-act="auto" data-id="${s.id}" ${autoChecked}/>
            <span class="auto-toggle__track" aria-hidden="true">
              <span class="auto-toggle__thumb"></span>
            </span>
            <span class="auto-toggle__text">${autoText}</span>
          </label>
        </td>
        <td class="small">${start}</td>
        <td class="small">${end}</td>
        <td class="small">${escapeHtml(s.provider || '')}</td>
        <td>
          <button class="btn small" data-act="extend30" data-id="${s.id}">+30 ngày</button>
        </td>
      </tr>
    `;
  }

  async function load() {
    bodyEl.innerHTML = `<tr><td colspan="9" class="muted">Đang tải...</td></tr>`;
    const qs = new URLSearchParams();
    if (statusEl.value) qs.set('status', statusEl.value);
    if (searchEl.value.trim()) qs.set('q', searchEl.value.trim());
    const { res, data } = await apiFetch(`/admin/subscriptions?${qs.toString()}`);
    if (!res.ok) {
      bodyEl.innerHTML = `<tr><td colspan="9" class="muted">Lỗi tải dữ liệu</td></tr>`;
      toast('bad', 'Lỗi', data?.message || 'Không tải được subscriptions');
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="9" class="muted">Không có dữ liệu</td></tr>`;
      return;
    }
    bodyEl.innerHTML = rows.map(rowHtml).join('');
  }

  async function patch(id, payload) {
    const { res, data } = await apiFetch(`/admin/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      toast('bad', 'Lỗi', data?.message || 'Cập nhật thất bại');
      return false;
    }
    return true;
  }

  bodyEl.addEventListener('change', async (e) => {
    const el = e.target;
    const act = el?.getAttribute?.('data-act');
    const id = el?.getAttribute?.('data-id');
    if (!act || !id) return;

    if (act === 'status') {
      const ok = await patch(id, { status: el.value });
      if (ok) toast('good', 'OK', 'Đã cập nhật trạng thái');
      load();
    }
    if (act === 'auto') {
      const label = el.closest('.auto-toggle')?.querySelector('.auto-toggle__text');
      const previous = !el.checked;
      const ok = await patch(id, { auto_renew: !!el.checked });
      if (ok) {
        if (label) label.textContent = el.checked ? 'Bật' : 'Tắt';
        toast('good', 'OK', 'Đã cập nhật auto_renew');
      } else {
        el.checked = previous;
        if (label) label.textContent = previous ? 'Bật' : 'Tắt';
      }
    }
  });

  bodyEl.addEventListener('click', async (e) => {
    const btn = e.target?.closest?.('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    if (act === 'extend30') {
      btn.disabled = true;
      const ok = await patch(id, { extend_days: 30 });
      btn.disabled = false;
      if (ok) toast('good', 'OK', 'Đã gia hạn +30 ngày');
      load();
    }
  });

  reloadBtn.addEventListener('click', load);
  statusEl.addEventListener('change', load);

  let _t = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(_t);
    _t = setTimeout(load, 350);
  });

  load();
});
