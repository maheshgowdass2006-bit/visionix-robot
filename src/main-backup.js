import * as THREE from 'three';
import './style.css';

// ========================================
// 1. SCENE, CAMERA AND RENDERER
// ========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101827);

const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 1000
);

let angle = 0.75;
let elevation = 0.65;
let distance = 34;
const lookTarget = new THREE.Vector3(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ========================================
// 2. LIGHTING
// ========================================
scene.add(new THREE.HemisphereLight(0xffffff, 0x526078, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 3);
sunlight.position.set(5, 10, 6);
sunlight.castShadow = true;
scene.add(sunlight);

// ========================================
// 3. FLOOR AND GRID
// ========================================
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({
    color: 0x263449,
    roughness: 0.85
  })
);

floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.05;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(40, 40, 0x38bdf8, 0x43536a);
grid.position.y = -0.035;
scene.add(grid);

// ========================================
// 4. WAREHOUSE SHELVES
// ========================================
const shelfData = [
  { x: -6, z: -5, width: 3, depth: 1 },
  { x: 0, z: -5, width: 3, depth: 1 },
  { x: 6, z: -5, width: 3, depth: 1 }
];

function createShelf(x, z) {
  const shelf = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2.5, 1),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8
    })
  );

  frame.position.y = 1.25;
  frame.castShadow = true;
  frame.receiveShadow = true;
  shelf.add(frame);

  for (let i = 0; i < 3; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.7
      })
    );

    box.position.set(-0.8 + i * 0.8, 1.7, 0.56);
    box.castShadow = true;
    shelf.add(box);
  }

  shelf.position.set(x, 0, z);
  scene.add(shelf);
}

shelfData.forEach(shelf => createShelf(shelf.x, shelf.z));

// ========================================
// 5. ROBOT MODEL
// ========================================
const robot = new THREE.Group();
scene.add(robot);

const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.45, 1.3),
  new THREE.MeshStandardMaterial({
    color: 0x0891b2,
    metalness: 0.35,
    roughness: 0.35
  })
);

body.position.y = 0.65;
body.castShadow = true;
robot.add(body);

const sensor = new THREE.Mesh(
  new THREE.BoxGeometry(0.55, 0.3, 0.55),
  new THREE.MeshStandardMaterial({ color: 0x164e63 })
);

sensor.position.set(0.35, 1.02, 0);
robot.add(sensor);

const frontSensor = new THREE.Mesh(
  new THREE.BoxGeometry(0.3, 0.12, 0.08),
  new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x0891b2,
    emissiveIntensity: 0.8
  })
);

frontSensor.position.set(0.93, 0.7, 0);
robot.add(frontSensor);

// Wheels
const wheels = [];
const wheelMaterial = new THREE.MeshStandardMaterial({
  color: 0x151923,
  roughness: 0.8
});

for (const x of [-0.58, 0.58]) {
  for (const z of [-0.72, 0.72]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.16, 24),
      wheelMaterial
    );

    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.32, z);
    robot.add(wheel);
    wheels.push(wheel);
  }
}

// Parcel platform
const platform = new THREE.Mesh(
  new THREE.BoxGeometry(1.25, 0.12, 0.95),
  new THREE.MeshStandardMaterial({ color: 0xf59e0b })
);

platform.position.set(-0.12, 0.95, 0);
robot.add(platform);

// Parcel
const parcel = new THREE.Group();
robot.add(parcel);

const boxBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.72, 0.58, 0.68),
  new THREE.MeshStandardMaterial({ color: 0xb87945 })
);

boxBody.position.y = 1.3;
parcel.add(boxBody);

const tape = new THREE.Mesh(
  new THREE.BoxGeometry(0.13, 0.59, 0.69),
  new THREE.MeshStandardMaterial({ color: 0xf4d7a1 })
);

tape.position.y = 1.3;
parcel.add(tape);

// Starting marker
const startMarker = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 0.025, 2.5),
  new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    wireframe: true
  })
);

startMarker.position.y = 0;
scene.add(startMarker);

// ========================================
// 6. PATHFINDING SETTINGS
// ========================================
const warehouseLimit = 17;
const robotSpeed = 3;
const robotRadius = 0.85;
const cellSize = 1;

function isBlocked(x, z) {
  if (
    x < -warehouseLimit || x > warehouseLimit ||
    z < -warehouseLimit || z > warehouseLimit
  ) {
    return true;
  }

  return shelfData.some(shelf => {
    const halfWidth = shelf.width / 2 + robotRadius;
    const halfDepth = shelf.depth / 2 + robotRadius;

    return (
      Math.abs(x - shelf.x) < halfWidth &&
      Math.abs(z - shelf.z) < halfDepth
    );
  });
}

