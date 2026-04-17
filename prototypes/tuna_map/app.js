//   Register to get your Mapbox access token https://docs.mapbox.com/help/glossary/access-token/
//   Code from https://docs.mapbox.com/help/tutorials/custom-markers-gl-js/ 

mapboxgl.accessToken = ''; // replace with your own access token

// State for controls
let currentYear = 2020;
let currentType = 'count';
let currentDataset = 'catch1deg';
let ocean_color = '#1b4974';

// Animation state
let isPlaying = false;
let rotateSpeed = 0; // degrees per second
let yearSpeed = 0; // years per second
let panSpeed = 0; // degrees per second (longitude)
let lastFrameTime = Date.now();
let currentRotation = 0;
let currentPan = 0; // longitude offset
let minYear = 1965;
let maxYear = 2023;

// UI element references
let playPauseBtn = null;
let resetBtn = null;
let rotateSpeedSlider = null;
let yearSpeedSlider = null;
let rotateSpeedValue = null;
let yearSpeedValue = null;
let pitchSlider = null;
let pitchValue = null;
let rotationSlider = null;
let rotationValue = null;
let panSpeedSlider = null;
let panSpeedValue = null;

// Dataset configuration
const datasets = {
  'catch1deg': 'data/tuna_data/cwp-grid-1deg-catch.geojson',
  'sea1deg': 'data/tuna_data/cwp-grid-1deg-sea.geojson',
  'grid1deg': 'data/tuna_data/cwp-grid-1deg.geojson',
  'catch5deg': 'data/tuna_data/cwp-grid-5deg-catch.geojson',
  'bluefin-only-5deg': 'data/tuna_data/cwp-grid-5deg-catch-bluefin.geojson',
};

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/outdoors-v12',
  center: [-40, 0],
  zoom: 0.25,
  renderWorldCopies: true
});

// Add geojson grid layer when map is loaded
map.on('load', function() {
  map.addSource('cwp-grid', {
    type: 'geojson',
    data: 'data/cwp-grid-5deg-var3.geojson'
  });


  // map.addLayer({
  //   id: 'cwp-grid-fill',
  //   type: 'fill',
  //   source: 'cwp-grid',
  //   paint: {
  //     'fill-color': '#0080ff',
  //     'fill-opacity': 0.4
  //   }
  // });

  // map.addLayer({
  //   id: 'cwp-grid-outline',
  //   type: 'line',
  //   source: 'cwp-grid',
  //   paint: { 'line-color': '#005bb5', 'line-width': 0.5 }
  // });

  map.setFog({
    'range': [1, 10],
    'color': 'rgba(186, 186, 163, 0)',      // Fully transparent lower atmosphere
    'high-color': 'rgba(0, 0, 0, 0)', // Fully transparent upper atmosphere
    'space-color': 'rgb(0, 0, 0)', // Make space background transparent
    'star-intensity': 0               // Remove stars
  });

  // Hide all text labels
  const layers = map.getStyle().layers;
  layers.forEach((layer) => {
    if (layer.type === 'symbol') {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  });

  // Add tuna catch data
  map.addSource('tuna-catch', {
    type: 'geojson',
    data: datasets[currentDataset]
  });

  map.addLayer({
    id: 'tuna-catch-fill',
    type: 'fill',
    source: 'tuna-catch',
    paint: {
      'fill-color': [
        'interpolate', ['linear'],
        ['coalesce', ['get', 'count_2020'], 0],
        0,    ocean_color,
        100,  '#FFD700',
        500,  '#FF8C00',
        1000, '#FF6347',
        5000, '#DC143C',
        10000,'#8B0000',
        50000,'#660000',
        100000,'#330000'
      ],
      'fill-opacity': 0.7
    }
  });

  // Setup slider control
  const yearSlider = document.getElementById('yearSlider');
  if (yearSlider) {
    yearSlider.addEventListener('input', function(e) {
      // Only update from slider if animation is not playing
      if (!isPlaying) {
        currentYear = parseInt(e.target.value);
        document.getElementById('yearValue').textContent = currentYear;
        updateMapLayer();
      }
    });
  }

  // Setup toggle buttons
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      toggleBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentType = this.dataset.type;
      updateMapLayer();
    });
  });

  // Setup dataset toggle buttons
  const datasetBtns = document.querySelectorAll('.dataset-btn');
  datasetBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      datasetBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentDataset = this.dataset.dataset;
      updateDataset();
    });
  });

  // map.addLayer({
  //   id: 'tuna-catch-outline',
  //   type: 'line',
  //   source: 'tuna-catch',
  //   paint: { 'line-color': '#8B0000', 'line-width': 0.1 }
  // });

  

  //adding continent fill layer on top to mask clipped boxes
  map.addLayer({
    'id': 'continent-fill',
    'type': 'fill',
    'source': {
        'type': 'vector',
        'url': 'mapbox://mapbox.country-boundaries-v1'
    },
    'source-layer': 'country_boundaries',
    'paint': {
        'fill-color': '#e9e9e9',
        'fill-opacity': 1
    }
  });

  // Setup projection selector
  const projectionSelect = document.getElementById('projectionSelect');
  if (projectionSelect) {
    projectionSelect.addEventListener('change', function(e) {
      const projectionMap = {
        'mercator': 'mercator',
        'equirectangular': 'equirectangular',
        'naturalEarth': 'naturalEarth',
        'winkelTripel': 'winkelTripel'
      };
      map.setProjection(projectionMap[e.target.value]);
    });
  }

  // Animation controls setup
  playPauseBtn = document.getElementById('playPauseBtn');
  resetBtn = document.getElementById('resetBtn');
  rotateSpeedSlider = document.getElementById('rotateSpeedSlider');
  yearSpeedSlider = document.getElementById('yearSpeedSlider');
  rotateSpeedValue = document.getElementById('rotateSpeedValue');
  yearSpeedValue = document.getElementById('yearSpeedValue');
  pitchSlider = document.getElementById('pitchSlider');
  pitchValue = document.getElementById('pitchValue');
  rotationSlider = document.getElementById('rotationSlider');
  rotationValue = document.getElementById('rotationValue');
  panSpeedSlider = document.getElementById('panSpeedSlider');
  panSpeedValue = document.getElementById('panSpeedValue');

  playPauseBtn.addEventListener('click', function() {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
    playPauseBtn.classList.toggle('playing');
    if (isPlaying) {
      lastFrameTime = Date.now();
      currentPan = map.getCenter().lng;
      animate();
    }
  });

  resetBtn.addEventListener('click', function() {
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    playPauseBtn.classList.remove('playing');
    currentYear = 1965;
    currentRotation = 0;
    currentPan = 0;
    document.getElementById('yearSlider').value = 1965;
    document.getElementById('yearValue').textContent = 1965;
    map.setPitch(0);
    map.setBearing(0);
    const center = map.getCenter();
    map.jumpTo({center: [0, center.lat], duration: 0});
    pitchSlider.value = 0;
    pitchValue.textContent = 0;
    rotationSlider.value = 0;
    rotationValue.textContent = 0;
    panSpeedSlider.value = 0;
    panSpeedValue.textContent = 0;
    updateMapLayer();
  });

  rotateSpeedSlider.addEventListener('input', function(e) {
    rotateSpeed = parseFloat(e.target.value);
    rotateSpeedValue.textContent = rotateSpeed.toFixed(1);
  });

  yearSpeedSlider.addEventListener('input', function(e) {
    yearSpeed = parseInt(e.target.value);
    yearSpeedValue.textContent = yearSpeed;
  });

  pitchSlider.addEventListener('input', function(e) {
    const pitch = parseFloat(e.target.value);
    pitchValue.textContent = pitch;
    map.setPitch(pitch);
  });

  rotationSlider.addEventListener('input', function(e) {
    const rotation = parseFloat(e.target.value);
    rotationValue.textContent = rotation;
    if (!isPlaying) {
      map.setBearing(rotation);
    }
  });

  panSpeedSlider.addEventListener('input', function(e) {
    panSpeed = parseFloat(e.target.value);
    panSpeedValue.textContent = panSpeed.toFixed(1);
  });

});

