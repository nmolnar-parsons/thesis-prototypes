// Fish Grid Visualization
const canvas = document.getElementById('fishCanvas');
const ctx = canvas.getContext('2d');
const zoomInfo = document.getElementById('zoomInfo');

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

// Configuration
const FISH_IMAGE_HEIGHT = 16; // Short side of the rendered fish before rotation
const PIXEL_SIZE = 2; // Base size of the pixel-art unit at low zoom
const CONTAINER_PADDING = 12;
const FISH_GAP = 2;
const PIXEL_GAP = 1;
const GRID_COLS = 13;
const ZOOM_SPEED = 0.04;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 10;
const ZOOM_THRESHOLD = 1.0; // Threshold for switching between zoom modes
const FISH_LAYOUT_ROWS = [
    { count: 0, gap: 0, xShift: 0 },
    { count: 0, gap: 24, xShift: 0 },
    { count: 4, gap: 18, xShift: 0 },
    { count: 6, gap: 14, xShift: 0 },
    { count: 8, gap: 12, xShift: 0 },
    { count: 9, gap: 10, xShift: 0 },
    { count: 8, gap: 10, xShift: 1 },
    { count: 5, gap: 12, xShift: 2 },
    { count: 5, gap: 12, xShift: 3 },
    { count: 5, gap: 12, xShift: 4 },
    { count: 3, gap: 12, xShift: 5 },
    { count: 2, gap: 12, xShift: 5 },
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
    
    // Start animation loop
    animate();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
    
    const zoomFactor = e.deltaY > 0 ? 1 - ZOOM_SPEED : 1 + ZOOM_SPEED;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * zoomFactor));
    
    // Zoom towards mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomRatio = newZoom / zoom;
    panX = mouseX - (mouseX - panX) * zoomRatio;
    panY = mouseY - (mouseY - panY) * zoomRatio;
    
    zoom = newZoom;
}

function handleDragStart(e) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
}

function handleDrag(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    panX += deltaX;
    panY += deltaY;
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
}

function handleDragEnd() {
    isDragging = false;
}

function animate() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    
    // Apply pan and zoom
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    
    // Draw grid
    drawFishGrid();
    
    ctx.restore();
    
    // Update info
    updateInfo();
    
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
        
        const fishX = x + CONTAINER_PADDING + col * (fishFootprintWidth + FISH_GAP);
        const fishY = y + CONTAINER_PADDING + row * (fishFootprintHeight + FISH_GAP);
        
        ctx.globalAlpha = 0.85;
        drawRotatedFish(fishImage, fishX, fishY, fishRenderWidth, fishRenderHeight, Math.PI / 2);
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
        
        const pixelX = x + CONTAINER_PADDING + col * (pixelFootprintWidth + FISH_GAP);
        const pixelY = y + CONTAINER_PADDING + row * (pixelFootprintHeight + FISH_GAP);

        ctx.globalAlpha = 0.9;
        drawRotatedFish(lowResFishImage, pixelX, pixelY, fishRenderWidth, fishRenderHeight, Math.PI / 2);
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
    zoomInfo.textContent = `Zoom: ${displayZoom}% | ${weekInfo}`;
}

function getWeekAtMouse() {
    // Simple approach - return first week for now
    // In a more complete implementation, this would check actual mouse position
    return fishData[0] || null;
}

// Start the visualization
init().catch(console.error);
