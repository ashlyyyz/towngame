// ===== POLYFILL roundRect =====
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        const r = typeof radii === 'number' ? radii : (radii || 0);
        const maxR = Math.min(w, h) / 2;
        const radius = Math.min(r, maxR);
        this.moveTo(x + radius, y);
        this.lineTo(x + w - radius, y);
        this.quadraticCurveTo(x + w, y, x + w, y + radius);
        this.lineTo(x + w, y + h - radius);
        this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        this.lineTo(x + radius, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        return this;
    };
}

// ===== CONFIG =====
const CONFIG = {
    PLAYER_SIZE: 30,
    FOOD_SIZE: 20,
    ENEMY_SIZE: 25,
    BOSS_SIZE: 45,
    HEART_SIZE: 28,
    PLAYER_SPEED: 4,
    FOOD_SPAWN_RATE: 90,
    ENEMY_SPAWN_RATE: 90,
    HEART_SPAWN_INTERVAL: 180,
    MAX_LIVES: 5,
    LEVELS: [
        { name: 'Healthy Park', boss: 'Burger Boss', bossEmoji: '🍔', bossHealth: 50, foodsNeeded: 10, foodTypes: ['🍎','🍌','🥕'], enemyTypes: ['🍔','🍟'], background: '#1a4f2f', enemySpeed: 0.4 },
        { name: 'School Cafeteria', boss: 'Soda King', bossEmoji: '🥤', bossHealth: 60, foodsNeeded: 12, foodTypes: ['🥛','🥚','🥬'], enemyTypes: ['🥤','🍕'], background: '#1a4a4a', enemySpeed: 0.6 },
        { name: 'Nutrition Market', boss: 'Fries Monster', bossEmoji: '🍟', bossHealth: 70, foodsNeeded: 15, foodTypes: ['🍎','🥕','🥦','🐟'], enemyTypes: ['🍟','🍔','🍩'], background: '#1a3f3f', enemySpeed: 0.7 },
        { name: 'Healthy Hospital', boss: 'Pizza Giant', bossEmoji: '🍕', bossHealth: 80, foodsNeeded: 15, foodTypes: ['🥛','🥚','🍊','🥬'], enemyTypes: ['🍕','🍩','🍭'], background: '#1a353f', enemySpeed: 0.8 },
        { name: 'Nutrition Castle', boss: 'Junk Food King', bossEmoji: '👑', bossHealth: 90, foodsNeeded: 20, foodTypes: ['🍎','🥛','🥬','🐟','🥚'], enemyTypes: ['🍔','🍟','🥤','🍕','🍩'], background: '#1a2a3f', enemySpeed: 0.9 }
    ]
};

// ===== USER ACCOUNT SYSTEM =====
function getUsers() {
    try {
        const users = localStorage.getItem('nutritionTownUsers');
        return users ? JSON.parse(users) : {};
    } catch {
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem('nutritionTownUsers', JSON.stringify(users));
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('nutritionTownCurrentUser')) || null;
    } catch {
        return null;
    }
}

function setCurrentUser(username) {
    if (username) {
        localStorage.setItem('nutritionTownCurrentUser', JSON.stringify(username));
    } else {
        localStorage.removeItem('nutritionTownCurrentUser');
    }
}

function registerUser(username, password) {
    const users = getUsers();
    if (users[username]) {
        return { success: false, message: 'Username already exists!' };
    }
    if (username.length < 3) {
        return { success: false, message: 'Username must be at least 3 characters!' };
    }
    if (password.length < 4) {
        return { success: false, message: 'Password must be at least 4 characters!' };
    }
    users[username] = {
        password: password,
        highScore: 0,
        totalFoods: 0,
        levelsCompleted: 0,
        lastPlayed: new Date().toISOString()
    };
    saveUsers(users);
    return { success: true, message: 'Registration successful!' };
}

function loginUser(username, password) {
    const users = getUsers();
    if (!users[username]) {
        return { success: false, message: 'Username not found!' };
    }
    if (users[username].password !== password) {
        return { success: false, message: 'Incorrect password!' };
    }
    setCurrentUser(username);
    return { success: true, message: `Welcome back, ${username}!` };
}

function logoutUser() {
    setCurrentUser(null);
    return { success: true, message: 'Logged out successfully!' };
}

function getUserData(username) {
    const users = getUsers();
    return users[username] || null;
}

function updateUserData(username, data) {
    const users = getUsers();
    if (users[username]) {
        users[username] = { ...users[username], ...data };
        saveUsers(users);
    }
}

function getHighScores() {
    try {
        const scores = localStorage.getItem('nutritionTownHighScores');
        return scores ? JSON.parse(scores) : [];
    } catch {
        return [];
    }
}

function saveHighScore(name, score, level) {
    const scores = getHighScores();
    scores.push({ name, score, level, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    if (scores.length > 10) scores.length = 10;
    localStorage.setItem('nutritionTownHighScores', JSON.stringify(scores));
    
    // Also update user data
    const userData = getUserData(name);
    if (userData) {
        if (score > (userData.highScore || 0)) {
            updateUserData(name, { highScore: score });
        }
    }
}

function getTopScore() {
    const scores = getHighScores();
    return scores.length ? scores[0] : null;
}

// ===== GAME STATE =====
let game = {
    screen: 'login',
    level: 0,
    lives: CONFIG.MAX_LIVES,
    score: 0,
    foodsCollected: 0,
    bossHealth: 100,
    maxBossHealth: 100,
    isGameOver: false,
    isVictory: false,
    levelComplete: false,
    frameCount: 0,
    foodSpawnTimer: 0,
    enemySpawnTimer: 0,
    heartSpawnTimer: 0,
    player: { x: 450, y: 350, size: CONFIG.PLAYER_SIZE, attacking: false, attackTimer: 0 },
    foods: [], enemies: [], hearts: [], particles: [],
    boss: null, bossActive: false,
    keys: {},
    totalFoodsCollected: 0,
    levelFoodsNeeded: 10,
    levelFoodsCollected: 0,
    invincibleTimer: 0,
    playerName: 'Hero',
    selectedButton: 0,
    registrationText: '',
    loginUsername: '',
    loginPassword: '',
    regUsername: '',
    regPassword: '',
    regConfirmPassword: '',
    isRegistering: false,
    highScores: [],
    scoreSaved: false,
    currentUser: null
};

// ===== DOM ELEMENTS =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const toast = document.getElementById('toastMessage');

// ===== HELPERS =====
function showToast(text, duration = 1500) {
    toast.textContent = text;
    toast.classList.remove('hidden');
    if (window.toastTimer) clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function random(a, b) {
    return Math.random() * (b - a) + a;
}

function randomInt(a, b) {
    return Math.floor(random(a, b + 1));
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = random(0, Math.PI * 2);
        const speed = random(1, 4);
        game.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: random(20, 40),
            maxLife: 40,
            size: random(3, 6),
            color: color
        });
    }
}

