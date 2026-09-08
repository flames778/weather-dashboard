const API_BASE = '';
const particles = new WeatherParticles('weatherCanvas');
let map = null;
let mapMarker = null;
let currentUnit = localStorage.getItem('unit') || 'C';
let currentData = null;
let soundEnabled = localStorage.getItem('sound') === 'true';
let audioCtx = null;
let soundNodes = {};
const el = id => document.getElementById(id);

const ui = {
  searchInput: el('searchInput'), searchButton: el('searchButton'), geoButton: el('geoButton'),
  unitToggle: el('unitToggle'), darkModeToggle: el('darkModeToggle'),
  soundToggle: el('soundToggle'), notifyToggle: el('notifyToggle'),
  weatherResult: el('weatherResult'),
  clothingSection: el('clothingSection'), clothingResult: el('clothingResult'),
  uvSection: el('uvSection'), uvResult: el('uvResult'),
  moonSection: el('moonSection'), moonResult: el('moonResult'),
  tempTrendSection: el('tempTrendSection'), tempTrendResult: el('tempTrendResult'),
  hourlySection: el('hourlySection'), hourlyList: el('hourlyList'),
  forecastSection: el('forecastSection'), forecastList: el('forecastList'),
  sunSection: el('sunSection'), sunArc: el('sunArc'),
  windSection: el('windSection'), windCompass: el('windCompass'),
  airSection: el('airSection'), airResult: el('airResult'),
  mapSection: el('mapSection'), weatherMap: el('weatherMap'),
  alertsSection: el('alertsSection'), alertsList: el('alertsList'),
  multiCitySection: el('multiCitySection'), multiCityGrid: el('multiCityGrid'),
  travelSection: el('travelSection'), travelGrid: el('travelGrid'),
  travelInput: el('travelInput'), travelAddBtn: el('travelAddBtn'), travelClearBtn: el('travelClearBtn'),
  calendarSection: el('calendarSection'), calendarResult: el('calendarResult'),
  shareSection: el('shareSection'), shareBtn: el('shareBtn'),
  sharePreview: el('sharePreview'), shareCanvas: el('shareCanvas'), downloadShareBtn: el('downloadShareBtn'),
  widgetSection: el('widgetSection'), widgetResult: el('widgetResult'),
  favoritesSection: el('favoritesSection'), favoritesList: el('favoritesList'),
  recentSection: el('recentSection'), recentList: el('recentList'),
  loading: el('loading'), error: el('error'),
};

// ====== DARK MODE ======
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

// ====== UNIT TOGGLE ======
function initUnit() { ui.unitToggle.innerHTML = currentUnit === 'C' ? '&deg;C / &deg;F' : '&deg;F / &deg;C'; }
ui.unitToggle.addEventListener('click', () => {
  currentUnit = currentUnit === 'C' ? 'F' : 'C';
  localStorage.setItem('unit', currentUnit); initUnit();
  if (currentData) renderAll(currentData);
});
initUnit();
function toUnit(c) { return currentUnit === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c); }
function unitLabel() { return currentUnit === 'C' ? '\u00B0C' : '\u00B0F'; }

// ====== WEATHER SOUNDS ======
ui.soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('sound', soundEnabled);
  ui.soundToggle.style.background = soundEnabled ? 'rgba(100,181,246,0.4)' : '';
  if (!soundEnabled) stopSounds();
  else if (currentData) playWeatherSounds(currentData.weather.weather[0].main);
});
ui.soundToggle.style.background = soundEnabled ? 'rgba(100,181,246,0.4)' : '';

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function createNoise(type) {
  initAudio();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer; source.loop = true;
  const filter = audioCtx.createBiquadFilter();
  filter.type = type; filter.frequency.value = type === 'lowpass' ? 400 : 1000;
  const gain = audioCtx.createGain(); gain.gain.value = 0;
  source.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  source.start();
  return { source, gain, filter };
}
function fadeGain(gain, val, dur) { gain.gain.linearRampToValueAtTime(val, audioCtx.currentTime + dur); }
function playWeatherSounds(main) {
  stopSounds(); if (!soundEnabled) return;
  const w = (main || '').toLowerCase();
  if (w.includes('rain') || w.includes('drizzle')) {
    soundNodes.rain = createNoise('lowpass'); fadeGain(soundNodes.rain.gain, 0.08, 1);
  } else if (w.includes('snow')) {
    soundNodes.snow = createNoise('lowpass'); fadeGain(soundNodes.snow.gain, 0.04, 1);
  } else if (w.includes('thunder')) {
    soundNodes.rain = createNoise('lowpass'); fadeGain(soundNodes.rain.gain, 0.1, 1);
  } else if (w.includes('wind') || w.includes('mist') || w.includes('fog')) {
    soundNodes.wind = createNoise('bandpass'); soundNodes.wind.filter.frequency.value = 300;
    fadeGain(soundNodes.wind.gain, 0.06, 1);
  }
}
function stopSounds() {
  Object.values(soundNodes).forEach(n => { try { n.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5); setTimeout(() => n.source.stop(), 600); } catch(e){} });
  soundNodes = {};
}

