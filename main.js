import * as THREE from 'three';
import { WorldManager } from './worldManager.js';
import { PlayerController } from './playerController.js';
import { UIManager } from './uiManager.js';
import { Minimap } from './minimap.js';

// Basic Scene Setup
const scene = new THREE.Scene();
// Set far plane higher to ensure skybox is visible
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Background color will be managed by WorldManager

// Game Components
const worldManager = new WorldManager(scene);
const uiManager = new UIManager();
// Pass worldManager for collision/interaction AND uiManager for potential notifications from player
const playerController = new PlayerController(camera, scene, worldManager, uiManager);
const minimap = new Minimap(worldManager); // Create the minimap

// Make core components accessible for debugging (optional, but helps with the current structure)
window.game = {
    scene,
    camera,
    renderer,
    worldManager,
    playerController,
    uiManager,
    minimap
};

// Define the debug function here, where worldManager is in scope
window.loadNewDebugRoom = async (prompt, type) => {
    if (window.game && window.game.worldManager) {
        await window.game.worldManager.loadNewDebugRoom(prompt, type); // Use the instance directly
    } else {
        console.error("WorldManager not found on window.game");
    }
};

// Initial Setup
// camera starting position set in PlayerController resetPosition/constructor
scene.add(new THREE.AmbientLight(0x606060)); // Slightly brighter ambient light
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Slightly brighter directional
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Game Loop
function animate() {
    requestAnimationFrame(animate);

    const delta = window.game.playerController.clock.getDelta(); // Get delta from player controller's clock

    playerController.update(delta); // Pass delta time to player controller
    // WorldManager update might not need delta if not doing time-based simulation
    worldManager.update(playerController.getPlayerPosition()); // Update world based on player position
    minimap.update(playerController.getPlayerPosition()); // Update minimap

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Consider minimap resize if needed
});

// Initial world generation
worldManager.generateInitialWorld().then(() => {
    animate(); // Start the game loop after the initial world is ready
}).catch(error => {
    console.error("Failed to generate initial world:", error);
    uiManager.showNotification("Error: Could not load initial world.", "error");
    // Handle error appropriately, maybe show a static error message or fallback scene
});

// Add debug axes (optional)
// const axesHelper = new THREE.AxesHelper( 5 );
// scene.add( axesHelper );