function drawButton(text, x, y, w, h, selected, color = '#3b7a5e') {
    const radius = 15;
    
    ctx.shadowColor = selected ? 'rgba(247,220,111,0.4)' : 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = selected ? 20 : 8;
    ctx.shadowOffsetY = 4;
    
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, selected ? '#4d9c7a' : color);
    grad.addColorStop(1, selected ? '#2d6a4f' : '#2d5a3f');
    ctx.fillStyle = grad;
    ctx.fill();
    
    if (selected) {
        ctx.strokeStyle = '#f7dc6f';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.fillStyle = selected ? '#f7dc6f' : '#f0f8f0';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w/2, y + h/2 + 2);
}

// ===== DRAWING FUNCTIONS =====

// === LOGIN SCREEN ===
function drawLoginScreen() {
    const grad = ctx.createRadialGradient(450, 350, 50, 450, 350, 500);
    grad.addColorStop(0, '#1a5f3f');
    grad.addColorStop(1, '#0a2f1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Background decorations
    for (let i = 0; i < 25; i++) {
        ctx.beginPath();
        ctx.arc(random(0, canvas.width), random(0, canvas.height), random(2, 6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(46,204,113,${random(0.03, 0.1)})`;
        ctx.fill();
    }
    
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;
    
    // Title
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleGrad = ctx.createLinearGradient(200, 60, 700, 140);
    titleGrad.addColorStop(0, '#a8e063');
    titleGrad.addColorStop(1, '#56ab2f');
    ctx.fillStyle = titleGrad;
    ctx.fillText("🍏 ASHLY'S NUTRITION QUEST", 450, 80);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#b8e0d0';
    ctx.font = '16px Arial';
    ctx.fillText('— Defeat Junk Food. Restore Healthy Living. —', 450, 120);
    
    // Login/Register Box
    const boxX = 200, boxY = 160, boxW = 500, boxH = 380;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#5f9f7f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 20);
    ctx.stroke();
    
    ctx.fillStyle = '#f0f8f0';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(game.isRegistering ? '📝 Create Account' : '🔐 Login', 450, 200);
    
    const inputX = 240, inputW = 420, inputH = 40;
    let currentY = 240;
    
    // Username
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b0d8c0';
    ctx.font = '16px Arial';
    ctx.fillText('Username', inputX, currentY - 5);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(inputX, currentY, inputW, inputH, 10);
    ctx.fill();
    ctx.strokeStyle = game.selectedButton === 0 ? '#f7dc6f' : '#5f9f7f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(inputX, currentY, inputW, inputH, 10);
    ctx.stroke();
    ctx.fillStyle = '#f0f8f0';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    const usernameText = game.isRegistering ? game.regUsername : game.loginUsername;
    ctx.fillText(usernameText || 'Enter username...', inputX + 15, currentY + 25);
    
    currentY += 55;
    
    // Password
    ctx.fillStyle = '#b0d8c0';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Password', inputX, currentY - 5);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(inputX, currentY, inputW, inputH, 10);
    ctx.fill();
    ctx.strokeStyle = game.selectedButton === 1 ? '#f7dc6f' : '#5f9f7f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(inputX, currentY, inputW, inputH, 10);
    ctx.stroke();
    ctx.fillStyle = '#f0f8f0';
    ctx.font = '18px Arial';
    const passwordText = game.isRegistering ? game.regPassword : game.loginPassword;
    const displayPass = passwordText ? '•'.repeat(passwordText.length) : 'Enter password...';
    ctx.fillText(displayPass, inputX + 15, currentY + 25);
    
    currentY += 55;
    
    // Confirm Password (only for registration)
    if (game.isRegistering) {
        ctx.fillStyle = '#b0d8c0';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Confirm Password', inputX, currentY - 5);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(inputX, currentY, inputW, inputH, 10);
        ctx.fill();
        ctx.strokeStyle = game.selectedButton === 2 ? '#f7dc6f' : '#5f9f7f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(inputX, currentY, inputW, inputH, 10);
        ctx.stroke();
        ctx.fillStyle = '#f0f8f0';
        ctx.font = '18px Arial';
        const confirmDisplay = game.regConfirmPassword ? '•'.repeat(game.regConfirmPassword.length) : 'Confirm password...';
        ctx.fillText(confirmDisplay, inputX + 15, currentY + 25);
        currentY += 55;
    }
    
    // Buttons
    const btnY = game.isRegistering ? currentY + 10 : currentY + 30;
    const btnW = 200, btnH = 45;
    const btnX1 = 250, btnX2 = 450;
    
    if (game.isRegistering) {
        drawButton('📝 Register', btnX1, btnY, btnW, btnH, game.selectedButton === 3, '#3b7a5e');
        drawButton('← Back to Login', btnX2 - 30, btnY, btnW + 30, btnH, game.selectedButton === 4, '#4f5f6b');
    } else {
        drawButton('🔐 Login', btnX1, btnY, btnW, btnH, game.selectedButton === 2, '#3b7a5e');
        drawButton('📝 Create Account', btnX2 - 30, btnY, btnW + 30, btnH, game.selectedButton === 3, '#5f4f6b');
    }
    
    // Guest option
    ctx.fillStyle = '#7faa98';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Or play as guest', 450, 510);
    
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(370, 520, 160, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#b0d8c0';
    ctx.font = '14px Arial';
    ctx.fillText('🎮 Play as Guest', 450, 540);
    
    ctx.fillStyle = '#7faa98';
    ctx.font = '12px Arial';
    ctx.fillText('Nutrition Month 2026', 450, 670);
}

// === TITLE SCREEN ===
function drawTitleScreen() {
    const grad = ctx.createRadialGradient(450, 350, 50, 450, 350, 500);
    grad.addColorStop(0, '#1a5f3f');
    grad.addColorStop(1, '#0a2f1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < 25; i++) {
        ctx.beginPath();
        ctx.arc(random(0, canvas.width), random(0, canvas.height), random(2, 6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(46,204,113,${random(0.03, 0.1)})`;
        ctx.fill();
    }
    
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;
    
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleGrad = ctx.createLinearGradient(200, 80, 700, 180);
    titleGrad.addColorStop(0, '#a8e063');
    titleGrad.addColorStop(1, '#56ab2f');
    ctx.fillStyle = titleGrad;
    ctx.fillText("🍏 ASHLY'S NUTRITION ", 450, 100);
    ctx.fillText('QUEST TOWN', 450, 175);
    
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.fillStyle = '#b8e0d0';
    ctx.font = '18px Arial';
    ctx.fillText('—Every healthy choice is a seed. Plant it today, and let tomorrow bloom with strength.—', 450, 215);
    
    // Show current user
    if (game.currentUser) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(300, 235, 300, 25, 10);
        ctx.fill();
        ctx.fillStyle = '#f7dc6f';
        ctx.font = '14px Arial';
        ctx.fillText(`👋 Welcome, ${game.currentUser}!`, 450, 252);
    }
    
    const topScore = getTopScore();
    if (topScore) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(250, 265, 400, 25, 10);
        ctx.fill();
        ctx.fillStyle = '#f7dc6f';
        ctx.font = '14px Arial';
        ctx.fillText(`🏆 High Score: ${topScore.name} - ${topScore.score} pts`, 450, 282);
    }
    
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(80, 300, 740, 110, 15);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = '#5f9f7f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(80, 300, 740, 110, 15);
    ctx.stroke();
    
    ctx.fillStyle = '#f7dc6f';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎯 Mission', 450, 322);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d0e8e0';
    ctx.font = '14px Arial';
    const missions = [
        '🦸 Defeat the Junk Food Bosses and save Nutrition Town!',
        '🍎 Collect healthy foods & ❤️ hearts to earn extra lives',
        '⚔️ Battle through 5 levels to restore the town',
        '🏆 Defeat the Junk Food King to win!'
    ];
    missions.forEach((m, i) => {
        ctx.fillText(m, 100, 348 + i * 18);
    });
    
    const buttons = [
        { text: '▶ PLAY', x: 80, color: '#3b7a5e' },
        { text: '📖 STORY', x: 230, color: '#7d6b4b' },
        { text: '🏆 HIGHEST SCORE', x: 360, color: '#2e6b8a' },
        { text: '🎬 CREDITS', x: 580, color: '#5f4f6b' },
        { text: '🚪 LOGOUT', x: 730, color: '#8b3a3a' }
    ];
    
    buttons.forEach((btn, i) => {
        const w = btn.text.includes('HIGHEST') ? 170 : 130;
        const x = i === 0 ? 80 : (i === 1 ? 230 : (i === 2 ? 380 : (i === 3 ? 580 : 730)));
        drawButton(btn.text, x, 430, w, 45, game.selectedButton === i, btn.color);
    });
    
    ctx.fillStyle = '#7faa98';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Nutrition Month 2026', 450, 660);
}

// === HIGH SCORES SCREEN ===
function drawHighScoresScreen() {
    ctx.fillStyle = 'rgba(10,30,20,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(80, 40, 740, 610, 30);
    ctx.stroke();
    
    ctx.fillStyle = '#f0f8f0';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 High Scores', 410, 70);
    
    const scores = getHighScores();
    
    if (!scores.length) {
        ctx.fillStyle = '#b0d8c0';
        ctx.font = '24px Arial';
        ctx.fillText('No scores yet!', 450, 250);
        ctx.font = '16px Arial';
        ctx.fillText('Be the first to save Nutrition Town!', 450, 290);
    } else {
        ctx.fillStyle = '#d0e8e0';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        
        ctx.fillStyle = '#f7dc6f';
        ctx.font = 'bold 16px Arial';
        ['#', 'Player', 'Score', 'Level', 'Date'].forEach((t, i) => {
            ctx.fillText(t, [140, 280, 460, 600, 720][i], 130);
        });
        
        ctx.strokeStyle = '#5f9f7f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(100, 140);
        ctx.lineTo(800, 140);
        ctx.stroke();
        
        scores.forEach((s, i) => {
            const y = 170 + i * 40;
            if (y > 590) return;
            ctx.fillStyle = i === 0 ? '#f7dc6f' : '#d0e8e0';
            ctx.font = i === 0 ? 'bold 18px Arial' : '14px Arial';
            ctx.fillText(`#${i + 1}`, 140, y);
            ctx.fillText(s.name || 'Hero', 280, y);
            ctx.fillText(s.score, 460, y);
            ctx.fillText(`Level ${s.level || 1}`, 600, y);
            ctx.fillText(s.date || '', 720, y);
            
            if (i === 0) {
                ctx.fillStyle = 'rgba(247,220,111,0.1)';
                ctx.beginPath();
                ctx.roundRect(100, y - 16, 700, 30, 8);
                ctx.fill();
            }
        });
    }
    
    drawButton('← Back to Menu', 330, 600, 240, 40, game.selectedButton === 0, '#4f5f6b');
}

// === STORY SCREEN ===
function drawStoryScreen() {
    ctx.fillStyle = 'rgba(10,30,20,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#5f9f7f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(50, 30, 800, 630, 30);
    ctx.stroke();
    
    ctx.fillStyle = '#f0f8f0';
    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📖 The Story', 450, 75);
    
    const stories = [
        '🏘️ Nutrition Town was once a healthy and happy place.',
        '😈 One day, the Junk Food Bosses invaded the town',
        'and filled it with burgers, fries, soda, candy, and donuts.',
        '😔 The citizens became weak and unhealthy.',
        '🦸 You are the Nutrition Hero, and your mission is',
        'to defeat the Junk Food Bosses, collect healthy foods,',
        '❤️ collect hearts to gain extra lives, and restore the town!'
    ];
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d0e8e0';
    ctx.font = '17px Arial';
    stories.forEach((s, i) => {
        ctx.fillText(s, 80, 125 + i * 32);
    });
    
    ctx.fillStyle = '#f7dc6f';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('👑 The Junk Food Bosses', 450, 365);
    
    const bosses = [
        '🍔 Level 1: Burger Boss',
        '🥤 Level 2: Soda King',
        '🍟 Level 3: Fries Monster',
        '🍕 Level 4: Pizza Giant',
        '👑 Level 5: Junk Food King'
    ];
    bosses.forEach((b, i) => {
        const x = 150 + (i % 3) * 220;
        const y = 400 + Math.floor(i / 3) * 34;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.roundRect(x - 90, y - 12, 180, 26, 10);
        ctx.fill();
        ctx.fillStyle = '#d0e8e0';
        ctx.font = '15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(b, x, y + 4);
    });
    
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.roundRect(200, 495, 500, 35, 10);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('❤️ Collect hearts to gain an extra life! ❤️', 450, 517);
    
    drawButton('← Back to Menu', 330, 555, 240, 40, game.selectedButton === 0, '#4f5f6b');
}

// === CREDITS SCREEN ===
function drawCreditsScreen() {
    ctx.fillStyle = 'rgba(10,30,20,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#a089b0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(80, 50, 740, 590, 30);
    ctx.stroke();
    
    ctx.fillStyle = '#f0f8f0';
    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎬 Credits', 450, 100);
    
    const credits = [
        "QUEEN ASHLY COLONGAN",
        '',
        '🍏 Nutrition Town',
        'Created for Nutrition Month 2026',
        '🎮 Game Design: PixelForge Studio',
        '📚 Educational Content: Nutrition Experts',
        '❤️ Heart Power-ups: Collect for extra lives!',
        '🌱 "Eat healthy, live strong!"',
        "",
        "🥗 Good nutrition isn't a diet—it's the foundation of a healthier and happier life.",
        "🌿 Nutrition is not about perfection; it's about making healthier choices, one meal at a time."
    ];
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d0e8e0';
    ctx.font = '17px Arial';
    credits.forEach((c, i) => {
        if (!c) return;
        const y = 155 + i * 34;
        if (i === 0) {
            ctx.fillStyle = '#f7dc6f';
            ctx.font = 'bold 26px Arial';
            ctx.fillText(c, 450, y);
            ctx.fillStyle = '#d0e8e0';
            ctx.font = '17px Arial';
        } else if (c.includes('❤️')) {
            ctx.fillStyle = '#ff6b6b';
            ctx.font = 'bold 17px Arial';
            ctx.fillText(c, 450, y);
            ctx.fillStyle = '#d0e8e0';
            ctx.font = '17px Arial';
        } else {
            ctx.fillText(c, 450, y);
        }
    });
    
    drawButton('← Back to Menu', 330, 580, 240, 40, game.selectedButton === 0, '#4f5f6b');
}

// === GAME SCREEN ===
function drawGameScreen() {
    const levelData = CONFIG.LEVELS[game.level] || CONFIG.LEVELS[0];
    
    const grad = ctx.createRadialGradient(450, 350, 50, 450, 350, 500);
    grad.addColorStop(0, levelData.background || '#1a4f2f');
    grad.addColorStop(1, '#0a2f1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // Hearts
    game.hearts.forEach(heart => {
        const bob = Math.sin(heart.bobOffset) * 4;
        const size = heart.size + bob;
        
        const gradient = ctx.createRadialGradient(heart.x, heart.y, 0, heart.x, heart.y, size * 1.5);
        gradient.addColorStop(0, 'rgba(255,50,50,0.3)');
        gradient.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(heart.x, heart.y, size * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText('❤️', heart.x, heart.y + bob);
        ctx.shadowBlur = 0;
    });
    
    // Foods
    game.foods.forEach(food => {
        const bob = Math.sin(food.bobOffset) * 3;
        ctx.font = `${food.size + bob}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(46,204,113,0.3)';
        ctx.shadowBlur = 15;
        ctx.fillText(food.emoji, food.x, food.y + bob);
        ctx.shadowBlur = 0;
    });
    
    // Enemies
    game.enemies.forEach(enemy => {
        ctx.font = `${enemy.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.fillText(enemy.emoji, enemy.x, enemy.y);
        ctx.shadowBlur = 0;
    });
    
    // Boss
    if (game.bossActive && game.boss) {
        const boss = game.boss;
        const gradient = ctx.createRadialGradient(boss.x, boss.y, 20, boss.x, boss.y, 60);
        gradient.addColorStop(0, 'rgba(255,215,0,0.2)');
        gradient.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, 60, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = `${boss.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText(boss.emoji, boss.x, boss.y);
        ctx.shadowBlur = 0;
        
        const barWidth = 80, barHeight = 8;
        const barX = boss.x - barWidth/2, barY = boss.y - boss.size/2 - 20;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        const healthPercent = boss.health / boss.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    // Player
    const player = game.player;
    if (game.invincibleTimer > 0 && Math.floor(game.invincibleTimer / 5) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    const glow = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 40);
    glow.addColorStop(0, 'rgba(46,204,113,0.2)');
    glow.addColorStop(1, 'rgba(46,204,113,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 40, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.font = `${player.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(46,204,113,0.5)';
    ctx.shadowBlur = 15;
    ctx.fillText('🦸', player.x, player.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    
    if (player.attacking) {
        ctx.strokeStyle = 'rgba(255,215,0,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size + 10, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Particles
    game.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
    
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 880, 38, 10);
    ctx.fill();
    
    ctx.textBaseline = 'middle';
    ctx.font = '15px Arial';
    const hudItems = [
        `🦸 ${game.playerName}`,
        `❤️ ${game.lives}`,
        `⭐ ${game.score}`,
        `🍎 ${game.totalFoodsCollected}`,
        `🏆 Lv${game.level + 1}`
    ];
    hudItems.forEach((item, i) => {
        ctx.fillStyle = '#d0e8e0';
        ctx.textAlign = 'left';
        ctx.fillText(item, 20 + i * 155, 30);
    });
    
    // Boss health bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(10, 52, 880, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#b0d8c0';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('👑 Boss Health', 15, 65);
    
    const bossPercent = game.bossActive && game.boss ? 
        (game.boss.health / game.boss.maxHealth) * 100 : 100;
    ctx.fillStyle = bossPercent > 50 ? '#2ecc71' : '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(130, 55, Math.max(0, (bossPercent / 100) * 740), 12, 4);
    ctx.fill();
    
    // Progress
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(10, 74, 880, 14, 6);
    ctx.fill();
    ctx.fillStyle = '#b0d8c0';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Progress', 15, 84);
    
    const progressPercent = game.levelFoodsNeeded > 0 ? 
        (game.levelFoodsCollected / game.levelFoodsNeeded) * 100 : 0;
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.roundRect(85, 76, Math.max(0, (progressPercent / 100) * 790), 10, 4);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`🍎 ${game.levelFoodsCollected}/${game.levelFoodsNeeded} to summon boss`, 15, 695);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign = 'right';
    ctx.fillText('❤️ Hearts appear when you need them!', 885, 695);
}

// === LEVEL COMPLETE SCREEN ===
function drawLevelCompleteScreen() {
    ctx.fillStyle = 'rgba(10,30,20,0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(100, 60, 700, 560, 30);
    ctx.stroke();
    
    ctx.fillStyle = '#f0f8f0';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 CONGRATS LANGGA', 450, 130);
    
    ctx.font = 'bold 38px Arial';
    ctx.fillText('Level Complete Congrats Langga!', 450, 210);
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#d0e8e0';
    ctx.fillText(`You defeated ${CONFIG.LEVELS[game.level].boss}!`, 450, 260);
    
    ctx.fillStyle = '#f7dc6f';
    ctx.font = '20px Arial';
    ctx.fillText(`⭐ Score: ${game.score}`, 450, 320);
    ctx.fillText(`🍎 Foods Collected: ${game.totalFoodsCollected}`, 450, 360);
    ctx.fillText(`❤️ Lives Remaining: ${game.lives}`, 450, 400);
    
    drawButton('▶ Next Level', 300, 450, 300, 50, game.selectedButton === 0, '#3b7a5e');
}

// === GAME OVER SCREEN ===
function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(10,20,20,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(80, 40, 740, 610, 30);
    ctx.stroke();
    
    ctx.fillStyle = '#f0f8f0';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('💔', 450, 110);
    
    ctx.font = 'bold 38px Arial';
    ctx.fillText('Game Over', 450, 190);
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#d0e8e0';
    ctx.fillText('You ran out of lives!', 450, 240);
    
    ctx.fillStyle = '#f7dc6f';
    ctx.font = '22px Arial';
    ctx.fillText(`🦸 ${game.playerName}`, 450, 295);
    
    ctx.fillStyle = '#d0e8e0';
    ctx.font = '18px Arial';
    ctx.fillText(`⭐ Final Score: ${game.score}`, 450, 345);
    ctx.fillText(`🏆 Reached Level: ${game.level + 1}`, 450, 380);
    ctx.fillText(`🍎 Foods Collected: ${game.totalFoodsCollected}`, 450, 415);
    
    const buttons = ['🔄 Try Again', '← Back to Menu'];
    buttons.forEach((text, i) => {
        drawButton(text, 230 + i * 260, 470, 200, 45, game.selectedButton === i, i === 0 ? '#3b7a5e' : '#4f5f6b');
    });
}

// === VICTORY SCREEN ===
function drawVictoryScreen() {
    ctx.fillStyle = 'rgba(10,30,20,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(247,220,111,${random(0.1, 0.4)})`;
        ctx.beginPath();
        ctx.arc(random(0, canvas.width), random(0, canvas.height), random(2, 5), 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(60, 30, 780, 630, 30);
    ctx.stroke();
    
    ctx.fillStyle = '#f0f8f0';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆', 450, 100);
    
    ctx.font = 'bold 36px Arial';
    ctx.fillText('🎉 Congratulations!', 450, 180);
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#d0e8e0';
    ctx.fillText(`${game.playerName}, you defeated the Junk Food King`, 450, 230);
    ctx.fillText('and restored Nutrition Town!', 450, 260);
    
    ctx.fillStyle = '#f7dc6f';
    ctx.font = '22px Arial';
    ctx.fillText(`⭐ Final Score: ${game.score}`, 450, 315);
    ctx.fillText(`🍎 Total Foods Collected: ${game.totalFoodsCollected}`, 450, 355);
    ctx.fillText(`❤️ Lives Remaining: ${game.lives}`, 450, 395);
    
    ctx.fillStyle = '#d0e8e0';
    ctx.font = '15px Arial';
    const messages = [
        
        '🌳 Parks are green again',
        '🏫 Schools serve nutritious meals',
        '😊 Citizens are healthy and happy',
        '🎊 Nutrition Month is celebrated by all!',
        "🍏✨ Every healthy bite is a quiet promise to yourself: to grow stronger, live brighter, and become the best version of who you can be." 
        
    ];
    messages.forEach((m, i) => {
        ctx.fillText(m, 450, 440 + i * 26);
    });
    
    const buttons = ['🔄 Play Again', '← Back to Menu'];
    buttons.forEach((text, i) => {
        drawButton(text, 230 + i * 260, 555, 200, 45, game.selectedButton === i, i === 0 ? '#3b7a5e' : '#4f5f6b');
    });
}

// ===== MAIN DRAW FUNCTION =====
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    switch (game.screen) {
        case 'login': drawLoginScreen(); break;
        case 'title': drawTitleScreen(); break;
        case 'registration': drawRegistrationScreen(); break;
        case 'story': drawStoryScreen(); break;
        case 'credits': drawCreditsScreen(); break;
        case 'highscores': drawHighScoresScreen(); break;
        case 'playing': drawGameScreen(); break;
        case 'levelComplete': drawLevelCompleteScreen(); break;
        case 'gameOver': drawGameOverScreen(); break;
        case 'victory': drawVictoryScreen(); break;
    }
}

// === REGISTRATION SCREEN (Legacy - kept for compatibility) ===
function drawRegistrationScreen() {
    // Redirect to login screen with register mode
    game.isRegistering = true;
    drawLoginScreen();
}

// ===== GAME UPDATE FUNCTIONS =====
function updateGame() {
    if (game.screen !== 'playing') return;
    if (game.isGameOver || game.isVictory || game.levelComplete) return;
    
    game.frameCount++;
    const player = game.player;
    const speed = CONFIG.PLAYER_SPEED;
    
    if (game.invincibleTimer > 0) game.invincibleTimer--;
    
    let dx = 0, dy = 0;
    if (game.keys['ArrowUp'] || game.keys['w']) dy = -speed;
    if (game.keys['ArrowDown'] || game.keys['s']) dy = speed;
    if (game.keys['ArrowLeft'] || game.keys['a']) dx = -speed;
    if (game.keys['ArrowRight'] || game.keys['d']) dx = speed;
    
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    
    player.x = Math.max(player.size/2, Math.min(canvas.width - player.size/2, player.x + dx));
    player.y = Math.max(player.size/2, Math.min(canvas.height - player.size/2, player.y + dy));
    
    // Attack
    if (game.keys[' '] && !player.attacking) {
        player.attacking = true;
        player.attackTimer = 20;
        if (game.bossActive && game.boss) {
            const dist = distance(player, game.boss);
            if (dist < player.size + game.boss.size) {
                game.boss.health -= 10;
                spawnParticles(game.boss.x, game.boss.y, '#ff6b6b', 15);
                if (game.boss.health <= 0) defeatBoss();
            }
        }
        game.enemies.forEach(enemy => {
            const dist = distance(player, enemy);
            if (dist < player.size + enemy.size) {
                spawnParticles(enemy.x, enemy.y, '#ff6b6b', 8);
                enemy.health = 0;
            }
        });
    }
    
    if (player.attacking) {
        player.attackTimer--;
        if (player.attackTimer <= 0) player.attacking = false;
    }
    
    // Spawn foods
    game.foodSpawnTimer++;
    if (game.foodSpawnTimer > CONFIG.FOOD_SPAWN_RATE - game.level * 5) {
        if (game.foods.length < 15 + game.level * 2) spawnFood();
        game.foodSpawnTimer = 0;
    }
    
    // Spawn hearts
    game.heartSpawnTimer++;
    if (game.heartSpawnTimer > CONFIG.HEART_SPAWN_INTERVAL - game.level * 10) {
        if (game.hearts.length < 5 && game.lives < CONFIG.MAX_LIVES) spawnHeart();
        game.heartSpawnTimer = 0;
    }
    
    // Spawn enemies
    game.enemySpawnTimer++;
    if (game.enemySpawnTimer > CONFIG.ENEMY_SPAWN_RATE - game.level * 8) {
        if (game.enemies.length < 5 + game.level) spawnEnemy();
        game.enemySpawnTimer = 0;
    }
    
    // Spawn boss
    if (!game.bossActive && game.levelFoodsCollected >= game.levelFoodsNeeded) {
        spawnBoss();
    }
    
    // Collect hearts
    game.hearts.forEach(heart => {
        if (!heart.collected) {
            heart.bobOffset += 0.05;
            const dist = distance(player, heart);
            if (dist < player.size + heart.size) {
                heart.collected = true;
                if (game.lives < CONFIG.MAX_LIVES) {
                    game.lives++;
                    spawnParticles(heart.x, heart.y, '#ff0000', 20);
                    showToast('❤️ +1 Life!', 1000);
                } else {
                    game.score += 5;
                    spawnParticles(heart.x, heart.y, '#f7dc6f', 15);
                    showToast('⭐ +5 Bonus (max lives)!', 800);
                }
            }
        }
    });
    game.hearts = game.hearts.filter(h => !h.collected);
    
    // Collect foods
    game.foods.forEach(food => {
        if (!food.collected) {
            food.bobOffset += 0.05;
            const dist = distance(player, food);
            if (dist < player.size + food.size) {
                food.collected = true;
                game.levelFoodsCollected++;
                game.totalFoodsCollected++;
                game.score += 10;
                spawnParticles(food.x, food.y, '#2ecc71', 12);
                showToast('🍎 +10 Health Points!', 400);
            }
        }
    });
    game.foods = game.foods.filter(f => !f.collected);
    
    // Update enemies
    game.enemies.forEach(enemy => {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.wobble += 0.02;
        const wobbleAngle = Math.sin(enemy.wobble) * 0.1;
        const finalAngle = angle + wobbleAngle;
        
        enemy.vx = Math.cos(finalAngle) * enemy.speed;
        enemy.vy = Math.sin(finalAngle) * enemy.speed;
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        
        if (enemy.x < 0 || enemy.x > canvas.width) enemy.vx *= -1;
        if (enemy.y < 0 || enemy.y > canvas.height) enemy.vy *= -1;
        enemy.x = Math.max(0, Math.min(canvas.width, enemy.x));
        enemy.y = Math.max(0, Math.min(canvas.height, enemy.y));
        
        if (enemy.health > 0 && game.invincibleTimer <= 0) {
            const dist = distance(player, enemy);
            if (dist < player.size + enemy.size) {
                game.lives--;
                game.invincibleTimer = 60;
                spawnParticles(player.x, player.y, '#ff0000', 20);
                showToast('💔 Lost a life!', 800);
                enemy.health = 0;
                if (game.lives <= 0) gameOver('You ran out of lives!');
            }
        }
    });
    game.enemies = game.enemies.filter(e => e.health > 0);
    
    // Update boss
    if (game.bossActive && game.boss) {
        const boss = game.boss;
        const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
        boss.x += Math.cos(angle) * boss.speed * 0.4;
        boss.y += Math.sin(angle) * boss.speed * 0.4;
        boss.x = Math.max(boss.size/2, Math.min(canvas.width - boss.size/2, boss.x));
        boss.y = Math.max(boss.size/2, Math.min(canvas.height - boss.size/2, boss.y));
        
        boss.attackTimer++;
        if (boss.attackTimer > boss.attackCooldown) {
            boss.attackTimer = 0;
            for (let i = 0; i < 3 + game.level; i++) {
                const angle2 = random(0, Math.PI * 2);
                const speed2 = random(0.8, 1.8);
                game.enemies.push({
                    x: boss.x, y: boss.y, size: 15,
                    emoji: ['🍔', '🍟', '🥤', '🍕', '🍩'][randomInt(0, 4)],
                    speed: speed2, vx: Math.cos(angle2) * speed2,
                    vy: Math.sin(angle2) * speed2, health: 1,
                    isProjectile: true, wobble: random(0, Math.PI * 2)
                });
            }
            showToast('💥 Boss attacks!', 600);
        }
        
        if (game.invincibleTimer <= 0) {
            const dist = distance(player, boss);
            if (dist < player.size + boss.size) {
                game.lives--;
                game.invincibleTimer = 60;
                spawnParticles(player.x, player.y, '#ff0000', 20);
                showToast('💔 Boss hit you!', 800);
                if (game.lives <= 0) gameOver('The boss defeated you!');
            }
        }
    }
    
    game.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life--; p.size *= 0.98;
    });
    game.particles = game.particles.filter(p => p.life > 0 && p.size > 0.5);
}

function spawnHeart() {
    game.hearts.push({
        x: random(40, canvas.width - 40),
        y: random(40, canvas.height - 40),
        size: CONFIG.HEART_SIZE,
        collected: false,
        bobOffset: random(0, Math.PI * 3)
    });
}

function spawnFood() {
    const levelData = CONFIG.LEVELS[game.level];
    const foodEmoji = levelData.foodTypes[randomInt(0, levelData.foodTypes.length - 1)];
    game.foods.push({
        x: random(30, canvas.width - 30),
        y: random(30, canvas.height - 30),
        size: CONFIG.FOOD_SIZE,
        emoji: foodEmoji,
        collected: false,
        bobOffset: random(0, Math.PI * 2)
    });
}

function spawnEnemy() {
    const levelData = CONFIG.LEVELS[game.level];
    const enemyEmoji = levelData.enemyTypes[randomInt(0, levelData.enemyTypes.length - 1)];
    const side = randomInt(0, 3);
    let x, y;
    if (side === 0) { x = random(0, canvas.width); y = -20; }
    else if (side === 1) { x = canvas.width + 20; y = random(0, canvas.height); }
    else if (side === 2) { x = random(0, canvas.width); y = canvas.height + 20; }
    else { x = -20; y = random(0, canvas.height); }
    
    const baseSpeed = levelData.enemySpeed || 0.8;
    const speedVariation = random(0.7, 1.3);
    const enemySpeed = baseSpeed * speedVariation;
    
    game.enemies.push({
        x, y,
        size: CONFIG.ENEMY_SIZE,
        emoji: enemyEmoji,
        speed: enemySpeed,
        vx: 0, vy: 0,
        health: 1,
        wobble: random(0, Math.PI * 2)
    });
}

function spawnBoss() {
    const levelData = CONFIG.LEVELS[game.level];
    game.boss = {
        x: canvas.width / 2,
        y: 80,
        size: CONFIG.BOSS_SIZE,
        emoji: levelData.bossEmoji,
        health: game.bossHealth,
        maxHealth: game.maxBossHealth,
        speed: 1.0,
        vx: 1.0,
        vy: 0,
        attackTimer: 0,
        attackCooldown: 60,
        phase: 0
    };
    game.bossActive = true;
    showToast(`👑 ${levelData.boss} appears!`, 1500);
}

function defeatBoss() {
    game.bossActive = false;
    game.boss = null;
    game.levelComplete = true;
    game.score += 50;
    spawnParticles(canvas.width/2, canvas.height/2, '#f7dc6f', 50);
    showToast(`🎉 ${CONFIG.LEVELS[game.level].boss} defeated!`, 2000);
    
    setTimeout(() => {
        if (game.level >= CONFIG.LEVELS.length - 1) {
            saveHighScore(game.playerName, game.score, game.level + 1);
            // Update user data
            if (game.currentUser) {
                const userData = getUserData(game.currentUser);
                if (userData) {
                    const levelsCompleted = Math.max(userData.levelsCompleted || 0, game.level + 1);
                    updateUserData(game.currentUser, {
                        highScore: Math.max(userData.highScore || 0, game.score),
                        totalFoods: (userData.totalFoods || 0) + game.totalFoodsCollected,
                        levelsCompleted: levelsCompleted,
                        lastPlayed: new Date().toISOString()
                    });
                }
            }
            game.screen = 'victory';
            game.isVictory = true;
            game.selectedButton = 0;
            showToast('🏆 Nutrition Town is saved! 🎉 CONGRATULATIONS LANGGA! 🎉', 3000);
        } else {
            game.screen = 'levelComplete';
            game.selectedButton = 0;
        }
    }, 1500);
}

function gameOver(message) {
    game.isGameOver = true;
    game.screen = 'gameOver';
    game.selectedButton = 0;
    saveHighScore(game.playerName, game.score, game.level + 1);
    showToast('💔 Game Over!', 1500);
}

function startGame() {
    game.level = 0;
    game.lives = CONFIG.MAX_LIVES;
    game.score = 0;
    game.totalFoodsCollected = 0;
    game.isGameOver = false;
    game.isVictory = false;
    game.levelComplete = false;
    game.foods = [];
    game.enemies = [];
    game.hearts = [];
    game.particles = [];
    game.boss = null;
    game.bossActive = false;
    game.frameCount = 0;
    game.invincibleTimer = 0;
    game.heartSpawnTimer = 0;
    game.player.x = canvas.width / 2;
    game.player.y = canvas.height / 2;
    game.keys = {};
    game.screen = 'playing';
    game.scoreSaved = false;
    initLevel();
}

function initLevel() {
    const levelData = CONFIG.LEVELS[game.level];
    game.bossHealth = levelData.bossHealth;
    game.maxBossHealth = levelData.bossHealth;
    game.levelFoodsNeeded = levelData.foodsNeeded;
    game.levelFoodsCollected = 0;
    game.bossActive = false;
    game.levelComplete = false;
    game.foods = [];
    game.enemies = [];
    game.hearts = [];
    game.particles = [];
    game.boss = null;
    game.invincibleTimer = 0;
    game.heartSpawnTimer = 0;
    game.player.x = canvas.width / 2;
    game.player.y = canvas.height / 2;
    game.player.attacking = false;
    
    for (let i = 0; i < 8; i++) spawnFood();
    for (let i = 0; i < 3; i++) spawnEnemy();
    for (let i = 0; i < 2; i++) {
        if (game.lives < CONFIG.MAX_LIVES) spawnHeart();
    }
    
    showToast(`🌳 Level ${game.level + 1}: ${levelData.name}`, 1500);
}

function nextLevel() {
    game.level++;
    game.screen = 'playing';
    initLevel();
    showToast(`🏆 Level ${game.level + 1}: ${CONFIG.LEVELS[game.level].name}`, 1500);
}

function resetGame() {
    startGame();
}

// ===== KEYBOARD EVENTS =====
document.addEventListener('keydown', (e) => {
    game.keys[e.key] = true;
    
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
    
    if (game.screen === 'login') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            const max = game.isRegistering ? 5 : 4;
            game.selectedButton = (game.selectedButton + 1) % max;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            const max = game.isRegistering ? 5 : 4;
            game.selectedButton = (game.selectedButton + max - 1) % max;
        } else if (e.key === 'Enter') {
            if (game.isRegistering) {
                if (game.selectedButton === 3) {
                    // Register
                    const result = registerUser(game.regUsername, game.regPassword);
                    showToast(result.message, 1500);
                    if (result.success) {
                        game.isRegistering = false;
                        game.selectedButton = 2;
                        game.regUsername = '';
                        game.regPassword = '';
                        game.regConfirmPassword = '';
                        showToast('Account created! Please login.', 1500);
                    }
                } else if (game.selectedButton === 4) {
                    game.isRegistering = false;
                    game.selectedButton = 2;
                    game.regUsername = '';
                    game.regPassword = '';
                    game.regConfirmPassword = '';
                }
            } else {
                if (game.selectedButton === 2) {
                    // Login
                    const result = loginUser(game.loginUsername, game.loginPassword);
                    showToast(result.message, 1500);
                    if (result.success) {
                        game.currentUser = game.loginUsername;
                        game.playerName = game.loginUsername;
                        game.screen = 'title';
                        game.selectedButton = 0;
                        game.loginUsername = '';
                        game.loginPassword = '';
                        // Load user data
                        const userData = getUserData(game.currentUser);
                        if (userData && userData.highScore) {
                            showToast(`👋 Welcome back! Your best score: ${userData.highScore}`, 2000);
                        }
                    }
                } else if (game.selectedButton === 3) {
                    game.isRegistering = true;
                    game.selectedButton = 0;
                    game.regUsername = '';
                    game.regPassword = '';
                    game.regConfirmPassword = '';
                }
            }
        } else if (e.key === 'Backspace') {
            if (game.isRegistering) {
                if (game.selectedButton === 0) game.regUsername = game.regUsername.slice(0, -1);
                else if (game.selectedButton === 1) game.regPassword = game.regPassword.slice(0, -1);
                else if (game.selectedButton === 2) game.regConfirmPassword = game.regConfirmPassword.slice(0, -1);
            } else {
                if (game.selectedButton === 0) game.loginUsername = game.loginUsername.slice(0, -1);
                else if (game.selectedButton === 1) game.loginPassword = game.loginPassword.slice(0, -1);
            }
        } else if (e.key.length === 1 && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Backspace') {
            if (game.isRegistering) {
                if (game.selectedButton === 0 && game.regUsername.length < 20) game.regUsername += e.key;
                else if (game.selectedButton === 1 && game.regPassword.length < 20) game.regPassword += e.key;
                else if (game.selectedButton === 2 && game.regConfirmPassword.length < 20) game.regConfirmPassword += e.key;
            } else {
                if (game.selectedButton === 0 && game.loginUsername.length < 20) game.loginUsername += e.key;
                else if (game.selectedButton === 1 && game.loginPassword.length < 20) game.loginPassword += e.key;
            }
        }
    } else if (game.screen === 'title') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            game.selectedButton = (game.selectedButton + 1) % 5;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            game.selectedButton = (game.selectedButton + 4) % 5;
        } else if (e.key === 'Enter') {
            if (game.selectedButton === 0) {
                startGame();
                showToast(`🎮 Let's go, ${game.playerName}!`, 1500);
            } else if (game.selectedButton === 1) {
                game.screen = 'story';
                game.selectedButton = 0;
            } else if (game.selectedButton === 2) {
                game.screen = 'highscores';
                game.selectedButton = 0;
            } else if (game.selectedButton === 3) {
                game.screen = 'credits';
                game.selectedButton = 0;
            } else if (game.selectedButton === 4) {
                // Logout
                const result = logoutUser();
                showToast(result.message, 1500);
                game.currentUser = null;
                game.playerName = 'Guest';
                game.screen = 'login';
                game.selectedButton = 2;
                game.loginUsername = '';
                game.loginPassword = '';
            }
        }
    } else if (game.screen === 'highscores') {
        if (e.key === 'Enter' || e.key === 'Escape') {
            game.screen = 'title';
            game.selectedButton = 2;
        }
    } else if (game.screen === 'story' || game.screen === 'credits') {
        if (e.key === 'Enter' || e.key === 'Escape') {
            game.screen = 'title';
            game.selectedButton = game.screen === 'story' ? 1 : 3;
        }
    } else if (game.screen === 'levelComplete') {
        if (e.key === 'Enter') {
            nextLevel();
        }
    } else if (game.screen === 'gameOver' || game.screen === 'victory') {
        const max = 2;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            game.selectedButton = (game.selectedButton + 1) % max;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            game.selectedButton = (game.selectedButton + max - 1) % max;
        } else if (e.key === 'Enter') {
            if (game.selectedButton === 0) resetGame();
            else {
                game.screen = 'title';
                game.selectedButton = 0;
            }
        }
    }
});

