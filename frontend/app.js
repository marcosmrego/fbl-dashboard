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
let isAutoRefreshEnabled = true;
let lastUpdateTime = new Date();

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

function renderOverview(data, history) {
  document.getElementById('channelName').textContent = data.channel_name || 'Focus Blues Lab';
  document.getElementById('card-subscribers').querySelector('.value').textContent = formatNumber(data.subscribers);
  document.getElementById('card-views').querySelector('.value').textContent = formatNumber(data.views);
  document.getElementById('card-videos').querySelector('.value').textContent = formatNumber(data.videos);
  document.getElementById('card-growth').querySelector('.value').textContent = formatGrowth(history);
}

function renderVideos(videos) {
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
      <td>Publicado</td>
    `;
    tbody.appendChild(tr);
  });

  updateVideosSummary(videos);
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

function setupFilters(videos) {
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

  function applyFilters() {
    const searchTerm = searchInput.value.trim();
    const statusValue = statusFilter.value;
    const filteredVideos = filterVideos(videos, searchTerm, statusValue);
    renderVideos(filteredVideos);
  }

  searchInput.addEventListener('input', applyFilters);
  statusFilter.addEventListener('change', applyFilters);
}

function setupSorting(videos) {
  const tableHeaders = document.querySelectorAll('thead th');
  let currentSort = { column: 'published_at', direction: 'desc' };

  // Adicionar classes iniciais
  tableHeaders.forEach((header, index) => {
    const columns = ['thumbnail', 'title', 'published_at', 'views', 'likes', 'comments', 'duration', 'status'];
    const column = columns[index];

    if (column && column !== 'thumbnail') {
      header.classList.add('sortable');
    }
  });

  tableHeaders.forEach((header, index) => {
    const columns = ['thumbnail', 'title', 'published_at', 'views', 'likes', 'comments', 'duration', 'status'];
    const column = columns[index];

    if (!column || column === 'thumbnail') return;

    header.addEventListener('click', () => {
      // Remover classes de ordenação de todos os cabeçalhos
      tableHeaders.forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });

      if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = column;
        currentSort.direction = 'desc';
      }

      // Adicionar classe ao cabeçalho atual
      header.classList.add(`sort-${currentSort.direction}`);

      const sortedVideos = [...videos].sort((a, b) => {
        let aValue = a[column];
        let bValue = b[column];

        if (column === 'published_at') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        } else if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return currentSort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
      });

      renderVideos(sortedVideos);
      setupFilters(sortedVideos);
    });
  });
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

  createChart(document.getElementById('subscribersChart'), 'Inscritos', subscribersData, '#5f8fff');
  createChart(document.getElementById('viewsChart'), 'Views', viewsData, '#ff9f43');
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

function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  autoRefreshInterval = setInterval(async () => {
    if (!isAutoRefreshEnabled) return;

    try {
      console.log('Auto-refreshing dashboard...');

      const results = await Promise.allSettled([
        fetchApi('/api/channel'),
        fetchApi('/api/history'),
      ]);

      const channelResult = results[0];
      const historyResult = results[1];

      if (channelResult.status === 'fulfilled') {
        renderOverview(channelResult.value, historyResult.status === 'fulfilled' ? historyResult.value : []);
      }

      if (historyResult.status === 'fulfilled') {
        renderHistory(historyResult.value);
      }

      updateLastRefreshTime();
      console.log('Dashboard updated successfully');
    } catch (error) {
      console.error('Auto-refresh failed:', error);
      // Não mostrar erro para o usuário em auto-refresh para não incomodar
    }
  }, 5000); // 5 segundos
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

function toggleAutoRefresh() {
  isAutoRefreshEnabled = !isAutoRefreshEnabled;
  const status = isAutoRefreshEnabled ? 'habilitado' : 'desabilitado';
  console.log(`Auto-refresh ${status}`);
}

// Adicionar controle visual do auto-refresh
function addAutoRefreshControl() {
  const btn = document.getElementById('toggleRefreshBtn');
  const indicator = document.getElementById('refreshIndicator');

  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    toggleAutoRefresh();

    if (isAutoRefreshEnabled) {
      btn.title = 'Auto-refresh a cada 5s (ativo)';
      indicator.textContent = '●';
      indicator.className = 'refresh-indicator active';
    } else {
      btn.title = 'Auto-refresh pausado';
      indicator.textContent = '○';
      indicator.className = 'refresh-indicator inactive';
    }
  });
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

  renderOverview(channel, history);
  renderVideos(videos);
  renderHistory(history);
  await loadTopVideos();

  setupFilters(videos);
  setupSorting(videos);

  // Iniciar auto-refresh
    addAutoRefreshControl();
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
