const cron = require('node-cron');
const youtube = require('./youtube');
const database = require('./database');

async function refreshData() {
  try {
    console.log('Coletando dados do YouTube...');
    const [channelData, videosData] = await Promise.all([
      youtube.fetchChannelData(),
      youtube.fetchVideosData(),
    ]);

    await database.saveChannelStats(channelData);
    await database.saveVideos(videosData);

    console.log(`Coleta concluída: ${videosData.length} vídeos atualizados.`);
  } catch (error) {
    console.error('Erro ao atualizar dados do YouTube:', error.message);
  }
}

function start() {
  // A cada 6 horas
  cron.schedule('0 */6 * * *', () => {
    console.log('Executando coleta agendada (6h)...');
    refreshData();
  });
}

module.exports = { start, refreshData };
