// Fish Grid Visualization
const canvas = document.getElementById('fishCanvas');
const ctx = canvas.getContext('2d');
const zoomInfo = document.getElementById('zoomInfo');
const playButton = document.getElementById('playButton');
const resetButton = document.getElementById('resetButton');
const zoomOutSpeedSlider = document.getElementById('zoomOutSpeed');
const zoomOutSpeedValue = document.getElementById('zoomOutSpeedValue');
const stopAtZoomEnabledCheckbox = document.getElementById('stopAtZoomEnabled');
const stopAtZoomLevelSlider = document.getElementById('stopAtZoomLevel');
const stopAtZoomLevelValue = document.getElementById('stopAtZoomLevelValue');
const showScaleBarCheckbox = document.getElementById('showScaleBar');
const showCenterBoxCheckbox = document.getElementById('showCenterBox');
const showCenterReticleCheckbox = document.getElementById('showCenterReticle');
const usePixelModeCheckbox = document.getElementById('usePixelMode');
const useGridLayoutCheckbox = document.getElementById('useGridLayout');
const bgGradientButton = document.getElementById('bgGradientButton');
const bgImageButton = document.getElementById('bgImageButton');
const bgVideoButton = document.getElementById('bgVideoButton');
const manualZoomSlider = document.getElementById('manualZoom');
const manualZoomValue = document.getElementById('manualZoomValue');
const invisibleYearLayoutCheckbox = document.getElementById('invisibleYearLayout');
const playYearAnimationButton = document.getElementById('playYearAnimationButton');

// State
let fishData = [];
let fishImage = null;
let zoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let hasDragged = false;
let isAutoZoomPlaying = false;
let autoZoomDirection = 1;
let zoomOutSpeedMultiplier = parseFloat(zoomOutSpeedSlider.value) || 1.6;
let isolatedFishKey = null;
let isolationFade = 0;
let isolationTarget = 0;
let pendingPlayAfterFadeIn = false;
let stopAtZoomEnabled = stopAtZoomEnabledCheckbox ? stopAtZoomEnabledCheckbox.checked : false;
let stopAtZoomPercent = parseFloat(stopAtZoomLevelSlider ? stopAtZoomLevelSlider.value : '18') || 18;
let showScaleBar = showScaleBarCheckbox ? showScaleBarCheckbox.checked : true;
let showCenterBox = showCenterBoxCheckbox ? showCenterBoxCheckbox.checked : true;
let showCenterReticle = showCenterReticleCheckbox ? showCenterReticleCheckbox.checked : true;
let usePixelMode = usePixelModeCheckbox ? usePixelModeCheckbox.checked : false;
let useGridLayout = useGridLayoutCheckbox ? useGridLayoutCheckbox.checked : false;
let floorColor = '#336132';
let backgroundMode = 'gradient'; // 'gradient', 'image', or 'video'
let invisibleYearLayout = invisibleYearLayoutCheckbox ? invisibleYearLayoutCheckbox.checked : false;
let yearFadeOpacity = 1; // 0-1, controls visibility of year rings
let isPlayingSecondStage = false; // Whether second stage animation is active
let yearFadeStartTime = 0;
const YEAR_FADE_DURATION_MS = 2000;

// Configuration
const FISH_IMAGE_HEIGHT = 16; // Short side of the rendered fish before rotation
const ZOOM_SPEED = 0.04;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 15;
const ZOOM_THRESHOLD = 1.0; // Threshold for switching between zoom modes
const PIXEL_MODE_ZOOM_THRESHOLD = 0.3; // Zoom level at which to switch to pixel mode
const AUTO_ZOOM_IN_RATE = 0.012;
const AUTO_ZOOM_OUT_RATE = 0.006;
const AUTO_ZOOM_MIN = 0.05;
const AUTO_ZOOM_MAX = 3.2;
const ZOOM_STOP_SNAP_THRESHOLD = 0.002;
const ISOLATION_FADE_IN_DURATION_MS = 5000;
const ISOLATION_OTHER_ALPHA_MULTIPLIER = 0;

// Computed values
let fishPositions = []; // Array of {x, y, weekNumber, fishIndex, circleIndex}
let layoutBounds = { width: 0, height: 0 };
let fishAspectRatio = 1;
let fishRenderWidth = 16;
let fishRenderHeight = FISH_IMAGE_HEIGHT;
let centerCanvasX = 0;
let centerCanvasY = 0;

