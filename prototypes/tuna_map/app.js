//   Register to get your Mapbox access token https://docs.mapbox.com/help/glossary/access-token/
//   Code from https://docs.mapbox.com/help/tutorials/custom-markers-gl-js/ 

mapboxgl.accessToken = ''; // replace with your own access token

// State for controls
let currentYear = 2020;
let currentType = 'count';
let currentDataset = 'catch1deg';
let fishFarmsVisible = true;
let ocean_color = '#13265f';

function getYearPropertyExpression(type, year) {
  return ['coalesce', ['get', `${type}_${year}`], 0];
}

function getCountEquivalentExpression(type, year) {
  const countExpr = getYearPropertyExpression('count', year);
  const tonneExpr = getYearPropertyExpression('tonne', year);
  const tonneAsCountExpr = ['ceil', ['*', tonneExpr, 40]];

  if (type === 'tonne') {
    return tonneAsCountExpr;
  }

  if (type === 'both') {
    return ['+', countExpr, tonneAsCountExpr];
  }

  return countExpr;
}

function getColorRampExpression(valueExpr) {
  const breakpoints = [0, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];
  const colorScale = [
    ocean_color,
    '#0b3c78',
    '#0f558f',
    '#1270a5',
    '#1f88bb',
    '#3ea2cf',
    '#67b9de',
    '#8dcdea',
    '#b7def4',
    '#deeffa',
    '#ffffff'
  ];

  const stepped = ['step', valueExpr, colorScale[0]];

  for (let i = 1; i < breakpoints.length; i++) {
    stepped.push(breakpoints[i]);
    stepped.push(colorScale[i]);
  }

  return stepped;
}

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
let isZoomOutAnimating = false;
let zoomOutSpeed = 0.1; // zoom levels per second
let zoomOutTarget = 0.25;
let zoomOutLastFrameTime = Date.now();
const datasetCache = {};

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
let zoomSlider = null;
let zoomValue = null;
let zoomOutPlayPauseBtn = null;
let zoomOutSpeedSlider = null;
let zoomOutSpeedValue = null;
let zoomOutTargetSlider = null;
let zoomOutTargetValue = null;