document.addEventListener('keyup', (e) => {
    game.keys[e.key] = false;
});

// ===== MOBILE TOUCH CONTROLS =====
let touchX = null, touchY = null;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const t = e.touches[0];
    const x = (t.clientX - rect.left) * scaleX;
    const y = (t.clientY - rect.top) * scaleY;
    touchX = x;
    touchY = y;

    if (game.screen === 'login') {
        handleLoginClick(x, y);
        return;
    }

    if (game.screen !== 'playing') {
        handleClick(x, y);
        return;
    }

    game.keys[' '] = true;
    setTimeout(() => { game.keys[' '] = false; }, 150);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (game.screen !== 'playing') return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const t = e.touches[0];
    const x = (t.clientX - rect.left) * scaleX;
    const y = (t.clientY - rect.top) * scaleY;
    
    const dx = x - game.player.x;
    const dy = y - game.player.y;
    const len = Math.hypot(dx, dy);
    
    if (len > 15) {
        const normX = dx / len, normY = dy / len;
        const spd = CONFIG.PLAYER_SPEED * 0.8;
        game.keys['ArrowUp'] = normY < -0.3;
        game.keys['ArrowDown'] = normY > 0.3;
        game.keys['ArrowLeft'] = normX < -0.3;
        game.keys['ArrowRight'] = normX > 0.3;
    } else {
        game.keys['ArrowUp'] = false;
        game.keys['ArrowDown'] = false;
        game.keys['ArrowLeft'] = false;
        game.keys['ArrowRight'] = false;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchX = null;
    touchY = null;
    game.keys['ArrowUp'] = false;
    game.keys['ArrowDown'] = false;
    game.keys['ArrowLeft'] = false;
    game.keys['ArrowRight'] = false;
    game.keys[' '] = false;
}, { passive: false });