// Initialize
async function init() {
    // Set canvas size
    resizeCanvas();
    refreshFloorColor();
    
    // Load image
    fishImage = await loadImage('fish-image/pacific-bluefin.png');
    configureFishGeometry();
    
    // Load and parse CSV
    const csv = await fetch('data/toyosu_tuna_2023.csv').then(r => r.text());
    parseCSV(csv);
    
    // Event listeners
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('wheel', handleZoom);
    canvas.addEventListener('mousedown', handleDragStart);
    canvas.addEventListener('mousemove', handleDrag);
    canvas.addEventListener('mouseup', handleDragEnd);
    canvas.addEventListener('mouseleave', handleDragEnd);
    playButton.addEventListener('click', toggleAutoZoomPlayback);
    resetButton.addEventListener('click', resetView);
    zoomOutSpeedSlider.addEventListener('input', handleZoomOutSpeedChange);
    if (stopAtZoomEnabledCheckbox) {
        stopAtZoomEnabledCheckbox.addEventListener('change', handleStopAtZoomEnabledChange);
    }
    if (stopAtZoomLevelSlider) {
        stopAtZoomLevelSlider.addEventListener('input', handleStopAtZoomLevelChange);
    }
    if (showScaleBarCheckbox) {
        showScaleBarCheckbox.addEventListener('change', handleScaleBarToggleChange);
    }
    if (showCenterBoxCheckbox) {
        showCenterBoxCheckbox.addEventListener('change', handleCenterBoxToggleChange);
    }
    if (showCenterReticleCheckbox) {
        showCenterReticleCheckbox.addEventListener('change', handleCenterReticleToggleChange);
    }
    if (usePixelModeCheckbox) {
        usePixelModeCheckbox.addEventListener('change', handlePixelModeToggleChange);
    }
    if (useGridLayoutCheckbox) {
        useGridLayoutCheckbox.addEventListener('change', handleGridLayoutToggleChange);
    }

    bgGradientButton.addEventListener('click', handleBgGradientClick);
    bgImageButton.addEventListener('click', handleBgImageClick);
    bgVideoButton.addEventListener('click', handleBgVideoClick);

    manualZoomSlider.addEventListener('input', handleManualZoomChange);

    if (invisibleYearLayoutCheckbox) {
        invisibleYearLayoutCheckbox.addEventListener('change', handleInvisibleYearLayoutChange);
    }
    playYearAnimationButton.addEventListener('click', handlePlayYearAnimation);

    updatePlaybackUI();
    updateSpeedLabel();
    updateStopAtZoomLabel();
    
    // Initialize button states
    playYearAnimationButton.disabled = !invisibleYearLayout;
    
    // Start animation loop
    animate();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function refreshFloorColor() {
    const cssFloorColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--floor-color')
        .trim();
    floorColor = cssFloorColor || '#336132';
}

function drawBackground() {
    if (backgroundMode === 'gradient') {
        drawGradientBackground();
    } else {
        // Fallback to solid color for image/video modes (not implemented yet)
        ctx.fillStyle = floorColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawGradientBackground() {
    // Create a subtle ocean blue gradient from lighter at top to darker at bottom
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    
    // Subtle gradient: light ocean blue at top, darker ocean blue at bottom
    const lightBlue = '#276aa4';   // Lighter ocean blue
    const darkBlue = '#092142';    // Darker ocean blue
    
    gradient.addColorStop(0, lightBlue);
    gradient.addColorStop(1, darkBlue);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function configureFishGeometry() {
    fishAspectRatio = fishImage.naturalWidth / fishImage.naturalHeight;
    fishRenderHeight = FISH_IMAGE_HEIGHT;
    fishRenderWidth = Math.max(4, fishRenderHeight * fishAspectRatio);
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const header = lines[0].split(',');
    
    fishData = lines.slice(1).map(line => {
        const values = line.split(',');
        return {
            year: parseInt(values[0]),
            month: parseInt(values[1]),
            week: parseInt(values[2]),
            origin: values[3],
            volume_tonnes: parseFloat(values[4]),
            price_high: parseInt(values[5]),
            price_mid: parseInt(values[6]),
            price_low: parseInt(values[7]),
            approx_fish_count: parseInt(values[8]),
            week_number: parseInt(values[9])
        };
    });
    
    // Calculate layout
    calculateLayout();
    centerLayout();
}

function calculateLayout() {
    if (useGridLayout) {
        calculateGridLayout();
    } else {
        calculateCircularLayout();
    }
    centerLayout();
}

function calculateCircularLayout() {
    fishPositions = [];
    centerCanvasX = 0;
    centerCanvasY = 0;

    if (fishData.length === 0) return;

    const SPACING_MULTIPLIER = 1.6; // Spacing between fish along circle
    const baseRadius = 100;
    const ringGap = 40; // Distance between rings

    // Place center fish - pointing upwards
    fishPositions.push({ 
        x: 0, y: 0, 
        weekNumber: fishData[0].week_number, 
        fishIndex: 0, 
        angle: -Math.PI / 2,
        circleIndex: 0 
    });

    // Helper function to place fish in concentric rings
    function placeRingSet(fishGroups, startRadiusMultiplier, isLastGroup = false, ringSetType = 'week') {
        let totalFish = fishGroups.reduce((sum, g) => sum + g.count, 0);
        if (totalFish === 0) return;

        let fishPlaced = 0;
        let currentRing = 0;
        let maxRings = Math.ceil(totalFish / 100); // Prevent infinite loops

        while (fishPlaced < totalFish && currentRing < maxRings) {
            const currentRadius = baseRadius + startRadiusMultiplier * ringGap + currentRing * ringGap;
            const circumference = 2 * Math.PI * currentRadius;
            const maxFishInRing = Math.floor(circumference / (fishRenderHeight * SPACING_MULTIPLIER));
            
            if (maxFishInRing === 0) break;

            // Place fish in this ring
            let fishInThisRing = Math.min(maxFishInRing, totalFish - fishPlaced);
            let isFinalRing = (fishInThisRing < maxFishInRing);
            
            for (let i = 0; i < fishInThisRing; i++) {
                let angle;
                
                // Use 180-degree arc for final rings of month/year groups, or for incomplete rings
                if ((isFinalRing && fishInThisRing < maxFishInRing) || (isLastGroup && isFinalRing)) {
                    // Line up from left side over the top to right side, using 180-degree arc
                    angle = -Math.PI + (i / Math.max(1, fishInThisRing - 1)) * Math.PI;
                } else {
                    // Distribute evenly around full rings
                    angle = (i / fishInThisRing) * Math.PI * 2;
                }
                
                const x = Math.cos(angle) * currentRadius;
                const y = Math.sin(angle) * currentRadius;
                
                // Fish angle points inward (towards center), rotated 180 degrees from the radial angle
                const fishAngle = angle + Math.PI;

                // Determine which group this fish belongs to
                let groupIdx = 0;
                let fishInGroupCount = 0;
                let countSoFar = 0;

                for (let g = 0; g < fishGroups.length; g++) {
                    if (countSoFar + fishGroups[g].count > fishPlaced) {
                        groupIdx = g;
                        fishInGroupCount = fishPlaced - countSoFar;
                        break;
                    }
                    countSoFar += fishGroups[g].count;
                }

                const group = fishGroups[groupIdx];
                fishPositions.push({
                    x: x,
                    y: y,
                    weekNumber: group.weekNumber,
                    fishIndex: fishInGroupCount,
                    angle: fishAngle,
                    circleIndex: groupIdx + 1,
                    ringSetType: ringSetType
                });

                fishPlaced++;
            }

            currentRing++;
        }
    }

    // Organize fish by circle type
    const weekFish = [];
    if (fishData[0].approx_fish_count > 1) {
        weekFish.push({
            weekNumber: fishData[0].week_number,
            count: fishData[0].approx_fish_count - 1 // Exclude center fish
        });
    }

    const monthFish = [];
    const yearFish = [];
    
    // Calculate how many month fish can fit in a single ring
    const monthRingRadiusMultiplier = weekFish.length > 0 ? 4 : 1;
    const monthRingRadius = baseRadius + monthRingRadiusMultiplier * ringGap;
    const monthRingCircumference = 2 * Math.PI * monthRingRadius;
    const maxMonthFishInRing = Math.floor(monthRingCircumference / (fishRenderHeight * SPACING_MULTIPLIER));
    
    // Collect month data (indices 1-3) and year data (indices 4+)
    let monthFishCount = 0;
    let monthDataExhausted = false;
    
    for (let i = 1; i < fishData.length; i++) {
        const count = fishData[i].approx_fish_count;
        
        // If we haven't exhausted month data and this is still month data (indices 1-3)
        if (!monthDataExhausted && i < 4 && monthFishCount + count <= maxMonthFishInRing) {
            monthFish.push({
                weekNumber: fishData[i].week_number,
                count: count
            });
            monthFishCount += count;
        } else {
            // Everything else goes to year ring
            monthDataExhausted = true;
            yearFish.push({
                weekNumber: fishData[i].week_number,
                count: count
            });
        }
    }

    // Remove old yearFish loop since we handle it above

    // Place each ring set
    if (weekFish.length > 0) {
        placeRingSet(weekFish, 1, false, 'week');
    }
    if (monthFish.length > 0) {
        placeRingSet(monthFish, weekFish.length > 0 ? 4 : 1, false, 'month');
    }
    if (yearFish.length > 0) {
        const yearStartMultiplier = (weekFish.length > 0 ? 4 : 1) + (monthFish.length > 0 ? (invisibleYearLayout ? 0 : 20) : 0);
        placeRingSet(yearFish, yearStartMultiplier, true, 'year');
    }

    // Calculate bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    fishPositions.forEach(fish => {
        minX = Math.min(minX, fish.x - fishRenderWidth);
        maxX = Math.max(maxX, fish.x + fishRenderWidth);
        minY = Math.min(minY, fish.y - fishRenderHeight);
        maxY = Math.max(maxY, fish.y + fishRenderHeight);
    });

    layoutBounds.width = maxX - minX;
    layoutBounds.height = maxY - minY;
}

function calculateGridLayout() {
    fishPositions = [];
    centerCanvasX = 0;
    centerCanvasY = 0;

    if (fishData.length === 0) return;

    // Collect fish by group
    const centerFish = {
        weekNumber: fishData[0].week_number,
        fishIndex: 0
    };

    const monthFish = [];
    for (let i = 1; i < Math.min(4, fishData.length); i++) {
        for (let j = 0; j < fishData[i].approx_fish_count; j++) {
            monthFish.push({
                weekNumber: fishData[i].week_number,
                fishIndex: j
            });
        }
    }

    const yearFish = [];
    for (let i = 4; i < fishData.length; i++) {
        for (let j = 0; j < fishData[i].approx_fish_count; j++) {
            yearFish.push({
                weekNumber: fishData[i].week_number,
                fishIndex: j
            });
        }
    }

    const FISH_SPACING = 2;
    const cellWidth = fishRenderWidth + FISH_SPACING;
    const cellHeight = fishRenderHeight + FISH_SPACING;
    const GROUP_GAP = 30; // Spacing between groups
    
    // Target aspect ratio: 8:15 (width:height)
    const ASPECT_RATIO = 8 / 15;
    
    // Helper function to calculate grid dimensions for a given number of items
    const calculateGridDims = (itemCount) => {
        if (itemCount === 0) return { cols: 0, rows: 0 };
        const cols = Math.ceil(Math.sqrt(itemCount * ASPECT_RATIO));
        const rows = Math.ceil(itemCount / cols);
        return { cols, rows };
    };

    // Calculate dimensions for each group
    const centerDims = { cols: 1, rows: 1 }; // Single fish
    const monthDims = calculateGridDims(monthFish.length);
    const yearDims = calculateGridDims(yearFish.length);

    let currentY = 0;

    // Place center fish
    fishPositions.push({
        x: 0,
        y: currentY,
        weekNumber: centerFish.weekNumber,
        fishIndex: centerFish.fishIndex,
        angle: -Math.PI / 2, // Point upward
        circleIndex: 0
    });

    currentY += centerDims.rows * cellHeight + GROUP_GAP;

    // Place month fish
    monthFish.forEach((fish, index) => {
        const row = Math.floor(index / monthDims.cols);
        const col = index % monthDims.cols;
        const x = col * cellWidth;
        const y = currentY + row * cellHeight;

        fishPositions.push({
            x: x,
            y: y,
            weekNumber: fish.weekNumber,
            fishIndex: fish.fishIndex,
            angle: -Math.PI / 2, // Point upward
            circleIndex: 1
        });
    });

    currentY += monthDims.rows * cellHeight + GROUP_GAP;

    // Place year fish
    yearFish.forEach((fish, index) => {
        const row = Math.floor(index / yearDims.cols);
        const col = index % yearDims.cols;
        const x = col * cellWidth;
        const y = currentY + row * cellHeight;

        fishPositions.push({
            x: x,
            y: y,
            weekNumber: fish.weekNumber,
            fishIndex: fish.fishIndex,
            angle: -Math.PI / 2, // Point upward
            circleIndex: 2
        });
    });

    // Calculate bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    fishPositions.forEach(fish => {
        minX = Math.min(minX, fish.x - fishRenderWidth / 2);
        maxX = Math.max(maxX, fish.x + fishRenderWidth / 2);
        minY = Math.min(minY, fish.y - fishRenderHeight / 2);
        maxY = Math.max(maxY, fish.y + fishRenderHeight / 2);
    });

    layoutBounds.width = maxX - minX;
    layoutBounds.height = maxY - minY;
}

