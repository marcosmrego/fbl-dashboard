const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value ?? 0);

const formatDuration = (duration) => {
  if (!duration) return '00:00';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  const parts = [];
  if (h) parts.push(String(h).padStart(2, '0'));
  parts.push(String(m).padStart(2, '0'));
  parts.push(String(s).padStart(2, '0'));
  return parts.join(':');
};

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

async function fetchApi(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
  return response.json();
}

const state = {
  allVideos: [],
  filteredVideos: [],
  currentPage: 1,
  itemsPerPage: 8,
  currentSort: { column: 'published_at', direction: 'desc' },
};

function formatGrowth(history) {
  if (!history || history.length < 2) return '—';
  const last = history[history.length - 1].subscribers;
  const previous = history[history.length - 2].subscribers;
  if (!previous) return '—';
  const diff = last - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  return `${diff >= 0 ? '+' : ''}${diff} (${pct}%)`;
}

function renderOverview(data, history) {
  document.getElementById('channelName').textContent = data.channel_name || 'Focus Blues Lab';
  document.getElementById('val-subscribers').textContent = formatNumber(data.subscribers);
  document.getElementById('val-views').textContent = formatNumber(data.views);
  document.getElementById('val-videos').textContent = formatNumber(data.videos);
  document.getElementById('val-growth').textContent = formatGrowth(history);
}

function getSortedVideos(videos) {
  const { column, direction } = state.currentSort;
  return [...videos].sort((a, b) => {
    let av = a[column];
    let bv = b[column];
    if (column === 'published_at') { av = new Date(av); bv = new Date(bv); }
    else if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return direction === 'asc' ? -1 : 1;
    if (av > bv) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderVideos(videos) {
  const prev = state.allVideos.length;
  state.allVideos = videos || [];
  // só reseta paginação se a quantidade de vídeos mudou
  if (prev !== state.allVideos.length) state.currentPage = 1;
  applyFiltersAndSorting();
}

function renderVideoRows(videos) {
  const tbody = document.getElementById('videosTableBody');
  tbody.innerHTML = '';
  videos.forEach((video) => {
    const tr = document.createElement('tr');
    const date = new Date(video.published_at).toLocaleDateString('pt-BR');
    tr.innerHTML = `
      <td><a href="${video.video_url}" target="_blank" rel="noopener">
        <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" />
      </a></td>
      <td><a class="video-title-link" href="${video.video_url}" target="_blank" rel="noopener">${video.title}</a></td>
      <td>${date}</td>
      <td class="num">${formatNumber(video.views)}</td>
      <td class="num">${formatNumber(video.likes)}</td>
      <td class="num">${formatNumber(video.comments)}</td>
      <td class="num">${formatDuration(video.duration)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateVideosSummary(videos) {
  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
  const avgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;
  document.getElementById('videosCount').textContent = formatNumber(videos.length);
  document.getElementById('totalViews').textContent = formatNumber(totalViews);
  document.getElementById('totalLikes').textContent = formatNumber(totalLikes);
  document.getElementById('avgViews').textContent = formatNumber(avgViews);
}

function filterVideos(videos, searchTerm) {
  if (!searchTerm) return videos;
  const term = searchTerm.toLowerCase();
  return videos.filter((v) => v.title.toLowerCase().includes(term));
}

function setupFilters() {
  document.getElementById('searchInput').addEventListener('input', () => {
    state.currentPage = 1;
    applyFiltersAndSorting();
  });
}

function setupSorting() {
  const headers = document.querySelectorAll('thead th[data-col]');
  headers.forEach((header) => {
    header.classList.add('sortable');
    header.addEventListener('click', () => {
      const col = header.dataset.col;
      if (state.currentSort.column === col) {
        state.currentSort.direction = state.currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.currentSort.column = col;
        state.currentSort.direction = 'desc';
      }
      headers.forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
      header.classList.add(`sort-${state.currentSort.direction}`);
      state.currentPage = 1;
      renderVideoPage();
    });
  });
}

function renderPagination(totalItems) {
  let container = document.getElementById('paginationControls');
  if (!container) {
    container = document.createElement('div');
    container.id = 'paginationControls';
    container.className = 'pagination';
    document.querySelector('.table-wrapper').appendChild(container);
  }
  container.innerHTML = '';
  const pageCount = Math.ceil(totalItems / state.itemsPerPage);
  if (pageCount <= 1) return;

  const btn = (text, page, disabled, active) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.disabled = disabled;
    if (active) b.classList.add('active');
    if (!disabled) b.addEventListener('click', () => { state.currentPage = page; renderVideoPage(); });
    container.appendChild(b);
  };

  btn('«', 1, state.currentPage === 1, false);
  btn('‹', state.currentPage - 1, state.currentPage === 1, false);

  const range = 2;
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= state.currentPage - range && p <= state.currentPage + range)) {
      btn(String(p), p, false, state.currentPage === p);
    } else if (p === state.currentPage - range - 1 || p === state.currentPage + range + 1) {
      const dots = document.createElement('span');
      dots.textContent = '…';
      dots.className = 'pagination-dots';
      container.appendChild(dots);
    }
  }

  btn('›', state.currentPage + 1, state.currentPage === pageCount, false);
  btn('»', pageCount, state.currentPage === pageCount, false);
}

function renderVideoPage() {
  const sorted = getSortedVideos(state.filteredVideos);
  const start = (state.currentPage - 1) * state.itemsPerPage;
  renderVideoRows(sorted.slice(start, start + state.itemsPerPage));
  renderPagination(sorted.length);
}

function applyFiltersAndSorting() {
  const term = document.getElementById('searchInput')?.value.trim() || '';
  state.filteredVideos = filterVideos(state.allVideos, term);
  updateVideosSummary(state.filteredVideos);
  renderVideoPage();
}

function renderTopList(listId, items, labelFn) {
  const list = document.getElementById(listId);
  list.innerHTML = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="top-rank">${i + 1}</span>
      <div class="top-info">
        <a href="${item.video_url}" target="_blank" rel="noopener" class="top-title">${item.title}</a>
        <span class="top-meta">${labelFn(item)}</span>
      </div>
    `;
    list.appendChild(li);
  });
}

let subscribersChart = null;
let viewsChart = null;

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  interaction: { mode: 'index', intersect: false },
  animation: { duration: 400 },
  scales: {
    x: {
      ticks: { color: '#6b8cba', maxRotation: 30 },
      grid: { color: 'rgba(255,255,255,0.04)' },
    },
    y: {
      ticks: { color: '#6b8cba' },
      grid: { color: 'rgba(255,255,255,0.04)' },
    },
  },
  plugins: {
    legend: { labels: { color: '#c5d8f5', font: { size: 12 } } },
    tooltip: {
      backgroundColor: 'rgba(10,20,40,0.95)',
      titleColor: '#c5d8f5',
      bodyColor: '#8aaad4',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
    },
  },
};

function buildDataset(label, data, color) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: `${color}22`,
    tension: 0.4,
    fill: true,
    pointRadius: 3,
    pointHoverRadius: 6,
  };
}

