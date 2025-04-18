import * as THREE from 'three';

export class RoomGenerator {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.defaultTextureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // 1x1 transparent png
        this.MIN_WHITE_REGION_SIZE = 10; // Minimum size for white regions in pixels
    }

    async generateRoomData(prompt, type = 'outdoor') {
        console.log(`Generating room data for: "${prompt}" (Type: ${type})`);

        // 1. Use LLM to determine base texture materials and sky description
        let materialData = { floor: 'generic floor', wall: null, ceiling: null, sky: null }; // Defaults
        try {
            const materialPrompt = `Analyze the following scene description and extract the primary material or appearance for the floor, walls (if indoor), ceiling (if indoor), and the sky (if outdoor). Respond ONLY with JSON in the format: {"floor": "material description", "wall": "material description or null", "ceiling": "material description or null", "sky": "sky description or null"}. Be concise, focusing on the texture name (e.g., 'grassy ground', 'stone bricks', 'damp cave wall', 'clear blue sky with clouds', 'starry night sky'). If a surface isn't applicable or unclear, use null. Description: ${prompt}`;
            const completion = await websim.chat.completions.create({
                messages: [{ role: "user", content: materialPrompt }],
                json: true,
            });
            materialData = JSON.parse(completion.content);
            // Basic validation
            if (typeof materialData.floor !== 'string') materialData.floor = 'generic floor';
             if (type === 'outdoor') {
                 materialData.wall = null;
                 materialData.ceiling = null;
                 if (typeof materialData.sky !== 'string') materialData.sky = 'clear blue sky'; // Default outdoor sky
             } else {
                 if (typeof materialData.wall !== 'string') materialData.wall = 'generic wall';
                 if (typeof materialData.ceiling !== 'string') materialData.ceiling = null; // Allow null ceiling
                 materialData.sky = null; // No sky indoors
             }

            console.log("LLM suggested materials:", materialData);
        } catch (error) {
            console.error("LLM failed to extract materials, using defaults:", error);
             // Use defaults defined above if LLM fails
             if (type === 'indoor') {
                materialData.wall = 'generic wall';
             } else { // outdoor default
                 materialData.sky = 'clear blue sky';
             }
        }


        // 2. Generate Textures using derived materials
        const texturePrompts = {
            floor: `Seamless tiling texture pattern, game asset style, ${materialData.floor}`,
            wall: type === 'indoor' && materialData.wall ? `Seamless tiling texture pattern, game asset style, ${materialData.wall}` : null,
            ceiling: type === 'indoor' && materialData.ceiling ? `Seamless tiling texture pattern, game asset style, ${materialData.ceiling}` : null,
            // Enhanced Skybox Prompt with instructions for white frames/windows
            sky: type === 'outdoor' && materialData.sky
                ? `High-resolution 360-degree equirectangular panorama, photorealistic style. Scene description: ${materialData.sky}. Include 3-5 pure white rectangular areas resembling windows, picture frames, or screens scattered around the scene. These white areas should be perfectly white (RGB 255,255,255) and at least 10% of the image height in size. Make them appear as natural parts of the environment like windows on buildings, blank TVs, or picture frames on walls. Ensure seamless wrapping except at white areas.`
                : null,
        };

        const textures = { floor: null, wall: null, ceiling: null, sky: null }; // Initialize all keys
        const texturePromises = [];

        for (const [key, texturePrompt] of Object.entries(texturePrompts)) {
            if (texturePrompt) {
                 const isSkybox = key === 'sky';
                texturePromises.push(
                    this.generateTexture(texturePrompt, key, isSkybox) // Pass key and skybox flag
                        .then(texture => { textures[key] = texture; })
                        .catch(error => {
                            console.error(`Failed to generate ${key} texture with prompt "${texturePrompt}":`, error);
                            // Use placeholder only for essential textures, sky can be null/default color
                             if (key === 'floor' || (type === 'indoor' && key === 'wall')) {
                                textures[key] = this.createPlaceholderTexture(key === 'floor' ? '#808080' : '#A0A0A0');
                             } else {
                                 textures[key] = null; // Allow sky/ceiling to fail gracefully
                             }
                        })
                );
            } else {
                 textures[key] = null; // Set to null if no prompt
            }
        }

        await Promise.all(texturePromises);

        // Ensure essential textures have placeholders if generation failed entirely
        if (!textures.floor) textures.floor = this.createPlaceholderTexture('#808080'); // Grey floor
        if (type === 'indoor' && materialData.wall && !textures.wall) textures.wall = this.createPlaceholderTexture('#A0A0A0'); // Lighter grey wall
        // Sky and Ceiling remain null if not generated or applicable

        // If we have a skybox, process it to find and fill white regions
        if (textures.sky) {
            textures.sky = await this.processWhiteRegions(textures.sky, prompt);
        }

        // 3. Generate Room Structure (Simplified for now)
        const structure = {
             type: type,
             dimensions: { width: 50, depth: 50, height: (type === 'indoor' ? 4 : 0) }, // Use tileSize, adjust height
             // Future: exits: [{ direction: 'north', connectsTo: 'prompt for next room' }], shape: 'rectangular' | 'L-shaped' etc.
        };

        // 4. Generate Objects (Simplified for now)
        const objects = [
            // Example: { type: 'chair', position: { x: 2, y: 0, z: 3 }, prompt: 'a simple wooden chair' }
        ];

        console.log("Generated textures:", {
             floor: textures.floor ? textures.floor.uuid : null, // Log UUIDs instead of full objects
             wall: textures.wall ? textures.wall.uuid : null,
             ceiling: textures.ceiling ? textures.ceiling.uuid : null,
             sky: textures.sky ? textures.sky.uuid : null
         });

        return {
            prompt: prompt,
            type: type,
            textures: textures, // Pass the actual THREE.Texture objects initially
            structure: structure,
            objects: objects,
        };
    }

    async generateTexture(prompt, context = 'unknown', isSkybox = false) {
        console.log(`Generating texture for ${context} with prompt: "${prompt}"`);
        const textureGenPrompt = prompt;
        try {
            const imageOptions = {
                 prompt: textureGenPrompt,
                 // seed: Date.now() // Optional: use seed for reproducibility if needed
             };

            if (isSkybox) {
                // Use higher resolution 2:1 aspect ratio for equirectangular images
                imageOptions.width = 4096; // Increased resolution
                imageOptions.height = 2048; // Increased resolution
                console.log(`Requesting skybox with dimensions: ${imageOptions.width}x${imageOptions.height}`);
            } else {
                // Square aspect ratio for seamless tiling textures
                imageOptions.width = 512; // Power of 2 often good for textures
                imageOptions.height = 512;
            }

            const result = await websim.imageGen(imageOptions);

            if (result && result.url) {
                // Load the generated image URL into a THREE.Texture
                return new Promise((resolve, reject) => {
                    this.textureLoader.load(
                        result.url,
                        (texture) => {
                             if (isSkybox) {
                                 texture.mapping = THREE.EquirectangularReflectionMapping;
                                 // Process skybox to hide seam line
                                 this.processSkyboxSeam(texture);
                                 // No repeat for skybox
                             } else {
                                texture.wrapS = THREE.RepeatWrapping;
                                texture.wrapT = THREE.RepeatWrapping;
                                // Adjust repeat based on typical texture scale and tile size
                                const textureScale = 2; // Assumed real-world size represented by the texture
                                const repeatValue = 50 / textureScale; // Use tileSize (50)
                                texture.repeat.set(repeatValue, repeatValue);
                             }
                             console.log(`Successfully loaded ${context} texture for: "${prompt}"`);
                            resolve(texture);
                        },
                        undefined, // onProgress callback currently not supported for imageGen
                        (err) => {
                             console.error(`Error loading texture from URL ${result.url} for ${context}:`, err);
                             // Resolve with placeholder on load error for essential textures
                             console.warn(`Falling back to placeholder texture for ${context} due to load error.`);
                              if (context === 'floor' || context === 'wall') {
                                 resolve(this.createPlaceholderTexture());
                              } else {
                                 resolve(null); // Allow sky/ceiling to fail to null
                              }
                        }
                    );
                });
            } else {
                 throw new Error("Image generation failed or returned no URL.");
            }
        } catch (error) {
             console.error(`websim.imageGen failed for prompt "${textureGenPrompt}" (context: ${context}):`, error);
             // Return placeholder on generation error for essential textures
             console.warn(`Falling back to placeholder texture for ${context} due to image generation error.`);
             if (context === 'floor' || context === 'wall') {
                 return this.createPlaceholderTexture();
             } else {
                 return null; // Allow sky/ceiling to fail to null
             }
        }
    }

    async processWhiteRegions(texture, mainPrompt) {
        if (!texture || !texture.image) {
            console.warn("Cannot process white regions: texture or image is null");
            return texture;
        }

        console.log("Processing white regions in panoramic image...");
        
        // Create a canvas to work with the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions to match the texture image
        canvas.width = texture.image.width;
        canvas.height = texture.image.height;
        
        // Draw the original image onto the canvas
        try {
            ctx.drawImage(texture.image, 0, 0);
        } catch (e) {
            console.error("Error drawing image to canvas:", e);
            return texture;
        }
        
        // Get the image data to analyze pixels
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Threshold for white detection (slightly below pure white to account for compression artifacts)
        const WHITE_THRESHOLD = 245;
        
        // Create a map to track visited pixels during connected component analysis
        const visited = new Array(data.length / 4).fill(false);
        
        // Array to store information about detected white regions
        const whiteRegions = [];
        
        // Connected component analysis to find white regions
        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            
            // If this pixel is white and not visited yet
            if (!visited[pixelIndex] && 
                data[i] >= WHITE_THRESHOLD && 
                data[i+1] >= WHITE_THRESHOLD && 
                data[i+2] >= WHITE_THRESHOLD) {
                
                // Start a breadth-first search from this pixel
                const queue = [pixelIndex];
                visited[pixelIndex] = true;
                
                const region = {
                    pixels: [pixelIndex],
                    minX: pixelIndex % canvas.width,
                    minY: Math.floor(pixelIndex / canvas.width),
                    maxX: pixelIndex % canvas.width,
                    maxY: Math.floor(pixelIndex / canvas.width)
                };
                
                while (queue.length > 0) {
                    const currentPixel = queue.shift();
                    const x = currentPixel % canvas.width;
                    const y = Math.floor(currentPixel / canvas.width);
                    
                    // Update region boundaries
                    region.minX = Math.min(region.minX, x);
                    region.minY = Math.min(region.minY, y);
                    region.maxX = Math.max(region.maxX, x);
                    region.maxY = Math.max(region.maxY, y);
                    
                    // Check 4-connected neighbors (up, right, down, left)
                    const neighbors = [
                        currentPixel - canvas.width, // up
                        currentPixel + 1,           // right
                        currentPixel + canvas.width, // down
                        currentPixel - 1            // left
                    ];
                    
                    for (const neighbor of neighbors) {
                        // Skip if out of bounds
                        if (neighbor < 0 || neighbor >= data.length / 4) continue;
                        
                        // Skip if crossing image boundary horizontally
                        if ((currentPixel % canvas.width === 0 && neighbor === currentPixel - 1) || 
                            (currentPixel % canvas.width === canvas.width - 1 && neighbor === currentPixel + 1)) {
                            continue;
                        }
                        
                        // If neighbor is white and not visited
                        const idx = neighbor * 4;
                        if (!visited[neighbor] && 
                            data[idx] >= WHITE_THRESHOLD && 
                            data[idx+1] >= WHITE_THRESHOLD && 
                            data[idx+2] >= WHITE_THRESHOLD) {
                            
                            queue.push(neighbor);
                            visited[neighbor] = true;
                            region.pixels.push(neighbor);
                        }
                    }
                }
                
                // Calculate width and height of the region
                region.width = region.maxX - region.minX + 1;
                region.height = region.maxY - region.minY + 1;
                
                // Only keep regions that are at least MIN_WHITE_REGION_SIZE in both dimensions
                if (region.width >= this.MIN_WHITE_REGION_SIZE && region.height >= this.MIN_WHITE_REGION_SIZE) {
                    whiteRegions.push(region);
                }
            }
        }
        
        console.log(`Found ${whiteRegions.length} white regions suitable for replacement`);
        
        // Sort regions by size (largest first) to prioritize most visible ones
        whiteRegions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
        
        // Process at most 5 largest regions to avoid too many API calls
        const regionsToProcess = whiteRegions.slice(0, 5);
        
        // Generate and place images for each white region
        for (const region of regionsToProcess) {
            try {
                // Generate a description for what should be in this frame/window
                let frameContentPrompt = `Based on the main scene: "${mainPrompt}", describe in detail what would be seen through this window/frame. It should be thematically related but show a different perspective or connected scene.`;
                
                const completion = await websim.chat.completions.create({
                    messages: [{ role: "user", content: frameContentPrompt }]
                });
                
                const frameDescription = completion.content;
                console.log(`Generated frame content description: "${frameDescription}"`);
                
                // Generate an image for this frame content
                const frameImagePrompt = `High-quality detailed image: ${frameDescription}. Make this image cohesive and self-contained, properly framed with good composition.`;
                
                const frameImageResult = await websim.imageGen({
                    prompt: frameImagePrompt,
                    width: region.width,
                    height: region.height
                });
                
                if (frameImageResult && frameImageResult.url) {
                    // Load the generated image
                    const frameImage = await this.loadImageAsHTMLImage(frameImageResult.url);
                    
                    // Draw the frame image into the region
                    ctx.drawImage(
                        frameImage, 
                        region.minX, region.minY, 
                        region.width, region.height
                    );
                    
                    console.log(`Placed frame image at (${region.minX},${region.minY}) with size ${region.width}x${region.height}`);
                }
            } catch (error) {
                console.error(`Error processing white region:`, error);
            }
        }
        
        // Apply the processed canvas back to the texture
        texture.image = canvas;
        texture.needsUpdate = true;
        
        // Process skybox seam again to ensure consistency
        this.processSkyboxSeam(texture);
        
        return texture;
    }

    loadImageAsHTMLImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    processSkyboxSeam(texture) {
        // Create a temporary canvas to process the skybox image
        const image = texture.image;
        // Ensure the image is loaded and is a type that can be drawn to canvas
        if (!(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof ImageBitmap) || (image instanceof HTMLImageElement && !image.complete)) {
             console.warn("Skybox texture image is not ready or not a processable type:", image);
             // Optionally, retry later or skip processing for this texture
             return;
         }

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');

        // Draw the original image to the canvas
        try {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.error("Error drawing skybox image to canvas:", e);
            return; // Stop processing if drawing fails
        }

        // Reduce blend width to confine the fog closer to the seam
        const blendWidth = Math.floor(image.width * 0.15); // Reduced from 0.40 to 0.15 (15%)
        // Define a softer fog color (light grey) - adjust alpha for density
        const fogColorOpaque = 'rgba(210, 210, 210, 1.0)'; // Opaque, light grey for dense fog feel
        const fogColorTransparent = 'rgba(210, 210, 210, 0.0)'; // Fully transparent version

        // --- Left edge gradient (seam start) ---
        const leftGradient = ctx.createLinearGradient(0, 0, blendWidth, 0);
        // Start opaque at the very edge
        leftGradient.addColorStop(0, fogColorOpaque);
        // Keep opaque for the first ~10% of the blend width to ensure seam is covered
        leftGradient.addColorStop(0.1, fogColorOpaque);
        // Start fading out, becoming fully transparent at the end of the blend width
        leftGradient.addColorStop(1, fogColorTransparent);

        // --- Right edge gradient (seam end) ---
        const rightGradient = ctx.createLinearGradient(image.width, 0, image.width - blendWidth, 0);
        // Start opaque at the very edge
        rightGradient.addColorStop(0, fogColorOpaque);
         // Keep opaque for the first ~10% of the blend width
        rightGradient.addColorStop(0.1, fogColorOpaque);
        // Start fading out, becoming fully transparent at the start of the blend width (relative to right edge)
        rightGradient.addColorStop(1, fogColorTransparent);

        // Apply the gradients over the existing image
        // Composite operation 'source-over' (default) draws the gradient on top
        ctx.fillStyle = leftGradient;
        ctx.fillRect(0, 0, blendWidth, image.height);

        ctx.fillStyle = rightGradient;
        ctx.fillRect(image.width - blendWidth, 0, blendWidth, image.height);

        // Update the texture with the processed canvas data
         // Directly use canvas, Three.js will handle it.
         texture.image = canvas;
         texture.needsUpdate = true;
         console.log(`Processed skybox seam with softer grey fog (15% width, opaque near edge) using Canvas`);
    }

    createPlaceholderTexture(color = '#FF00FF') { // Default to magenta for visibility
        console.warn(`Creating placeholder texture with color ${color}.`);
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');

        // Simple checkerboard pattern
        context.fillStyle = color;
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = 'rgba(0,0,0,0.2)'; // Slightly darker shade for contrast
        for (let i = 0; i < 4; i++) {
             for (let j = 0; j < 4; j++) {
                 if ((i + j) % 2 === 0) {
                     context.fillRect(i * 16, j * 16, 16, 16);
                 }
             }
         }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        const textureScale = 2;
        const repeatValue = 50 / textureScale; // Updated to match new tileSize of 50
        texture.repeat.set(repeatValue, repeatValue);
        return texture;
    }
}