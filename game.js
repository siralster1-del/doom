// Game state
const Game = {
    scene: null,
    camera: null,
    renderer: null,
    player: {
        mesh: null,
        velocity: new THREE.Vector3(),
        canJump: false,
        health: 100,
        speed: 0.15,
        jumpStrength: 0.3
    },
    enemies: [],
    projectiles: [],
    walls: [],
    floor: null,
    ceiling: null,
    currentStage: 1,
    kills: 0,
    score: 0,
    isPaused: false,
    isGameOver: false,
    mapSize: 60,
    cellSize: 4,
    enemiesPerStage: 20,
    maxEnemies: 40
};

// Input state
const Input = {
    keys: {},
    shoot: false,
    lastShot: 0,
    shootCooldown: 300
};

// Initialize the game
function init() {
    // Create scene
    Game.scene = new THREE.Scene();
    Game.scene.fog = new THREE.Fog(0x333333, 0, 150);
    
    // Create camera
    Game.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    Game.camera.position.set(0, 2, 0);
    
    // Create renderer
    Game.renderer = new THREE.WebGLRenderer({ antialias: false });
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
    Game.renderer.setClearColor(0x444444);
    document.getElementById('game-container').appendChild(Game.renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    Game.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 50, 0);
    Game.scene.add(directionalLight);
    
    // Add additional point lights for better illumination
    const pointLight1 = new THREE.PointLight(0xff8844, 0.5, 100);
    pointLight1.position.set(20, 10, 20);
    Game.scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0xff4444, 0.5, 100);
    pointLight2.position.set(-20, 10, -20);
    Game.scene.add(pointLight2);
    
    // Setup event listeners
    setupEventListeners();
    
    // Start first stage
    startStage(1);
    
    // Start game loop
    animate();
}

// Generate random map
function generateMap(stage) {
    // Clear previous map
    Game.walls.forEach(wall => Game.scene.remove(wall));
    Game.walls = [];
    if (Game.floor) Game.scene.remove(Game.floor);
    if (Game.ceiling) Game.scene.remove(Game.ceiling);
    
    const mapSize = Game.mapSize + stage * 3;
    const cellSize = Game.cellSize;
    
    // Create open world grid - start with all empty
    const grid = [];
    for (let i = 0; i < mapSize; i++) {
        grid[i] = [];
        for (let j = 0; j < mapSize; j++) {
            grid[i][j] = 0; // 0 = empty, 1 = wall
        }
    }
    
    // Add perimeter walls
    for (let i = 0; i < mapSize; i++) {
        grid[i][0] = 1;
        grid[i][mapSize - 1] = 1;
        grid[0][i] = 1;
        grid[mapSize - 1][i] = 1;
    }
    
    // Add random buildings and structures for cover
    const numStructures = 15 + stage * 3;
    for (let s = 0; s < numStructures; s++) {
        const structureType = Math.floor(Math.random() * 3);
        const centerX = Math.floor(Math.random() * (mapSize - 10)) + 5;
        const centerY = Math.floor(Math.random() * (mapSize - 10)) + 5;
        
        if (structureType === 0) {
            // Square building
            const size = Math.floor(Math.random() * 3) + 2;
            for (let dx = -size; dx <= size; dx++) {
                for (let dy = -size; dy <= size; dy++) {
                    if (Math.abs(dx) === size || Math.abs(dy) === size) {
                        const x = centerX + dx;
                        const y = centerY + dy;
                        if (x > 0 && x < mapSize - 1 && y > 0 && y < mapSize - 1) {
                            grid[x][y] = 1;
                        }
                    }
                }
            }
        } else if (structureType === 1) {
            // Wall segments
            const length = Math.floor(Math.random() * 5) + 3;
            const horizontal = Math.random() > 0.5;
            for (let i = 0; i < length; i++) {
                const x = horizontal ? centerX + i : centerX;
                const y = horizontal ? centerY : centerY + i;
                if (x > 0 && x < mapSize - 1 && y > 0 && y < mapSize - 1) {
                    grid[x][y] = 1;
                }
            }
        } else {
            // Scattered pillars
            const numPillars = Math.floor(Math.random() * 4) + 2;
            for (let p = 0; p < numPillars; p++) {
                const x = centerX + Math.floor(Math.random() * 6) - 3;
                const y = centerY + Math.floor(Math.random() * 6) - 3;
                if (x > 0 && x < mapSize - 1 && y > 0 && y < mapSize - 1) {
                    grid[x][y] = 1;
                }
            }
        }
    }
    
    // Create walls from grid
    const wallMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x888888,
        flatShading: true
    });
    
    for (let i = 0; i < mapSize; i++) {
        for (let j = 0; j < mapSize; j++) {
            if (grid[i][j] === 1) {
                const wallGeometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(
                    (i - mapSize / 2) * cellSize,
                    cellSize / 2,
                    (j - mapSize / 2) * cellSize
                );
                wall.userData.isWall = true;
                Game.scene.add(wall);
                Game.walls.push(wall);
            }
        }
    }
    
    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(mapSize * cellSize, mapSize * cellSize);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x666666,
        flatShading: true
    });
    Game.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    Game.floor.rotation.x = -Math.PI / 2;
    Game.floor.position.y = 0;
    Game.scene.add(Game.floor);
    
    // Create ceiling
    const ceilingMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x555555,
        flatShading: true
    });
    Game.ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
    Game.ceiling.rotation.x = Math.PI / 2;
    Game.ceiling.position.y = cellSize;
    Game.scene.add(Game.ceiling);
    
    // Set player position in center of map
    Game.camera.position.x = 0;
    Game.camera.position.z = 0;
    Game.camera.position.y = 2;
    
    return grid;
}

