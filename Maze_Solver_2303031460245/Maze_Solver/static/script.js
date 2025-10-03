const mazeGrid = document.getElementById('maze-grid');
const generateBtn = document.getElementById('generate-btn');
const solveBtn = document.getElementById('solve-btn');
const algorithmSelect = document.getElementById('algorithm-select');
const levelSelect = document.getElementById('level-select'); // NEW
const statusDiv = document.getElementById('status');
const pathLengthSpan = document.getElementById('path-length');
const solverTypeSpan = document.getElementById('solver-type');
const currentLevelSpan = document.getElementById('current-level'); // NEW

let currentMaze = [];
let playerPos = { r: 0, c: 0 };
let goalPos = { r: 0, c: 0 };
let cellSize = 25; // Default size

// Configuration for dynamic cell sizing
const MAX_CONTAINER_SIZE = 600; // Max pixels for the maze container
const MAX_CELL_SIZE = 30; // Max size for easy levels
const MIN_CELL_SIZE = 12; // Min size for hard levels

// --- 1. MAZE RENDERING ---
function renderMaze() {
    const rows = currentMaze.length;
    const cols = currentMaze[0].length;
    
    // Clear old maze and set grid dimensions
    mazeGrid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    mazeGrid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
    mazeGrid.innerHTML = ''; 
    
    // Find player position (S) if it hasn't been set correctly
    let foundStart = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (currentMaze[r][c] === 'S') {
                playerPos = { r, c };
                foundStart = true;
                break;
            }
        }
        if (foundStart) break;
    }
    
    // Render cells
    currentMaze.forEach((rowArr, r) => {
        rowArr.forEach((cellType, c) => {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;

            if (cellType === 1) cell.classList.add('wall');
            else if (cellType === 'S') cell.classList.add('start', 'path');
            else if (cellType === 'G') cell.classList.add('goal', 'path');
            else cell.classList.add('path');

            // Apply player class to the start position
            if (r === playerPos.r && c === playerPos.c) {
                cell.classList.add('player');
            }

            mazeGrid.appendChild(cell);
        });
    });

    statusDiv.textContent = 'Ready! Use Arrow Keys or run a solver.';
    pathLengthSpan.textContent = 'N/A';
    solverTypeSpan.textContent = 'Manual';
}

async function fetchAndRenderMaze() {
    statusDiv.textContent = 'Generating new maze...';
    
    const level = levelSelect.value;
    currentLevelSpan.textContent = level;

    try {
        // Fetch using the selected level
        const response = await fetch(`/api/generate/${level}`);
        const data = await response.json();
        
        currentMaze = data.maze;
        goalPos = { r: data.goal[0], c: data.goal[1] }; // PlayerPos is set in renderMaze for safety
        
        // --- Dynamic Cell Size Calculation ---
        const maxDim = Math.max(data.height, data.width);
        
        // Calculate dynamic cell size
        cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(MAX_CONTAINER_SIZE / maxDim)));

        // Set the CSS variable for the cell size
        mazeGrid.style.setProperty('--cell-size', `${cellSize}px`);
        // ------------------------------------

        // Re-enable player movement
        document.removeEventListener('keydown', handleKeyDown);
        document.addEventListener('keydown', handleKeyDown); 
        
        renderMaze();
        
    } catch (error) {
        console.error('Error fetching maze:', error);
        statusDiv.textContent = 'Error loading maze. Check your Flask server!';
    }
}

// --- 2. PLAYER MOVEMENT ---
function movePlayer(dr, dc) {
    const newR = playerPos.r + dr;
    const newC = playerPos.c + dc;

    if (newR < 0 || newR >= currentMaze.length || newC < 0 || newC >= currentMaze[0].length) {
        return;
    }

    const nextCellType = currentMaze[newR][newC];
    
    if (nextCellType !== 1) {
        // Clear solution path when the user manually moves
        document.querySelectorAll('.solution').forEach(cell => cell.classList.remove('solution', 'bfs', 'dfs'));

        // Remove 'player' class from current cell
        document.querySelector(`.cell[data-r="${playerPos.r}"][data-c="${playerPos.c}"]`).classList.remove('player');
        
        // Update player position
        playerPos.r = newR;
        playerPos.c = newC;
        
        // Add 'player' class to new cell
        const newCell = document.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
        newCell.classList.add('player');
        
        solverTypeSpan.textContent = 'Manual';
        pathLengthSpan.textContent = 'N/A';

        // Win condition
        if (playerPos.r === goalPos.r && playerPos.c === goalPos.c) {
            statusDiv.textContent = '🎉 You Win! Click "Generate New Maze" to play again!';
            document.removeEventListener('keydown', handleKeyDown);
            pathLengthSpan.textContent = 'Solved!';
        } else {
            statusDiv.textContent = 'Manual navigation...';
        }
    }
}

function handleKeyDown(event) {
    // Only handle movement if the game is active (not won)
    if (playerPos.r === goalPos.r && playerPos.c === goalPos.c) return;

    switch (event.key) {
        case 'ArrowUp': movePlayer(-1, 0); break;
        case 'ArrowDown': movePlayer(1, 0); break;
        case 'ArrowLeft': movePlayer(0, -1); break;
        case 'ArrowRight': movePlayer(0, 1); break;
    }
}

// --- 3. SOLVER VISUALIZATION ---
async function solveMaze() {
    const algorithm = algorithmSelect.value;
    statusDiv.textContent = `Solving with ${algorithm.toUpperCase()}...`;
    solveBtn.disabled = true;
    
    // Clear previous visualization
    document.querySelectorAll('.solution').forEach(cell => cell.classList.remove('solution', 'bfs', 'dfs'));

    try {
        const response = await fetch('/api/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maze: currentMaze, algorithm: algorithm })
        });
        
        const data = await response.json();
        const solutionPath = data.path;
        
        if (solutionPath.length > 0) {
            // Animate the path visualization
            for (let i = 0; i < solutionPath.length; i++) {
                const [r, c] = solutionPath[i];
                const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                
                if (cell && cell.classList.contains('path') && !cell.classList.contains('start') && !cell.classList.contains('goal')) {
                    cell.classList.add('solution', algorithm);
                }
                
                // Faster animation for BFS (20ms) to show its efficiency, slower for DFS (50ms)
                await new Promise(resolve => setTimeout(resolve, algorithm === 'bfs' ? 20 : 50)); 
            }
            
            const pathLength = solutionPath.length > 0 ? solutionPath.length - 1 : 0;
            statusDiv.textContent = `${algorithm.toUpperCase()} found path! Length: ${pathLength}`;
            pathLengthSpan.textContent = pathLength;
            solverTypeSpan.textContent = algorithm.toUpperCase();

        } else {
            statusDiv.textContent = `No path found by ${algorithm.toUpperCase()}!`;
            pathLengthSpan.textContent = '0';
        }
        
    } catch (error) {
        console.error('Error solving maze:', error);
        statusDiv.textContent = 'Error solving maze. Check your Flask server!';
    } finally {
        solveBtn.disabled = false;
    }
}

// --- 4. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', fetchAndRenderMaze);
generateBtn.addEventListener('click', fetchAndRenderMaze);
solveBtn.addEventListener('click', solveMaze);