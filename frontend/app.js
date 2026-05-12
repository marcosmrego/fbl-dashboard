const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value);

const formatDuration = (duration) => {
  if (!duration) return '00:00';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const parts = [];

  if (hours) parts.push(String(hours).padStart(2, '0'));
  parts.push(String(minutes).padStart(2, '0'));
  parts.push(String(seconds).padStart(2, '0'));

  return hours ? parts.join(':') : parts.slice(1).join(':');
};

async function fetchApi(endpoint) {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error('Falha ao carregar ' + endpoint);
  }
  return response.json();
}

let autoRefreshInterval = null;
let lastUpdateTime = new Date();
const state = {
  allVideos: [],
  filteredVideos: [],
  currentPage: 1,
  itemsPerPage: 5,
  currentSort: { column: 'published_at', direction: 'desc' },
};

function formatGrowth(history) {
  if (!history || history.length < 2) {
    return '—';
  }

  const last = history[history.length - 1].subscribers;
  const previous = history[history.length - 2].subscribers;
  if (previous === 0) {
    return '—';
  }

  const value = ((last - previous) / previous) * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function renderOverview(data, history, totalVideoViews = null) {
  document.getElementById('channelName').textContent = data.channel_name || 'Focus Blues Lab';
  document.getElementById('card-subscribers').querySelector('.value').textContent = formatNumber(data.subscribers);
  document.getElementById('card-views').querySelector('.value').textContent = formatNumber(
    totalVideoViews !== null ? totalVideoViews : data.views
  );
  document.getElementById('card-videos').querySelector('.value').textContent = formatNumber(data.videos);
  document.getElementById('card-growth').querySelector('.value').textContent = formatGrowth(history);
}

function getSortedVideos(videos) {
  const { column, direction } = state.currentSort;
  return [...videos].sort((a, b) => {
    let aValue = a[column];
    let bValue = b[column];

    if (column === 'published_at') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderVideos(videos) {
  state.allVideos = videos || [];
  state.currentPage = 1;
  applyFiltersAndSorting();
}

function renderVideoRows(videos) {
  const tbody = document.getElementById('videosTableBody');
  tbody.innerHTML = '';

  videos.forEach((video) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${video.thumbnail}" alt="${video.title}" /></td>
      <td><a href="${video.video_url}" target="_blank">${video.title}</a></td>
      <td>${new Date(video.published_at).toLocaleDateString('pt-BR')}</td>
      <td>${formatNumber(video.views)}</td>
      <td>${formatNumber(video.likes)}</td>
      <td>${formatNumber(video.comments)}</td>
      <td>${formatDuration(video.duration)}</td>
      <td>${video.status || 'Publicado'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateVideosSummary(videos) {
  const count = videos.length;
  const totalViews = videos.reduce((sum, video) => sum + video.views, 0);
  const totalLikes = videos.reduce((sum, video) => sum + video.likes, 0);
  const avgViews = count > 0 ? Math.round(totalViews / count) : 0;

  document.getElementById('videosCount').textContent = formatNumber(count);
  document.getElementById('totalViews').textContent = formatNumber(totalViews);
  document.getElementById('totalLikes').textContent = formatNumber(totalLikes);
  document.getElementById('avgViews').textContent = formatNumber(avgViews);

  document.getElementById('card-views').querySelector('.value').textContent = formatNumber(totalViews);
}

function filterVideos(videos, searchTerm, statusFilter) {
  return videos.filter((video) => {
    const matchesSearch = !searchTerm ||
      video.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter ||
      video.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}

function setupFilters() {
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

  function applyFilters() {
    state.currentPage = 1;
    applyFiltersAndSorting();
  }

  searchInput.addEventListener('input', applyFilters);
  statusFilter.addEventListener('change', applyFilters);
}

function setupSorting() {
  const tableHeaders = document.querySelectorAll('thead th');
  const columns = ['thumbnail', 'title', 'published_at', 'views', 'likes', 'comments', 'duration', 'status'];

  tableHeaders.forEach((header, index) => {
    const column = columns[index];
    if (!column || column === 'thumbnail') return;

    header.classList.add('sortable');
    header.addEventListener('click', () => {
      if (state.currentSort.column === column) {
        state.currentSort.direction = state.currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.currentSort.column = column;
        state.currentSort.direction = 'desc';
      }

      tableHeaders.forEach((h) => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      header.classList.add(`sort-${state.currentSort.direction}`);

      state.currentPage = 1;
      renderVideoPage();
    });
  });
}

function getPaginatedVideos(videos) {
  const start = (state.currentPage - 1) * state.itemsPerPage;
  return videos.slice(start, start + state.itemsPerPage);
}

function renderPagination(totalItems) {
  let paginationContainer = document.getElementById('paginationControls');
  if (!paginationContainer) {
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'paginationControls';
    paginationContainer.className = 'pagination';
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) tableWrapper.appendChild(paginationContainer);
  }

  paginationContainer.innerHTML = '';
  const pageCount = Math.ceil(totalItems / state.itemsPerPage);
  if (pageCount <= 1) return;

  const addButton = (text, page, disabled = false, active = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.disabled = disabled;
    if (active) button.classList.add('active');
    if (!disabled) {
      button.addEventListener('click', () => {
        state.currentPage = page;
        renderVideoPage();
      });
    }
    paginationContainer.appendChild(button);
  };

  addButton('«', 1, state.currentPage === 1);
  for (let page = 1; page <= pageCount; page += 1) {
    addButton(String(page), page, false, state.currentPage === page);
  }
  addButton('»', pageCount, state.currentPage === pageCount);
}

function renderVideoPage() {
  const sortedVideos = getSortedVideos(state.filteredVideos);
  const pageVideos = getPaginatedVideos(sortedVideos);
  renderVideoRows(pageVideos);
  renderPagination(sortedVideos.length);
}

function applyFiltersAndSorting() {
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const searchTerm = searchInput ? searchInput.value.trim() : '';
  const statusValue = statusFilter ? statusFilter.value : '';

  state.filteredVideos = filterVideos(state.allVideos, searchTerm, statusValue);
  updateVideosSummary(state.filteredVideos);
  renderVideoPage();
}

function renderTopList(listId, items, labelKey) {
  const list = document.getElementById(listId);
  list.innerHTML = '';

  items.forEach((item) => {
    const li = document.createElement('li');
    const labelValue = labelKey === 'views'
      ? `${formatNumber(item.views)} views`
      : labelKey === 'engagement'
        ? `${formatNumber(item.likes + item.comments)} engajamento`
        : labelKey === 'recent'
          ? `${new Date(item.published_at).toLocaleDateString('pt-BR')}`
          : `${formatNumber(item.views)} views/dia`;

    li.innerHTML = `<strong>${item.title}</strong><br><span>${labelValue}</span>`;
    list.appendChild(li);
  });
}

function renderHistory(history) {
  const labels = history.map((item) => new Date(item.collected_at).toLocaleDateString('pt-BR'));
  const subscribersData = history.map((item) => item.subscribers);
  const viewsData = history.map((item) => item.total_views);

  const createChart = (ctx, label, data, color) => {
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data,
          borderColor: color,
          backgroundColor: 'rgba(78, 124, 255, 0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: '#9bb1d7' } },
          y: { ticks: { color: '#9bb1d7' } },
        },
        plugins: {
          legend: { labels: { color: '#d3e1ff' } },
        },
      },
    });
  };

  if (window.subscribersChart) {
    window.subscribersChart.destroy();
  }
  if (window.viewsChart) {
    window.viewsChart.destroy();
  }

  window.subscribersChart = createChart(document.getElementById('subscribersChart'), 'Inscritos', subscribersData, '#5f8fff');
  window.viewsChart = createChart(document.getElementById('viewsChart'), 'Views', viewsData, '#ff9f43');
}

async function loadTopVideos() {
  try {
    const topVideos = await fetchApi('/api/top-videos');
    renderTopList('topMostViewed', topVideos?.mostViewed ?? [], 'views');
    renderTopList('topHighestEngagement', topVideos?.highestEngagement ?? [], 'engagement');
    renderTopList('topMostRecent', topVideos?.mostRecent ?? [], 'recent');
    renderTopList('topFastestGrowth', topVideos?.fastestGrowth ?? [], 'growth');
  } catch (error) {
    console.error('Erro ao carregar top vídeos:', error);
  }
}


function updateLastRefreshTime() {
  lastUpdateTime = new Date();
  const timeElement = document.getElementById('lastUpdateTime');
  if (timeElement) {
    timeElement.textContent = lastUpdateTime.toLocaleTimeString('pt-BR');
  }
}

function showRefreshStatus(message, success) {
  const statusEl = document.getElementById('refreshStatus');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status-message ${success ? 'success' : 'error'}`;

  clearTimeout(window.refreshStatusTimeout);
  window.refreshStatusTimeout = setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status-message hidden';
  }, 5000);
}

async function refreshDashboard() {
  try {
    await fetchApi('/api/refresh-data');
  } catch (error) {
    console.error('Falha ao solicitar refresh:', error);
  }

  const [channel, videos, history] = await Promise.all([
    fetchApi('/api/channel'),
    fetchApi('/api/videos'),
    fetchApi('/api/history'),
  ]);

  const totalVideoViews = videos.reduce((sum, video) => sum + video.views, 0);
  renderOverview(channel, history, totalVideoViews);
  renderVideos(videos);
  renderHistory(history);
  await loadTopVideos();
  updateLastRefreshTime();
}

function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  autoRefreshInterval = setInterval(async () => {
    try {
      await refreshDashboard();
      console.log('Dashboard atualizado automaticamente');
    } catch (error) {
      console.error('Falha no auto-refresh:', error);
    }
  }, 5000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

async function init() {
  let channel = { channel_name: 'Focus Blues Lab', subscribers: 0, views: 0, videos: 0 };
  let videos = [];
  let history = [];
  let loadedSomething = false;

  try {
    channel = await fetchApi('/api/channel');
    loadedSomething = true;
  } catch (error) {
    console.error('Erro ao carregar /api/channel:', error);
  }

  try {
    videos = await fetchApi('/api/videos');
    loadedSomething = true;
  } catch (error) {
    console.error('Erro ao carregar /api/videos:', error);
  }

  try {
    history = await fetchApi('/api/history');
    loadedSomething = true;
  } catch (error) {
    console.error('Erro ao carregar /api/history:', error);
  }

  const totalVideoViews = videos.reduce((sum, video) => sum + video.views, 0);
  renderOverview(channel, history, totalVideoViews);
  renderVideos(videos);
  renderHistory(history);
  await loadTopVideos();

  setupFilters();
  setupSorting();

  startAutoRefresh();
  updateLastRefreshTime();

  console.log('Dashboard inicializado com auto-refresh a cada 5 segundos');

  if (!loadedSomething) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="alert">Não foi possível carregar os dados. Verifique o servidor.</div>');
  }
}

// Cleanup quando a página for fechada
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});

init();
