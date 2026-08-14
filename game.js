'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

const SPEED_POWERUP_DURATION = 5;
const SPEED_POWERUP_DROP_CHANCE = 0.15;
const SPEED_POWERUP_TTL = 8;
const SPEED_MULTIPLIER = 2;
const TRIPLE_SHOT_DURATION = 5;
const TRIPLE_SHOT_POWERUP_DROP_CHANCE = 0.15;
const TRIPLE_SHOT_POWERUP_TTL = 8;
const TRIPLE_SHOT_SPREAD = 0.18;
const SHIELD_RADIUS = 27;
const SHIELD_DURATION = 5;
const SHIELD_POWERUP_DROP_CHANCE = 0.15;
const SHIELD_POWERUP_TTL = 8;
const SHIELD_IMPACT_DURATION = 0.25;

const SHIP_SKINS = [
  { id: 'classic', name: 'CLASICA', color: '#fff', flame: '#ff8200', flameX: -8, flameWidth: 4, size: 1, pointsMultiplier: 1 },
  { id: 'interceptor', name: 'INTERCEPTOR', color: '#00e5ff', flame: '#00a6ff', flameX: -10, flameWidth: 5, size: 1, pointsMultiplier: 1 },
  { id: 'comet', name: 'COMETA', color: '#ff4fd8', flame: '#ffe45c', flameX: -11, flameWidth: 4, size: 1, pointsMultiplier: 1 },
  { id: 'gigante', name: 'GIGANTE', color: '#9b59ff', flame: '#e0aaff', flameX: -8, flameWidth: 5, size: 2, pointsMultiplier: 2 },
];
const SHIP_SKIN_STORAGE_KEY = 'asteroids-ship-skin';
const SHIP_SKIN_NOTICE_DURATION = 1.8;

function getShipSkinScale() {
  return SHIP_SKINS[selectedShipSkin].size || 1;
}

function getShipPointsMultiplier() {
  return SHIP_SKINS[selectedShipSkin].pointsMultiplier || 1;
}

function loadShipSkin() {
  try {
    const savedId = localStorage.getItem(SHIP_SKIN_STORAGE_KEY);
    const index = SHIP_SKINS.findIndex(skin => skin.id === savedId);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

let selectedShipSkin = loadShipSkin();
let shipSkinNoticeTimer = 0;

function cycleShipSkin() {
  selectedShipSkin = (selectedShipSkin + 1) % SHIP_SKINS.length;
  shipSkinNoticeTimer = SHIP_SKIN_NOTICE_DURATION;
  try {
    localStorage.setItem(SHIP_SKIN_STORAGE_KEY, SHIP_SKINS[selectedShipSkin].id);
  } catch {
    // La seleccion sigue funcionando aunque el navegador bloquee localStorage.
  }
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Proyectil enemigo ─────────────────────────────────────────────────────────
class EnemyBullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 260;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl = 4;
    this.radius = 3;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.save();
    ctx.fillStyle = '#ff4d3d';
    ctx.shadowColor = '#ff4d3d';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño
const SHOOTING_STAR_TTL = 6;
const SHOOTING_STAR_SPEED = 220;
const SHOOTING_STAR_POINTS = 250;

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.points = POINTS[size];
    this.strokeStyle = '#fff';
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella Fugaz ────────────────────────────────────────────────────────────
class ShootingStar extends Asteroid {
  constructor(x, y) {
    super(x, y, 2);
    this.radius = 24;
    this.points = SHOOTING_STAR_POINTS;
    this.strokeStyle = '#ffbf47';
    this.ttl = SHOOTING_STAR_TTL;

    const angle = rand(0, Math.PI * 2);
    const speed = SHOOTING_STAR_SPEED + rand(-20, 20);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.verts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? this.radius : this.radius * 0.45;
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  split() {
    return [];
  }

  draw() {
    const speed = Math.hypot(this.vx, this.vy);
    const tailX = this.x - (this.vx / speed) * 70;
    const tailY = this.y - (this.vy / speed) * 70;
    const alpha = Math.min(1, this.ttl / 1.25);

    ctx.save();
    ctx.strokeStyle = `rgba(255, 140, 30, ${(alpha * 0.75).toFixed(2)})`;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    ctx.restore();

    super.draw();
  }
}

// ── Power-up de velocidad ─────────────────────────────────────────────────────
class SpeedPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.ttl = SPEED_POWERUP_TTL;
    this.pulse = 0;
    this.dead = false;
  }

  update(dt) {
    this.ttl -= dt;
    this.pulse += dt * 5;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const radius = this.radius + Math.sin(this.pulse) * 2;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#00e5ff';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', 0, 1);
    ctx.restore();
  }
}

// ── Power-up de disparo triple ────────────────────────────────────────────────
class TripleShotPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.ttl = TRIPLE_SHOT_POWERUP_TTL;
    this.pulse = 0;
    this.dead = false;
  }

  update(dt) {
    this.ttl -= dt;
    this.pulse += dt * 5;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const radius = this.radius + Math.sin(this.pulse) * 2;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#ff4fd8';
    ctx.fillStyle = 'rgba(255, 79, 216, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff4fd8';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', 0, 1);
    ctx.restore();
  }
}

