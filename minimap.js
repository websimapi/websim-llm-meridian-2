import * as THREE from 'three';

export class Minimap {
    constructor(worldManager) {
        this.worldManager = worldManager;
        this.minimapContainer = document.getElementById('minimap-container');
        if (!this.minimapContainer) {
            console.warn("Minimap container not found, creating one.");
            this.minimapContainer = document.createElement('div');
            this.minimapContainer.id = 'minimap-container';
            // Apply necessary styles if creating dynamically
            Object.assign(this.minimapContainer.style, {
                position: 'absolute', top: '20px', right: '20px', width: '160px', height: '160px',
                backgroundColor: 'rgba(40, 40, 40, 0.8)', border: '2px solid rgba(100, 100, 100, 0.8)',
                borderRadius: '6px', zIndex: '1000', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column'
            });
            document.body.appendChild(this.minimapContainer);
        }

        this.minimapCanvas = document.getElementById('minimap-canvas');
        if (!this.minimapCanvas) {
            console.warn("Minimap canvas not found, creating one.");
            this.minimapCanvas = document.createElement('canvas');
            this.minimapCanvas.id = 'minimap-canvas';
            this.minimapCanvas.width = 160; // Set resolution
            this.minimapCanvas.height = 160; // Set resolution
             Object.assign(this.minimapCanvas.style, {
                width: '100%', height: '100%', display: 'block', flexGrow: '1'
            });
            this.minimapContainer.appendChild(this.minimapCanvas);
        } else {
             // Ensure canvas resolution matches if element exists
            this.minimapCanvas.width = this.minimapContainer.offsetWidth > 0 ? this.minimapContainer.offsetWidth : 160;
            this.minimapCanvas.height = this.minimapContainer.offsetHeight > 0 ? this.minimapContainer.offsetHeight : 160;
        }


        this.ctx = this.minimapCanvas.getContext('2d');
        this.mapScale = 1.5; // Initial zoom level
        this.minZoom = 0.5; // Minimum zoom level
        this.maxZoom = 4.0; // Maximum zoom level
        this.playerMarkerSize = 3;
        this.playerDirectionLength = 10;

        this.floorTexture = null; // Cache the current floor texture
        this.patternNeedsUpdate = true; // Signal pattern needs recreation
        this.texturePattern = null; // Pattern cache

        this.initControls();
    }

    initControls() {
        const zoomInButton = document.getElementById('zoom-in');
        const zoomOutButton = document.getElementById('zoom-out');

        if (zoomInButton && zoomOutButton) {
            zoomInButton.addEventListener('click', () => this.zoomIn());
            zoomOutButton.addEventListener('click', () => this.zoomOut());
        } else {
            console.warn("Minimap zoom controls not found.");
             // Optionally create controls dynamically if needed
        }
    }

    zoomIn() {
        this.mapScale = Math.min(this.maxZoom, this.mapScale * 1.2);
        console.log("Zoom In, new scale:", this.mapScale);
    }

    zoomOut() {
        this.mapScale = Math.max(this.minZoom, this.mapScale / 1.2);
         console.log("Zoom Out, new scale:", this.mapScale);
    }

