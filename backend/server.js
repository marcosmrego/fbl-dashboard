const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const database = require('./database');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, '..', 'images')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/channel', async (req, res) => {
  try {
    const channel = await database.getChannelOverview();
    res.json(channel);
  } catch (error) {
    console.error('GET /api/channel failed', error);
    res.status(500).json({ error: 'Erro ao buscar dados do canal' });
  }
});

app.get('/api/videos', async (req, res) => {
  try {
    const videos = await database.getVideos();
    res.json(videos);
  } catch (error) {
    console.error('GET /api/videos failed', error);
    res.status(500).json({ error: 'Erro ao buscar lista de vídeos' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const history = await database.getHistory();
    res.json(history);
  } catch (error) {
    console.error('GET /api/history failed', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

app.get('/api/top-videos', async (req, res) => {
  try {
    const topVideos = await database.getTopVideos();
    res.json(topVideos);
  } catch (error) {
    console.error('GET /api/top-videos failed', error);
    res.status(500).json({ error: 'Erro ao buscar top vídeos' });
  }
});

app.get('/api/refresh-data', async (req, res) => {
  try {
    await scheduler.refreshData();
    res.json({ success: true, message: 'Coleta de dados iniciada com sucesso' });
  } catch (error) {
    console.error('GET /api/refresh-data failed', error);
    res.status(500).json({ error: 'Erro ao disparar coleta de dados' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

database.init().then(async () => {
  await scheduler.refreshData();
  scheduler.start();
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Erro ao inicializar o banco de dados', error);
  process.exit(1);
});