function cellKey(x, z) {
  return `${x},${z}`;
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

// ========================================
// 7. A* PATHFINDING
// ========================================
function findPath(startX, startZ, goalX, goalZ) {
  const start = {
    x: Math.round(startX / cellSize),
    z: Math.round(startZ / cellSize)
  };

  const goal = {
    x: Math.round(goalX / cellSize),
    z: Math.round(goalZ / cellSize)
  };

  if (isBlocked(goal.x * cellSize, goal.z * cellSize)) {
    return null;
  }

  const open = [start];
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  const closed = new Set();

  gScore.set(cellKey(start.x, start.z), 0);
  fScore.set(cellKey(start.x, start.z), heuristic(start, goal));

  const directions = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 }
  ];

  while (open.length > 0) {
    let bestIndex = 0;

    for (let i = 1; i < open.length; i++) {
      const score =
        fScore.get(cellKey(open[i].x, open[i].z)) ?? Infinity;
      const best =
        fScore.get(cellKey(open[bestIndex].x, open[bestIndex].z)) ?? Infinity;

      if (score < best) bestIndex = i;
    }

    const current = open.splice(bestIndex, 1)[0];
    const currentKey = cellKey(current.x, current.z);

    if (current.x === goal.x && current.z === goal.z) {
      const path = [current];
      let key = currentKey;

      while (cameFrom.has(key)) {
        const previous = cameFrom.get(key);
        path.unshift(previous);
        key = cellKey(previous.x, previous.z);
      }

      return path.map(cell => new THREE.Vector3(
        cell.x * cellSize,
        0.04,
        cell.z * cellSize
      ));
    }

    closed.add(currentKey);

    for (const direction of directions) {
      const neighbor = {
        x: current.x + direction.x,
        z: current.z + direction.z
      };

      const neighborKey = cellKey(neighbor.x, neighbor.z);

      if (
        closed.has(neighborKey) ||
        isBlocked(neighbor.x * cellSize, neighbor.z * cellSize)
      ) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(
          neighborKey,
          tentativeG + heuristic(neighbor, goal)
        );

        if (!open.some(cell =>
          cell.x === neighbor.x && cell.z === neighbor.z
        )) {
          open.push(neighbor);
        }
      }
    }
  }

  return null;
}

// ========================================
// 8. ROUTE DISPLAY
// ========================================
let routeLine = null;
let destinationMarker = null;
let autonomousPath = [];
let pathIndex = 0;
let autoNavigating = false;
let currentDestination = null;
let rerouteAttempts = 0;

function clearRoute() {
  if (routeLine) {
    scene.remove(routeLine);
    routeLine.geometry.dispose();
    routeLine.material.dispose();
    routeLine = null;
  }

  if (destinationMarker) {
    scene.remove(destinationMarker);
    destinationMarker.geometry.dispose();
    destinationMarker.material.dispose();
    destinationMarker = null;
  }

  autonomousPath = [];
  pathIndex = 0;
  autoNavigating = false;
  currentDestination = null;
  rerouteAttempts = 0;
}

function displayRoute(path) {
  if (routeLine) {
    scene.remove(routeLine);
    routeLine.geometry.dispose();
    routeLine.material.dispose();
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(path);

  routeLine = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x22c55e })
  );

  scene.add(routeLine);
}

function displayDestination(position) {
  if (destinationMarker) {
    scene.remove(destinationMarker);
    destinationMarker.geometry.dispose();
    destinationMarker.material.dispose();
  }

  destinationMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.08, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );

  destinationMarker.rotation.x = -Math.PI / 2;
  destinationMarker.position.set(position.x, 0.08, position.z);
  scene.add(destinationMarker);
}

// ========================================
// AUTOMATIC REROUTING
// ========================================
function replanRoute() {
  if (!currentDestination) {
    autoNavigating = false;
    isMoving = false;
    statusElement.textContent =
      'Status: Route blocked. Choose a new destination.';
    return false;
  }

  rerouteAttempts++;

  const newPath = findPath(
    robot.position.x,
    robot.position.z,
    currentDestination.x,
    currentDestination.z
  );

  if (!newPath || newPath.length < 1) {
    autoNavigating = false;
    isMoving = false;
    statusElement.textContent = 'Status: No alternative route found.';
    return false;
  }

  autonomousPath = newPath;
  pathIndex = newPath.length > 1 ? 1 : 0;

  displayRoute(newPath);
  displayDestination(currentDestination);

  autoNavigating = true;
  isMoving = true;

  statusElement.textContent =
    `Status: Route recalculated (${rerouteAttempts}).`;

  return true;
}
// ========================================
// 9. CONTROL PANEL
// ========================================
const controls = document.createElement('div');
controls.id = 'robot-controls';