// ── Power-up de escudo ────────────────────────────────────────────────────────
class ShieldPowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.ttl = SHIELD_POWERUP_TTL;
    this.pulse = 0;
    this.dead = false;
  }

  update(dt) {
    this.ttl -= dt;
    this.pulse += dt * 5;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const radius = this.radius + Math.sin(this.pulse) * 2;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = '#5288ff';
    ctx.fillStyle = 'rgba(82, 136, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8fb2ff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', 0, 1);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
function drawShipSkin(scale = 1, thrusting = false) {
  const skin = SHIP_SKINS[selectedShipSkin];

  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = skin.color;
  ctx.lineWidth = scale < 1 ? 2.5 : 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  if (skin.id === 'interceptor') {
    ctx.moveTo(21, 0);
    ctx.lineTo(3, -5);
    ctx.lineTo(-11, -13);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-8, 4);
    ctx.lineTo(-11, 13);
    ctx.lineTo(3, 5);
  } else if (skin.id === 'comet') {
    ctx.moveTo(19, 0);
    ctx.lineTo(5, -8);
    ctx.lineTo(-8, -11);
    ctx.lineTo(-13, -5);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-13, 5);
    ctx.lineTo(-8, 11);
    ctx.lineTo(5, 8);
  } else {
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 9);
  }

  ctx.closePath();
  ctx.stroke();

  if (skin.id === 'interceptor') {
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-3, -3);
    ctx.lineTo(-3, 3);
    ctx.closePath();
    ctx.stroke();
  } else if (skin.id === 'comet') {
    ctx.beginPath();
    ctx.moveTo(9, -4);
    ctx.quadraticCurveTo(14, 0, 9, 4);
    ctx.stroke();
  }

  if (thrusting && Math.random() > 0.35) {
    ctx.beginPath();
    ctx.moveTo(skin.flameX, -skin.flameWidth);
    ctx.lineTo(skin.flameX - rand(6, 14), 0);
    ctx.lineTo(skin.flameX, skin.flameWidth);
    ctx.strokeStyle = skin.flame;
    ctx.stroke();
  }

  ctx.restore();
}