function centerLayout() {
    if (useGridLayout) {
        // For grid layout, zoom from top-left corner
        centerCanvasX = 0;
        centerCanvasY = 0;
        panX = 100; // Offset to show content
        panY = 100;
    } else {
        // For circular layout, zoom from center
        // Round to ensure exact pixel alignment for the center fish at world (0, 0)
        centerCanvasX = Math.round(canvas.width / 2);
        centerCanvasY = Math.round(canvas.height / 2);
        panX = centerCanvasX;
        panY = centerCanvasY;
    }
}

function handleZoom(e) {
    e.preventDefault();
    isAutoZoomPlaying = false;
    updatePlaybackUI();
    
    const zoomFactor = e.deltaY > 0 ? 1 - ZOOM_SPEED : 1 + ZOOM_SPEED;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * zoomFactor));
    
    // Zoom towards mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setZoomAroundScreenPoint(newZoom, mouseX, mouseY);
}

function handleDragStart(e) {
    isAutoZoomPlaying = false;
    pendingPlayAfterFadeIn = false;
    updatePlaybackUI();
    isDragging = true;
    hasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
}

function handleDrag(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasDragged = true;
    }
    
    panX += deltaX;
    panY += deltaY;
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
}

function handleDragEnd(e) {
    if (e && e.type === 'mouseup' && !hasDragged) {
        handleCanvasClick(e);
    }

    isDragging = false;
}