// Spawn enemies
function spawnEnemies(grid, stage) {
    // Clear previous enemies
    Game.enemies.forEach(enemy => Game.scene.remove(enemy.mesh));
    Game.enemies = [];
    
    const enemyCount = Math.min(Game.enemiesPerStage + stage - 1, Game.maxEnemies + stage);
    const mapSize = grid.length;
    const cellSize = Game.cellSize;
    
    const enemyGeometry = new THREE.BoxGeometry(1.5, 2, 1.5);
    const enemyMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    
    for (let e = 0; e < enemyCount; e++) {
        let x, z, attempts = 0;
        
        // Find a valid spawn position
        do {
            const gridX = Math.floor(Math.random() * (mapSize - 2)) + 1;
            const gridZ = Math.floor(Math.random() * (mapSize - 2)) + 1;
            x = (gridX - mapSize / 2) * cellSize;
            z = (gridZ - mapSize / 2) * cellSize;
            attempts++;
        } while (
            attempts < 100 &&
            (grid[Math.floor(x / cellSize + mapSize / 2)]?.[Math.floor(z / cellSize + mapSize / 2)] === 1 ||
            Game.camera.position.distanceTo(new THREE.Vector3(x, 1, z)) < 20)
        );
        
        if (attempts >= 100) continue;
        
        const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial);
        enemyMesh.position.set(x, 1, z);
        
        const enemy = {
            mesh: enemyMesh,
            health: 50 + stage * 10,
            speed: 0.02 + stage * 0.005,
            damage: 10 + stage * 2,
            lastAttack: 0,
            attackCooldown: 1000
        };
        
        Game.scene.add(enemyMesh);
        Game.enemies.push(enemy);
    }
    
    updateHUD();
}

// Start a new stage
function startStage(stageNumber) {
    Game.currentStage = stageNumber;
    Game.isPaused = false;
    Game.isGameOver = false;
    
    const grid = generateMap(stageNumber);
    spawnEnemies(grid, stageNumber);
    
    updateHUD();
}