class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12 * getShipSkinScale();
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedBoostTimer = 0;
    this.tripleShotTimer = 0;
    this.shieldTimer = 0;
    this.shieldImpactTimer = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoostTimer > 0) {
      if (this.speedBoostTimer <= dt) this.clearSpeedBoost();
      else this.speedBoostTimer -= dt;
    }
    if (this.tripleShotTimer > 0)
      this.tripleShotTimer = Math.max(0, this.tripleShotTimer - dt);
    if (this.shieldImpactTimer > 0)
      this.shieldImpactTimer = Math.max(0, this.shieldImpactTimer - dt);
    if (this.shieldTimer > 0)
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);

    this.radius = 12 * getShipSkinScale();

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;
    const thrustMultiplier = this.speedBoostTimer > 0 ? SPEED_MULTIPLIER : 1;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * thrustMultiplier * dt;
      this.vy += Math.sin(this.angle) * THRUST * thrustMultiplier * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  activateSpeedBoost() {
    if (this.speedBoostTimer <= 0) {
      this.vx *= SPEED_MULTIPLIER;
      this.vy *= SPEED_MULTIPLIER;
    }
    this.speedBoostTimer = SPEED_POWERUP_DURATION;
  }

  clearSpeedBoost() {
    if (this.speedBoostTimer > 0) {
      this.vx /= SPEED_MULTIPLIER;
      this.vy /= SPEED_MULTIPLIER;
    }
    this.speedBoostTimer = 0;
  }

  activateTripleShot() {
    this.tripleShotTimer = TRIPLE_SHOT_DURATION;
  }

  clearTripleShot() {
    this.tripleShotTimer = 0;
  }

  activateShield() {
    this.shieldTimer = SHIELD_DURATION;
  }

  registerShieldImpact() {
    this.shieldImpactTimer = SHIELD_IMPACT_DURATION;
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21 * getShipSkinScale();
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShotTimer > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SHOT_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SHOT_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;

    if (this.shieldTimer > 0) {
      const time = this.shieldTimer / SHIELD_DURATION;
      const impact = this.shieldImpactTimer / SHIELD_IMPACT_DURATION;
      const radius = SHIELD_RADIUS * getShipSkinScale() + impact * 5;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = `rgba(40, 180, 255, ${(0.04 + time * 0.08).toFixed(2)})`;
      ctx.strokeStyle = `rgba(80, 205, 255, ${(0.28 + time * 0.5).toFixed(2)})`;
      ctx.lineWidth = 1.5 + impact * 2;
      ctx.shadowColor = '#28b4ff';
      ctx.shadowBlur = 7 + impact * 12;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    drawShipSkin(getShipSkinScale(), this.thrusting);
    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, enemyBullets, asteroids, particles;
let speedPowerUps, tripleShotPowerUps, shieldPowerUps;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  const spawnPosition = () => {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    return { x, y };
  };

  for (let i = 0; i < count; i++) {
    const { x, y } = spawnPosition();
    asteroids.push(new Asteroid(x, y, 3));
  }

  const { x, y } = spawnPosition();
  asteroids.push(new ShootingStar(x, y));
}

function initGame() {
  ship          = new Ship();
  bullets       = [];
  enemyBullets  = [];
  asteroids     = [];
  particles     = [];
  speedPowerUps = [];
  tripleShotPowerUps = [];
  shieldPowerUps = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets       = [];
  enemyBullets  = [];
  particles     = [];
  speedPowerUps = [];
  tripleShotPowerUps = [];
  shieldPowerUps = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  if (ship.dead) return;
  explode(ship.x, ship.y, 14);
  ship.clearSpeedBoost();
  ship.clearTripleShot();
  ship.dead = true;
  enemyBullets = [];
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (pressed('KeyS')) cycleShipSkin();
  if (shipSkinNoticeTimer > 0)
    shipSkinNoticeTimer = Math.max(0, shipSkinNoticeTimer - dt);

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    speedPowerUps.forEach(p => p.update(dt));
    tripleShotPowerUps.forEach(p => p.update(dt));
    shieldPowerUps.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    speedPowerUps = speedPowerUps.filter(p => !p.dead);
    tripleShotPowerUps = tripleShotPowerUps.filter(p => !p.dead);
    shieldPowerUps = shieldPowerUps.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    speedPowerUps.forEach(p => p.update(dt));
    tripleShotPowerUps.forEach(p => p.update(dt));
    shieldPowerUps.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    speedPowerUps = speedPowerUps.filter(p => !p.dead);
    tripleShotPowerUps = tripleShotPowerUps.filter(p => !p.dead);
    shieldPowerUps = shieldPowerUps.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    asteroids = asteroids.filter(a => !a.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  enemyBullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  speedPowerUps.forEach(p => p.update(dt));
  tripleShotPowerUps.forEach(p => p.update(dt));
  shieldPowerUps.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  enemyBullets = enemyBullets.filter(b => !b.dead);
  asteroids = asteroids.filter(a => !a.dead);
  particles = particles.filter(p => !p.dead);
  speedPowerUps = speedPowerUps.filter(p => !p.dead);
  tripleShotPowerUps = tripleShotPowerUps.filter(p => !p.dead);
  shieldPowerUps = shieldPowerUps.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += a.points * getShipPointsMultiplier();
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        const drop = Math.random();
        if (drop < SPEED_POWERUP_DROP_CHANCE)
          speedPowerUps.push(new SpeedPowerUp(a.x, a.y));
        else if (drop < SPEED_POWERUP_DROP_CHANCE + TRIPLE_SHOT_POWERUP_DROP_CHANCE)
          tripleShotPowerUps.push(new TripleShotPowerUp(a.x, a.y));
        else if (drop < SPEED_POWERUP_DROP_CHANCE + TRIPLE_SHOT_POWERUP_DROP_CHANCE + SHIELD_POWERUP_DROP_CHANCE)
          shieldPowerUps.push(new ShieldPowerUp(a.x, a.y));
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up de velocidad
  for (const powerUp of speedPowerUps) {
    if (!powerUp.dead && dist(ship, powerUp) < ship.radius + powerUp.radius) {
      powerUp.dead = true;
      ship.activateSpeedBoost();
    }
  }
  speedPowerUps = speedPowerUps.filter(p => !p.dead);

  // Nave vs power-up de disparo triple
  for (const powerUp of tripleShotPowerUps) {
    if (!powerUp.dead && dist(ship, powerUp) < ship.radius + powerUp.radius) {
      powerUp.dead = true;
      ship.activateTripleShot();
    }
  }
  tripleShotPowerUps = tripleShotPowerUps.filter(p => !p.dead);

  // Nave vs power-up de escudo
  for (const powerUp of shieldPowerUps) {
    if (!powerUp.dead && dist(ship, powerUp) < ship.radius + powerUp.radius) {
      powerUp.dead = true;
      ship.activateShield();
    }
  }
  shieldPowerUps = shieldPowerUps.filter(p => !p.dead);

  // Proyectil enemigo vs escudo o nave
  for (const bullet of enemyBullets) {
    const shieldActive = ship.shieldTimer > 0;
    const collisionRadius = shieldActive ? SHIELD_RADIUS * getShipSkinScale() : ship.radius;
    if (!bullet.dead && dist(ship, bullet) < collisionRadius + bullet.radius) {
      bullet.dead = true;
      if (ship.invincible > 0) continue;
      if (shieldActive) {
        ship.registerShieldImpact();
      } else {
        killShip();
        break;
      }
    }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      const collisionRadius = ship.shieldTimer > 0 ? SHIELD_RADIUS * getShipSkinScale() : ship.radius;
      if (dist(ship, a) < collisionRadius + a.radius * 0.82) {
        if (ship.shieldTimer > 0) {
          a.dead = true;
          score += a.points * getShipPointsMultiplier();
          explode(a.x, a.y, a.size * 5);
          ship.registerShieldImpact();
        } else {
          killShip();
          break;
        }
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead);

  // Nivel completado
  if (state === 'playing' && asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  drawShipSkin(0.45);
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  let statusRow = 0;

  function drawPowerUpTimer(label, timer, duration, color) {
    const barW = 150;
    const barH = 7;
    const barX = (W - barW) / 2;
    const labelY = 42 + statusRow * 24;
    const barY = 47 + statusRow * 24;
    const progress = timer / duration;

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '12px monospace';
    ctx.fillText(`${label}  ${timer.toFixed(1)}s`, W / 2, labelY);
    ctx.strokeStyle = color;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * progress, barH - 2);
    statusRow++;
  }

  if (ship.speedBoostTimer > 0)
    drawPowerUpTimer('VELOCIDAD', ship.speedBoostTimer, SPEED_POWERUP_DURATION, '#00e5ff');

  if (ship.tripleShotTimer > 0)
    drawPowerUpTimer('TRIPLE SHOT', ship.tripleShotTimer, TRIPLE_SHOT_DURATION, '#ff4fd8');

  if (ship.shieldTimer > 0)
    drawPowerUpTimer('ESCUDO', ship.shieldTimer, SHIELD_DURATION, '#50cdff');

  if (shipSkinNoticeTimer > 0) {
    const alpha = Math.min(1, shipSkinNoticeTimer / 0.35);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.font = '14px monospace';
    ctx.fillText(`SKIN: ${SHIP_SKINS[selectedShipSkin].name}`, W / 2, H - 22);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  speedPowerUps.forEach(p => p.draw());
  tripleShotPowerUps.forEach(p => p.draw());
  shieldPowerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  enemyBullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