function animate() {
    updateIsolationFade();
    updateSecondStageAnimation();
    applyAutoZoomStep();

    drawBackground();
    
    // Disable image smoothing at low zoom to reduce shimmering
    ctx.imageSmoothingEnabled = zoom > PIXEL_MODE_ZOOM_THRESHOLD;
    
    ctx.save();
    
    // Apply pan and zoom - round coordinates at low zoom to avoid sub-pixel shimmer
    if (zoom < PIXEL_MODE_ZOOM_THRESHOLD) {
        ctx.translate(Math.round(panX), Math.round(panY));
    } else {
        ctx.translate(panX, panY);
    }
    ctx.scale(zoom, zoom);
    
    // Draw grid
    drawFishGrid();

    // Draw selected fish scale bar in world space so it tracks zoom/pan naturally.
    drawSelectedFishScaleBar();
    
    ctx.restore();
    
    // Update info
    updateInfo();
    
    // Draw center box overlay in screen space (after ctx.restore)
    drawCenterBoxOverlay();
    drawCenterReticleOverlay();
    
    requestAnimationFrame(animate);
}

function drawFishGrid() {
    if (!fishImage || fishPositions.length === 0) return;
    
    // Draw all fish at their circular positions
    fishPositions.forEach((fishPos) => {
        const fishKey = getFishKey(fishPos.weekNumber, fishPos.fishIndex);
        
        let alpha = getFishAlpha(fishKey, 0.85);
        
        // Apply year fade opacity in invisible year layout mode
        if (invisibleYearLayout && fishPos.ringSetType === 'year') {
            alpha *= yearFadeOpacity;
        }
        
        ctx.globalAlpha = alpha;
        
        // Use pixel mode when zoomed out and option is enabled, or always in grid layout when zoomed out
        const shouldUsePixelMode = (usePixelMode && zoom < PIXEL_MODE_ZOOM_THRESHOLD) || (useGridLayout && zoom < 0.8);
        if (shouldUsePixelMode) {
            drawPixel(fishPos.x, fishPos.y, fishPos.angle);
        } else {
            drawRotatedFish(fishImage, fishPos.x, fishPos.y, fishRenderWidth, fishRenderHeight, fishPos.angle);
        }
        
        ctx.globalAlpha = 1;
    });
}

