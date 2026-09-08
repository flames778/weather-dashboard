class WeatherParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.currentWeather = null;
    this.animFrame = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setWeather(weatherMain) {
    this.currentWeather = (weatherMain || '').toLowerCase();
    this.particles = [];
    this.init();
  }

  init() {
    const count = this.currentWeather.includes('rain') ? 200
      : this.currentWeather.includes('snow') ? 120
      : this.currentWeather.includes('cloud') ? 30
      : this.currentWeather.includes('clear') ? 15
      : this.currentWeather.includes('thunder') ? 250
      : 0;

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
    if (!this.animFrame) this.animate();
  }

  createParticle() {
    const w = this.currentWeather;
    if (w.includes('rain') || w.includes('thunder')) {
      return {
        type: 'rain',
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height,
        speed: 8 + Math.random() * 12,
        length: 10 + Math.random() * 20,
        opacity: 0.2 + Math.random() * 0.4,
        wind: w.includes('thunder') ? (Math.random() - 0.3) * 4 : 1
      };
    }
    if (w.includes('snow')) {
      return {
        type: 'snow',
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height,
        radius: 1 + Math.random() * 3,
        speed: 0.5 + Math.random() * 2,
        opacity: 0.5 + Math.random() * 0.5,
        wobble: Math.random() * Math.PI * 2
      };
    }
    if (w.includes('cloud')) {
      return {
        type: 'cloud',
        x: -200 + Math.random() * (this.canvas.width + 400),
        y: Math.random() * this.canvas.height * 0.5,
        radius: 40 + Math.random() * 80,
        speed: 0.2 + Math.random() * 0.5,
        opacity: 0.05 + Math.random() * 0.1
      };
    }
    if (w.includes('clear')) {
      return {
        type: 'sun',
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: 1 + Math.random() * 2,
        speed: 0.1 + Math.random() * 0.3,
        opacity: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2
      };
    }
    return { type: 'none' };
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const p of this.particles) {
      if (p.type === 'rain') {
        p.y += p.speed;
        p.x += p.wind;
        this.ctx.beginPath();
        this.ctx.strokeStyle = `rgba(174,194,224,${p.opacity})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x + p.wind, p.y + p.length);
        this.ctx.stroke();
        if (p.y > this.canvas.height) { p.y = -p.length; p.x = Math.random() * this.canvas.width; }
      }
      else if (p.type === 'snow') {
        p.y += p.speed;
        p.wobble += 0.02;
        p.x += Math.sin(p.wobble) * 0.8;
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
        if (p.y > this.canvas.height + 10) { p.y = -10; p.x = Math.random() * this.canvas.width; }
      }
      else if (p.type === 'cloud') {
        p.x += p.speed;
        if (p.x > this.canvas.width + 200) p.x = -200;
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
        this.ctx.ellipse(p.x, p.y, p.radius * 1.5, p.radius, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }
      else if (p.type === 'sun') {
        p.phase += 0.03;
        p.x += Math.cos(p.phase) * p.speed;
        p.y += Math.sin(p.phase) * p.speed * 0.3;
        this.ctx.beginPath();
        this.ctx.fillStyle = `rgba(255,223,100,${p.opacity * 0.6})`;
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.animFrame = requestAnimationFrame(() => this.animate());
  }
}