// ====== NOTIFICATIONS ======
let notificationsEnabled = Notification.permission === 'granted';
ui.notifyToggle.addEventListener('click', async () => {
  if (notificationsEnabled) { notificationsEnabled = false; ui.notifyToggle.style.background = ''; return; }
  const perm = await Notification.requestPermission();
  notificationsEnabled = perm === 'granted';
  ui.notifyToggle.style.background = notificationsEnabled ? 'rgba(100,181,246,0.4)' : '';
  if (notificationsEnabled && currentData) checkWeatherAlerts(currentData);
});
function checkWeatherAlerts(data) {
  if (!notificationsEnabled || !data.forecast) return;
  const fd = data.forecast;
  if (fd.list) {
    fd.list.forEach(item => {
      if (item.pop > 0.7 && item.dt - Date.now()/1000 < 10800) {
        new Notification('Weather Alert', { body: `Rain expected in ${Math.round((item.dt - Date.now()/1000)/3600)}h - ${(item.pop*100).toFixed(0)}% chance` });
      }
    });
  }
}

// ====== GEOLOCATION ======
ui.geoButton.addEventListener('click', () => {
  if (!navigator.geolocation) { showError('Geolocation not supported'); return; }
  showLoading();
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
    () => { hideLoading(); showError('Location access denied. Try searching a city.'); }
  );
});