function drawRotatedFish(img, x, y, width, height, angle) {
    // Save the current context state
    ctx.save();
    
    // Round coordinates at very low zoom to reduce shimmering
    let drawX = x;
    let drawY = y;
    if (zoom < 0.3) {
        drawX = Math.round(x);
        drawY = Math.round(y);
    }
    
    // Translate to the position where the fish will be drawn (center of fish)
    ctx.translate(drawX, drawY);
    
    // Rotate by the angle (fish faces the given direction)
    ctx.rotate(angle);
    
    // Draw the image centered at origin
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    
    // Restore the context state
    ctx.restore();
}

function drawPixel(x, y, angle) {
    // Save the current context state
    ctx.save();
    
    // Translate to the position where the pixel will be drawn (center of fish)
    ctx.translate(x, y);
    
    // Rotate by the angle (same as fish)
    ctx.rotate(angle);
    
    // Draw simple white pixels shaped like a simplified fish
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    
    // Create a simplified fish shape with rectangular pixels
    const pixelSize = fishRenderHeight * 0.25;
    
    // Main body (center)
    ctx.fillRect(-fishRenderWidth * 0.35, -pixelSize * 0.5, fishRenderWidth * 0.5, pixelSize);
    
    // Side fins (add width/fatness)
    const sideWidth = pixelSize * 5;
    ctx.fillRect(-fishRenderWidth * 0.35, -pixelSize * 0.35, sideWidth, pixelSize * 0.7);
    ctx.fillRect(-fishRenderWidth * 0.35, pixelSize * 0.15, sideWidth, pixelSize * 0.7);
    
    // Head (point to the right when not rotated)
    ctx.fillRect(fishRenderWidth * 0.15, -pixelSize * 0.6, pixelSize * 0.8, pixelSize * 0.6);
    
    // Tail (point to the left when not rotated)
    ctx.fillRect(-fishRenderWidth * 0.35, -pixelSize * 0.8, pixelSize * 0.6, pixelSize * 1.6);
    
    // Restore the context state
    ctx.restore();
}

