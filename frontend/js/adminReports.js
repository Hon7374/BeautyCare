document.addEventListener('DOMContentLoaded', () => {
  const daysEl = document.getElementById('reportDays');
  const reloadBtn = document.getElementById('btnReloadReports');
  const cards = document.getElementById('overviewCards');
  const revBody = document.getElementById('revenueBody');

  const charts = {
    providerRevenue: null,
    providerTx: null,
    trend: null
  };

  const palette = ['#d97792', '#efb8a6', '#7fb9a8', '#a78bfa', '#f1c27d', '#8fb8d8', '#c78da1'];

  function card(title, value, sub) {
    return `
      <div class="card">
        <div class="card-content">
          <div class="small muted">${escapeHtml(title)}</div>
          <div style="font-size:22px;font-weight:800;margin-top:6px">${escapeHtml(value)}</div>
          ${sub ? `<div class="small muted" style="margin-top:6px">${escapeHtml(sub)}</div>` : ''}
        </div>
      </div>
    `;
  }

  function chartAvailable() {
    return typeof Chart !== 'undefined';
  }

  function setEmpty(id, message, visible = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.style.display = visible ? 'flex' : 'none';
  }

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function providerName(value) {
    return String(value || 'unknown').trim().toUpperCase();
  }

  function aggregateByProvider(rows) {
    const map = new Map();
    (rows || []).forEach((row) => {
      const provider = providerName(row.provider);
      const current = map.get(provider) || { provider, gross_amount: 0, tx_count: 0 };
      current.gross_amount += Number(row.gross_amount || 0);
      current.tx_count += Number(row.tx_count || 0);
      map.set(provider, current);
    });
    return Array.from(map.values()).sort((a, b) => b.gross_amount - a.gross_amount);
  }

  function baseChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#6f5a65',
            boxWidth: 12,
            boxHeight: 12,
            font: { family: 'Poppins', weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(58,40,49,0.92)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.16)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: { color: '#7b6070' },
          grid: { color: 'rgba(201,156,173,0.12)' }
        },
        y: {
          ticks: { color: '#7b6070' },
          grid: { color: 'rgba(201,156,173,0.12)' }
        }
      }
    };
  }

  function renderProviderCharts(revenueRows) {
    destroyChart('providerRevenue');
    destroyChart('providerTx');

    if (!chartAvailable()) {
      setEmpty('providerRevenueEmpty', 'Không tải được Chart.js.');
      setEmpty('providerTxEmpty', 'Không tải được Chart.js.');
      return;
    }

    const rows = aggregateByProvider(revenueRows);
    if (!rows.length) {
      setEmpty('providerRevenueEmpty', 'Chưa có dữ liệu doanh thu.');
      setEmpty('providerTxEmpty', 'Chưa có dữ liệu giao dịch.');
      return;
    }

    setEmpty('providerRevenueEmpty', '', false);
    setEmpty('providerTxEmpty', '', false);

    const labels = rows.map((row) => row.provider);
    charts.providerRevenue = new Chart(document.getElementById('providerRevenueChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Doanh thu',
          data: rows.map((row) => row.gross_amount),
          backgroundColor: labels.map((_, index) => palette[index % palette.length]),
          borderRadius: 12,
          borderSkipped: false
        }]
      },
      options: {
        ...baseChartOptions(),
        plugins: {
          ...baseChartOptions().plugins,
          tooltip: {
            ...baseChartOptions().plugins.tooltip,
            callbacks: {
              label: (ctx) => `Doanh thu: ${formatVND(ctx.parsed.y || 0)}`
            }
          }
        },
        scales: {
          ...baseChartOptions().scales,
          y: {
            ...baseChartOptions().scales.y,
            ticks: {
              color: '#7b6070',
              callback: (value) => formatVND(value).replace(' ₫', '')
            }
          }
        }
      }
    });

    charts.providerTx = new Chart(document.getElementById('providerTxChart'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          label: 'Giao dịch',
          data: rows.map((row) => row.tx_count),
          backgroundColor: labels.map((_, index) => palette[index % palette.length]),
          borderColor: '#fff8fa',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: baseChartOptions().plugins
      }
    });
  }

  function renderTrendChart(rows) {
    destroyChart('trend');

    if (!chartAvailable()) {
      setEmpty('trendEmpty', 'Không tải được Chart.js.');
      return;
    }

    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      setEmpty('trendEmpty', 'Chưa có dữ liệu xu hướng.');
      return;
    }

    setEmpty('trendEmpty', '', false);

    charts.trend = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: list.map((row) => row.date),
        datasets: [
          {
            label: 'Doanh thu',
            data: list.map((row) => Number(row.gross_amount || 0)),
            borderColor: '#d97792',
            backgroundColor: 'rgba(217,119,146,0.14)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y'
          },
          {
            label: 'Booking',
            data: list.map((row) => Number(row.booking_count || 0)),
            borderColor: '#7fb9a8',
            backgroundColor: 'rgba(127,185,168,0.14)',
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        ...baseChartOptions(),
        interaction: { mode: 'index', intersect: false },
        plugins: {
          ...baseChartOptions().plugins,
          tooltip: {
            ...baseChartOptions().plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === 'y') return `Doanh thu: ${formatVND(ctx.parsed.y || 0)}`;
                return `Booking: ${Number(ctx.parsed.y || 0)}`;
              }
            }
          }
        },
        scales: {
          x: baseChartOptions().scales.x,
          y: {
            type: 'linear',
            position: 'left',
            ticks: {
              color: '#7b6070',
              callback: (value) => formatVND(value).replace(' ₫', '')
            },
            grid: { color: 'rgba(201,156,173,0.12)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            ticks: { color: '#7b6070', precision: 0 },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  async function load() {
    const days = Number(daysEl.value || 30);
    cards.innerHTML = '';
    revBody.innerHTML = `<tr><td colspan="4" class="muted">Đang tải...</td></tr>`;
    setEmpty('providerRevenueEmpty', 'Đang tải biểu đồ...');
    setEmpty('providerTxEmpty', 'Đang tải biểu đồ...');
    setEmpty('trendEmpty', 'Đang tải biểu đồ...');

    const o = await apiFetch(`/admin/reports/overview?days=${days}`);
    if (!o.res.ok) {
      toast('bad', 'Lỗi', o.data?.message || 'Không tải được overview');
      revBody.innerHTML = `<tr><td colspan="4" class="muted">Lỗi tải</td></tr>`;
      return;
    }

    const d = o.data || {};
    cards.innerHTML = [
      card('Users', String(d.users_total ?? 0)),
      card('Services', String(d.services_total ?? 0)),
      card('Vouchers', String(d.vouchers_total ?? 0)),
      card('Bookings (gần đây)', String(d.bookings_recent ?? 0), `${days} ngày`),
      card('Orders (gần đây)', String(d.orders_recent ?? 0), `${days} ngày`),
      card('Payments (gần đây)', String(d.payments_recent ?? 0), `${days} ngày`),
      card('Payments paid', String(d.payments_paid_recent ?? 0), `${days} ngày`),
      card('Doanh thu paid', formatVND(d.revenue_paid_recent ?? 0), `${days} ngày`),
      card('Subscriptions active', String(d.subscriptions_active ?? 0))
    ].join('');

    const [revenueResult, trendResult] = await Promise.all([
      apiFetch(`/admin/reports/revenue?days=${days}`),
      apiFetch(`/admin/reports/revenue-trend?days=${days}`)
    ]);

    if (!revenueResult.res.ok) {
      toast('bad', 'Lỗi', revenueResult.data?.message || 'Không tải được revenue');
      revBody.innerHTML = `<tr><td colspan="4" class="muted">Lỗi tải</td></tr>`;
      renderProviderCharts([]);
      return;
    }

    const revenueRows = revenueResult.data?.rows || [];
    renderProviderCharts(revenueRows);

    if (!revenueRows.length) {
      revBody.innerHTML = `<tr><td colspan="4" class="muted">Chưa có dữ liệu doanh thu</td></tr>`;
    } else {
      revBody.innerHTML = revenueRows.map(x => `
        <tr>
          <td>${escapeHtml(x.provider)}</td>
          <td>${escapeHtml(x.purpose)}</td>
          <td>${Number(x.tx_count || 0)}</td>
          <td>${formatVND(x.gross_amount || 0)}</td>
        </tr>
      `).join('');
    }

    if (!trendResult.res.ok) {
      toast('bad', 'Lỗi', trendResult.data?.message || 'Không tải được xu hướng');
      renderTrendChart([]);
      return;
    }

    renderTrendChart(trendResult.data?.rows || []);
  }

  reloadBtn.addEventListener('click', load);
  daysEl.addEventListener('change', load);
  load();
});
