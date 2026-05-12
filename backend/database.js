const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { open } = require('sqlite');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database', 'analytics.db');

let db;

async function init() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS channel_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collected_at DATETIME,
      channel_name TEXT,
      subscribers INTEGER,
      total_views INTEGER,
      total_videos INTEGER
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      video_id TEXT PRIMARY KEY,
      title TEXT,
      published_at DATETIME,
      views INTEGER,
      likes INTEGER,
      comments INTEGER,
      duration TEXT,
      thumbnail TEXT,
      video_url TEXT,
      collected_at DATETIME
    );
  `);

  const columns = await db.all(`PRAGMA table_info(channel_stats);`);
  if (!columns.find((column) => column.name === 'channel_name')) {
    await db.exec(`ALTER TABLE channel_stats ADD COLUMN channel_name TEXT;`);
  }

  return db;
}

async function getChannelOverview() {
  const row = await db.get(`SELECT channel_name, subscribers, total_views AS views, total_videos AS videos FROM channel_stats ORDER BY collected_at DESC LIMIT 1`);
  return row || { channel_name: 'Focus Blues Lab', subscribers: 0, views: 0, videos: 0 };
}

async function getVideos() {
  return db.all(`SELECT * FROM videos ORDER BY published_at DESC LIMIT 50`);
}

async function getHistory() {
  return db.all(`SELECT collected_at, subscribers, total_views, total_videos FROM channel_stats ORDER BY collected_at ASC`);
}

async function getTopVideos() {
  const mostViewed = await db.all(`
    SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at
    FROM videos
    ORDER BY views DESC
    LIMIT 5
  `);

  const highestEngagement = await db.all(`
    SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at,
      (likes + comments) AS engagement
    FROM videos
    ORDER BY engagement DESC
    LIMIT 5
  `);

  const mostRecent = await db.all(`
    SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at
    FROM videos
    ORDER BY published_at DESC
    LIMIT 5
  `);

  const fastestGrowth = await db.all(`
    SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at,
      CASE
        WHEN julianday('now') - julianday(published_at) <= 0 THEN views
        ELSE views / (julianday('now') - julianday(published_at))
      END AS views_per_day
    FROM videos
    ORDER BY views_per_day DESC
    LIMIT 5
  `);

  return {
    mostViewed,
    highestEngagement,
    mostRecent,
    fastestGrowth,
  };
}

module.exports = {
  init,
  getChannelOverview,
  getVideos,
  getHistory,
  getTopVideos,
};