function updateInfo() {
    const displayZoom = (zoom * 100).toFixed(0);
    zoomInfo.textContent = `Zoom: ${displayZoom}% ${isAutoZoomPlaying ? '[playing]' : '[paused]'}`;
    manualZoomSlider.value = zoom;
    manualZoomValue.textContent = `${zoom.toFixed(2)}x`;
}

function toggleAutoZoomPlayback() {
    if (isAutoZoomPlaying || pendingPlayAfterFadeIn) {
        isAutoZoomPlaying = false;
        pendingPlayAfterFadeIn = false;
        updatePlaybackUI();
        return;
    }

    if (isolatedFishKey || isolationFade > 0.001) {
        pendingPlayAfterFadeIn = true;
        clearFishIsolation();
    } else {
        startAutoZoomPlayback();
    }

    updatePlaybackUI();
}

function startAutoZoomPlayback() {
    isAutoZoomPlaying = true;
    autoZoomDirection = -1;
}

function resetView() {
    isAutoZoomPlaying = false;
    pendingPlayAfterFadeIn = false;
    clearFishIsolation();
    autoZoomDirection = 1;
    centerLayout();
    updatePlaybackUI();
}

function handleZoomOutSpeedChange() {
    zoomOutSpeedMultiplier = Math.max(0.1, parseFloat(zoomOutSpeedSlider.value) || 1);
    updateSpeedLabel();
}

function updateSpeedLabel() {
    zoomOutSpeedValue.textContent = `${zoomOutSpeedMultiplier.toFixed(1)}x`;
}

function handleStopAtZoomEnabledChange() {
    stopAtZoomEnabled = !!stopAtZoomEnabledCheckbox.checked;
}

function handleStopAtZoomLevelChange() {
    stopAtZoomPercent = parseFloat(stopAtZoomLevelSlider.value) || 0;
    stopAtZoomPercent = Math.max(0, Math.min(100, stopAtZoomPercent));
    updateStopAtZoomLabel();
}

function updateStopAtZoomLabel() {
    if (!stopAtZoomLevelValue) return;
    stopAtZoomLevelValue.textContent = `${stopAtZoomPercent.toFixed(0)}%`;
}

function stopPercentToZoom(percent) {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const t = clampedPercent / 100;
    return AUTO_ZOOM_MIN + (AUTO_ZOOM_MAX - AUTO_ZOOM_MIN) * t;
}

function handleScaleBarToggleChange() {
    showScaleBar = !!showScaleBarCheckbox.checked;
}

function handleCenterBoxToggleChange() {
    showCenterBox = !!showCenterBoxCheckbox.checked;
}

function handleCenterReticleToggleChange() {
    showCenterReticle = !!showCenterReticleCheckbox.checked;
}

function handlePixelModeToggleChange() {
    usePixelMode = !!usePixelModeCheckbox.checked;
}

function handleGridLayoutToggleChange() {
    useGridLayout = !!useGridLayoutCheckbox.checked;
    calculateLayout();
    resetView();
}

function handleInvisibleYearLayoutChange() {
    invisibleYearLayout = !!invisibleYearLayoutCheckbox.checked;
    if (invisibleYearLayout) {
        yearFadeOpacity = 0; // Start invisible
        playYearAnimationButton.disabled = false;
    } else {
        yearFadeOpacity = 1; // Make visible
        playYearAnimationButton.disabled = true;
    }
    calculateLayout();
    resetView();
}

function handlePlayYearAnimation() {
    if (!invisibleYearLayout) return; // Only works in invisible year layout mode
    
    isAutoZoomPlaying = false;
    updatePlaybackUI();
    isPlayingSecondStage = true;
    yearFadeStartTime = performance.now();
    yearFadeOpacity = 0;
}

function updateSecondStageAnimation() {
    if (!isPlayingSecondStage) return;
    
    const elapsed = performance.now() - yearFadeStartTime;
    
    if (elapsed < YEAR_FADE_DURATION_MS) {
        // Fade in the year rings
        yearFadeOpacity = elapsed / YEAR_FADE_DURATION_MS;
    } else {
        // Fade complete, start zoom out animation
        yearFadeOpacity = 1;
        isPlayingSecondStage = false;
        isAutoZoomPlaying = true;
        autoZoomDirection = -1;
        updatePlaybackUI();
    }
}

function handleBgGradientClick() {
    backgroundMode = 'gradient';
    updateBgButtonUI();
}

function handleBgImageClick() {
    backgroundMode = 'image';
    updateBgButtonUI();
    // TODO: Implement image background
}