async function fetchWeatherByCoords(lat, lon) {
  showLoading();
  try {
    const res = await fetch(`${API_BASE}/api/weather/coords?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error('Failed to fetch weather');
    const data = await res.json();
    if (data.cod !== 200) throw new Error(data.message);
    addRecent(data.name);
    fetchForecastAndAir(data);
  } catch (e) { hideLoading(); showError(e.message); }
}

// ====== FAVORITES ======
function getFavorites() { try { return JSON.parse(localStorage.getItem('favorites')) || []; } catch { return []; } }
function saveFavorites(f) { localStorage.setItem('favorites', JSON.stringify(f)); }
function renderFavorites() {
  const favs = getFavorites();
  ui.favoritesSection.style.display = favs.length ? 'block' : 'none';
  ui.favoritesList.innerHTML = favs.map(f =>
    `<button class="tag-chip" data-city="${f.city}">${f.city}, ${f.country} <span>&#9733;</span></button>`
  ).join('');
  ui.favoritesList.querySelectorAll('.tag-chip').forEach(b => b.addEventListener('click', () => fetchWeather(b.dataset.city)));
}
function toggleFavorite(name, country) {
  const favs = getFavorites();
  const key = `${name},${country}`;
  const idx = favs.findIndex(f => `${f.city},${f.country}` === key);
  if (idx >= 0) favs.splice(idx, 1); else favs.push({ city: name, country });
  saveFavorites(favs); renderFavorites();
  return favs.some(f => `${f.city},${f.country}` === key);
}

// ====== RECENT ======
function getRecent() { try { return JSON.parse(localStorage.getItem('recent')) || []; } catch { return []; } }
function addRecent(city) {
  let r = getRecent().filter(x => x.toLowerCase() !== city.toLowerCase());
  r.unshift(city); if (r.length > 8) r = r.slice(0, 8);
  localStorage.setItem('recent', JSON.stringify(r)); renderRecent();
}
function renderRecent() {
  const r = getRecent();
  ui.recentSection.style.display = r.length ? 'block' : 'none';
  ui.recentList.innerHTML = r.map(x => `<button class="tag-chip" data-city="${x}">${x}</button>`).join('');
  ui.recentList.querySelectorAll('.tag-chip').forEach(b => b.addEventListener('click', () => fetchWeather(b.dataset.city)));
}
renderRecent();

// ====== UI HELPERS ======
function showLoading() {
  ui.loading.style.display = 'flex'; ui.error.style.display = 'none'; ui.weatherResult.innerHTML = '';
  [ui.clothingSection, ui.uvSection, ui.moonSection, ui.tempTrendSection, ui.hourlySection,
   ui.forecastSection, ui.sunSection, ui.windSection, ui.airSection, ui.mapSection,
   ui.alertsSection, ui.multiCitySection, ui.travelSection, ui.calendarSection,
   ui.shareSection, ui.widgetSection].forEach(s => s.style.display = 'none');
}
function hideLoading() { ui.loading.style.display = 'none'; }
function showError(m) { ui.error.style.display = 'block'; ui.error.textContent = m; }
function hideError() { ui.error.style.display = 'none'; }
function validateCity(c) {
  if (!c || !c.trim()) return 'Please enter a city name.';
  if (c.trim().length < 2) return 'City name must be at least 2 characters.';
  if (/^\d+$/.test(c.trim())) return 'City name must not be only numbers.';
  return null;
}

// ====== FETCH ======
async function fetchWeather(city) {
  const err = validateCity(city); if (err) { showError(err); return; }
  showLoading();
  try {
    const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`);
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'City not found.'); }
    const data = await res.json();
    if (data.cod !== 200) throw new Error(data.message || 'City not found.');
    addRecent(data.name); fetchForecastAndAir(data);
  } catch (e) { hideLoading(); showError(e.message); }
}

async function fetchForecastAndAir(wd) {
  const { lat, lon } = wd.coord;
  try {
    const [fr, ar] = await Promise.all([
      fetch(`${API_BASE}/api/forecast?lat=${lat}&lon=${lon}`),
      fetch(`${API_BASE}/api/air?lat=${lat}&lon=${lon}`)
    ]);
    const forecast = await fr.json(); const air = await ar.json();
    renderAll({ weather: wd, forecast, air });
  } catch (e) { renderAll({ weather: wd, forecast: null, air: null }); }
}

// ====== RENDER ALL ======
function renderAll(data) {
  currentData = data; hideLoading(); hideError();
  renderWeatherCard(data.weather);
  particles.setWeather(data.weather.weather[0].main);
  playWeatherSounds(data.weather.weather[0].main);
  renderClothing(data.weather);
  renderMoon(data.weather.dt, data.weather.coord.lat, data.weather.coord.lon);
  if (data.forecast && data.forecast.list) {
    renderHourly(data.forecast); renderForecast5Day(data.forecast); renderTempTrend(data.forecast);
    renderCalendar(data.forecast); renderMultiCity(data.weather); checkWeatherAlerts(data);
  }
  renderSun(data.weather); renderWind(data.weather);
  if (data.air && data.air.list) renderAir(data.air);
  renderMap(data.weather.coord.lat, data.weather.coord.lon, data.weather.name);
  renderUV(data.weather); renderShareCard(data.weather); renderWidgetCode(data.weather);
}

// ====== WEATHER CARD ======
function celsiusToAll(c) {
  return {
    c: Math.round(c),
    f: Math.round(c * 9 / 5 + 32),
    k: Math.round(c + 273.15)
  };
}
function renderWeatherCard(d) {
  const favs = getFavorites();
  const isFav = favs.some(f => f.city === d.name && f.country === d.sys.country);
  const t = celsiusToAll(d.main.temp);
  const fl = celsiusToAll(d.main.feels_like);
  const mn = celsiusToAll(d.main.temp_min);
  const mx = celsiusToAll(d.main.temp_max);
  ui.weatherResult.innerHTML = `
    <div class="weather-card">
      <div class="wc-header">
        <div><h2>${d.name}, ${d.sys.country}</h2>
        <p class="wc-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-city="${d.name}" data-country="${d.sys.country}">${isFav ? '&#9733;' : '&#9734;'}</button>
      </div>
      <div class="wc-main">
        <img src="https://openweathermap.org/img/wn/${d.weather[0].icon}@4x.png" alt="" class="wc-icon">
        <div class="wc-temp-block">
          <p class="wc-temp">${toUnit(d.main.temp)}<span class="wc-unit">${unitLabel()}</span></p>
          <p class="wc-desc">${d.weather[0].description}</p>
          <p class="wc-feels">Feels like ${toUnit(d.main.feels_like)}${unitLabel()}</p>
        </div>
      </div>
      <div class="temp-all-units">
        <div class="tui"><span class="tui-val">${t.c}&deg;C</span><span class="tui-label">Celsius</span></div>
        <div class="tui"><span class="tui-val">${t.f}&deg;F</span><span class="tui-label">Fahrenheit</span></div>
        <div class="tui"><span class="tui-val">${t.k} K</span><span class="tui-label">Kelvin</span></div>
      </div>
      <div class="wc-details">
        <div class="wc-detail"><span class="wc-label">Humidity</span><span class="wc-val">${d.main.humidity}%</span></div>
        <div class="wc-detail"><span class="wc-label">Wind</span><span class="wc-val">${d.wind.speed} m/s</span></div>
        <div class="wc-detail"><span class="wc-label">Pressure</span><span class="wc-val">${d.main.pressure} hPa</span></div>
        <div class="wc-detail"><span class="wc-label">Visibility</span><span class="wc-val">${(d.visibility/1000).toFixed(1)} km</span></div>
        <div class="wc-detail"><span class="wc-label">Clouds</span><span class="wc-val">${d.clouds.all}%</span></div>
        <div class="wc-detail"><span class="wc-label">Min / Max</span><span class="wc-val">${toUnit(d.main.temp_min)} / ${toUnit(d.main.temp_max)}${unitLabel()}</span></div>
      </div>
    </div>`;
  ui.weatherResult.querySelector('.fav-btn').addEventListener('click', function() {
    const now = toggleFavorite(this.dataset.city, this.dataset.country);
    this.classList.toggle('active', now); this.innerHTML = now ? '&#9733;' : '&#9734;';
  });
}

// ====== CLOTHING RECOMMENDATIONS ======
function renderClothing(d) {
  ui.clothingSection.style.display = 'block';
  const temp = d.main.temp;
  const w = d.weather[0].main.toLowerCase();
  const items = [];
  if (temp < 0) items.push({ icon: '&#129506;', text: 'Heavy winter coat, gloves, scarf, warm boots' });
  else if (temp < 10) items.push({ icon: '&#129506;', text: 'Winter jacket, sweater, long pants' });
  else if (temp < 18) items.push({ icon: '&#129507;', text: 'Light jacket or hoodie' });
  else if (temp < 25) items.push({ icon: '&#128085;', text: 'T-shirt and jeans or light pants' });
  else if (temp < 32) items.push({ icon: '&#128086;', text: 'Shorts, tank top, sandals' });
  else items.push({ icon: '&#128086;', text: 'Minimal clothing, stay hydrated!' });

  if (w.includes('rain') || w.includes('drizzle')) items.push({ icon: '&#9748;', text: 'Bring an umbrella!' });
  if (w.includes('snow')) items.push({ icon: '&#127784;', text: 'Waterproof boots recommended' });
  if (w.includes('wind')) items.push({ icon: '&#127744;', text: 'Windbreaker recommended' });
  if (d.main.humidity > 80) items.push({ icon: '&#128167;', text: 'High humidity - wear breathable fabrics' });
  if (d.wind.speed > 10) items.push({ icon: '&#127744;', text: 'Strong wind - secure loose items' });

  const uv = estimateUV(d);
  if (uv >= 6) items.push({ icon: '&#127786;', text: 'High UV - wear sunscreen and sunglasses' });

  ui.clothingResult.innerHTML = items.map(i =>
    `<div class="clothing-item"><span class="ci-icon">${i.icon}</span><span class="ci-text">${i.text}</span></div>`
  ).join('');
}

// ====== UV INDEX ======
function estimateUV(d) {
  const hour = new Date().getHours();
  const lat = Math.abs(d.coord.lat);
  const cloudCover = d.clouds.all / 100;
  let baseUV = 0;
  if (hour >= 6 && hour <= 18) {
    const solarAngle = Math.sin(((hour - 6) / 12) * Math.PI);
    baseUV = solarAngle * (11 - lat * 0.15);
  }
  return Math.max(0, Math.min(11, baseUV * (1 - cloudCover * 0.6)));
}
function renderUV(d) {
  ui.uvSection.style.display = 'block';
  const uv = estimateUV(d);
  const labels = ['Low','Low','Low','Moderate','Moderate','Moderate','High','High','Very High','Very High','Very High','Extreme'];
  const colors = ['#4caf50','#4caf50','#4caf50','#ff9800','#ff9800','#ff9800','#f44336','#f44336','#9c27b0','#9c27b0','#9c27b0','#7b1fa2'];
  const tips = {
    'Low': 'No protection needed',
    'Moderate': 'Wear sunglasses, use SPF 30+',
    'High': 'Seek shade during midday, use SPF 50+',
    'Very High': 'Avoid sun 10am-4pm, wear protective clothing',
    'Extreme': 'Stay indoors if possible, full sun protection required'
  };
  const label = labels[Math.min(Math.round(uv), 11)];
  const color = colors[Math.min(Math.round(uv), 11)];
  const tip = tips[label];
  ui.uvResult.innerHTML = `
    <div class="uv-card">
      <div class="uv-gauge"><div class="uv-fill" style="width:${(uv/11)*100}%;background:${color}"></div></div>
      <div class="uv-info">
        <span class="uv-num" style="color:${color}">${uv.toFixed(1)}</span>
        <span class="uv-label" style="color:${color}">${label}</span>
      </div>
      <p class="uv-tip">${tip}</p>
    </div>`;
}

// ====== MOON PHASE ======
function getMoonPhase(date) {
  const year = date.getFullYear(); const month = date.getMonth() + 1; const day = date.getDate();
  let c = 0, e = 0, jd = 0, b = 0;
  if (month < 3) { year--; month += 12; }
  ++month; c = 365.25 * year; e = 30.6 * month;
  jd = c + e + day - 694039.09; jd /= 29.5305882;
  b = parseInt(jd); jd -= b; b = Math.round(jd * 8);
  if (b >= 8) b = 0;
  return b;
}

function calcMoonriseSet(lat, lon, date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  let y = year, m = month;
  if (m < 3) { y--; m += 12; }
  m++;
  const jd0 = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * m) + day - 1524.5;
  const T = (jd0 - 2451545.0) / 36525.0;

  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360;
  const Mrad = M * rad;
  const C = (1.9146 - 0.004817 * T) * Math.sin(Mrad) + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad);
  const sunLong = (L0 + C) % 360;
  const sunAnom = M + C;
  const sunR = 1.000001018 * (1 - 0.016708634 * Math.cos(Mrad));

  const N = (125.0445 - 1934.13626 * T) % 360;
  const Nrad = N * rad;
  const p = -0.00569 - 0.00478 * Math.sin(Nrad);
  const w = 218.316 + 481267.881 * T;
  const moonLon = w + 6.289 * Math.sin(p * deg * rad + (6.289 * Math.sin((sunLong - w) * rad) * deg * rad)) / deg;
  const moonLat = 5.128 * Math.sin((sunLong + 275.05 - 2.3) * rad);

  const jd = jd0;
  const h0 = (0.7275 * moonLat * rad) - 0.01454;
  const cosH = (Math.sin(-0.01454) - Math.sin(lat * rad) * Math.sin(moonLat * rad)) /
               (Math.cos(lat * rad) * Math.cos(moonLat * rad));
  let H = 0;
  if (cosH < -1) H = 180;
  else if (cosH > 1) H = 0;
  else H = Math.acos(cosH) * deg;

  const moonPhaseAngle = ((sunLong - moonLon + 180) % 360) * rad;
  const transitOffset = 2451545.0009 + 27.321661 * Math.atan2(Math.sin(moonPhaseAngle), Math.cos(moonPhaseAngle) * Math.cos(moonLat * rad));
  const riseTime = transitOffset - H / 360 * 27.321661;
  const setTime = transitOffset + H / 360 * 27.321661;

  function jdToDate(jd) {
    const d = new Date((jd - 2440587.5) * 86400000);
    return d;
  }

  const rise = jdToDate(riseTime);
  const set = jdToDate(setTime);
  const transit = jdToDate(transitOffset);

  // Adjust to current date
  const riseLocal = new Date(date);
  riseLocal.setHours(rise.getUTCHours(), rise.getUTCMinutes(), 0);
  const setLocal = new Date(date);
  setLocal.setHours(set.getUTCHours(), set.getUTCMinutes(), 0);
  const transitLocal = new Date(date);
  transitLocal.setHours(transit.getUTCHours(), transit.getUTCMinutes(), 0);

  return { rise: riseLocal, set: setLocal, transit: transitLocal };
}

function renderMoon(dt, lat, lon) {
  ui.moonSection.style.display = 'block';
  const d = new Date(dt * 1000);
  const phase = getMoonPhase(d);
  const names = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  const emojis = ['&#127761;','&#127762;','&#127763;','&#127764;','&#127765;','&#127766;','&#127767;','&#127768;'];
  const illumination = [0, 12, 25, 50, 75, 100, 75, 50, 25][phase] || 0;

  const moonTimes = calcMoonriseSet(lat || 0, lon || 0, d);
  const riseStr = moonTimes.rise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const setStr = moonTimes.set.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const transitStr = moonTimes.transit.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const now = Date.now();
  const riseT = moonTimes.rise.getTime();
  const setT = moonTimes.set.getTime();
  const transitT = moonTimes.transit.getTime();
  let moonProgress = 0;
  if (now >= riseT && now <= setT) {
    moonProgress = (now - riseT) / (setT - riseT);
  } else if (now > setT) {
    moonProgress = 1;
  }
  const isUp = now >= riseT && now <= setT;

  ui.moonResult.innerHTML = `
    <div class="moon-card">
      <span class="moon-emoji">${emojis[phase]}</span>
      <p class="moon-name">${names[phase]}</p>
      <p class="moon-illum">${illumination}% illuminated</p>
      <div class="moon-arc">
        <svg viewBox="0 0 300 140" class="moon-svg">
          <defs><linearGradient id="moonArcGrad" x1="0%" x2="100%">
            <stop offset="0%" stop-color="#5c6bc0" stop-opacity="0.3"/>
            <stop offset="50%" stop-color="#7986cb" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#3f51b5" stop-opacity="0.3"/>
          </linearGradient></defs>
          <path d="M 20 120 Q 150 -10 280 120" fill="none" stroke="url(#moonArcGrad)" stroke-width="3" stroke-dasharray="6,4"/>
          <line x1="20" y1="120" x2="280" y2="120" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
          <circle cx="${20 + moonProgress * 260}" cy="${120 - Math.sin(moonProgress * Math.PI) * 130}" r="10" fill="${isUp ? '#7986cb' : '#455a64'}"/>
          <circle cx="20" cy="120" r="5" fill="#5c6bc0"/>
          <circle cx="280" cy="120" r="5" fill="#3f51b5"/>
        </svg>
      </div>
      <div class="moon-times">
        <div class="moon-time"><span class="mt-label">Moonrise</span><span class="mt-val">${riseStr}</span></div>
        <div class="moon-time"><span class="mt-label">Transit</span><span class="mt-val">${transitStr}</span></div>
        <div class="moon-time"><span class="mt-label">Moonset</span><span class="mt-val">${setStr}</span></div>
      </div>
    </div>`;
}

// ====== TEMP TREND GRAPH ======
function renderTempTrend(fd) {
  if (!fd.list) { ui.tempTrendSection.style.display = 'none'; return; }
  ui.tempTrendSection.style.display = 'block';
  const now = Date.now() / 1000;
  const points = fd.list.filter(f => f.dt >= now).slice(0, 8);
  if (!points.length) { ui.tempTrendSection.style.display = 'none'; return; }
  const temps = points.map(p => p.main.temp);
  const minT = Math.min(...temps) - 2; const maxT = Math.max(...temps) + 2;
  const w = 560; const h = 180; const padX = 40; const padY = 30;
  const graphW = w - padX * 2; const graphH = h - padY * 2;
  const pathPoints = temps.map((t, i) => {
    const x = padX + (i / (temps.length - 1)) * graphW;
    const y = padY + (1 - (t - minT) / (maxT - minT)) * graphH;
    return { x, y, temp: t };
  });
  const pathD = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = pathD + ` L${pathPoints[pathPoints.length-1].x},${h-padY} L${pathPoints[0].x},${h-padY} Z`;
  const labels = points.map(p => new Date(p.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }));
  ui.tempTrendResult.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="trend-svg">
      <defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#64b5f6" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#64b5f6" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${areaD}" fill="url(#trendGrad)"/>
      <path d="${pathD}" fill="none" stroke="#64b5f6" stroke-width="2.5" stroke-linecap="round"/>
      ${pathPoints.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#64b5f6"/>
        <text x="${p.x}" y="${p.y-10}" text-anchor="middle" fill="currentColor" font-size="11" font-weight="600">${toUnit(p.temp)}°</text>
        <text x="${p.x}" y="${h-8}" text-anchor="middle" fill="currentColor" font-size="9" opacity="0.5">${labels[i]}</text>
      `).join('')}
    </svg>`;
}

// ====== HOURLY ======
function renderHourly(fd) {
  if (!fd.list || !fd.list.length) { ui.hourlySection.style.display = 'none'; return; }
  ui.hourlySection.style.display = 'block';
  const now = Date.now() / 1000;
  const upcoming = fd.list.filter(f => f.dt >= now).slice(0, 8);
  ui.hourlyList.innerHTML = upcoming.map(h => {
    const hr = new Date(h.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    return `<div class="hourly-card"><p class="h-time">${hr}</p>
      <img src="https://openweathermap.org/img/wn/${h.weather[0].icon}@2x.png" alt="" class="h-icon">
      <p class="h-temp">${toUnit(h.main.temp)}${unitLabel()}</p><p class="h-desc">${h.weather[0].main}</p></div>`;
  }).join('');
}

// ====== 5-DAY FORECAST ======
function renderForecast5Day(fd) {
  if (!fd.list || !fd.list.length) { ui.forecastSection.style.display = 'none'; return; }
  ui.forecastSection.style.display = 'block';
  const days = {};
  fd.list.forEach(item => {
    const date = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!days[date]) days[date] = { temps: [], icons: [], descs: [] };
    days[date].temps.push(item.main.temp); days[date].icons.push(item.weather[0].icon); days[date].descs.push(item.weather[0].main);
  });
  ui.forecastList.innerHTML = Object.entries(days).slice(0, 5).map(([day, d]) => {
    const hi = Math.max(...d.temps), lo = Math.min(...d.temps);
    const midI = d.icons[Math.floor(d.icons.length/2)], midD = d.descs[Math.floor(d.descs.length/2)];
    return `<div class="fc-card"><p class="fc-day">${day}</p>
      <img src="https://openweathermap.org/img/wn/${midI}@2x.png" alt="" class="fc-icon">
      <p class="fc-desc">${midD}</p>
      <p class="fc-temp"><span class="fc-hi">${toUnit(hi)}&deg;</span> / <span class="fc-lo">${toUnit(lo)}&deg;</span></p></div>`;
  }).join('');
}

// ====== SUNRISE/SUNSET ======
function renderSun(d) {
  if (!d.sys) { ui.sunSection.style.display = 'none'; return; }
  ui.sunSection.style.display = 'block';
  const rise = new Date(d.sys.sunrise * 1000), set = new Date(d.sys.sunset * 1000), now = new Date();
  const riseStr = rise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const setStr = set.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const progress = Math.max(0, Math.min(1, (now - rise) / (set - rise)));
  const isDay = progress > 0 && progress < 1;
  ui.sunArc.innerHTML = `
    <div class="sun-arc"><svg viewBox="0 0 300 160" class="sun-svg">
      <defs><linearGradient id="arcGrad" x1="0%" x2="100%">
        <stop offset="0%" stop-color="#ff9800" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="#ffb300" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#f44336" stop-opacity="0.3"/>
      </linearGradient></defs>
      <path d="M 20 140 Q 150 -20 280 140" fill="none" stroke="url(#arcGrad)" stroke-width="3" stroke-dasharray="6,4"/>
      <line x1="20" y1="140" x2="280" y2="140" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <circle cx="${20+progress*260}" cy="${140-Math.sin(progress*Math.PI)*150}" r="10" fill="${isDay?'#ffb300':'#5c6bc0'}"/>
      <circle cx="20" cy="140" r="5" fill="#ff9800"/><circle cx="280" cy="140" r="5" fill="#f44336"/>
    </svg></div>
    <div class="sun-times">
      <div class="sun-time"><span class="sun-label">Sunrise</span><span class="sun-val">${riseStr}</span></div>
      <div class="sun-time"><span class="sun-label">Sunset</span><span class="sun-val">${setStr}</span></div>
    </div>`;
}

// ====== WIND COMPASS ======
function renderWind(d) {
  if (!d.wind) { ui.windSection.style.display = 'none'; return; }
  ui.windSection.style.display = 'block';
  const deg = d.wind.deg || 0, speed = d.wind.speed || 0, gust = d.wind.gust;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const dirName = dirs[Math.round(deg/22.5)%16];
  ui.windCompass.innerHTML = `
    <div class="compass"><svg viewBox="0 0 200 200" class="compass-svg">
      <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
      <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <text x="100" y="22" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="12">N</text>
      <text x="185" y="105" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">E</text>
      <text x="100" y="195" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">S</text>
      <text x="16" y="105" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">W</text>
      <line x1="100" y1="100" x2="${100+70*Math.sin(deg*Math.PI/180)}" y2="${100-70*Math.cos(deg*Math.PI/180)}" stroke="#64b5f6" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="100" r="5" fill="#64b5f6"/>
    </svg></div>
    <div class="wind-info"><p class="wind-speed">${speed} <small>m/s</small></p>
      <p class="wind-dir">${dirName} (${Math.round(deg)}&deg;)</p>${gust?`<p class="wind-gust">Gusts: ${gust} m/s</p>`:''}</div>`;
}

// ====== AIR QUALITY ======
function renderAir(data) {
  if (!data.list || !data.list.length) { ui.airSection.style.display = 'none'; return; }
  ui.airSection.style.display = 'block';
  const a = data.list[0], aqi = a.main.aqi;
  const labels = ['Good','Fair','Moderate','Poor','Very Poor'];
  const colors = ['#4caf50','#8bc34a','#ff9800','#f44336','#9c27b0'];
  const c = a.components;
  ui.airResult.innerHTML = `<div class="air-card">
    <div class="aqi-badge" style="background:${colors[aqi-1]}"><span class="aqi-num">${aqi}</span><span class="aqi-label">${labels[aqi-1]}</span></div>
    <div class="air-pollutants">
      <div class="pollutant"><span>CO</span><span>${c.co.toFixed(0)} &micro;g/m&sup3;</span></div>
      <div class="pollutant"><span>NO<sub>2</sub></span><span>${c.no2.toFixed(1)} &micro;g/m&sup3;</span></div>
      <div class="pollutant"><span>O<sub>3</sub></span><span>${c.o3.toFixed(1)} &micro;g/m&sup3;</span></div>
      <div class="pollutant"><span>PM2.5</span><span>${c.pm2_5.toFixed(1)} &micro;g/m&sup3;</span></div>
      <div class="pollutant"><span>PM10</span><span>${c.pm10.toFixed(1)} &micro;g/m&sup3;</span></div>
      <div class="pollutant"><span>SO<sub>2</sub></span><span>${c.so2.toFixed(1)} &micro;g/m&sup3;</span></div>
    </div></div>`;
}

// ====== MAP ======
function renderMap(lat, lon, name) {
  ui.mapSection.style.display = 'block';
  if (!map) { map = L.map('weatherMap').setView([lat, lon], 10); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map); setTimeout(() => map.invalidateSize(), 100); }
  else map.setView([lat, lon], 10);
  if (mapMarker) map.removeLayer(mapMarker);
  mapMarker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>${name}</b>`).openPopup();
  setTimeout(() => map.invalidateSize(), 200);
}

