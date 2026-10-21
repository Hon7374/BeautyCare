
document.addEventListener('DOMContentLoaded', () => {
  const silver = document.getElementById('rateSilver');
  const gold = document.getElementById('rateGold');
  const premium = document.getElementById('ratePremium');
  const maxStack = document.getElementById('maxStack');
  const hint = document.getElementById('discountHint');
  const btn = document.getElementById('btnSaveDiscounts');

  async function load() {
    const { res, data } = await apiFetch('/admin/discounts');
    if (!res.ok) {
      toast('bad', 'Lỗi', data?.message || 'Không tải được chính sách');
      return;
    }
    const p = data?.policies || {};
    const s = data?.settings || {};
    silver.value = (Number(p.silver ?? 0.05) * 100).toFixed(1);
    gold.value = (Number(p.gold ?? 0.10) * 100).toFixed(1);
    premium.value = (Number(p.premium ?? 0.20) * 100).toFixed(1);
    maxStack.value = (Number(s.max_total_rate ?? 0.95) * 100).toFixed(1);
    hint.textContent = 'Đã tải.';
  }

  function toRatePercent(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n / 100;
  }

  async function save() {
    btn.disabled = true;
    try {
      const payload = {
        policies: {
          silver: toRatePercent(silver.value),
          gold: toRatePercent(gold.value),
          premium: toRatePercent(premium.value)
        },
        settings: {
          max_total_rate: toRatePercent(maxStack.value)
        }
      };
      const { res, data } = await apiFetch('/admin/discounts', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        toast('bad', 'Lỗi', data?.message || 'Không lưu được');
        return;
      }
      toast('good', 'OK', 'Đã lưu chính sách');
      hint.textContent = 'Đã lưu lúc ' + new Date().toLocaleTimeString('vi-VN');
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', save);
  load();
});
