const cron = require('node-cron');
const youtube = require('./youtube');
const database = require('./database');

async function refreshData() {
  try {
    const channelData = await youtube.fetchChannelData();
    const videosData = await youtube.fetchVideosData();

    const db = await database.init();
    await db.run(
      `INSERT INTO channel_stats (collected_at, channel_name, subscribers, total_views, total_videos) VALUES (?, ?, ?, ?, ?)`,
      new Date().toISOString(),
      channelData.channel_name,
      channelData.subscribers,
      channelData.views,
      channelData.videos
    );

    const insertVideo = await db.prepare(`
      INSERT OR REPLACE INTO videos (
        video_id, title, published_at, views, likes, comments, duration, thumbnail, video_url, collected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const video of videosData) {
      await insertVideo.run(
        video.video_id,
        video.title,
        video.published_at,
        video.views,
        video.likes,
        video.comments,
        video.duration,
        video.thumbnail,
        video.video_url,
        video.collected_at
      );
    }

    await insertVideo.finalize();
    console.log('Atualização automática concluída.');
  } catch (error) {
    console.error('Erro ao atualizar dados do YouTube:', error);
  }
}

function start() {
  cron.schedule('0 */6 * * *', () => {
    console.log('Executando coleta agendada de dados do YouTube...');
    refreshData();
  });
}

module.exports = { start, refreshData };
