let scene, camera, renderer, countriesGroup, miningData = {}, mouse = { x: 0, y: 0 };

function init() {
  // Create the scene
  scene = new THREE.Scene();

  // Set up the camera
  camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 1, 1000);
  camera.position.z = 500;

  // Create the renderer with antialiasing enabled
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('mapCanvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xffffff);  // Set background color to white

  // Initialize the countries group
  countriesGroup = new THREE.Group();
  scene.add(countriesGroup);  // Ensure countriesGroup is added to the scene early

  // Load the country borders (GeoJSON)
  loadGeoJSON('/assets/data/countries.geo.json');  // Use your countries.geo.json file

  // Add mouse move event listener
  document.addEventListener('mousemove', onMouseMove, false);

  // Add scrape button event listener
  document.getElementById('scrape-button').addEventListener('click', scrapeData);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

// Function to scrape data dynamically using Flask
function scrapeData() {
  fetch('http://127.0.0.1:5000/scrape', {
    method: 'GET',
  })
  .then(response => response.json())
  .then(data => {
    // Update miningData with the scraped data
    miningData = data.data;

    // Optionally, remove this line if you don't want to print the data:
    // console.log('Scraped Data:', data.data);

    // Optionally, remove this line to stop showing data in scrape-results div:
    // document.getElementById('scrape-results').innerHTML = JSON.stringify(miningData);
  })
  .catch(error => console.error('Error scraping data:', error));
}

function onMouseMove(event) {
  // Convert mouse position to normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Use the camera to convert to world coordinates (map coordinates)
  const vector = new THREE.Vector3(mouse.x, mouse.y, 0);
  vector.unproject(camera);  // Convert from NDC to world coordinates
  const mouseMapX = vector.x;
  const mouseMapY = vector.y;

  // Loop through each country to check if the mouse is inside the polygon
  countriesGroup.children.forEach(mesh => {
    if (mesh instanceof THREE.Mesh) {  // Only check meshes, not lines
      const vertices = mesh.geometry.attributes.position.array;
      const points = [];

      for (let i = 0; i < vertices.length; i += 3) {
        points.push({ x: vertices[i], y: vertices[i + 1] });  // Get (x, y) from the vertices
      }

      if (isPointInPolygon({ x: mouseMapX, y: mouseMapY }, points)) {
        // Highlight the country in light blue on hover
        mesh.material.color.set(0xADD8E6);

        // Get the GeoJSON properties
        const countryData = mesh.userData.geoData;

        // Get the country name from GeoJSON
        const countryName = countryData.SOVEREIGNT || "Unknown";
        console.log(`Country: ${countryName}`);

        // Fetch mining data from the updated miningData object (from the scrape)
        const production = miningData[countryName] || "0";

        // Display the essential information in the info box
        let infoContent = `<strong>Country: ${countryName}</strong><br>`;
        infoContent += `Mining Production: ${production}<br>`;

        document.getElementById('info').innerHTML = infoContent;
      } else {
        // Reset color to normal blue if not hovering
        mesh.material.color.set(0x0000ff);
      }
    }
  });
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

// Function to load GeoJSON data
function loadGeoJSON(url) {
  fetch(url)
    .then(response => response.json())
    .then(data => {
      drawCountries(data);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));
}

// Function to draw countries from GeoJSON
function drawCountries(geoData) {
  geoData.features.forEach(feature => {
    const geometryType = feature.geometry.type;
    const coordinates = feature.geometry.coordinates;
    const countryName = feature.properties.name;  // Extract country name from GeoJSON

    if (geometryType === 'Polygon') {
      drawPolygon(coordinates, countryName, feature.properties);  // Pass the full properties object
    } else if (geometryType === 'MultiPolygon') {
      coordinates.forEach(polygon => {
        drawPolygon(polygon, countryName, feature.properties);  // Pass the full properties object
      });
    }
  });
}

// Function to draw individual polygons with borders
function drawPolygon(polygon, countryName, properties) {
  const shape = new THREE.Shape();
  const borderPoints = [];

  polygon.forEach(ring => {
    ring.forEach((point, index) => {
      const [lon, lat] = point;
      const x = (lon + 180) / 360 * window.innerWidth - window.innerWidth / 2;
      const y = (lat + 90) / 180 * window.innerHeight - window.innerHeight / 2;

      if (index === 0) {
        shape.moveTo(x, y);  // Start at the first point
      } else {
        shape.lineTo(x, y);  // Draw lines to the rest of the points
      }

      borderPoints.push(new THREE.Vector3(x, y, 0));  // Store the points for borders
    });
  });

  // Create the filled shape
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1 });
  const mesh = new THREE.Mesh(geometry, material);

  // Attach the full geoData (properties) to userData
  mesh.userData = { geoData: properties };  // Store the full properties object from GeoJSON
  countriesGroup.add(mesh);

  // Create the country border (lines)
  const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
  const borderMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });  // Black borders
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

// Initialize everything when the page loads
window.onload = init;
