let scene, camera, renderer, countriesGroup, miningData = {}, mouse = { x: 0, y: 0 };
let currentYear = 2022;
let currentCommodity = 57;
let hoveredCountry = null;  // Track the currently hovered country
let nightBand;  // Nighttime band
let bandSpeed = 0.001;  // Slower speed for the night band movement

function init() {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 1, 1000);
  camera.position.z = 500;
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('mapCanvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xffffff);

  countriesGroup = new THREE.Group();
  scene.add(countriesGroup);

  loadGeoJSON('/assets/data/countries.geo.json');

  // Create the nighttime band
  createNightBand();

  // Start the automatic year-changing scraper
  autoScrape();

  document.addEventListener('mousemove', onMouseMove, false);

  function animate() {
    requestAnimationFrame(animate);
    moveNightBand();  // Move the night band across the screen
    renderer.render(scene, camera);
  }
  animate();
}

// Function to create the nighttime band
function createNightBand() {
  const bandWidth = window.innerWidth * 0.3; // Make it larger to move across entire screen
  const bandHeight = window.innerHeight * 2;  // Much thinner, 8% of screen height
  const bandGeometry = new THREE.PlaneGeometry(bandWidth, bandHeight);
  const bandMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3  // Semi-transparent to create a soft night effect
  });
  nightBand = new THREE.Mesh(bandGeometry, bandMaterial);

  // Start far off the left side of the screen
  nightBand.position.x = -window.innerWidth;
  nightBand.position.y = 0;  // Center vertically
  scene.add(nightBand);
}

// Function to move the night band during year change cycle
function moveNightBand() {
  // Move the band only if it has not yet reached the right end of the screen
  if (nightBand.position.x < window.innerWidth * 1.5) {
    nightBand.position.x += bandSpeed * window.innerWidth;  // Move the band horizontally at a slower speed
  } else {
    // Reset the band to start off the screen again
    nightBand.position.x = -window.innerWidth;
  }
}

// Automatically change the year and update data every 10 seconds
function autoScrape() {
  scrapeData();

  setInterval(() => {
    currentYear--;
    if (currentYear < 1970) currentYear = 2022;

    // Update the Year and Commodity at the top of the page
    document.getElementById('year-commodity').innerHTML = `Year: ${currentYear} | Commodity: ${currentCommodity}`;

    scrapeData();

    // If a country is hovered, update the info display automatically
    if (hoveredCountry) {
      updateCountryInfo(hoveredCountry);
    }

  }, 10000);  // Trigger the scrape and update every 10 seconds
}

// Scrape data dynamically based on current year and commodity
function scrapeData() {
  fetch(`http://127.0.0.1:5000/scrape?year=${currentYear}&commodity=${currentCommodity}`, {
    method: 'GET',
  })
  .then(response => response.json())
  .then(data => {
    miningData = data.data;  // Update mining data

    if (hoveredCountry) {
      updateCountryInfo(hoveredCountry);  // Auto-update the hovered country info
    }
  })
  .catch(error => console.error('Error scraping data:', error));
}

// Handle mouse movement and update hovered country
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const vector = new THREE.Vector3(mouse.x, mouse.y, 0);
  vector.unproject(camera);
  const mouseMapX = vector.x;
  const mouseMapY = vector.y;

  let countryFound = false;

  countriesGroup.children.forEach(mesh => {
    if (mesh instanceof THREE.Mesh) {
      const vertices = mesh.geometry.attributes.position.array;
      const points = [];
      for (let i = 0; i < vertices.length; i += 3) {
        points.push({ x: vertices[i], y: vertices[i + 1] });
      }

      if (isPointInPolygon({ x: mouseMapX, y: mouseMapY }, points)) {
        mesh.material.color.set(0xADD8E6);
        const countryData = mesh.userData.geoData;
        const countryName = countryData.SOVEREIGNT || "Unknown";

        hoveredCountry = countryName;

        updateCountryInfo(countryName);
        countryFound = true;
      } else {
        mesh.material.color.set(0x0000ff);
      }
    }
  });

  if (!countryFound) hoveredCountry = null;
}

// Update the info box with country mining data
function updateCountryInfo(countryName) {
  const production = miningData[countryName] || "0";
  let infoContent = `<strong>Country: ${countryName}</strong><br>`;
  infoContent += `Mining Production: ${production}<br>`;
  document.getElementById('info').innerHTML = infoContent;
}

// Simple point-in-polygon algorithm
function isPointInPolygon(mouse, points) {
  let inside = false;
  const x = mouse.x;
  const y = mouse.y;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Load GeoJSON data for the map
function loadGeoJSON(url) {
  fetch(url)
    .then(response => response.json())
    .then(data => drawCountries(data))
    .catch(error => console.error('Error loading GeoJSON:', error));
}

// Draw countries from GeoJSON
function drawCountries(geoData) {
  geoData.features.forEach(feature => {
    const geometryType = feature.geometry.type;
    const coordinates = feature.geometry.coordinates;
    const countryName = feature.properties.name;

    if (geometryType === 'Polygon') {
      drawPolygon(coordinates, countryName, feature.properties);
    } else if (geometryType === 'MultiPolygon') {
      coordinates.forEach(polygon => drawPolygon(polygon, countryName, feature.properties));
    }
  });
}

// Draw individual polygons with borders
function drawPolygon(polygon, countryName, properties) {
  const shape = new THREE.Shape();
  const borderPoints = [];
  polygon.forEach(ring => {
    ring.forEach((point, index) => {
      const [lon, lat] = point;
      const x = (lon + 180) / 360 * window.innerWidth - window.innerWidth / 2;
      const y = (lat + 90) / 180 * window.innerHeight - window.innerHeight / 2;
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
      borderPoints.push(new THREE.Vector3(x, y, 0));
    });
  });

  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1 });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.userData = { geoData: properties };
  countriesGroup.add(mesh);

  const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
  const borderMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
  const borderLine = new THREE.Line(borderGeometry, borderMaterial);
  countriesGroup.add(borderLine);
}

// Adjust the renderer size when the window is resized
window.addEventListener('resize', function() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.left = window.innerWidth / -2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = window.innerHeight / -2;
  camera.updateProjectionMatrix();
});

window.onload = init;