// Dataset configuration
const datasets = {
  'catch1deg': 'data/tuna_data/cwp-grid-1deg-catch.geojson',
  'bluefin1deg': 'data/tuna_data/bluefin-cwp-grid-1deg-catch.geojson',
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
    // 'high-color': 'rgba(0, 0, 0, 0)', // Fully transparent upper atmosphere
    // 'space-color': 'rgb(0, 0, 0)', // Make space background transparent
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
      'fill-color': getColorRampExpression(getCountEquivalentExpression('count', 2020)),
      'fill-opacity': 0.88,
      'fill-antialias': false
    }
  });

  // Setup slider control
  const yearSlider = document.getElementById('yearSlider');
  if (yearSlider) {
    yearSlider.addEventListener('input', function(e) {
      // Only update from slider if animation is not playing
      if (!isPlaying) {
        currentYear = parseInt(e.target.value);
        setYearDisplay(currentYear);
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
        'fill-color': '#13265f',
        'fill-opacity': 1
    }
  });

  map.addSource('fish-farms', {
    type: 'geojson',
    data: 'data/iccat_fish_farms_centroids.geojson'
  });

  map.addLayer({
    id: 'fish-farms',
    type: 'circle',
    source: 'fish-farms',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        4,
        2,
        5,
        4,
        7,
        6,
        10,
        9,
        16
      ],
      'circle-color': '#22c55e',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#14532d'
    }
  });

  function escapeFarmDetailText(value) {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fishFarmTooltipHtml(props, lng, lat, includeCapacity) {
    const lonStr = lng.toFixed(5);
    const latStr = lat.toFixed(5);
    const capLine =
      includeCapacity &&
      props.capacity_t != null &&
      props.capacity_t !== '' &&
      !Number.isNaN(Number(props.capacity_t))
        ? '<div style="margin-top:6px">Capacity (t): ' +
          escapeFarmDetailText(props.capacity_t) +
          '</div>'
        : '';
    return (
      '<div style="font-size:12px;line-height:1.45;text-align:left">' +
      '<div><strong>' +
      escapeFarmDetailText(props.name || 'Farm') +
      '</strong></div>' +
      '<div>ICCAT: ' +
      escapeFarmDetailText(props.iccat_serial) +
      '</div>' +
      '<div>Country: ' +
      escapeFarmDetailText(props.country) +
      '</div>' +
      '<div>Reg.: ' +
      escapeFarmDetailText(props.reg_number) +
      '</div>' +
      '<div>Lat/Lon: ' +
      latStr +
      ', ' +
      lonStr +
      '</div>' +
      capLine +
      '</div>'
    );
  }

  const fishFarmHoverPopup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: '300px',
    className: 'fish-farm-hover-popup'
  });

  map.on('mousemove', 'fish-farms', function(e) {
    if (!fishFarmsVisible) return;
    const feature = e.features[0];
    if (!feature) return;
    const coords = feature.geometry.coordinates;
    const lng = coords[0];
    const lat = coords[1];
    const props = feature.properties || {};
    fishFarmHoverPopup
      .setLngLat(coords)
      .setHTML(fishFarmTooltipHtml(props, lng, lat, false))
      .addTo(map);
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'fish-farms', function() {
    fishFarmHoverPopup.remove();
    map.getCanvas().style.cursor = '';
  });

  map.on('click', 'fish-farms', function(e) {
    if (!fishFarmsVisible) return;
    const feature = e.features[0];
    if (!feature) return;
    const props = feature.properties || {};
    const coords = feature.geometry.coordinates;
    const lng = coords[0];
    const lat = coords[1];
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(fishFarmTooltipHtml(props, lng, lat, true))
      .addTo(map);
  });

  const toggleFishFarmsBtn = document.getElementById('toggleFishFarmsBtn');
  if (toggleFishFarmsBtn) {
    toggleFishFarmsBtn.addEventListener('click', function() {
      fishFarmsVisible = !fishFarmsVisible;
      map.setLayoutProperty(
        'fish-farms',
        'visibility',
        fishFarmsVisible ? 'visible' : 'none'
      );
      if (!fishFarmsVisible) {
        fishFarmHoverPopup.remove();
        map.getCanvas().style.cursor = '';
      }
      toggleFishFarmsBtn.classList.toggle('active', fishFarmsVisible);
      toggleFishFarmsBtn.setAttribute('aria-pressed', String(fishFarmsVisible));
      toggleFishFarmsBtn.textContent = fishFarmsVisible ? 'ICCAT farms on' : 'ICCAT farms off';
    });
  }

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
  zoomSlider = document.getElementById('zoomSlider');
  zoomValue = document.getElementById('zoomValue');
  zoomOutPlayPauseBtn = document.getElementById('zoomOutPlayPauseBtn');
  zoomOutSpeedSlider = document.getElementById('zoomOutSpeedSlider');
  zoomOutSpeedValue = document.getElementById('zoomOutSpeedValue');
  zoomOutTargetSlider = document.getElementById('zoomOutTargetSlider');
  zoomOutTargetValue = document.getElementById('zoomOutTargetValue');

  if (zoomSlider && zoomValue) {
    zoomSlider.addEventListener('input', function(e) {
      const zoom = parseFloat(e.target.value);
      map.setZoom(zoom);
    });

    map.on('zoom', function() {
      const zoom = map.getZoom();
      zoomSlider.value = zoom.toFixed(2);
      zoomValue.textContent = zoom.toFixed(2);

      if (isZoomOutAnimating && zoom <= zoomOutTarget) {
        map.setZoom(zoomOutTarget);
        stopZoomOutAnimation();
      }
    });
  }

  if (zoomOutSpeedSlider && zoomOutSpeedValue) {
    zoomOutSpeedSlider.addEventListener('input', function(e) {
      zoomOutSpeed = parseFloat(e.target.value);
      zoomOutSpeedValue.textContent = zoomOutSpeed.toFixed(2);
    });
  }

  if (zoomOutTargetSlider && zoomOutTargetValue) {
    zoomOutTargetSlider.addEventListener('input', function(e) {
      zoomOutTarget = parseFloat(e.target.value);
      zoomOutTargetValue.textContent = zoomOutTarget.toFixed(2);
    });
  }

  if (zoomOutPlayPauseBtn) {
    zoomOutPlayPauseBtn.addEventListener('click', function() {
      if (isZoomOutAnimating) {
        stopZoomOutAnimation();
        return;
      }

      if (zoomOutSpeed <= 0) {
        return;
      }

      if (map.getZoom() <= zoomOutTarget) {
        map.setZoom(zoomOutTarget);
        return;
      }

      isZoomOutAnimating = true;
      zoomOutPlayPauseBtn.textContent = 'Stop Zoom Out';
      zoomOutPlayPauseBtn.classList.add('playing');
      zoomOutLastFrameTime = Date.now();
      animateZoomOut();
    });
  }

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
    stopZoomOutAnimation();
    playPauseBtn.textContent = 'Play';
    playPauseBtn.classList.remove('playing');
    currentYear = 1965;
    currentRotation = 0;
    currentPan = 0;
    document.getElementById('yearSlider').value = 1965;
    setYearDisplay(1965);
    map.setPitch(0);
    map.setBearing(0);
    map.setZoom(0.25);
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
    yearSpeed = parseFloat(e.target.value);
    yearSpeedValue.textContent = yearSpeed.toFixed(1);
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

function setYearDisplay(year) {
  const roundedYear = Math.round(year);
  document.getElementById('yearValue').textContent = roundedYear;
  document.getElementById('yearTickerValue').textContent = roundedYear;
}

function stopZoomOutAnimation() {
  isZoomOutAnimating = false;
  if (zoomOutPlayPauseBtn) {
    zoomOutPlayPauseBtn.textContent = 'Start Zoom Out';
    zoomOutPlayPauseBtn.classList.remove('playing');
  }
}

function getCachedDataset(datasetKey) {
  if (datasetCache[datasetKey]) {
    return Promise.resolve(datasetCache[datasetKey]);
  }

  return fetch(datasets[datasetKey])
    .then(response => response.json())
    .then(data => {
      datasetCache[datasetKey] = data;
      return data;
    });
}

function logBluefinCombinedCount(year) {
  const roundedYear = Math.round(year);
  const countKey = `count_${roundedYear}`;
  const tonneKey = `tonne_${roundedYear}`;

  getCachedDataset(currentDataset)
    .then(data => {
      const total = (data.features || []).reduce((sum, feature) => {
        const properties = feature.properties || {};
        const countValue = Number(properties[countKey]) || 0;
        const tonneValue = Number(properties[tonneKey]) || 0;

        return sum + countValue + Math.ceil(tonneValue * 40);
      }, 0);

      console.log(`Bluefin combined count for ${roundedYear}: ${total}`);
    })
    .catch(error => {
      console.warn(`Unable to log bluefin combined count for ${roundedYear}:`, error);
    });
}

// Function to update the map layer based on current year and type
function updateMapLayer() {
  const roundedYear = Math.round(currentYear);
  const valueExpr = getCountEquivalentExpression(currentType, roundedYear);
  map.setPaintProperty('tuna-catch-fill', 'fill-color', getColorRampExpression(valueExpr));
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
  setYearDisplay(roundedYear);
  updateMapLayer();

  requestAnimationFrame(animate);
}

function animateZoomOut() {
  if (!isZoomOutAnimating) return;

  const now = Date.now();
  const deltaTime = (now - zoomOutLastFrameTime) / 1000;
  zoomOutLastFrameTime = now;

  const currentZoom = map.getZoom();
  const remainingZoom = Math.max(0, currentZoom - zoomOutTarget);
  const easeWindow = 1.5;
  const easeRatio = Math.min(1, remainingZoom / easeWindow);
  const speedScale = Math.max(0.12, easeRatio * easeRatio);
  const effectiveZoomOutSpeed = zoomOutSpeed * speedScale;
  const nextZoom = currentZoom - (effectiveZoomOutSpeed * deltaTime);

  if (nextZoom <= zoomOutTarget) {
    const center = map.getCenter();
    map.jumpTo({
      center: [center.lng, center.lat],
      zoom: zoomOutTarget,
      bearing: map.getBearing(),
      pitch: map.getPitch()
    });
    stopZoomOutAnimation();
    return;
  }

  const center = map.getCenter();
  map.jumpTo({
    center: [center.lng, center.lat],
    zoom: nextZoom,
    bearing: map.getBearing(),
    pitch: map.getPitch()
  });
  requestAnimationFrame(animateZoomOut);
}