// ====== MULTI-CITY DASHBOARD ======
async function renderMultiCity(current) {
  ui.multiCitySection.style.display = 'block';
  const favs = getFavorites().filter(f => f.city !== current.name).slice(0, 5);
  const cards = [{ name: current.name, country: current.sys.country, temp: current.main.temp, icon: current.weather[0].icon, desc: current.weather[0].description, main: current.weather[0].main }];
  for (const f of favs) {
    try {
      const r = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(f.city)}`);
      if (r.ok) { const d = await r.json(); if (d.cod === 200) cards.push({ name: d.name, country: d.sys.country, temp: d.main.temp, icon: d.weather[0].icon, desc: d.weather[0].description, main: d.weather[0].main }); }
    } catch(e) {}
  }
  ui.multiCityGrid.innerHTML = cards.map(c => `
    <div class="mc-card" data-city="${c.name}" style="cursor:pointer">
      <p class="mc-name">${c.name}, ${c.country}</p>
      <img src="https://openweathermap.org/img/wn/${c.icon}@2x.png" alt="" class="mc-icon">
      <p class="mc-temp">${toUnit(c.temp)}${unitLabel()}</p>
      <p class="mc-desc">${c.desc}</p>
    </div>`).join('');
  ui.multiCityGrid.querySelectorAll('.mc-card').forEach(card => {
    card.addEventListener('click', () => fetchWeather(card.dataset.city));
  });
}

// ====== TRAVEL PLANNER ======
const travelCities = JSON.parse(localStorage.getItem('travel') || '[]');
function renderTravel() {
  ui.travelSection.style.display = 'block';
  if (!travelCities.length) { ui.travelGrid.innerHTML = '<p class="travel-empty">Add cities above to compare weather</p>'; return; }
  Promise.all(travelCities.map(c => fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(c)}`).then(r => r.json()))).then(results => {
    ui.travelGrid.innerHTML = results.filter(d => d.cod === 200).map(d => `
      <div class="travel-card">
        <p class="tc-name">${d.name}, ${d.sys.country}</p>
        <img src="https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png" alt="" class="tc-icon">
        <p class="tc-temp">${toUnit(d.main.temp)}${unitLabel()}</p>
        <p class="tc-desc">${d.weather[0].description}</p>
        <div class="tc-details">
          <span>Wind: ${d.wind.speed}m/s</span><span>Humidity: ${d.main.humidity}%</span>
        </div>
        <button class="tc-remove" data-city="${d.name}">&#10005;</button>
      </div>`).join('');
    ui.travelGrid.querySelectorAll('.tc-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = travelCities.indexOf(btn.dataset.city);
        if (idx >= 0) travelCities.splice(idx, 1);
        localStorage.setItem('travel', JSON.stringify(travelCities));
        renderTravel();
      });
    });
  });
}
ui.travelAddBtn.addEventListener('click', () => {
  const city = ui.travelInput.value.trim();
  if (city && !travelCities.includes(city) && travelCities.length < 6) {
    travelCities.push(city); localStorage.setItem('travel', JSON.stringify(travelCities));
    ui.travelInput.value = ''; renderTravel();
  }
});
ui.travelInput.addEventListener('keydown', e => { if (e.key === 'Enter') ui.travelAddBtn.click(); });
ui.travelClearBtn.addEventListener('click', () => { travelCities.length = 0; localStorage.setItem('travel', '[]'); renderTravel(); });
renderTravel();

