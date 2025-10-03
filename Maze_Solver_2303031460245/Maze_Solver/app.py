from flask import Flask, render_template, request, jsonify
from collections import deque
import random

app = Flask(__name__)

# --- Configuration ---
# Format: (Width, Height) - Must be odd numbers for proper maze generation
LEVEL_CONFIG = {
    1: (11, 11),  # Easy
    2: (15, 15),
    3: (21, 21),  # Standard
    4: (25, 25),
    5: (31, 31),
    6: (35, 35),
    7: (41, 41),
    8: (45, 45),
    9: (51, 51),
    10: (55, 55) # Hardest
}

# General Constants
WALL = 1
PATH = 0

# --- Maze Generation (DFS-based Recursive Backtracker) ---
def generate_maze(w, h):
    """Generates a perfect maze using DFS-based Recursive Backtracker."""
    maze = [[WALL] * w for _ in range(h)]
    
    # Start and Goal positions depend on the current W and H
    START = (1, 1)
    
    stack = [START]
    maze[START[0]][START[1]] = PATH

    while stack:
        cy, cx = stack[-1]
        
        neighbors = []
        for dy, dx in [(0, 2), (0, -2), (2, 0), (-2, 0)]:
            ny, nx = cy + dy, cx + dx
            if 0 < ny < h and 0 < nx < w and maze[ny][nx] == WALL:
                neighbors.append((ny, nx, dy, dx))

        if neighbors:
            ny, nx, dy, dx = random.choice(neighbors)
            
            # Carve path
            maze[cy + dy // 2][cx + dx // 2] = PATH 
            maze[ny][nx] = PATH
            stack.append((ny, nx))
        else:
            stack.pop()
    
    # Set markers
    GOAL = (h - 2, w - 2)
    maze[START[0]][START[1]] = 'S'
    maze[GOAL[0]][GOAL[1]] = 'G'
    
    return maze, START, GOAL

def find_start_goal(maze):
    """Helper to locate S and G coordinates."""
    h, w = len(maze), len(maze[0])
    start_pos, goal_pos = None, None
    for r in range(h):
        for c in range(w):
            if maze[r][c] == 'S': start_pos = (r, c)
            elif maze[r][c] == 'G': goal_pos = (r, c)
    return start_pos, goal_pos

def reconstruct_path(parent, goal_pos):
    """Helper to backtrack from goal to start."""
    path = []
    curr = goal_pos
    while curr:
        path.append(curr)
        curr = parent.get(curr)
    return path[::-1] # Reverse the path

# --- Solver Algorithms ---
def solve_bfs(maze):
    """BFS: Guarantees the shortest path using a Queue (deque)."""
    start_pos, goal_pos = find_start_goal(maze)
    if not start_pos or not goal_pos: return [] 
    
    h, w = len(maze), len(maze[0])
    queue = deque([start_pos])
    visited = {start_pos}
    parent = {start_pos: None}
    
    while queue:
        cy, cx = queue.popleft()
        if (cy, cx) == goal_pos:
            return reconstruct_path(parent, goal_pos)
            
        for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            ny, nx = cy + dy, cx + dx
            
            is_valid = 0 <= ny < h and 0 <= nx < w
            is_path = is_valid and maze[ny][nx] != WALL
            
            if is_path and (ny, nx) not in visited:
                visited.add((ny, nx))
                parent[(ny, nx)] = (cy, cx)
                queue.append((ny, nx))
                
    return []

def solve_dfs(maze):
    """DFS: Finds a path (not necessarily the shortest) using a Stack (Python list)."""
    start_pos, goal_pos = find_start_goal(maze)
    if not start_pos or not goal_pos: return [] 

    h, w = len(maze), len(maze[0])
    stack = [start_pos] 
    visited = {start_pos}
    parent = {start_pos: None}
    
    while stack:
        cy, cx = stack[-1] 
        
        if (cy, cx) == goal_pos:
            return reconstruct_path(parent, goal_pos)
            
        found_unvisited_neighbor = False
        for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            ny, nx = cy + dy, cx + dx
            
            is_valid = 0 <= ny < h and 0 <= nx < w
            is_path = is_valid and maze[ny][nx] != WALL
            
            if is_path and (ny, nx) not in visited:
                visited.add((ny, nx))
                parent[(ny, nx)] = (cy, cx)
                stack.append((ny, nx)) 
                found_unvisited_neighbor = True
                break 
        
        if not found_unvisited_neighbor:
            stack.pop() 

    return []

# --- Flask Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate/<int:level_num>', methods=['GET'])
def generate(level_num):
    # Retrieve dimensions or default to level 3 if invalid
    if level_num not in LEVEL_CONFIG:
        level_num = 3 
    
    W, H = LEVEL_CONFIG[level_num]
    
    new_maze, START, GOAL = generate_maze(W, H)
    
    return jsonify({
        'maze': new_maze, 
        'start': list(START), 
        'goal': list(GOAL),
        'level': level_num,
        'width': W,
        'height': H
    })

@app.route('/api/solve', methods=['POST'])
def solve():
    data = request.get_json()
    maze_data = data.get('maze')
    algorithm = data.get('algorithm')

    if algorithm == 'bfs':
        solution = solve_bfs(maze_data)
    elif algorithm == 'dfs':
        solution = solve_dfs(maze_data)
    else:
        solution = []
    
    return jsonify({'path': solution, 'algorithm': algorithm})

if __name__ == '__main__':
    app.run(debug=True, port=5000)