function handleBgVideoClick() {
    backgroundMode = 'video';
    updateBgButtonUI();
    // TODO: Implement video background
}

function updateBgButtonUI() {
    bgGradientButton.classList.toggle('active', backgroundMode === 'gradient');
    bgImageButton.classList.toggle('active', backgroundMode === 'image');
    bgVideoButton.classList.toggle('active', backgroundMode === 'video');
}

function handleManualZoomChange() {
    isAutoZoomPlaying = false;
    updatePlaybackUI();
    zoom = parseFloat(manualZoomSlider.value) || 1;
}

function drawCenterBoxOverlay() {
    if (!showCenterBox) {
        return;
    }

    const boxWidth = 400;
    const boxHeight = 750;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const boxX = centerX - boxWidth / 2;
    const boxY = centerY - boxHeight / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Draw smaller box 1/4 of the way up the center box
    const smallBoxWidth = 400;
    const smallBoxHeight = 100;
    const smallBoxX = centerX - smallBoxWidth / 2;
    const smallBoxY = boxY + boxHeight * 0.75 - smallBoxHeight / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(smallBoxX, smallBoxY, smallBoxWidth, smallBoxHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(smallBoxX, smallBoxY, smallBoxWidth, smallBoxHeight);
}

function drawCenterReticleOverlay() {
    if (!showCenterReticle) {
        return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const crossArm = 10;
    const innerGap = 3;
    const circleRadius = 3;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(centerX - crossArm, centerY);
    ctx.lineTo(centerX - innerGap, centerY);
    ctx.moveTo(centerX + innerGap, centerY);
    ctx.lineTo(centerX + crossArm, centerY);
    ctx.moveTo(centerX, centerY - crossArm);
    ctx.lineTo(centerX, centerY - innerGap);
    ctx.moveTo(centerX, centerY + innerGap);
    ctx.lineTo(centerX, centerY + crossArm);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function updatePlaybackUI() {
    playButton.textContent = isAutoZoomPlaying ? 'Pause' : 'Play';
}

function getFishKey(weekNumber, fishIndex) {
    return `${weekNumber}-${fishIndex}`;
}

function getFishAlpha(fishKey, baseAlpha) {
    if (!isolatedFishKey || isolationFade <= 0) {
        return baseAlpha;
    }

    if (fishKey === isolatedFishKey) {
        return baseAlpha;
    }

    const isolationMix = 1 - isolationFade * (1 - ISOLATION_OTHER_ALPHA_MULTIPLIER);
    return baseAlpha * isolationMix;
}

function clearFishIsolation() {
    // Keep isolatedFishKey during fade-in so non-selected fish can interpolate alpha.
    isolationTarget = 0;
}

function updateIsolationFade() {
    const remaining = isolationTarget - isolationFade;

    if (Math.abs(remaining) < 0.001) {
        isolationFade = isolationTarget;
    } else if (isolationTarget < isolationFade) {
        const fadeInStep = 16.67 / ISOLATION_FADE_IN_DURATION_MS;
        isolationFade = Math.max(isolationTarget, isolationFade - fadeInStep);
    } else {
        isolationFade = isolationTarget;
    }

    if (isolationFade <= 0.001 && isolationTarget === 0) {
        isolatedFishKey = null;
    }

    if (pendingPlayAfterFadeIn && isolationFade <= 0.001) {
        pendingPlayAfterFadeIn = false;
        startAutoZoomPlayback();
        updatePlaybackUI();
    }
}

function handleCanvasClick(e) {
    const fish = getFishAtScreenPoint(e.clientX, e.clientY);

    if (isolatedFishKey && (!fish || fish.key !== isolatedFishKey)) {
        clearFishIsolation();
        return;
    }

    if (fish) {
        isolatedFishKey = fish.key;
        isolationTarget = 1;
        isolationFade = 1;
        return;
    }

    clearFishIsolation();
}

function drawSelectedFishScaleBar() {
    if (!showScaleBar || !isolatedFishKey || isolationTarget !== 1) {
        return;
    }

    const placement = getFishPlacementByKey(isolatedFishKey);
    if (!placement) {
        return;
    }

    const centerX = placement.fishX + fishRenderWidth / 2;
    const centerY = placement.fishY + fishRenderHeight / 2;
    const tipY = centerY - fishRenderWidth / 2;
    const tailY = centerY + fishRenderWidth / 2;
    const displayLengthPx = fishRenderWidth * zoom;
    const centerBoxHeight = 750;
    const percentOfCenterBox = (displayLengthPx / centerBoxHeight) * 100;

    ctx.save();
    ctx.strokeStyle = '#ff2e2e';
    ctx.fillStyle = '#ff2e2e';
    ctx.lineWidth = Math.max(1 / zoom, 1.2 / zoom);

    ctx.beginPath();
    ctx.moveTo(centerX, tipY);
    ctx.lineTo(centerX, tailY);
    ctx.stroke();

    const tickHalf = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(centerX - tickHalf, tipY);
    ctx.lineTo(centerX + tickHalf, tipY);
    ctx.moveTo(centerX - tickHalf, tailY);
    ctx.lineTo(centerX + tickHalf, tailY);
    ctx.stroke();

    ctx.font = `${11 / zoom}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${displayLengthPx.toFixed(1)} px (${percentOfCenterBox.toFixed(1)}% of center box)`, centerX + 5 / zoom, centerY);
    ctx.restore();
}

function getFishPlacementByKey(targetKey) {
    for (let i = 0; i < fishPositions.length; i++) {
        const fish = fishPositions[i];
        const key = getFishKey(fish.weekNumber, fish.fishIndex);
        
        if (key === targetKey) {
            return { fishX: fish.x, fishY: fish.y };
        }
    }
    return null;
}

function getFishAtScreenPoint(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    const worldX = (canvasX - panX) / zoom;
    const worldY = (canvasY - panY) / zoom;

    for (let i = 0; i < fishPositions.length; i++) {
        const fish = fishPositions[i];
        const fishX = fish.x;
        const fishY = fish.y;
        const rotatedOffset = (fishRenderWidth - fishRenderHeight) / 2;
        const hitX = fishX + rotatedOffset;
        const hitY = fishY - rotatedOffset;
        const hitWidth = fishRenderHeight;
        const hitHeight = fishRenderWidth;

        if (
            worldX >= hitX &&
            worldX <= hitX + hitWidth &&
            worldY >= hitY &&
            worldY <= hitY + hitHeight
        ) {
            return { key: getFishKey(fish.weekNumber, fish.fishIndex) };
        }
    }

    return null;
}

function setZoomAroundScreenPoint(nextZoom, screenX, screenY) {
    const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
    if (clampedZoom === zoom) return;

    const worldX = (screenX - panX) / zoom;
    const worldY = (screenY - panY) / zoom;

    zoom = clampedZoom;
    panX = screenX - worldX * zoom;
    panY = screenY - worldY * zoom;
}

function applyAutoZoomStep() {
    if (!isAutoZoomPlaying) return;

    const inRate = AUTO_ZOOM_IN_RATE;
    const outRate = AUTO_ZOOM_OUT_RATE * zoomOutSpeedMultiplier;
    let targetZoom = zoom;

    // Determine zoom center point based on layout
    let zoomCenterX, zoomCenterY;
    if (useGridLayout) {
        // For grid layout, zoom from top-left area (200px from left, near top)
        zoomCenterX = 200;
        zoomCenterY = 150;
    } else {
        // For circular layout, zoom from center
        zoomCenterX = canvas.width * 0.5;
        zoomCenterY = canvas.height * 0.5;
    }

    if (autoZoomDirection === -1 && stopAtZoomEnabled) {
        const zoomStopTarget = stopPercentToZoom(stopAtZoomPercent);

        if (zoom <= zoomStopTarget + ZOOM_STOP_SNAP_THRESHOLD) {
            setZoomAroundScreenPoint(zoomStopTarget, zoomCenterX, zoomCenterY);
            isAutoZoomPlaying = false;
            updatePlaybackUI();
            return;
        }

        const distance = zoom - zoomStopTarget;
        const slowdownRange = Math.max(0.2, zoomStopTarget * 0.7);
        const slowdownFactor = Math.max(0.08, Math.min(1, distance / slowdownRange));
        const adjustedOutRate = outRate * slowdownFactor;
        targetZoom = Math.max(zoomStopTarget, zoom * (1 - adjustedOutRate));

        if (targetZoom - zoomStopTarget <= ZOOM_STOP_SNAP_THRESHOLD) {
            targetZoom = zoomStopTarget;
            isAutoZoomPlaying = false;
            updatePlaybackUI();
        }

        setZoomAroundScreenPoint(targetZoom, zoomCenterX, zoomCenterY);
        return;
    }

    if (autoZoomDirection === 1) {
        targetZoom = Math.min(AUTO_ZOOM_MAX, zoom * (1 + inRate));
        if (targetZoom >= AUTO_ZOOM_MAX) autoZoomDirection = -1;
    } else {
        targetZoom = Math.max(AUTO_ZOOM_MIN, zoom * (1 - outRate));
        if (targetZoom <= AUTO_ZOOM_MIN) autoZoomDirection = 1;
    }

    setZoomAroundScreenPoint(targetZoom, zoomCenterX, zoomCenterY);
}

// Start the visualization
init().catch(console.error);