// ===== MOUSE CLICK FOR MENUS =====
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (game.screen === 'login') {
        handleLoginClick(x, y);
        return;
    }
    
    handleClick(x, y);
});

function handleLoginClick(x, y) {
    if (game.isRegistering) {
        // Username field
        if (x >= 240 && x <= 660 && y >= 240 && y <= 280) game.selectedButton = 0;
        // Password field
        else if (x >= 240 && x <= 660 && y >= 295 && y <= 335) game.selectedButton = 1;
        // Confirm Password field
        else if (x >= 240 && x <= 660 && y >= 350 && y <= 390) game.selectedButton = 2;
        // Register button
        else if (x >= 250 && x <= 450 && y >= 430 && y <= 475) {
            const result = registerUser(game.regUsername, game.regPassword);
            showToast(result.message, 1500);
            if (result.success) {
                game.isRegistering = false;
                game.selectedButton = 2;
                game.regUsername = '';
                game.regPassword = '';
                game.regConfirmPassword = '';
                showToast('Account created! Please login.', 1500);
            }
        }
        // Back button
        else if (x >= 450 && x <= 680 && y >= 430 && y <= 475) {
            game.isRegistering = false;
            game.selectedButton = 2;
            game.regUsername = '';
            game.regPassword = '';
            game.regConfirmPassword = '';
        }
    } else {
        // Username field
        if (x >= 240 && x <= 660 && y >= 240 && y <= 280) game.selectedButton = 0;
        // Password field
        else if (x >= 240 && x <= 660 && y >= 295 && y <= 335) game.selectedButton = 1;
        // Login button
        else if (x >= 250 && x <= 450 && y >= 390 && y <= 435) {
            const result = loginUser(game.loginUsername, game.loginPassword);
            showToast(result.message, 1500);
            if (result.success) {
                game.currentUser = game.loginUsername;
                game.playerName = game.loginUsername;
                game.screen = 'title';
                game.selectedButton = 0;
                game.loginUsername = '';
                game.loginPassword = '';
                const userData = getUserData(game.currentUser);
                if (userData && userData.highScore) {
                    showToast(`👋 Welcome back! Best score: ${userData.highScore}`, 2000);
                }
            }
        }
        // Create Account button
        else if (x >= 450 && x <= 680 && y >= 390 && y <= 435) {
            game.isRegistering = true;
            game.selectedButton = 0;
            game.regUsername = '';
            game.regPassword = '';
            game.regConfirmPassword = '';
        }
    }
    // Guest play
    if (x >= 370 && x <= 530 && y >= 520 && y <= 550) {
        game.playerName = 'Guest';
        game.currentUser = null;
        game.screen = 'title';
        game.selectedButton = 0;
        showToast('🎮 Playing as Guest!', 1500);
    }
}

