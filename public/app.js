const API_BASE = '';
const particles = new WeatherParticles('weatherCanvas');
let map = null;
let mapMarker = null;
let currentUnit = localStorage.getItem('unit') || 'C';
let currentData = null;

const el = id => document.getElementById(id);

const ui = {
  searchInput: el('searchInput'),
  searchButton: el('searchButton'),
  unitToggle: el('unitToggle'),
  darkModeToggle: el('darkModeToggle'),
  weatherResult: el('weatherResult'),
  hourlySection: el('hourlySection'),
  hourlyList: el('hourlyList'),
  forecastSection: el('forecastSection'),
  forecastList: el('forecastList'),
  sunSection: el('sunSection'),
  sunArc: el('sunArc'),
  windSection: el('windSection'),
  windCompass: el('windCompass'),
  airSection: el('airSection'),
  airResult: el('airResult'),
  mapSection: el('mapSection'),
  weatherMap: el('weatherMap'),
  alertsSection: el('alertsSection'),
  alertsList: el('alertsList'),
  favoritesSection: el('favoritesSection'),
  favoritesList: el('favoritesList'),
  recentSection: el('recentSection'),
  recentList: el('recentList'),
  loading: el('loading'),
  error: el('error'),
};

// --- Dark Mode ---
function initDarkMode() {
  const saved = localStorage.getItem('darkMode') === 'true';
  document.body.classList.toggle('dark', saved);
  ui.darkModeToggle.textContent = saved ? '\u2600' : '\u263E';
}
ui.darkModeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark);
  ui.darkModeToggle.textContent = isDark ? '\u2600' : '\u263E';
});
initDarkMode();

// --- Unit Toggle ---
function initUnit() {
  ui.unitToggle.innerHTML = currentUnit === 'C' ? '&deg;C / &deg;F' : '&deg;F / &deg;C';
}
ui.unitToggle.addEventListener('click', () => {
  currentUnit = currentUnit === 'C' ? 'F' : 'C';
  localStorage.setItem('unit', currentUnit);
  initUnit();
  if (currentData) renderAll(currentData);
});
initUnit();

function toUnit(celsius) {
  if (currentUnit === 'F') return Math.round(celsius * 9 / 5 + 32);
  return Math.round(celsius);
}
function unitLabel() { return currentUnit === 'C' ? '\u00B0C' : '\u00B0F'; }

// --- Favorites ---
function getFavorites() { try { return JSON.parse(localStorage.getItem('favorites')) || []; } catch { return []; } }
function saveFavorites(favs) { localStorage.setItem('favorites', JSON.stringify(favs)); }
function renderFavorites() {
  const favs = getFavorites();
  ui.favoritesSection.style.display = favs.length ? 'block' : 'none';
  ui.favoritesList.innerHTML = favs.map(f =>
    `<button class="fav-chip" data-city="${f.city}">${f.city}, ${f.country} <span>&#9733;</span></button>`
  ).join('');
  ui.favoritesList.querySelectorAll('.fav-chip').forEach(b => {
    b.addEventListener('click', () => fetchWeather(b.dataset.city));
  });
}
function toggleFavorite(name, country) {
  const favs = getFavorites();
  const key = `${name},${country}`;
  const idx = favs.findIndex(f => `${f.city},${f.country}` === key);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push({ city: name, country });
  saveFavorites(favs);
  renderFavorites();
  return favs.some(f => `${f.city},${f.country}` === key);
}

// --- Recent Searches ---
function getRecent() { try { return JSON.parse(localStorage.getItem('recent')) || []; } catch { return []; } }
function addRecent(city) {
  let recents = getRecent().filter(r => r.toLowerCase() !== city.toLowerCase());
  recents.unshift(city);
  if (recents.length > 8) recents = recents.slice(0, 8);
  localStorage.setItem('recent', JSON.stringify(recents));
  renderRecent();
}
function renderRecent() {
  const recents = getRecent();
  ui.recentSection.style.display = recents.length ? 'block' : 'none';
  ui.recentList.innerHTML = recents.map(r =>
    `<button class="recent-chip" data-city="${r}">${r}</button>`
  ).join('');
  ui.recentList.querySelectorAll('.recent-chip').forEach(b => {
    b.addEventListener('click', () => fetchWeather(b.dataset.city));
  });
}
renderRecent();