// ====== CALENDAR ======
function renderCalendar(fd) {
  if (!fd.list) { ui.calendarSection.style.display = 'none'; return; }
  ui.calendarSection.style.display = 'block';
  const days = {};
  fd.list.forEach(item => {
    const d = new Date(item.dt * 1000);
    const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!days[key]) days[key] = { temps: [], icons: [], descs: [], pops: [] };
    days[key].temps.push(item.main.temp); days[key].icons.push(item.weather[0].icon);
    days[key].descs.push(item.weather[0].main); days[key].pops.push(item.pop || 0);
  });
  ui.calendarResult.innerHTML = `<div class="cal-grid">${Object.entries(days).map(([day, d]) => {
    const hi = Math.max(...d.temps), lo = Math.min(...d.temps);
    const rain = Math.max(...d.pops);
    const midI = d.icons[Math.floor(d.icons.length/2)];
    return `<div class="cal-card">
      <p class="cal-day">${day}</p>
      <img src="https://openweathermap.org/img/wn/${midI}@2x.png" alt="" class="cal-icon">
      <p class="cal-temp">${toUnit(hi)}° / ${toUnit(lo)}°</p>
      ${rain > 0.1 ? `<p class="cal-rain">&#127783; ${(rain*100).toFixed(0)}%</p>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ====== SHARE CARD ======
function renderShareCard(d) {
  ui.shareSection.style.display = 'block';
}
ui.shareBtn.addEventListener('click', () => {
  if (!currentData) return;
  const d = currentData.weather;
  const canvas = ui.shareCanvas;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 600, 338);
  grad.addColorStop(0, '#1a237e'); grad.addColorStop(1, '#4a148c');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 600, 338);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 32px -apple-system, sans-serif';
  ctx.fillText(`${d.name}, ${d.sys.country}`, 30, 50);
  ctx.font = '18px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), 30, 80);
  ctx.font = 'bold 72px -apple-system, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(`${toUnit(d.main.temp)}°${currentUnit}`, 30, 180);
  ctx.font = '22px -apple-system, sans-serif'; ctx.fillStyle = '#90caf9';
  ctx.fillText(d.weather[0].description, 30, 220);
  ctx.font = '16px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Wind: ${d.wind.speed}m/s  |  Humidity: ${d.main.humidity}%  |  Feels like: ${toUnit(d.main.feels_like)}°${currentUnit}`, 30, 260);
  ctx.font = '14px -apple-system, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Weather Dashboard', 30, 320);
  ui.sharePreview.style.display = 'block';
});
ui.downloadShareBtn.addEventListener('click', () => {
  const link = document.createElement('a'); link.download = 'weather-card.png';
  link.href = ui.shareCanvas.toDataURL(); link.click();
});

// ====== WIDGET EMBED ======
function renderWidgetCode(d) {
  ui.widgetSection.style.display = 'block';
  const code = `<iframe src="${window.location.origin}?widget=${encodeURIComponent(d.name)}" width="300" height="200" frameborder="0" style="border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.2)"></iframe>`;
  ui.widgetResult.innerHTML = `
    <div class="widget-preview"><div class="widget-mini">
      <p class="wm-city">${d.name}</p>
      <img src="https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png" alt="" class="wm-icon">
      <p class="wm-temp">${toUnit(d.main.temp)}${unitLabel()}</p>
      <p class="wm-desc">${d.weather[0].description}</p>
    </div></div>
    <div class="widget-code"><label>Embed Code</label>
      <textarea readonly onclick="this.select()">${code}</textarea></div>`;
}

// ====== SEARCH ======
function search() { fetchWeather(ui.searchInput.value.trim()); }
ui.searchButton.addEventListener('click', search);
ui.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

// ====== AUTO-DETECT LOCATION ======
window.addEventListener('load', () => {
  if (navigator.geolocation && !localStorage.getItem('lastCity')) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      () => {}
    );
  }
});

renderFavorites();