    update(playerPosition) {
        // Ensure canvas size is updated if container resized (e.g., dev tools open/close)
        const currentWidth = this.minimapContainer.offsetWidth;
        const currentHeight = this.minimapContainer.offsetHeight;
        if (this.minimapCanvas.width !== currentWidth || this.minimapCanvas.height !== currentHeight) {
            this.minimapCanvas.width = currentWidth > 0 ? currentWidth : 160;
            this.minimapCanvas.height = currentHeight > 0 ? currentHeight : 160;
        }

        const centerX = this.minimapCanvas.width / 2;
        const centerY = this.minimapCanvas.height / 2;

        // Clear canvas
        this.ctx.fillStyle = '#222'; // Background color if no texture
        this.ctx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        // Find and cache the floor texture
        this.updateFloorTexture();

        // Draw Floor Texture if available
        if (this.floorTexture && this.floorTexture.image && (this.floorTexture.image.complete || this.floorTexture.image instanceof HTMLCanvasElement || this.floorTexture.image instanceof ImageBitmap)) {
            try {
                const textureImage = this.floorTexture.image;
                const tileSize = this.worldManager.tileSize; // Typically 50
                const repeatX = this.floorTexture.repeat.x;
                const repeatY = this.floorTexture.repeat.y;

                // Calculate the world area visible on the minimap
                const viewWidthWorld = this.minimapCanvas.width / this.mapScale;
                const viewHeightWorld = this.minimapCanvas.height / this.mapScale;

                // Calculate the top-left world coordinates visible centered on the player
                const worldOriginX = playerPosition.x - viewWidthWorld / 2;
                const worldOriginZ = playerPosition.z - viewHeightWorld / 2;

                // --- Draw tiled texture ---
                // Save context state for clipping and transformations
                this.ctx.save();

                // We want to draw the texture such that the player's position corresponds to the center of the minimap
                // Translate the canvas so the player's world position aligns with the center
                this.ctx.translate(centerX, centerY);
                // Scale the canvas according to the zoom level
                this.ctx.scale(this.mapScale, this.mapScale);
                // Translate back by the player's world position to center the view on the player
                this.ctx.translate(-playerPosition.x, -playerPosition.z);

                 // Draw the texture - Use createPattern for repeating background
                 // Need to ensure the pattern origin is correctly aligned with the world origin
                 // (0,0) in world space corresponds to the center of the tile (plane)
                 // Texture coordinates (u,v) go from 0 to 1 across the texture image.
                 // World coordinates (x,z) go from -tileSize/2 to +tileSize/2.
                 // Mapping: u = (x / tileSize + 0.5) * repeatX, v = (z / tileSize + 0.5) * repeatY

                 // Create pattern *once* if texture image is valid
                 // Check if pattern needs recreating (texture changed or not created yet)
                 if (!this.texturePattern || this.patternNeedsUpdate) {
                     if(textureImage.width > 0 && textureImage.height > 0) { // Prevent error with 0-size canvas/image
                         this.texturePattern = this.ctx.createPattern(textureImage, 'repeat');
                         this.patternNeedsUpdate = false;
                     } else {
                         this.texturePattern = null; // Cannot create pattern
                     }
                 }

                 if (this.texturePattern) {
                     // Set the fill style to the pattern
                     this.ctx.fillStyle = this.texturePattern;

                     // Adjust the pattern's transformation matrix to align it correctly
                     // Texture scale factor: how many world units per texture pixel
                     const texScaleX = tileSize / repeatX / textureImage.width;
                     const texScaleY = tileSize / repeatY / textureImage.height;

                     // Create a matrix to scale and translate the pattern
                     const matrix = new DOMMatrix();
                     // The pattern needs to be scaled so its repetition matches the world coordinates
                     matrix.scaleSelf(texScaleX, texScaleY);
                     // Translate the pattern origin: UV (0,0) should correspond to world (-tileSize/2, -tileSize/2)
                     matrix.translateSelf(-tileSize / 2, -tileSize / 2);

                     // Apply the matrix to the pattern *if setTransform is supported*
                     // Note: Browser support for setTransform on patterns varies. Might not work perfectly.
                      try {
                          if (this.texturePattern.setTransform) {
                               this.texturePattern.setTransform(matrix);
                          } else {
                              // Fallback: draw image manually tiled (more complex, skip for now)
                              console.warn("CanvasPattern.setTransform not supported. Minimap texture alignment might be off.");
                          }
                      } catch (e) {
                           console.warn("Error setting pattern transform:", e);
                      }


                     // Fill the entire transformed rectangle representing the room floor
                     // The fill covers the area defined by the current transformation matrix
                     this.ctx.fillRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize);

                 } else {
                     // Fallback: Draw grey rectangle if pattern failed
                     this.ctx.fillStyle = '#555';
                     this.ctx.fillRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize);
                 }


                // Restore context state (removes transformations and clipping)
                this.ctx.restore();

            } catch (error) {
                console.error("Error drawing minimap texture:", error);
                // Draw fallback grey rectangle in case of error
                 this.ctx.fillStyle = '#444'; // Darker grey on error
                 const roomWidthOnMap = this.worldManager.tileSize * this.mapScale;
                 const roomDepthOnMap = this.worldManager.tileSize * this.mapScale;
                 const roomRectX = centerX - roomWidthOnMap / 2 - (playerPosition.x * this.mapScale); // Adjust for player offset
                 const roomRectY = centerY - roomDepthOnMap / 2 - (playerPosition.z * this.mapScale); // Adjust for player offset
                this.ctx.fillRect(roomRectX, roomRectY, roomWidthOnMap, roomDepthOnMap);
            }
        } else {
             // Optional: Draw room bounds outline if texture is unavailable
             this.ctx.strokeStyle = '#666';
             this.ctx.lineWidth = 1;
             const roomWidthOnMap = this.worldManager.tileSize * this.mapScale;
             const roomDepthOnMap = this.worldManager.tileSize * this.mapScale;
             const roomRectX = centerX - (playerPosition.x * this.mapScale) - roomWidthOnMap / 2; // Center based on player
             const roomRectY = centerY - (playerPosition.z * this.mapScale) - roomDepthOnMap / 2; // Center based on player
             this.ctx.strokeRect(roomRectX, roomRectY, roomWidthOnMap, roomDepthOnMap);
        }


        // Draw Player Marker (always at the center)
        this.ctx.fillStyle = '#4CAF50'; // Green marker
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, this.playerMarkerSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw Player Direction Line
        if (window.game && window.game.playerController) {
            const playerYaw = window.game.playerController.yawObject.rotation.y;

            // Direction line points opposite to camera look direction in top-down view
            const endX = centerX - Math.sin(playerYaw) * this.playerDirectionLength;
            const endY = centerY - Math.cos(playerYaw) * this.playerDirectionLength;

            this.ctx.strokeStyle = '#4CAF50'; // Green line
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }
    }

    updateFloorTexture() {
        const worldManager = window.game?.worldManager;
        if (!worldManager || !worldManager.currentRoomObjects) {
             if (this.floorTexture !== null) this.patternNeedsUpdate = true;
            this.floorTexture = null;
            return;
        }

        // Find the floor mesh (assuming it's a PlaneGeometry directly in currentRoomObjects)
        const floorMesh = worldManager.currentRoomObjects.children.find(
            child => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry
        );

        const newTexture = floorMesh?.material?.map || null;

        if (newTexture !== this.floorTexture) {
            this.floorTexture = newTexture;
            this.patternNeedsUpdate = true; // Signal that pattern needs recreation
            console.log("Minimap floor texture updated.");
        }
    }
}