// --- UI Helpers ---
function showLoading() {
  ui.loading.style.display = 'flex';
  ui.error.style.display = 'none';
  ui.weatherResult.innerHTML = '';
  [ui.hourlySection, ui.forecastSection, ui.sunSection, ui.windSection,
   ui.airSection, ui.mapSection, ui.alertsSection].forEach(s => s.style.display = 'none');
}
function hideLoading() { ui.loading.style.display = 'none'; }
function showError(msg) { ui.error.style.display = 'block'; ui.error.textContent = msg; }
function hideError() { ui.error.style.display = 'none'; }

// --- Validation ---
function validateCity(city) {
  if (!city || !city.trim()) return 'Please enter a city name.';
  if (city.trim().length < 2) return 'City name must be at least 2 characters.';
  if (/^\d+$/.test(city.trim())) return 'City name must not be only numbers.';
  return null;
}

// --- Fetch ---
async function fetchWeather(city) {
  const err = validateCity(city);
  if (err) { showError(err); return; }
  showLoading();
  try {
    const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`);
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'City not found.'); }
    const data = await res.json();
    if (data.cod !== 200) throw new Error(data.message || 'City not found.');
    addRecent(data.name);
    fetchForecastAndAir(data);
  } catch (e) { hideLoading(); showError(e.message); }
}

async function fetchForecastAndAir(weatherData) {
  const { lat, lon } = weatherData.coord;
  try {
    const [forecastRes, airRes] = await Promise.all([
      fetch(`${API_BASE}/api/forecast?lat=${lat}&lon=${lon}`),
      fetch(`${API_BASE}/api/air?lat=${lat}&lon=${lon}`)
    ]);
    const forecast = await forecastRes.json();
    const air = await airRes.json();
    renderAll({ weather: weatherData, forecast, air });
  } catch (e) {
    renderAll({ weather: weatherData, forecast: null, air: null });
  }
}

// --- Render All ---
function renderAll(data) {
  currentData = data;
  hideLoading(); hideError();
  renderWeatherCard(data.weather);
  particles.setWeather(data.weather.weather[0].main);
  if (data.forecast && data.forecast.list) {
    renderHourly(data.forecast);
    renderForecast5Day(data.forecast);
    renderSun(data.weather);
  }
  renderWind(data.weather);
  if (data.air && data.air.list) renderAir(data.air);
  renderMap(data.weather.coord.lat, data.weather.coord.lon, data.weather.name);
}

// --- Weather Card ---
function renderWeatherCard(d) {
  const favs = getFavorites();
  const isFav = favs.some(f => f.city === d.name && f.country === d.sys.country);
  ui.weatherResult.innerHTML = `
    <div class="weather-card">
      <div class="wc-header">
        <div>
          <h2>${d.name}, ${d.sys.country}</h2>
          <p class="wc-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-city="${d.name}" data-country="${d.sys.country}">${isFav ? '&#9733;' : '&#9734;'}</button>
      </div>
      <div class="wc-main">
        <img src="https://openweathermap.org/img/wn/${d.weather[0].icon}@4x.png" alt="${d.weather[0].description}" class="wc-icon">
        <div class="wc-temp-block">
          <p class="wc-temp">${toUnit(d.main.temp)}<span class="wc-unit">${unitLabel()}</span></p>
          <p class="wc-desc">${d.weather[0].description}</p>
          <p class="wc-feels">Feels like ${toUnit(d.main.feels_like)}${unitLabel()}</p>
        </div>
      </div>
      <div class="wc-details">
        <div class="wc-detail"><span class="wc-label">Humidity</span><span class="wc-val">${d.main.humidity}%</span></div>
        <div class="wc-detail"><span class="wc-label">Wind</span><span class="wc-val">${d.wind.speed} m/s</span></div>
        <div class="wc-detail"><span class="wc-label">Pressure</span><span class="wc-val">${d.main.pressure} hPa</span></div>
        <div class="wc-detail"><span class="wc-label">Visibility</span><span class="wc-val">${(d.visibility / 1000).toFixed(1)} km</span></div>
        <div class="wc-detail"><span class="wc-label">Clouds</span><span class="wc-val">${d.clouds.all}%</span></div>
        <div class="wc-detail"><span class="wc-label">Min / Max</span><span class="wc-val">${toUnit(d.main.temp_min)} / ${toUnit(d.main.temp_max)}${unitLabel()}</span></div>
      </div>
    </div>`;

  ui.weatherResult.querySelector('.fav-btn').addEventListener('click', function () {
    const nowFav = toggleFavorite(this.dataset.city, this.dataset.country);
    this.classList.toggle('active', nowFav);
    this.innerHTML = nowFav ? '&#9733;' : '&#9734;';
  });
}

// --- Hourly Forecast (next 24h from 3-hour intervals) ---
function renderHourly(fd) {
  if (!fd.list || !fd.list.length) { ui.hourlySection.style.display = 'none'; return; }
  ui.hourlySection.style.display = 'block';
  const now = Date.now() / 1000;
  const upcoming = fd.list.filter(f => f.dt >= now).slice(0, 8);
  ui.hourlyList.innerHTML = upcoming.map(h => {
    const time = new Date(h.dt * 1000);
    const hr = time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    return `<div class="hourly-card">
      <p class="h-time">${hr}</p>
      <img src="https://openweathermap.org/img/wn/${h.weather[0].icon}@2x.png" alt="" class="h-icon">
      <p class="h-temp">${toUnit(h.main.temp)}${unitLabel()}</p>
      <p class="h-desc">${h.weather[0].main}</p>
    </div>`;
  }).join('');
}

// --- 5-Day Forecast (grouped by day) ---
function renderForecast5Day(fd) {
  if (!fd.list || !fd.list.length) { ui.forecastSection.style.display = 'none'; return; }
  ui.forecastSection.style.display = 'block';
  const days = {};
  fd.list.forEach(item => {
    const date = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!days[date]) days[date] = { temps: [], icons: [], descs: [] };
    days[date].temps.push(item.main.temp);
    days[date].icons.push(item.weather[0].icon);
    days[date].descs.push(item.weather[0].main);
  });
  const entries = Object.entries(days).slice(0, 5);
  ui.forecastList.innerHTML = entries.map(([day, data]) => {
    const hi = Math.max(...data.temps);
    const lo = Math.min(...data.temps);
    const midIcon = data.icons[Math.floor(data.icons.length / 2)];
    const midDesc = data.descs[Math.floor(data.descs.length / 2)];
    return `<div class="fc-card">
      <p class="fc-day">${day}</p>
      <img src="https://openweathermap.org/img/wn/${midIcon}@2x.png" alt="" class="fc-icon">
      <p class="fc-desc">${midDesc}</p>
      <p class="fc-temp"><span class="fc-hi">${toUnit(hi)}&deg;</span> / <span class="fc-lo">${toUnit(lo)}&deg;</span></p>
    </div>`;
  }).join('');
}

// --- Sunrise / Sunset ---
function renderSun(wd) {
  if (!wd.sys) { ui.sunSection.style.display = 'none'; return; }
  ui.sunSection.style.display = 'block';
  const rise = new Date(wd.sys.sunrise * 1000);
  const set = new Date(wd.sys.sunset * 1000);
  const now = new Date();
  const riseStr = rise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const setStr = set.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dayLen = set.getTime() - rise.getTime();
  const elapsed = now.getTime() - rise.getTime();
  const progress = Math.max(0, Math.min(1, elapsed / dayLen));
  const isDay = progress > 0 && progress < 1;

  ui.sunArc.innerHTML = `
    <div class="sun-arc">
      <svg viewBox="0 0 300 160" class="sun-svg">
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ff9800" stop-opacity="0.3"/>
            <stop offset="50%" stop-color="#ffb300" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#f44336" stop-opacity="0.3"/>
          </linearGradient>
        </defs>
        <path d="M 20 140 Q 150 -20 280 140" fill="none" stroke="url(#arcGrad)" stroke-width="3" stroke-dasharray="6,4"/>
        <line x1="20" y1="140" x2="280" y2="140" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
        <circle cx="${20 + progress * 260}" cy="${140 - Math.sin(progress * Math.PI) * 150}" r="10" fill="${isDay ? '#ffb300' : '#5c6bc0'}"/>
        <circle cx="20" cy="140" r="5" fill="#ff9800"/>
        <circle cx="280" cy="140" r="5" fill="#f44336"/>
      </svg>
    </div>
    <div class="sun-times">
      <div class="sun-time"><span class="sun-label">Sunrise</span><span class="sun-val">${riseStr}</span></div>
      <div class="sun-time"><span class="sun-label">Sunset</span><span class="sun-val">${setStr}</span></div>
    </div>`;
}

// --- Wind Compass ---
function renderWind(wd) {
  if (!wd.wind) { ui.windSection.style.display = 'none'; return; }
  ui.windSection.style.display = 'block';
  const deg = wd.wind.deg || 0;
  const speed = wd.wind.speed || 0;
  const gust = wd.wind.gust;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const dirName = dirs[Math.round(deg / 22.5) % 16];
  ui.windCompass.innerHTML = `
    <div class="compass">
      <svg viewBox="0 0 200 200" class="compass-svg">
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
        <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <text x="100" y="22" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="12">N</text>
        <text x="185" y="105" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">E</text>
        <text x="100" y="195" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">S</text>
        <text x="16" y="105" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">W</text>
        <line x1="100" y1="100" x2="${100 + 70 * Math.sin(deg * Math.PI / 180)}" y2="${100 - 70 * Math.cos(deg * Math.PI / 180)}"
          stroke="#64b5f6" stroke-width="3" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="5" fill="#64b5f6"/>
      </svg>
    </div>
    <div class="wind-info">
      <p class="wind-speed">${speed} <small>m/s</small></p>
      <p class="wind-dir">${dirName} (${Math.round(deg)}&deg;)</p>
      ${gust ? `<p class="wind-gust">Gusts: ${gust} m/s</p>` : ''}
    </div>`;
}

// --- Air Quality ---
function renderAir(data) {
  if (!data.list || !data.list.length) { ui.airSection.style.display = 'none'; return; }
  ui.airSection.style.display = 'block';
  const a = data.list[0];
  const aqi = a.main.aqi;
  const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  const colors = ['#4caf50', '#8bc34a', '#ff9800', '#f44336', '#9c27b0'];
  const c = a.components;
  ui.airResult.innerHTML = `
    <div class="air-card">
      <div class="aqi-badge" style="background:${colors[aqi - 1]}">
        <span class="aqi-num">${aqi}</span>
        <span class="aqi-label">${labels[aqi - 1]}</span>
      </div>
      <div class="air-pollutants">
        <div class="pollutant"><span>CO</span><span>${c.co.toFixed(0)} &micro;g/m&sup3;</span></div>
        <div class="pollutant"><span>NO<sub>2</sub></span><span>${c.no2.toFixed(1)} &micro;g/m&sup3;</span></div>
        <div class="pollutant"><span>O<sub>3</sub></span><span>${c.o3.toFixed(1)} &micro;g/m&sup3;</span></div>
        <div class="pollutant"><span>PM2.5</span><span>${c.pm2_5.toFixed(1)} &micro;g/m&sup3;</span></div>
        <div class="pollutant"><span>PM10</span><span>${c.pm10.toFixed(1)} &micro;g/m&sup3;</span></div>
        <div class="pollutant"><span>SO<sub>2</sub></span><span>${c.so2.toFixed(1)} &micro;g/m&sup3;</span></div>
      </div>
    </div>`;
}

// --- Map ---
function renderMap(lat, lon, name) {
  ui.mapSection.style.display = 'block';
  if (!map) {
    map = L.map('weatherMap').setView([lat, lon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
  } else {
    map.setView([lat, lon], 10);
  }
  if (mapMarker) map.removeLayer(mapMarker);
  mapMarker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>${name}</b>`).openPopup();
  setTimeout(() => map.invalidateSize(), 200);
}

// --- Search ---
function search() {
  const city = ui.searchInput.value.trim();
  fetchWeather(city);
}
ui.searchButton.addEventListener('click', search);
ui.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

renderFavorites();