// Setup event listeners
function setupEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        Input.keys[e.key.toLowerCase()] = true;
        
        if (e.key.toLowerCase() === 'a') {
            Input.shoot = true;
        }
        
        if (e.key === 'Escape') {
            togglePause();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        Input.keys[e.key.toLowerCase()] = false;
        
        if (e.key.toLowerCase() === 'a') {
            Input.shoot = false;
        }
    });
    
    // Menu buttons
    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('menu').classList.add('hidden');
        document.getElementById('hud').style.display = 'flex';
        document.getElementById('crosshair').style.display = 'block';
    });
    
    document.getElementById('resume-btn').addEventListener('click', () => {
        togglePause();
    });
    
    document.getElementById('restart-btn').addEventListener('click', () => {
        restartGame();
    });
    
    document.getElementById('retry-btn').addEventListener('click', () => {
        restartGame();
    });
    
    document.getElementById('next-stage-btn').addEventListener('click', () => {
        document.getElementById('stage-complete').classList.add('hidden');
        startStage(Game.currentStage + 1);
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        Game.camera.aspect = window.innerWidth / window.innerHeight;
        Game.camera.updateProjectionMatrix();
        Game.renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Toggle pause
function togglePause() {
    if (Game.isGameOver) return;
    
    Game.isPaused = !Game.isPaused;
    const pauseMenu = document.getElementById('pause-menu');
    
    if (Game.isPaused) {
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
    }
}

// Restart game
function restartGame() {
    Game.player.health = 100;
    Game.kills = 0;
    Game.score = 0;
    Game.isGameOver = false;
    
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    
    startStage(1);
}

// Update player movement
function updatePlayer() {
    if (Game.isPaused || Game.isGameOver) return;
    
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    
    Game.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    
    // Arrow key movement
    if (Input.keys['arrowup']) {
        direction.add(forward);
    }
    if (Input.keys['arrowdown']) {
        direction.sub(forward);
    }
    if (Input.keys['arrowleft']) {
        direction.sub(right);
        Game.camera.rotation.y += 0.03;
    }
    if (Input.keys['arrowright']) {
        direction.add(right);
        Game.camera.rotation.y -= 0.03;
    }
    
    direction.normalize();
    
    // Apply movement
    const newPos = Game.camera.position.clone();
    newPos.x += direction.x * Game.player.speed;
    newPos.z += direction.z * Game.player.speed;
    
    // Collision detection with walls
    if (!checkCollision(newPos)) {
        Game.camera.position.copy(newPos);
    }
    
    // Jump
    if (Input.keys[' '] && Game.player.canJump) {
        Game.player.velocity.y = Game.player.jumpStrength;
        Game.player.canJump = false;
    }
    
    // Apply gravity
    Game.player.velocity.y -= 0.02;
    Game.camera.position.y += Game.player.velocity.y;
    
    // Floor collision
    if (Game.camera.position.y <= 2) {
        Game.camera.position.y = 2;
        Game.player.velocity.y = 0;
        Game.player.canJump = true;
    }
    
    // Ceiling collision
    if (Game.camera.position.y >= Game.cellSize - 0.5) {
        Game.camera.position.y = Game.cellSize - 0.5;
        Game.player.velocity.y = 0;
    }
    
    // Shooting
    if (Input.shoot && Date.now() - Input.lastShot > Input.shootCooldown) {
        shoot();
        Input.lastShot = Date.now();
    }
}

// Check collision with walls
function checkCollision(position) {
    const playerRadius = 0.5;
    
    for (const wall of Game.walls) {
        const wallPos = wall.position;
        const dx = Math.abs(position.x - wallPos.x);
        const dz = Math.abs(position.z - wallPos.z);
        
        if (dx < Game.cellSize / 2 + playerRadius && 
            dz < Game.cellSize / 2 + playerRadius) {
            return true;
        }
    }
    
    return false;
}

// Shoot projectile
function shoot() {
    const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    const direction = new THREE.Vector3();
    Game.camera.getWorldDirection(direction);
    
    projectile.position.copy(Game.camera.position);
    projectile.position.add(direction.multiplyScalar(1));
    
    const projectileData = {
        mesh: projectile,
        velocity: direction.multiplyScalar(0.8),
        lifetime: 0
    };
    
    Game.scene.add(projectile);
    Game.projectiles.push(projectileData);
}

// Update enemies
function updateEnemies() {
    if (Game.isPaused || Game.isGameOver) return;
    
    const toRemove = [];
    
    for (let i = 0; i < Game.enemies.length; i++) {
        const enemy = Game.enemies[i];
        
        // Move towards player
        const direction = new THREE.Vector3();
        direction.subVectors(Game.camera.position, enemy.mesh.position);
        direction.y = 0;
        direction.normalize();
        
        const newPos = enemy.mesh.position.clone();
        newPos.add(direction.multiplyScalar(enemy.speed));
        
        // Check collision with walls before moving
        const enemyRadius = 0.75;
        let canMove = true;
        
        for (const wall of Game.walls) {
            const wallPos = wall.position;
            const dx = Math.abs(newPos.x - wallPos.x);
            const dz = Math.abs(newPos.z - wallPos.z);
            
            if (dx < Game.cellSize / 2 + enemyRadius && 
                dz < Game.cellSize / 2 + enemyRadius) {
                canMove = false;
                break;
            }
        }
        
        if (canMove) {
            enemy.mesh.position.copy(newPos);
        }
        
        // Attack player if close
        const distance = enemy.mesh.position.distanceTo(Game.camera.position);
        if (distance < 2 && Date.now() - enemy.lastAttack > enemy.attackCooldown) {
            Game.player.health -= enemy.damage;
            enemy.lastAttack = Date.now();
            
            // Flash effect
            document.getElementById('game-container').classList.add('damage-flash');
            setTimeout(() => {
                document.getElementById('game-container').classList.remove('damage-flash');
            }, 300);
            
            updateHUD();
            
            if (Game.player.health <= 0) {
                gameOver();
            }
        }
        
        // Remove dead enemies
        if (enemy.health <= 0) {
            toRemove.push(i);
            Game.scene.remove(enemy.mesh);
            Game.kills++;
            Game.score += 100 * Game.currentStage;
            updateHUD();
        }
    }
    
    // Remove dead enemies (iterate backwards)
    for (let i = toRemove.length - 1; i >= 0; i--) {
        Game.enemies.splice(toRemove[i], 1);
    }
    
    // Check if stage complete
    if (Game.enemies.length === 0 && !Game.isGameOver) {
        stageComplete();
    }
}

// Update projectiles
function updateProjectiles() {
    if (Game.isPaused || Game.isGameOver) return;
    
    const toRemove = [];
    
    for (let i = 0; i < Game.projectiles.length; i++) {
        const proj = Game.projectiles[i];
        
        proj.mesh.position.add(proj.velocity);
        proj.lifetime++;
        
        // Check collision with walls
        let hitWall = false;
        for (const wall of Game.walls) {
            const distance = proj.mesh.position.distanceTo(wall.position);
            if (distance < Game.cellSize / 2) {
                hitWall = true;
                break;
            }
        }
        
        // Check collision with enemies
        let hitEnemy = false;
        for (const enemy of Game.enemies) {
            const distance = proj.mesh.position.distanceTo(enemy.mesh.position);
            if (distance < 1) {
                enemy.health -= 25;
                hitEnemy = true;
                break;
            }
        }
        
        // Remove projectile if hit something or lived too long
        if (hitWall || hitEnemy || proj.lifetime > 100) {
            toRemove.push(i);
            Game.scene.remove(proj.mesh);
        }
    }
    
    // Remove used projectiles (iterate backwards)
    for (let i = toRemove.length - 1; i >= 0; i--) {
        Game.projectiles.splice(toRemove[i], 1);
    }
}

// Update HUD
function updateHUD() {
    document.getElementById('health').textContent = Math.max(0, Game.player.health);
    document.getElementById('stage').textContent = Game.currentStage;
    document.getElementById('kills').textContent = Game.kills;
    document.getElementById('enemies').textContent = Game.enemies.length;
    document.getElementById('score').textContent = Game.score;
}

// Game over
function gameOver() {
    Game.isGameOver = true;
    
    document.getElementById('final-score').textContent = Game.score;
    document.getElementById('final-stage').textContent = Game.currentStage - 1;
    document.getElementById('game-over').classList.remove('hidden');
}

// Stage complete
function stageComplete() {
    Game.isPaused = true;
    
    document.getElementById('stage-score').textContent = Game.score;
    document.getElementById('stage-complete').classList.remove('hidden');
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (!Game.isPaused && !Game.isGameOver) {
        updatePlayer();
        updateEnemies();
        updateProjectiles();
    }
    
    Game.renderer.render(Game.scene, Game.camera);
}

// Start the game when page loads
window.addEventListener('load', init);