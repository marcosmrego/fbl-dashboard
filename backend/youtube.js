const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!API_KEY || !CHANNEL_ID) {
  console.warn('Aviso: YOUTUBE_API_KEY e CHANNEL_ID não estão configurados em backend/.env');
}

const buildUrl = (endpoint, params) => {
  const searchParams = new URLSearchParams({
    key: API_KEY,
    ...params,
  });
  return `https://www.googleapis.com/youtube/v3/${endpoint}?${searchParams.toString()}`;
};

async function fetchChannelData() {
  const url = buildUrl('channels', {
    part: 'snippet,statistics',
    id: CHANNEL_ID,
  });
  const response = await axios.get(url);
  const item = response.data.items?.[0] || {};
  return {
    channel_name: item.snippet?.title || 'Focus Blues Lab',
    subscribers: Number(item.statistics?.subscriberCount || 0),
    views: Number(item.statistics?.viewCount || 0),
    videos: Number(item.statistics?.videoCount || 0),
  };
}

async function fetchVideosData() {
  const url = buildUrl('search', {
    part: 'snippet',
    channelId: CHANNEL_ID,
    maxResults: 20,
    order: 'date',
    type: 'video',
  });
  const response = await axios.get(url);
  const videoIds = response.data.items.map((item) => item.id.videoId).join(',');

  if (!videoIds) {
    return [];
  }

  const detailsUrl = buildUrl('videos', {
    part: 'snippet,statistics,contentDetails',
    id: videoIds,
  });

  const detailsResponse = await axios.get(detailsUrl);
  return detailsResponse.data.items.map((item) => ({
    video_id: item.id,
    title: item.snippet.title,
    published_at: item.snippet.publishedAt,
    views: Number(item.statistics.viewCount || 0),
    likes: Number(item.statistics.likeCount || 0),
    comments: Number(item.statistics.commentCount || 0),
    duration: item.contentDetails.duration,
    thumbnail: item.snippet.thumbnails?.medium?.url || '',
    video_url: `https://www.youtube.com/watch?v=${item.id}`,
    collected_at: new Date().toISOString(),
  }));
}

module.exports = {
  fetchChannelData,
  fetchVideosData,
};
