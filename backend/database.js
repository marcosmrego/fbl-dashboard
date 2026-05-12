const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

let db;

async function init() {
  try {
    db = await pool.connect();

    // Create tables if they don't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS channel_stats (
        id SERIAL PRIMARY KEY,
        collected_at TIMESTAMP,
        channel_name TEXT,
        subscribers INTEGER,
        total_views INTEGER,
        total_videos INTEGER
      );
    `);

    await db.query(`
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

    // Check if channel_name column exists, add if not
    const columns = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'channel_stats' AND column_name = 'channel_name';
    `);

    if (columns.rows.length === 0) {
      await db.query(`ALTER TABLE channel_stats ADD COLUMN channel_name TEXT;`);
    }

    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function getChannelOverview() {
  try {
    const result = await db.query(`
      SELECT channel_name, subscribers, total_views AS views, total_videos AS videos
      FROM channel_stats
      ORDER BY collected_at DESC
      LIMIT 1
    `);
    return result.rows[0] || { channel_name: 'Focus Blues Lab', subscribers: 0, views: 0, videos: 0 };
  } catch (error) {
    console.error('Error getting channel overview:', error);
    throw error;
  }
}

async function getVideos() {
  try {
    const result = await db.query(`
      SELECT * FROM videos
      ORDER BY published_at DESC
      LIMIT 50
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting videos:', error);
    throw error;
  }
}

async function getHistory() {
  try {
    const result = await db.query(`
      SELECT collected_at, subscribers, total_views, total_videos
      FROM channel_stats
      ORDER BY collected_at ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting history:', error);
    throw error;
  }
}

async function getTopVideos() {
  try {
    const mostViewed = await db.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at
      FROM videos
      ORDER BY views DESC
      LIMIT 5
    `);

    const highestEngagement = await db.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at,
        (likes + comments) AS engagement
      FROM videos
      ORDER BY engagement DESC
      LIMIT 5
    `);

    const mostRecent = await db.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at
      FROM videos
      ORDER BY published_at DESC
      LIMIT 5
    `);

    const fastestGrowth = await db.query(`
      SELECT video_id, title, thumbnail, video_url, views, likes, comments, duration, published_at,
        CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - published_at)) / 86400 <= 0 THEN views::float
          ELSE views::float / (EXTRACT(EPOCH FROM (NOW() - published_at)) / 86400)
        END AS views_per_day
      FROM videos
      ORDER BY views_per_day DESC
      LIMIT 5
    `);

    return {
      mostViewed: mostViewed.rows,
      highestEngagement: highestEngagement.rows,
      mostRecent: mostRecent.rows,
      fastestGrowth: fastestGrowth.rows,
    };
  } catch (error) {
    console.error('Error getting top videos:', error);
    throw error;
  }
}

module.exports = {
  init,
  getChannelOverview,
  getVideos,
  getHistory,
  getTopVideos,
};
