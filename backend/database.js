const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_stats (
      id SERIAL PRIMARY KEY,
      collected_at TIMESTAMP,
      channel_name TEXT,
      subscribers INTEGER,
      total_views INTEGER,
      total_videos INTEGER
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
      video_id TEXT PRIMARY KEY,
      title TEXT,
      published_at TIMESTAMP,
      views INTEGER,
      likes INTEGER,
      comments INTEGER,
      duration TEXT,
      thumbnail TEXT,
      video_url TEXT,
      collected_at TIMESTAMP
    );
  `);

  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'channel_stats' AND column_name = 'channel_name';
  `);
  if (rows.length === 0) {
    await pool.query(`ALTER TABLE channel_stats ADD COLUMN channel_name TEXT;`);
  }

  console.log('Banco de dados inicializado com sucesso');
}

async function saveChannelStats(data) {
  await pool.query(
    `INSERT INTO channel_stats (collected_at, channel_name, subscribers, total_views, total_videos)
     VALUES ($1, $2, $3, $4, $5)`,
    [new Date(), data.channel_name, data.subscribers, data.views, data.videos]
  );
}

async function saveVideos(videos) {
  for (const video of videos) {
    await pool.query(
      `INSERT INTO videos (video_id, title, published_at, views, likes, comments, duration, thumbnail, video_url, collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (video_id) DO UPDATE SET
         title = EXCLUDED.title,
         views = EXCLUDED.views,
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         duration = EXCLUDED.duration,
         thumbnail = EXCLUDED.thumbnail,
         collected_at = EXCLUDED.collected_at`,
      [
        video.video_id,
        video.title,
        video.published_at,
        video.views,
        video.likes,
        video.comments,
        video.duration,
        video.thumbnail,
        video.video_url,
        video.collected_at,
      ]
    );
  }
}

async function getChannelOverview() {
  const { rows } = await pool.query(`
    SELECT channel_name, subscribers, total_views AS views, total_videos AS videos
    FROM channel_stats
    ORDER BY collected_at DESC
    LIMIT 1
  `);
  return rows[0] || { channel_name: 'Focus Blues Lab', subscribers: 0, views: 0, videos: 0 };
}

async function getVideos() {
  const { rows } = await pool.query(`
    SELECT * FROM videos
    ORDER BY published_at DESC
    LIMIT 50
  `);
  return rows;
}

async function getHistory() {
  const { rows } = await pool.query(`
    SELECT collected_at, subscribers, total_views, total_videos
    FROM channel_stats
    ORDER BY collected_at ASC
  `);
  return rows;
}

async function getTopVideos() {
  const [mostViewed, highestEngagement, mostRecent, fastestGrowth] = await Promise.all([
    pool.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at
      FROM videos ORDER BY views DESC LIMIT 5
    `),
    pool.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at,
        (likes + comments) AS engagement
      FROM videos ORDER BY engagement DESC LIMIT 5
    `),
    pool.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at
      FROM videos ORDER BY published_at DESC LIMIT 5
    `),
    pool.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at,
        CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - published_at)) / 86400 <= 0 THEN views::float
          ELSE views::float / (EXTRACT(EPOCH FROM (NOW() - published_at)) / 86400)
        END AS views_per_day
      FROM videos ORDER BY views_per_day DESC LIMIT 5
    `),
  ]);

  return {
    mostViewed: mostViewed.rows,
    highestEngagement: highestEngagement.rows,
    mostRecent: mostRecent.rows,
    fastestGrowth: fastestGrowth.rows,
  };
}

module.exports = {
  init,
  saveChannelStats,
  saveVideos,
  getChannelOverview,
  getVideos,
  getHistory,
  getTopVideos,
};