controls.innerHTML = `
  <h2>VISIONIX Robot Control</h2>
  <p>W / S: Move forward / backward</p>
  <p>A / D: Turn left / right</p>
  <p>Double-click the floor to select a destination.</p>
  <p>Drag the empty floor to rotate the camera.</p>
  <div class="control-buttons">
    <button id="start-btn">Start</button>
    <button id="pause-btn">Pause</button>
    <button id="reset-btn">Reset</button>
  </div>
  <p id="robot-status">Status: Paused</p>
  <p id="robot-position">Position: X 0, Z 0</p>
`;

document.body.appendChild(controls);

const statusElement = document.getElementById('robot-status');
const positionElement = document.getElementById('robot-position');

// ========================================
// 10. MANUAL CONTROLS
// ========================================
const keys = {};
let isMoving = false;

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();

  if ([
    'w', 'a', 's', 'd',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright'
  ].includes(key)) {
    event.preventDefault();
    keys[key] = true;

    if (autoNavigating) {
      autoNavigating = false;
      statusElement.textContent = 'Status: Manual control';
    }
  }
});

window.addEventListener('keyup', event => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener('blur', () => {
  for (const key in keys) keys[key] = false;
});

// ========================================
// 11. FREE CAMERA ROTATION AND ZOOM
// ========================================
let dragging = false;
let previousX = 0;
let previousY = 0;
let dragDistance = 0;

renderer.domElement.addEventListener('pointerdown', event => {
  dragging = true;
  dragDistance = 0;
  previousX = event.clientX;
  previousY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging) return;

  const dx = event.clientX - previousX;
  const dy = event.clientY - previousY;

  dragDistance += Math.abs(dx) + Math.abs(dy);

  angle -= dx * 0.008;

  elevation = THREE.MathUtils.clamp(
    elevation + dy * 0.005,
    0.15,
    1.35
  );

  previousX = event.clientX;
  previousY = event.clientY;
});

renderer.domElement.addEventListener('pointerup', () => {
  dragging = false;
});

renderer.domElement.addEventListener('pointercancel', () => {
  dragging = false;
});

renderer.domElement.addEventListener('wheel', event => {
  distance = THREE.MathUtils.clamp(
    distance + event.deltaY * 0.025,
    12,
    55
  );
}, { passive: true });

// ========================================
// 12. CLICK FLOOR TO SELECT DESTINATION
// ========================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

renderer.domElement.addEventListener('dblclick', event => {
  if (dragDistance > 5) return;

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const target = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(floorPlane, target)) return;

  target.x = THREE.MathUtils.clamp(target.x, -17, 17);
  target.z = THREE.MathUtils.clamp(target.z, -17, 17);

  if (isBlocked(
    Math.round(target.x / cellSize) * cellSize,
    Math.round(target.z / cellSize) * cellSize
  )) {
    statusElement.textContent =
      'Status: Choose a free floor area.';
    return;
  }

  const path = findPath(
    robot.position.x,
    robot.position.z,
    target.x,
    target.z
  );

  if (!path || path.length < 1) {
    statusElement.textContent = 'Status: No route found.';
    return;
  }

  autonomousPath = path;
  pathIndex = path.length > 1 ? 1 : 0;
  currentDestination = path[path.length - 1].clone();
  rerouteAttempts = 0;

  displayRoute(path);
  displayDestination(currentDestination);

  autoNavigating = true;
  isMoving = true;

  statusElement.textContent =
    `Status: Route found (${path.length} points).`;
});

// ========================================
// 13. BUTTONS
// ========================================
document.getElementById('start-btn').addEventListener('click', () => {
  isMoving = true;

  if (autonomousPath.length > 0 &&
      pathIndex < autonomousPath.length) {
    autoNavigating = true;
    statusElement.textContent = 'Status: Autonomous navigation';
  } else {
    statusElement.textContent = 'Status: Manual control';
  }
});

document.getElementById('pause-btn').addEventListener('click', () => {
  isMoving = false;
  autoNavigating = false;
  statusElement.textContent = 'Status: Paused';
});