function handleClick(x, y) {
    if (game.screen === 'title') {
        const buttons = [
            { x: 80, y: 430, w: 130, h: 45 },
            { x: 230, y: 430, w: 130, h: 45 },
            { x: 380, y: 430, w: 170, h: 45 },
            { x: 580, y: 430, w: 130, h: 45 },
            { x: 730, y: 430, w: 130, h: 45 }
        ];
        buttons.forEach((btn, i) => {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                if (i === 0) {
                    startGame();
                    showToast(`🎮 Let's go, ${game.playerName}!`, 1500);
                } else if (i === 1) {
                    game.screen = 'story';
                    game.selectedButton = 0;
                } else if (i === 2) {
                    game.screen = 'highscores';
                    game.selectedButton = 0;
                } else if (i === 3) {
                    game.screen = 'credits';
                    game.selectedButton = 0;
                } else if (i === 4) {
                    const result = logoutUser();
                    showToast(result.message, 1500);
                    game.currentUser = null;
                    game.playerName = 'Guest';
                    game.screen = 'login';
                    game.selectedButton = 2;
                    game.loginUsername = '';
                    game.loginPassword = '';
                }
            }
        });
    } else if (game.screen === 'highscores') {
        if (x >= 330 && x <= 570 && y >= 600 && y <= 640) {
            game.screen = 'title';
            game.selectedButton = 2;
        }
    } else if (game.screen === 'story' || game.screen === 'credits') {
        if (x >= 330 && x <= 570 && y >= 555 && y <= 595) {
            game.screen = 'title';
            game.selectedButton = game.screen === 'story' ? 1 : 3;
        }
    } else if (game.screen === 'levelComplete') {
        if (x >= 300 && x <= 600 && y >= 450 && y <= 500) {
            nextLevel();
        }
    } else if (game.screen === 'gameOver') {
        if (x >= 230 && x <= 430 && y >= 470 && y <= 515) resetGame();
        if (x >= 490 && x <= 690 && y >= 470 && y <= 515) {
            game.screen = 'title';
            game.selectedButton = 0;
        }
    } else if (game.screen === 'victory') {
        if (x >= 230 && x <= 430 && y >= 555 && y <= 600) resetGame();
        if (x >= 490 && x <= 690 && y >= 555 && y <= 600) {
            game.screen = 'title';
            game.selectedButton = 0;
        }
    }
}

// ===== GAME LOOP =====
function gameLoop() {
    updateGame();
    draw();
    requestAnimationFrame(gameLoop);
}

// ===== INITIALIZATION =====
// Check if user is already logged in
const savedUser = getCurrentUser();
if (savedUser) {
    game.currentUser = savedUser;
    game.playerName = savedUser;
    game.screen = 'title';
    game.selectedButton = 0;
    showToast(`👋 Welcome back langga, ${savedUser}!`, 2000);
} else {
    game.screen = 'login';
    game.selectedButton = 2;
    game.playerName = 'Guest';
}

game.loginUsername = '';
game.loginPassword = '';
game.regUsername = '';
game.regPassword = '';
game.regConfirmPassword = '';
game.isRegistering = false;

gameLoop();

window.addEventListener('load', () => {
    if (game.screen === 'login') {
        setTimeout(() => {
            showToast('🔐 Please login or play as guest', 2500);
        }, 500);
    }
});

console.log('🍏 Nutrition Town loaded!');
console.log('👤 Registration/Login system added!');
console.log('🚪 Logout functionality added!');
