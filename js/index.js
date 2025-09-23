class NASAEONETMap {
            constructor() {
                this.map = null;
                this.eventsLayer = null;
                this.nasaLayers = new Map();
                this.categories = [];
                this.currentEvents = [];
                
                this.initMap();
                this.loadCategories();
                this.loadNASALayers();
                this.loadEvents();
                this.setupEventListeners();
            }
            
            initMap() {
                // Inicializar el mapa
                this.map = L.map('map').setView([20, 0], 2);
                
                // Capa base del mapa
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);
                
                // Grupo de capas para eventos
                this.eventsLayer = L.layerGroup().addTo(this.map);
            }
            
            async loadCategories() {
                try {
                    const response = await fetch('https://eonet.gsfc.nasa.gov/api/v3/categories');
                    const data = await response.json();
                    this.categories = data.categories;
                    this.populateCategoryFilter();
                } catch (error) {
                    console.error('Error cargando categorías:', error);
                }
            }
            
            populateCategoryFilter() {
                const select = document.getElementById('categoryFilter');
                this.categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.title;
                    select.appendChild(option);
                });
            }
            
            async loadNASALayers() {
                try {
                    const response = await fetch('https://eonet.gsfc.nasa.gov/api/v3/layers');
                    const data = await response.json();
                    this.populateLayerControls(data.layers.slice(0, 10)); // Limitamos a 10 capas
                } catch (error) {
                    console.error('Error cargando capas NASA:', error);
                }
            }
            
            populateLayerControls(layers) {
                const container = document.getElementById('layerControls');
                layers.forEach((layer, index) => {
                    if (layer.serviceTypeId && layer.serviceTypeId.includes('WMS')) {
                        const layerItem = document.createElement('div');
                        layerItem.className = 'layer-item';
                        layerItem.innerHTML = `
                            <input type="checkbox" id="layer_${index}" data-layer="${index}">
                            <label for="layer_${index}">${layer.name || 'Capa NASA'}</label>
                        `;
                        container.appendChild(layerItem);
                        
                        // Guardar información de la capa
                        this.nasaLayers.set(index, layer);
                    }
                });
            }
            
            async loadEvents() {
                this.showLoading(true);
                try {
                    const url = this.buildEventsURL();
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data.features) {
                        // Formato GeoJSON
                        this.currentEvents = data.features;
                    } else if (data.events) {
                        // Formato normal, convertir a GeoJSON
                        this.currentEvents = this.convertToGeoJSON(data.events);
                    }
                    
                    this.displayEvents();
                    this.updateStats();
                } catch (error) {
                    console.error('Error cargando eventos:', error);
                    alert('Error cargando eventos. Por favor, intenta de nuevo.');
                } finally {
                    this.showLoading(false);
                }
            }
            
            buildEventsURL() {
                const baseURL = 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson';
                const params = new URLSearchParams();
                
                const category = document.getElementById('categoryFilter').value;
                const status = document.getElementById('statusFilter').value;
                const days = document.getElementById('daysFilter').value;
                const limit = document.getElementById('limitFilter').value;
                
                if (category) params.append('category', category);
                if (status) params.append('status', status);
                if (days) params.append('days', days);
                if (limit) params.append('limit', limit);
                
                return `${baseURL}?${params.toString()}`;
            }
            
            convertToGeoJSON(events) {
                return events.map(event => ({
                    type: 'Feature',
                    properties: {
                        id: event.id,
                        title: event.title,
                        description: event.description || '',
                        closed: event.closed,
                        categories: event.categories,
                        sources: event.sources
                    },
                    geometry: event.geometry
                }));
            }
            
            displayEvents() {
                // Limpiar eventos anteriores
                this.eventsLayer.clearLayers();
                
                this.currentEvents.forEach(event => {
                    if (event.geometry) {
                        const marker = this.createEventMarker(event);
                        this.eventsLayer.addLayer(marker);
                    }
                });
            }
            
            createEventMarker(event) {
                const coords = event.geometry.coordinates;
                let latLng;
                
                if (event.geometry.type === 'Point') {
                    latLng = [coords[1], coords[0]]; // [lat, lng]
                } else if (event.geometry.type === 'Polygon') {
                    // Para polígonos, usar el centroide aproximado
                    const bounds = L.geoJSON(event.geometry).getBounds();
                    latLng = bounds.getCenter();
                }
                
                if (!latLng) return null;
                
                // Elegir icono y color según la categoría
                const category = event.properties.categories[0];
                const color = this.getCategoryColor(category.id);
                const isOpen = !event.properties.closed;
                
                const marker = L.circleMarker(latLng, {
                    color: '#ffffff',
                    fillColor: color,
                    fillOpacity: isOpen ? 0.8 : 0.5,
                    radius: isOpen ? 8 : 6,
                    weight: 2
                });
                
                // Popup con información del evento
                const popupContent = this.createPopupContent(event);
                marker.bindPopup(popupContent);
                
                return marker;
            }
            
            getCategoryColor(categoryId) {
                const colors = {
                    'drought': '#8B4513',
                    'dustHaze': '#DAA520',
                    'earthquakes': '#DC143C',
                    'floods': '#4169E1',
                    'landslides': '#8B4513',
                    'manmade': '#696969',
                    'seaLakeIce': '#87CEEB',
                    'severeStorms': '#9932CC',
                    'snow': '#F0F8FF',
                    'tempExtremes': '#FF4500',
                    'volcanoes': '#FF6347',
                    'waterColor': '#20B2AA',
                    'wildfires': '#FF4500'
                };
                return colors[categoryId] || '#00d4ff';
            }
            
            createPopupContent(event) {
                const props = event.properties;
                const isOpen = !props.closed;
                const category = props.categories[0];
                
                return `
                    <div class="popup-content">
                        <div class="popup-title">${props.title}</div>
                        <div class="popup-date">
                            Categoría: ${category.title}
                        </div>
                        <div class="popup-status ${isOpen ? 'status-open' : 'status-closed'}">
                            ${isOpen ? '🔴 ACTIVO' : '✅ FINALIZADO'}
                        </div>
                        ${props.description ? `<p>${props.description}</p>` : ''}
                        ${props.sources.length > 0 ? `
                            <p><strong>Fuentes:</strong><br>
                            ${props.sources.map(source => `<a href="${source.url}" target="_blank">${source.id}</a>`).join(', ')}
                            </p>
                        ` : ''}
                    </div>
                `;
            }
            
            updateStats() {
                document.getElementById('eventCount').textContent = this.currentEvents.length;
            }
            
            showLoading(show) {
                document.getElementById('loading').style.display = show ? 'block' : 'none';
                document.getElementById('applyFilters').disabled = show;
            }
            
            setupEventListeners() {
                document.getElementById('applyFilters').addEventListener('click', () => {
                    this.loadEvents();
                });
                
                document.getElementById('clearFilters').addEventListener('click', () => {
                    document.getElementById('categoryFilter').value = '';
                    document.getElementById('statusFilter').value = '';
                    document.getElementById('daysFilter').value = '';
                    document.getElementById('limitFilter').value = '50';
                    this.loadEvents();
                });
                
                // Eventos para capas NASA
                document.getElementById('layerControls').addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const layerIndex = parseInt(e.target.dataset.layer);
                        this.toggleNASALayer(layerIndex, e.target.checked);
                    }
                });
            }
            
            toggleNASALayer(layerIndex, show) {
                const layerInfo = this.nasaLayers.get(layerIndex);
                if (!layerInfo) return;
                
                if (show) {
                    try {
                        // Crear capa WMS de NASA
                        const wmsLayer = L.tileLayer.wms(layerInfo.serviceUrl, {
                            layers: layerInfo.name,
                            format: 'image/png',
                            transparent: true,
                            opacity: 0.7,
                            ...layerInfo.parameters
                        });
                        
                        wmsLayer.addTo(this.map);
                        this.nasaLayers.set(`active_${layerIndex}`, wmsLayer);
                    } catch (error) {
                        console.error('Error añadiendo capa NASA:', error);
                    }
                } else {
                    const activeLayer = this.nasaLayers.get(`active_${layerIndex}`);
                    if (activeLayer) {
                        this.map.removeLayer(activeLayer);
                        this.nasaLayers.delete(`active_${layerIndex}`);
                    }
                }
            }
        }
        
        // Inicializar la aplicación cuando se carga la página
        document.addEventListener('DOMContentLoaded', () => {
            new NASAEONETMap();
        });