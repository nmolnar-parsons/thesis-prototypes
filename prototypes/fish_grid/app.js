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

// State
let fishData = [];
let fishImage = null;
let lowResFishImage = null;
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
let floorColor = '#336132';

// Configuration
const FISH_IMAGE_HEIGHT = 16; // Short side of the rendered fish before rotation
const PIXEL_SIZE = 2; // Base size of the pixel-art unit at low zoom
const CONTAINER_PADDING = 12;
const FISH_GAP = 3.5;
const PIXEL_GAP = 1;
const GRID_COLS = 12;
const ZOOM_SPEED = 0.04;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 15;
const ZOOM_THRESHOLD = 1.0; // Threshold for switching between zoom modes
const AUTO_ZOOM_IN_RATE = 0.012;
const AUTO_ZOOM_OUT_RATE = 0.006;
const AUTO_ZOOM_MIN = 0.05;
const AUTO_ZOOM_MAX = 3.2;
const ZOOM_STOP_SNAP_THRESHOLD = 0.002;
const ISOLATION_FADE_IN_DURATION_MS = 5000;
const ISOLATION_OTHER_ALPHA_MULTIPLIER = 0;
const FISH_LAYOUT_ROWS = [
    { count: 0, gap: 0, xShift: 0 },
    { count: 0, gap: 24, xShift: 0 },
    { count: 4, gap: 18, xShift: 0 },
    { count: 6, gap: 14, xShift: 0 },
    { count: 8, gap: 12, xShift: 0 },
    { count: 9, gap: 10, xShift: 0 },
    { count: 8, gap: 10, xShift: 1 },
    { count: 5, gap: 12, xShift: 2 },
    { count: 4, gap: 12, xShift: 3 },
    { count: 4, gap: 12, xShift: 4 },
    { count: 4, gap: 12, xShift: 5 },
    { count: 4, gap: 12, xShift: 5 },
];

// Computed values
let containerDimensions = []; // Array of {width, height, x, y, cols, rows} for each week
let layoutBounds = { width: 0, height: 0 };
let fishAspectRatio = 1;
let fishRenderWidth = 16;
let fishRenderHeight = FISH_IMAGE_HEIGHT;
let fishFootprintWidth = FISH_IMAGE_HEIGHT;
let fishFootprintHeight = 16;
let pixelFootprintWidth = 16;
let pixelFootprintHeight = 16 * 2.5;

// Initialize
async function init() {
    // Set canvas size
    resizeCanvas();
    refreshFloorColor();
    
    // Load image
    fishImage = await loadImage('fish-image/pacific-bluefin.png');
    lowResFishImage = await loadImage('fish-image/low-res.png');
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

    updatePlaybackUI();
    updateSpeedLabel();
    updateStopAtZoomLabel();
    
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
    fishFootprintWidth = fishRenderHeight;
    fishFootprintHeight = fishRenderWidth;
    pixelFootprintWidth = fishFootprintWidth;
    pixelFootprintHeight = fishFootprintHeight;
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
    // Calculate container dimensions based on fish count so every fish has room at high zoom
    containerDimensions = [];
    layoutBounds = { width: 0, height: 0 };

    const layoutRows = [];
    let weekIndex = 0;

    FISH_LAYOUT_ROWS.forEach((rowConfig) => {
        const rowWeeks = fishData.slice(weekIndex, weekIndex + rowConfig.count);
        weekIndex += rowConfig.count;

        const rowContainers = rowWeeks.map((week) => {
            const contentCount = Math.max(1, week.approx_fish_count);
            const cols = Math.ceil(Math.sqrt(contentCount));
            const rows = Math.ceil(contentCount / cols);
            const width = CONTAINER_PADDING * 2 + cols * fishFootprintWidth + Math.max(0, cols - 1) * FISH_GAP;
            const height = CONTAINER_PADDING * 2 + rows * fishFootprintHeight + Math.max(0, rows - 1) * FISH_GAP;

            return {
                week: week,
                width: width,
                height: height,
                cols: cols,
                rows: rows
            };
        });

        const rowWidth = rowContainers.reduce((sum, container) => sum + container.width, 0) + Math.max(0, rowContainers.length - 1) * rowConfig.gap;
        const rowHeight = rowContainers.reduce((maxHeight, container) => Math.max(maxHeight, container.height), 0);

        layoutRows.push({ rowContainers, rowWidth, rowHeight, gap: rowConfig.gap, xShift: rowConfig.xShift || 0 });
    });

    layoutBounds.width = layoutRows.reduce((maxWidth, row) => Math.max(maxWidth, row.rowWidth + (row.xShift * 18)), 0);

    let y = 0;
    layoutRows.forEach((row) => {
        const xStart = (layoutBounds.width - row.rowWidth) / 2 + (row.xShift || 0) * 18;
        let x = xStart;

        row.rowContainers.forEach((container) => {
            containerDimensions.push({
                ...container,
                x: x,
                y: y
            });

            x += container.width + row.gap;
        });

        layoutBounds.height = y + row.rowHeight;
        y += row.rowHeight + 14;
    });
}

function centerLayout() {
    if (layoutBounds.width === 0 || layoutBounds.height === 0) return;

    panX = (canvas.width - layoutBounds.width) / 2;
    panY = (canvas.height - layoutBounds.height) / 2;
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
    applyAutoZoomStep();

    ctx.fillStyle = floorColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    
    // Apply pan and zoom
    ctx.translate(panX, panY);
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
    if (!fishImage || fishData.length === 0) return;
    
    const isZoomedIn = zoom > ZOOM_THRESHOLD;
    
    containerDimensions.forEach((container) => {
        const x = container.x;
        const y = container.y;
        const width = container.width;
        const height = container.height;
        const week = container.week;
        
        if (isZoomedIn) {
            drawZoomedInWeek(x, y, width, height, week);
        } else {
            drawZoomedOutWeek(x, y, width, height, week);
        }
    });
}