document.getElementById('reset-btn').addEventListener('click', () => {
  robot.position.set(0, 0, 0);
  robot.rotation.y = 0;
  isMoving = false;
  clearRoute();

  for (const key in keys) keys[key] = false;
  for (const wheel of wheels) wheel.rotation.x = 0;

  statusElement.textContent = 'Status: Paused';
});
// ========================================
// 14. COLLISION DETECTION
// ========================================
function collidesWithShelf(x, z) {
  return shelfData.some(shelf => {
    const halfWidth = shelf.width / 2 + robotRadius;
    const halfDepth = shelf.depth / 2 + robotRadius;

    return (
      Math.abs(x - shelf.x) < halfWidth &&
      Math.abs(z - shelf.z) < halfDepth
    );
  });
}

// ========================================
// 15. MANUAL MOVEMENT
// ========================================
function updateManualMovement(delta) {
  let movement = 0;
  let turning = 0;

  if (keys['w'] || keys['arrowup']) movement += 1;
  if (keys['s'] || keys['arrowdown']) movement -= 1;
  if (keys['a'] || keys['arrowleft']) turning += 1;
  if (keys['d'] || keys['arrowright']) turning -= 1;

  robot.rotation.y += turning * 2 * delta;

  const nextX = robot.position.x +
    Math.cos(robot.rotation.y) * movement * robotSpeed * delta;

  const nextZ = robot.position.z -
    Math.sin(robot.rotation.y) * movement * robotSpeed * delta;

  const safeX = THREE.MathUtils.clamp(nextX, -17, 17);
  const safeZ = THREE.MathUtils.clamp(nextZ, -17, 17);

  if (!collidesWithShelf(safeX, safeZ)) {
    robot.position.x = safeX;
    robot.position.z = safeZ;

    if (movement !== 0) {
      wheels.forEach(wheel => {
        wheel.rotation.x += movement * 8 * delta;
      });
    }
  } else if (movement !== 0) {
    statusElement.textContent = 'Status: Obstacle detected!';
  }
}

// ========================================
// 16. AUTOMATIC PATH FOLLOWING
// ========================================
function updateAutonomousMovement(delta) {
  if (!autoNavigating || !isMoving) return;

  if (pathIndex >= autonomousPath.length) {
    autoNavigating = false;
    isMoving = false;
    statusElement.textContent = 'Status: Destination reached!';
    return;
  }

  const target = autonomousPath[pathIndex];

  const dx = target.x - robot.position.x;
  const dz = target.z - robot.position.z;
  const distanceToTarget = Math.hypot(dx, dz);

  if (distanceToTarget < 0.12) {
    pathIndex++;
    return;
  }

  const desiredAngle = Math.atan2(-dz, dx);

  const angleDifference = Math.atan2(
    Math.sin(desiredAngle - robot.rotation.y),
    Math.cos(desiredAngle - robot.rotation.y)
  );

  const maxTurn = 2.5 * delta;

  robot.rotation.y += THREE.MathUtils.clamp(
    angleDifference,
    -maxTurn,
    maxTurn
  );

  if (Math.abs(angleDifference) < 0.35) {
    const step = Math.min(robotSpeed * delta, distanceToTarget);

    const nextX = robot.position.x + Math.cos(robot.rotation.y) * step;
    const nextZ = robot.position.z - Math.sin(robot.rotation.y) * step;

    if (!collidesWithShelf(nextX, nextZ)) {
      robot.position.x = nextX;
      robot.position.z = nextZ;

      wheels.forEach(wheel => {
        wheel.rotation.x += step * 8;
      });
    } else {
      // Recalculate the A* route if the current path is blocked.
      replanRoute();
    }
  }
}

// ========================================
// 17. RESIZE WINDOW
// ========================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========================================
// 18. MAIN ANIMATION LOOP
// ========================================
let previousTime = 0;

function animate(time = 0) {
  requestAnimationFrame(animate);

  const delta = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;

  if (isMoving) {
    if (autoNavigating) {
      updateAutonomousMovement(delta);
    } else {
      updateManualMovement(delta);
    }
  }

  positionElement.textContent =
    `Position: X ${robot.position.x.toFixed(1)}, Z ${robot.position.z.toFixed(1)}`;

  // Keep the camera focused on the warehouse center.
  camera.position.set(
    lookTarget.x + distance * Math.sin(angle) * Math.cos(elevation),
    lookTarget.y + distance * Math.sin(elevation),
    lookTarget.z + distance * Math.cos(angle) * Math.cos(elevation)
  );

  camera.lookAt(lookTarget);
  renderer.render(scene, camera);
}

animate();