require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

async function owFetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OWM API error ${response.status}: ${text}`);
  }
  return response.json();
}

app.get('/api/weather', async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'City parameter is required' });
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
    const data = await owFetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch weather' });
  }
});

app.get('/api/weather/coords', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
    const data = await owFetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch weather' });
  }
});

app.get('/api/forecast', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
    const data = await owFetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch forecast' });
  }
});

app.get('/api/air', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
    const data = await owFetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch air quality' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Weather Dashboard running at http://localhost:${PORT}`);
});
