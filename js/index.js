class NASAEONETMap {
    constructor() {
        this.map = null;
        this.eventsLayer = null;
        this.nasaLayers = new Map();
        this.categories = [];
        this.currentEvents = [];
        this.isLoading = false;

        this.init();
    }

    async init() {
        try {
            this.initMap();
            this.setupEventListeners();

            // Cargar datos iniciales
            await Promise.all([
                this.loadCategories(),
                this.loadNASALayers(),
                this.loadEvents()
            ]);

            this.hideError();
        } catch (error) {
            console.error('Error inicializando la aplicación:', error);
            this.showError('Error inicializando la aplicación. Por favor, recarga la página.');
        }
    }

    initMap() {
        // Inicializar el mapa con una vista global
        this.map = L.map('map', {
            zoomControl: true,
            attributionControl: true
        }).setView([20, 0], 2);

        // Agregar capa base del mapa
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors | NASA EONET Data',
            maxZoom: 18,
            minZoom: 2
        }).addTo(this.map);

        // Crear grupo de capas para eventos
        this.eventsLayer = L.layerGroup().addTo(this.map);

        console.log('Mapa inicializado correctamente');
    }

    async loadCategories() {
        try {
            console.log('Cargando categorías...');
            const response = await fetch('https://eonet.gsfc.nasa.gov/api/v3/categories');

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            this.categories = data.categories || [];
            this.populateCategoryFilter();

            console.log(`Cargadas ${this.categories.length} categorías`);
        } catch (error) {
            console.error('Error cargando categorías:', error);
            this.showError('No se pudieron cargar las categorías de eventos');
        }
    }

    populateCategoryFilter() {
        const select = document.getElementById('categoryFilter');
        if (!select) return;

        // Limpiar opciones existentes (excepto la primera)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.title;
            select.appendChild(option);
        });
    }

    async loadNASALayers() {
        try {
            console.log('Cargando capas NASA...');
            const response = await fetch('https://eonet.gsfc.nasa.gov/api/v3/layers');

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            const layers = (data.layers || []).slice(0, 10); // Limitar a 10 capas
            this.populateLayerControls(layers);

            console.log(`Cargadas ${layers.length} capas NASA`);
        } catch (error) {
            console.error('Error cargando capas NASA:', error);
            this.updateLayerControlsError();
        }
    }

    populateLayerControls(layers) {
        const container = document.getElementById('layerControls');
        if (!container) return;

        container.innerHTML = '';

        if (layers.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #a0a0a0;">No hay capas disponibles</div>';
            return;
        }

        layers.forEach((layer, index) => {
            if (layer.serviceTypeId && layer.serviceTypeId.includes('WMS')) {
                const layerItem = document.createElement('div');
                layerItem.className = 'layer-item';
                layerItem.innerHTML = `
                    <input type="checkbox" id="layer_${index}" data-layer="${index}">
                    <label for="layer_${index}">${layer.name || `Capa ${index + 1}`}</label>
                `;
                container.appendChild(layerItem);
                this.nasaLayers.set(index, layer);
            }
        });
    }

    updateLayerControlsError() {
        const container = document.getElementById('layerControls');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #ff6b6b;">Error cargando capas</div>';
        }
    }

    async loadEvents() {
        if (this.isLoading) return;

        this.showLoading(true);
        this.isLoading = true;

        try {
            const url = this.buildEventsURL();
            console.log('Cargando eventos desde:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Respuesta de la API:', data);

            // Procesar eventos según el formato de respuesta
            if (data.features && Array.isArray(data.features)) {
                // Formato GeoJSON
                this.currentEvents = data.features;
            } else if (data.events && Array.isArray(data.events)) {
                // Formato estándar, convertir a GeoJSON
                this.currentEvents = this.convertToGeoJSON(data.events);
            } else {
                console.warn('No se encontraron eventos en la respuesta:', data);
                this.currentEvents = [];
            }

            this.displayEvents();
            this.updateStats();
            this.hideError();

            console.log(`Cargados ${this.currentEvents.length} eventos`);

        } catch (error) {
            console.error('Error cargando eventos:', error);
            this.showError(`Error cargando eventos: ${error.message}`);
            this.currentEvents = [];
            this.updateStats();
        } finally {
            this.showLoading(false);
            this.isLoading = false;
        }
    }

    buildEventsURL() {
        const baseURL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
        const params = new URLSearchParams();

        const categoryEl = document.getElementById('categoryFilter');
        const statusEl = document.getElementById('statusFilter');
        const daysEl = document.getElementById('daysFilter');
        const limitEl = document.getElementById('limitFilter');

        if (categoryEl?.value) params.append('category', categoryEl.value);
        if (statusEl?.value) params.append('status', statusEl.value);
        if (daysEl?.value) params.append('days', daysEl.value);

        // Aplicar límite por defecto si no se especifica uno
        const limit = limitEl?.value || '50';
        if (limit) params.append('limit', limit);

        return `${baseURL}/geojson?${params.toString()}`;
    }

    convertToGeoJSON(events) {
        return events.filter(event => event.geometry).map(event => ({
            type: 'Feature',
            properties: {
                id: event.id,
                title: event.title,
                description: event.description || '',
                closed: event.closed,
                categories: event.categories || [],
                sources: event.sources || []
            },
            geometry: event.geometry
        }));
    }

    displayEvents() {
        // Limpiar eventos anteriores
        this.eventsLayer.clearLayers();

        if (this.currentEvents.length === 0) {
            console.log('No hay eventos para mostrar');
            return;
        }

        let markersCreated = 0;
        this.currentEvents.forEach((event, index) => {
            try {
                const marker = this.createEventMarker(event);
                if (marker) {
                    this.eventsLayer.addLayer(marker);
                    markersCreated++;
                }
            } catch (error) {
                console.error(`Error creando marcador para evento ${index}:`, error);
            }
        });

        console.log(`Creados ${markersCreated} marcadores de ${this.currentEvents.length} eventos`);

        // Ajustar vista del mapa si hay eventos
        if (markersCreated > 0) {
            try {
                const bounds = this.eventsLayer.getBounds();
                if (bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [20, 20] });
                }
            } catch (error) {
                console.error('Error ajustando vista del mapa:', error);
            }
        }
    }

    createEventMarker(event) {
        const coords = event.geometry?.coordinates;
        if (!coords || !Array.isArray(coords)) {
            console.warn('Coordenadas inválidas para evento:', event.properties?.id);
            return null;
        }

        let latLng;

        try {
            if (event.geometry.type === 'Point') {
                latLng = [coords[1], coords[0]]; // [lat, lng]
            } else {
                // Para geometrías complejas, usar el centro del bbox
                const geoJsonLayer = L.geoJSON(event.geometry);
                const bounds = geoJsonLayer.getBounds();
                latLng = bounds.getCenter();
            }
        } catch (error) {
            console.error('Error procesando geometría:', error);
            return null;
        }

        // Validar coordenadas
        if (!Array.isArray(latLng) || latLng.length !== 2 ||
            Math.abs(latLng[0]) > 90 || Math.abs(latLng[1]) > 180) {
            console.warn('Coordenadas fuera de rango:', latLng);
            return null;
        }

        // Obtener categoría y propiedades
        const category = event.properties.categories?.[0];
        const categoryId = category?.id;
        const color = this.getCategoryColor(categoryId);
        const isOpen = !event.properties.closed;

        // Crear marcador con icono personalizado
        const icon = this.createCustomIcon(categoryId, color, isOpen);
        
        const marker = L.marker(latLng, {
            icon: icon
        });

        // Agregar popup con información del evento
        const popupContent = this.createPopupContent(event);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'custom-popup'
        });

        return marker;
    }

    createCustomIcon(categoryId, color, isOpen) {
        const iconClass = this.getCategoryIcon(categoryId);
        
        return L.divIcon({
            html: `
                <div style="
                    background-color: ${color};
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 3px solid white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    opacity: ${isOpen ? '1' : '0.7'};
                ">
                    <i class="${iconClass}" style="color: white; font-size: 14px;"></i>
                </div>
            `,
            className: 'custom-marker-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    getCategoryIcon(categoryId) {
        const icons = {
            'drought': 'bi bi-sun',
            'dustHaze': 'bi bi-cloud-haze',
            'earthquakes': 'bi bi-geo-alt',
            'floods': 'bi bi-droplet',
            'landslides': 'bi bi-mountain',
            'manmade': 'bi bi-gear',
            'seaLakeIce': 'bi bi-snow',
            'severeStorms': 'bi bi-cloud-lightning-rain',
            'snow': 'bi bi-snow2',
            'tempExtremes': 'bi bi-thermometer-sun',
            'volcanoes': 'bi bi-volcano',
            'waterColor': 'bi bi-water',
            'wildfires': 'bi bi-fire'
        };
        return icons[categoryId] || 'bi bi-geo';
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
        const category = props.categories?.[0];
        const categoryId = category?.id;
        const iconClass = this.getCategoryIcon(categoryId);

        return `
            <div class="popup-content">
                <div class="popup-title">
                    <i class="${iconClass}" style="margin-right: 5px;"></i>
                    ${props.title || 'Evento sin título'}
                </div>
                ${category ? `<div class="popup-category">${category.title}</div>` : ''}
                <div class="popup-status ${isOpen ? 'status-open' : 'status-closed'}">
                    ${isOpen ? '🔴 ACTIVO' : '✅ FINALIZADO'}
                </div>
                ${props.description ? `<p>${props.description}</p>` : ''}
                ${props.sources?.length > 0 ? `
                    <p><strong>Fuentes:</strong><br>
                    ${props.sources.map(source =>
                        `<a href="${source.url}" target="_blank" rel="noopener">${source.id}</a>`
                    ).join(', ')}
                    </p>
                ` : ''}
            </div>
        `;
    }

    updateStats() {
        const eventCountEl = document.getElementById('eventCount');
        if (eventCountEl) {
            eventCountEl.textContent = this.currentEvents.length;
        }
    }

    showLoading(show) {
        const loadingEl = document.getElementById('loading');
        const buttonEl = document.getElementById('applyFilters');

        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
        if (buttonEl) {
            buttonEl.disabled = show;
        }
    }

    showError(message) {
        const errorEl = document.getElementById('errorMessage');
        if (errorEl) {
            errorEl.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
            errorEl.style.display = 'block';
        }
    }

    hideError() {
        const errorEl = document.getElementById('errorMessage');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    setupEventListeners() {
        const applyBtn = document.getElementById('applyFilters');
        const clearBtn = document.getElementById('clearFilters');
        const layerControls = document.getElementById('layerControls');

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.loadEvents();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Eventos para capas NASA
        if (layerControls) {
            layerControls.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const layerIndex = parseInt(e.target.dataset.layer);
                    this.toggleNASALayer(layerIndex, e.target.checked);
                }
            });
        }

        // Permitir aplicar filtros con Enter en los selects
        ['categoryFilter', 'statusFilter', 'daysFilter', 'limitFilter'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.loadEvents();
                    }
                });
            }
        });
    }

    clearFilters() {
        const filters = [
            { id: 'categoryFilter', value: '' },
            { id: 'statusFilter', value: '' },
            { id: 'daysFilter', value: '' },
            { id: 'limitFilter', value: '50' }
        ];

        filters.forEach(filter => {
            const element = document.getElementById(filter.id);
            if (element) {
                element.value = filter.value;
            }
        });

        // Recargar eventos con filtros limpios
        this.loadEvents();
    }

    toggleNASALayer(layerIndex, show) {
        const layerInfo = this.nasaLayers.get(layerIndex);
        if (!layerInfo) {
            console.warn('Información de capa no encontrada para índice:', layerIndex);
            return;
        }

        if (show) {
            try {
                // Crear capa WMS de NASA
                const wmsLayer = L.tileLayer.wms(layerInfo.serviceUrl, {
                    layers: layerInfo.name,
                    format: 'image/png',
                    transparent: true,
                    opacity: 0.7,
                    attribution: 'NASA',
                    ...layerInfo.parameters
                });

                wmsLayer.addTo(this.map);
                this.nasaLayers.set(`active_${layerIndex}`, wmsLayer);

                console.log('Capa NASA agregada:', layerInfo.name);
            } catch (error) {
                console.error('Error agregando capa NASA:', error);
                this.showError('Error agregando capa del mapa');
            }
        } else {
            const activeLayer = this.nasaLayers.get(`active_${layerIndex}`);
            if (activeLayer) {
                this.map.removeLayer(activeLayer);
                this.nasaLayers.delete(`active_${layerIndex}`);
                console.log('Capa NASA removida:', layerInfo.name);
            }
        }
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Verificar que Leaflet esté disponible
    if (typeof L === 'undefined') {
        console.error('Leaflet no está disponible');
        alert('Error: La librería de mapas no está disponible. Por favor, recarga la página.');
        return;
    }

    // Verificar que el elemento del mapa existe
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Elemento #map no encontrado');
        alert('Error: El contenedor del mapa no se encontró en la página.');
        return;
    }

    try {
        // Inicializar la aplicación
        window.nasaEONETApp = new NASAEONETMap();
        console.log('Aplicación NASA EONET inicializada correctamente');
    } catch (error) {
        console.error('Error fatal inicializando la aplicación:', error);
        alert('Error inicializando la aplicación. Verifica la consola para más detalles.');
    }
});

// Manejo de errores globales
window.addEventListener('error', (event) => {
    console.error('Error global capturado:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Promise rechazada no manejada:', event.reason);
});