// Function to update the map layer based on current year and type
function updateMapLayer() {
  const roundedYear = Math.round(currentYear);
  const propertyName = currentType + '_' + roundedYear;
  
  map.setPaintProperty('tuna-catch-fill', 'fill-color', [
    'interpolate', ['linear'],
    ['coalesce', ['get', propertyName], 0],
    0,    ocean_color,
    100,  '#FFD700',
    500,  '#FF8C00',
    1000, '#FF6347',
    5000, '#DC143C',
    10000,'#8B0000',
    50000,'#660000',
    100000,'#330000'
  ]);
}

// Function to update dataset
function updateDataset() {
  const newDataUrl = datasets[currentDataset];
  map.getSource('tuna-catch').setData(newDataUrl);
}

// Animation loop
function animate() {
  if (!isPlaying) return;

  const now = Date.now();
  const deltaTime = (now - lastFrameTime) / 1000; // Convert to seconds
  lastFrameTime = now;

  // Update rotation - rotate the globe on its north-south axis
  currentRotation += rotateSpeed * deltaTime;
  // Apply rotation using bearing (N-S axis rotation)
  map.setBearing(currentRotation);
  // Update rotation slider to reflect current rotation
  const displayRotation = (currentRotation % 360);
  rotationSlider.value = displayRotation;
  rotationValue.textContent = Math.round(displayRotation);

  // Update pan - move camera across longitude
  currentPan -= panSpeed * deltaTime;
  // Wrap longitude to -180 to 180 range
  let panLongitude = currentPan % 360;
  if (panLongitude > 180) {
    panLongitude -= 360;
  }
  // Update map center with panning
  const currentCenter = map.getCenter();
  map.jumpTo({center: [panLongitude, currentCenter.lat], duration: 0});

  // Update year
  currentYear += yearSpeed * deltaTime;
  if (currentYear > maxYear) {
    currentYear = maxYear;
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    playPauseBtn.classList.remove('playing');
  } else if (currentYear < minYear) {
    currentYear = minYear;
  }

  // Update UI - set the rounded year
  const roundedYear = Math.round(currentYear);
  document.getElementById('yearSlider').value = roundedYear;
  document.getElementById('yearValue').textContent = roundedYear;
  updateMapLayer();

  requestAnimationFrame(animate);
}