function renderHistory(history) {
  if (typeof Chart === 'undefined' || !history.length) return;

  const labels = history.map((r) => new Date(r.collected_at).toLocaleDateString('pt-BR'));
  const subData = history.map((r) => r.subscribers);
  const viewData = history.map((r) => r.total_views);

  if (subscribersChart) {
    // atualiza dados sem recriar o gráfico
    subscribersChart.data.labels = labels;
    subscribersChart.data.datasets[0].data = subData;
    subscribersChart.update('none'); // 'none' pula a animação para não conflitar com o timer
  } else {
    subscribersChart = new Chart(document.getElementById('subscribersChart'), {
      type: 'line',
      data: { labels, datasets: [buildDataset('Inscritos', subData, '#5f8fff')] },
      options: chartOptions,
    });
  }

  if (viewsChart) {
    viewsChart.data.labels = labels;
    viewsChart.data.datasets[0].data = viewData;
    viewsChart.update('none');
  } else {
    viewsChart = new Chart(document.getElementById('viewsChart'), {
      type: 'line',
      data: { labels, datasets: [buildDataset('Views', viewData, '#ff9f43')] },
      options: chartOptions,
    });
  }
}

function updateLastRefreshTime() {
  const el = document.getElementById('lastUpdateTime');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR');
}

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.value)) return data.value;
  if (data && Array.isArray(data.videos)) return data.videos;
  return [];
}

function normalizeTopVideos(data) {
  if (!data || typeof data !== 'object') return {};
  return {
    mostViewed: normalizeArray(data.mostViewed),
    highestEngagement: normalizeArray(data.highestEngagement),
    mostRecent: normalizeArray(data.mostRecent),
    fastestGrowth: normalizeArray(data.fastestGrowth),
  };
}

async function refreshDashboard() {
  const [channel, videosRaw, historyRaw, topVideosRaw] = await Promise.all([
    fetchApi('/api/channel'),
    fetchApi('/api/videos'),
    fetchApi('/api/history'),
    fetchApi('/api/top-videos'),
  ]);

  const videos = normalizeArray(videosRaw);
  const history = normalizeArray(historyRaw);
  const topVideos = normalizeTopVideos(topVideosRaw);

  renderOverview(channel, history);
  renderVideos(videos);

  renderTopList('topMostViewed', topVideos.mostViewed, (v) => `${formatNumber(v.views)} views`);
  renderTopList('topHighestEngagement', topVideos.highestEngagement, (v) => `${formatNumber((v.likes || 0) + (v.comments || 0))} engajamento`);
  renderTopList('topMostRecent', topVideos.mostRecent, (v) => new Date(v.published_at).toLocaleDateString('pt-BR'));
  renderTopList('topFastestGrowth', topVideos.fastestGrowth, (v) => `${formatNumber(Math.round(v.views_per_day || 0))} views/dia`);

  try {
    renderHistory(history);
  } catch (err) {
    console.error('Erro ao renderizar gráficos:', err);
  }

  updateLastRefreshTime();
}

async function init() {
  try {
    await refreshDashboard();
  } catch (err) {
    console.error('Erro ao inicializar dashboard:', err);
  }

  setupFilters();
  setupSorting();

  // Atualiza a UI a cada 10 segundos lendo apenas do banco (sem chamar a YouTube API)
  setInterval(async () => {
    try {
      await refreshDashboard();
    } catch (err) {
      console.error('Erro no auto-refresh:', err);
    }
  }, 10000);
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