function drawZoomedInWeek(x, y, width, height, week) {
    // Draw individual fish for each fish in the count
    const fishCount = week.approx_fish_count;
    const cols = Math.max(1, Math.ceil(Math.sqrt(fishCount)));
    
    for (let i = 0; i < fishCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const fishKey = getFishKey(week.week_number, i);
        
        const fishX = x + CONTAINER_PADDING + col * (fishFootprintWidth + FISH_GAP);
        const fishY = y + CONTAINER_PADDING + row * (fishFootprintHeight + FISH_GAP);
        
        ctx.globalAlpha = getFishAlpha(fishKey, 0.85);
        drawRotatedFish(fishImage, fishX, fishY, fishRenderWidth, fishRenderHeight, -Math.PI / 2);
        ctx.globalAlpha = 1;
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
}

function drawZoomedOutWeek(x, y, width, height, week) {
    const fishCount = week.approx_fish_count;
    const cols = Math.max(1, week.cols || Math.ceil(Math.sqrt(fishCount)));
    const intensity = fishCount / Math.max(...fishData.map(d => d.approx_fish_count));
    
    for (let i = 0; i < fishCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const fishKey = getFishKey(week.week_number, i);
        
        const pixelX = x + CONTAINER_PADDING + col * (pixelFootprintWidth + FISH_GAP);
        const pixelY = y + CONTAINER_PADDING + row * (pixelFootprintHeight + FISH_GAP);

        ctx.globalAlpha = getFishAlpha(fishKey, 0.9);
        drawRotatedFish(lowResFishImage, pixelX, pixelY, fishRenderWidth, fishRenderHeight, -Math.PI / 2);
        ctx.globalAlpha = 1;
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
}

function drawRotatedFish(img, x, y, width, height, angle) {
    // Save the current context state
    ctx.save();
    
    // Translate to the center of where the fish will be drawn
    ctx.translate(x + width / 2, y + height / 2);
    
    // Rotate by the angle (90 degrees = Math.PI / 2)
    ctx.rotate(angle);
    
    // Draw the image centered at origin
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    
    // Restore the context state
    ctx.restore();
}

function updateInfo() {
    const displayZoom = (zoom * 100).toFixed(0);
    const hoveredWeek = getWeekAtMouse();
    const weekInfo = hoveredWeek ? `Week ${hoveredWeek.week_number}: ${hoveredWeek.approx_fish_count} fish` : 'Hover over weeks for info';
    zoomInfo.textContent = `Zoom: ${displayZoom}% ${isAutoZoomPlaying ? '[playing]' : '[paused]'}`;
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
    zoom = 1;
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
    for (let c = 0; c < containerDimensions.length; c++) {
        const container = containerDimensions[c];
        const fishCount = container.week.approx_fish_count;
        const cols = Math.max(1, container.cols || Math.ceil(Math.sqrt(fishCount)));

        for (let i = 0; i < fishCount; i++) {
            const key = getFishKey(container.week.week_number, i);
            if (key !== targetKey) continue;

            const col = i % cols;
            const row = Math.floor(i / cols);
            const fishX = container.x + CONTAINER_PADDING + col * (fishFootprintWidth + FISH_GAP);
            const fishY = container.y + CONTAINER_PADDING + row * (fishFootprintHeight + FISH_GAP);

            return { fishX, fishY };
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

    for (let c = 0; c < containerDimensions.length; c++) {
        const container = containerDimensions[c];
        const fishCount = container.week.approx_fish_count;
        const cols = Math.max(1, container.cols || Math.ceil(Math.sqrt(fishCount)));

        for (let i = 0; i < fishCount; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const fishX = container.x + CONTAINER_PADDING + col * (fishFootprintWidth + FISH_GAP);
            const fishY = container.y + CONTAINER_PADDING + row * (fishFootprintHeight + FISH_GAP);
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
                return { key: getFishKey(container.week.week_number, i) };
            }
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

    if (autoZoomDirection === -1 && stopAtZoomEnabled) {
        const zoomStopTarget = stopPercentToZoom(stopAtZoomPercent);

        if (zoom <= zoomStopTarget + ZOOM_STOP_SNAP_THRESHOLD) {
            setZoomAroundScreenPoint(zoomStopTarget, canvas.width * 0.5, canvas.height * 0.5);
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

        setZoomAroundScreenPoint(targetZoom, canvas.width * 0.5, canvas.height * 0.5);
        return;
    }

    if (autoZoomDirection === 1) {
        targetZoom = Math.min(AUTO_ZOOM_MAX, zoom * (1 + inRate));
        if (targetZoom >= AUTO_ZOOM_MAX) autoZoomDirection = -1;
    } else {
        targetZoom = Math.max(AUTO_ZOOM_MIN, zoom * (1 - outRate));
        if (targetZoom <= AUTO_ZOOM_MIN) autoZoomDirection = 1;
    }

    const centerX = canvas.width * 0.5;
    const centerY = canvas.height * 0.5;
    setZoomAroundScreenPoint(targetZoom, centerX, centerY);
}

function getWeekAtMouse() {
    // Simple approach - return first week for now
    // In a more complete implementation, this would check actual mouse position
    return fishData[0] || null;
}

// Start the visualization
init().catch(console.error);
