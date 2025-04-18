export class UIManager {
    constructor() {
        this.uiContainer = document.getElementById('ui-container');
        this.roomGalleryVisible = false;
        this.initBasicUI();
        this.initRoomManagementUI();
    }

    initBasicUI() {
        // Placeholder for initial UI elements
        const statusElement = document.createElement('div');
        statusElement.id = 'player-status';
        statusElement.textContent = 'Status: OK';
        // this.uiContainer.appendChild(statusElement); // Moved to room management panel

        // Add a debug button to trigger room generation manually
        // const debugButton = document.createElement('button');
        // debugButton.textContent = 'Load Debug Room (Forest)';
        // debugButton.onclick = () => {
        //     const prompt = 'A bright, grassy clearing in a fantasy forest, under a blue sky.';
        //     window.loadNewDebugRoom(prompt, 'outdoor'); // Call global debug function
        // };
        // this.uiContainer.appendChild(debugButton);

        // const debugButtonIndoor = document.createElement('button');
        // debugButtonIndoor.textContent = 'Load Debug Room (Cave)';
        // debugButtonIndoor.onclick = () => {
        //     const prompt = 'A dark, damp cave with glowing crystals on the walls.';
        //     window.loadNewDebugRoom(prompt, 'indoor'); // Call global debug function
        // };
        // this.uiContainer.appendChild(debugButtonIndoor);

        const toggleGalleryButton = document.createElement('button');
        toggleGalleryButton.textContent = 'Toggle Room Gallery';
        toggleGalleryButton.onclick = () => this.toggleRoomGallery();
        // Add to a more persistent part of the UI if needed, or keep here
        // this.uiContainer.appendChild(toggleGalleryButton); // Moved to room management panel

        // Example status update
        this.updateStatus('Ready');
    }

    initRoomManagementUI() {
        // Create container for room management UI
        const roomManagementContainer = document.createElement('div');
        roomManagementContainer.id = 'room-management';
        roomManagementContainer.classList.add('ui-panel');
        roomManagementContainer.style.position = 'absolute'; // Position independently
        roomManagementContainer.style.bottom = '10px';
        roomManagementContainer.style.left = '10px';
        roomManagementContainer.style.backgroundColor = 'rgba(50, 50, 50, 0.7)';
        roomManagementContainer.style.padding = '10px';
        roomManagementContainer.style.borderRadius = '5px';
        roomManagementContainer.style.zIndex = '100';

        // Export/Import buttons
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export Rooms';
        exportButton.onclick = () => {
            if (window.game && window.game.worldManager) {
                if (window.game.worldManager.rooms.length > 0) {
                    window.game.worldManager.exportRoomsToJSON();
                    this.showNotification('Exporting rooms...');
                } else {
                    this.showNotification('No rooms to export.', 'info');
                }
            }
        };

        const importButton = document.createElement('button');
        importButton.textContent = 'Import Rooms';
        importButton.onclick = () => this.showImportDialog();

        // Toggle gallery button
        const galleryButton = document.createElement('button');
        galleryButton.textContent = 'Room Gallery';
        galleryButton.id = 'gallery-toggle-button'; // Add ID for potential styling/reference
        galleryButton.onclick = () => this.toggleRoomGallery();

        // Add buttons to container
        roomManagementContainer.appendChild(exportButton);
        roomManagementContainer.appendChild(importButton);
        roomManagementContainer.appendChild(galleryButton);

        // Debug buttons moved inside panel
        const debugPanel = document.createElement('div');
        debugPanel.style.marginTop = '10px';
        debugPanel.style.borderTop = '1px solid #666';
        debugPanel.style.paddingTop = '5px';

        const debugButton = document.createElement('button');
        debugButton.textContent = 'New Outdoor Room (Debug)';
        debugButton.onclick = () => {
            const roomPrompt = window.prompt("Enter prompt for new outdoor room:", "A misty mountain path at dawn");
            if (roomPrompt) {
                window.loadNewDebugRoom(roomPrompt, 'outdoor');
            }
        };
        debugPanel.appendChild(debugButton);

        const debugButtonIndoor = document.createElement('button');
        debugButtonIndoor.textContent = 'New Indoor Room (Debug)';
        debugButtonIndoor.onclick = () => {
            const roomPrompt = window.prompt("Enter prompt for new indoor room:", "A cozy library with a fireplace");
            if (roomPrompt) {
                window.loadNewDebugRoom(roomPrompt, 'indoor');
            }
        };
        debugPanel.appendChild(debugButtonIndoor);

        // Add new button for generating panoramic with embedded images
        const portalButton = document.createElement('button');
        portalButton.textContent = 'New Portal Room';
        portalButton.onclick = () => {
            const portalPrompt = window.prompt("Enter base prompt for a room with portals/windows:", "A fantasy observatory with large windows");
            if (portalPrompt) {
                window.loadNewDebugRoom(portalPrompt, 'outdoor');
            }
        };
        debugPanel.appendChild(portalButton);

        roomManagementContainer.appendChild(debugPanel);

        // Player status moved inside panel
        const statusElement = document.createElement('div');
        statusElement.id = 'player-status';
        statusElement.textContent = 'Status: OK';
        statusElement.style.marginTop = '5px';
        statusElement.style.fontSize = '0.9em';
        statusElement.style.color = '#ccc';
        roomManagementContainer.appendChild(statusElement);

        // Add panel to the main UI container (or directly to body if preferred)
        document.body.appendChild(roomManagementContainer); // Attach directly to body

        // Create room gallery container (initially hidden)
        const galleryContainer = document.createElement('div');
        galleryContainer.id = 'room-gallery';
        galleryContainer.classList.add('gallery-container');
        galleryContainer.style.display = 'none';

        // Add gallery header
        const galleryHeader = document.createElement('div');
        galleryHeader.classList.add('gallery-header');

        const galleryTitle = document.createElement('h2');
        galleryTitle.classList.add('gallery-title');
        galleryTitle.textContent = 'Room Gallery';

        const gallerySubtitle = document.createElement('div');
        gallerySubtitle.classList.add('gallery-subtitle');
        gallerySubtitle.textContent = 'Browse and teleport to your generated rooms';

        galleryHeader.appendChild(galleryTitle);
        galleryHeader.appendChild(gallerySubtitle);
        galleryContainer.appendChild(galleryHeader);

        // Close button for gallery
        const closeGalleryButton = document.createElement('button');
        closeGalleryButton.classList.add('close-gallery');
        closeGalleryButton.textContent = 'X';
        closeGalleryButton.onclick = () => this.toggleRoomGallery();
        galleryContainer.appendChild(closeGalleryButton);

        // Room list container
        const roomListContainer = document.createElement('div');
        roomListContainer.id = 'room-list';
        roomListContainer.classList.add('room-list');
        galleryContainer.appendChild(roomListContainer);

        // Add gallery container to body
        document.body.appendChild(galleryContainer);
    }

    showImportDialog() {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';

        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const contents = e.target.result;
                    if (window.game && window.game.worldManager) {
                        this.showNotification('Importing...', 'info');
                        const success = await window.game.worldManager.importRoomsFromJSON(contents);
                        if (success) {
                            this.showNotification('Rooms imported successfully!', 'info');
                            // Optionally teleport to the first imported room or show a message
                        } else {
                            // Error notification handled within importRoomsFromJSON
                            // this.showNotification('Failed to import rooms.', 'error');
                        }
                    }
                };
                reader.readAsText(file);
            }
        };

        fileInput.click();
    }

    toggleRoomGallery() {
        const galleryContainer = document.getElementById('room-gallery');
        this.roomGalleryVisible = !this.roomGalleryVisible;

        if (this.roomGalleryVisible) {
            galleryContainer.style.display = 'flex';
            // Update gallery content if worldManager is available
            if (window.game && window.game.worldManager) {
                this.updateRoomGallery(
                    window.game.worldManager.rooms,
                    window.game.worldManager.currentRoomIndex
                );
            }
            // Optional: Pause game or release pointer lock
            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
        } else {
            galleryContainer.style.display = 'none';
            // Optional: Resume game or request pointer lock if appropriate
            // Check if game canvas has focus before requesting lock
            // if (document.activeElement === document.getElementById('game-canvas')) {
            //    window.game?.playerController?.lockPointer();
            // }
        }
    }

    updateRoomGallery(rooms, currentIndex) {
        const roomListContainer = document.getElementById('room-list');
        if (!roomListContainer) return;

        // Clear existing list
        roomListContainer.innerHTML = '';

        if (rooms.length === 0) {
            const noRoomsMessage = document.createElement('div');
            noRoomsMessage.classList.add('no-rooms');
            noRoomsMessage.textContent = 'No rooms created or imported yet. Use the debug buttons or import a file.';
            roomListContainer.appendChild(noRoomsMessage);
            return;
        }

        // Create room list items
        rooms.forEach((room, index) => {
            const roomItem = document.createElement('div');
            roomItem.classList.add('room-item');
            if (index === currentIndex) {
                roomItem.classList.add('current-room');
            }

            // Room preview (use floor texture URL)
            const roomPreview = document.createElement('div');
            roomPreview.classList.add('room-preview');
            if (room.textureUrls && room.textureUrls.floor) {
                roomPreview.style.backgroundImage = `url('${room.textureUrls.floor}')`;
            } else {
                // Use skybox if floor is missing and it's outdoor
                if (room.type === 'outdoor' && room.textureUrls && room.textureUrls.sky) {
                    roomPreview.style.backgroundImage = `url('${room.textureUrls.sky}')`;
                    // Adjust background size for panoramic preview
                    roomPreview.style.backgroundSize = 'contain';
                    roomPreview.style.backgroundRepeat = 'no-repeat';
                } else {
                    roomPreview.classList.add('no-preview');
                }
            }

            // Room details
            const roomDetails = document.createElement('div');
            roomDetails.classList.add('room-details');

            const roomName = document.createElement('div');
            roomName.classList.add('room-name');
            roomName.textContent = room.name || `Room ${index + 1}`; // Use index if name is missing

            const roomType = document.createElement('div');
            roomType.classList.add('room-type');
            roomType.textContent = `${room.type ? room.type.charAt(0).toUpperCase() + room.type.slice(1) : 'Unknown'}`;

            const roomPrompt = document.createElement('div');
            roomPrompt.classList.add('room-prompt');
            roomPrompt.textContent = room.prompt || 'No prompt available';

            const roomActions = document.createElement('div');
            roomActions.classList.add('room-actions');

            const teleportButton = document.createElement('button');
            teleportButton.textContent = index === currentIndex ? 'Current Room' : 'Teleport';
            teleportButton.disabled = index === currentIndex;
            teleportButton.onclick = () => {
                if (window.game && window.game.worldManager) {
                    window.game.worldManager.teleportToRoom(index);
                    this.toggleRoomGallery(); // Close gallery after initiating teleport
                }
            };

            roomActions.appendChild(teleportButton);

            // Assemble room item
            roomDetails.appendChild(roomName);
            roomDetails.appendChild(roomType);
            roomDetails.appendChild(roomPrompt);
            roomDetails.appendChild(roomActions);

            roomItem.appendChild(roomPreview);
            roomItem.appendChild(roomDetails);

            roomListContainer.appendChild(roomItem);
        });
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.classList.add('notification', type);
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after specified duration
        setTimeout(() => {
            notification.classList.add('fade-out');
            // Remove from DOM after fade out animation completes
            notification.addEventListener('animationend', () => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            });
            // Fallback removal in case animationend doesn't fire reliably
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500); // Corresponds to fadeOut animation duration
        }, duration);
    }

    updateStatus(newStatus) {
        const statusElement = document.getElementById('player-status');
        if (statusElement) {
            statusElement.textContent = `Status: ${newStatus}`;
        } else {
            console.warn("Player status element not found in UI.");
        }
    }
}