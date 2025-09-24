// Clase principal para gestionar el mapa de eventos naturales de la NASA
class MapaEventosNASA {
    constructor() {
        this.mapa = null;
        this.capaEventos = null;
        this.capasNASA = new Map();
        this.categorias = [];
        this.eventosActuales = [];
        this.cargando = false;

        this.inicializar();
    }

    // Método de inicialización principal
    async inicializar() {
        try {
            this.inicializarMapa();
            this.configurarEventos();

            // Cargar datos iniciales de forma paralela
            await Promise.all([
                this.cargarCategorias(),
                this.cargarCapasNASA(),
                this.cargarEventos()
            ]);

            this.ocultarError();
        } catch (error) {
            console.error('Error inicializando la aplicación:', error);
            this.mostrarError('Error inicializando la aplicación. Por favor, recarga la página.');
        }
    }

    // Inicializar el mapa de Leaflet
    inicializarMapa() {
        this.mapa = L.map('mapa', {
            zoomControl: true,
            attributionControl: true
        }).setView([20, 0], 2);

        // Capa base de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors | NASA EONET Data',
            maxZoom: 18,
            minZoom: 2
        }).addTo(this.mapa);

        // Capa para agrupar los eventos
        this.capaEventos = L.layerGroup().addTo(this.mapa);
        console.log('Mapa inicializado correctamente');
    }

    // Cargar las categorías de eventos desde la API de la NASA
    async cargarCategorias() {
        try {
            console.log('Cargando categorías...');
            const respuesta = await fetch('https://eonet.gsfc.nasa.gov/api/v3/categories');

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const datos = await respuesta.json();
            this.categorias = datos.categories || [];
            this.llenarFiltroCategorias();

            console.log(`Cargadas ${this.categorias.length} categorías`);
        } catch (error) {
            console.error('Error cargando categorías:', error);
            this.mostrarError('No se pudieron cargar las categorías de eventos');
        }
    }

    // Llenar el selector de categorías con las opciones disponibles
    llenarFiltroCategorias() {
        const selector = document.getElementById('filtroCategoria');
        if (!selector) return;

        // Limpiar opciones existentes (excepto la primera)
        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }

        // Agregar cada categoría como opción
        this.categorias.forEach(categoria => {
            const opcion = document.createElement('option');
            opcion.value = categoria.id;
            opcion.textContent = categoria.title;
            selector.appendChild(opcion);
        });
    }

    // Cargar las capas adicionales de la NASA
    async cargarCapasNASA() {
        try {
            console.log('Cargando capas NASA...');
            const respuesta = await fetch('https://eonet.gsfc.nasa.gov/api/v3/layers');

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const datos = await respuesta.json();
            const capas = (datos.layers || []).slice(0, 10); // Limitar a 10 capas
            this.llenarControlesCapas(capas);

            console.log(`Cargadas ${capas.length} capas NASA`);
        } catch (error) {
            console.error('Error cargando capas NASA:', error);
            this.actualizarControlesCapasError();
        }
    }

    // Crear controles de interfaz para las capas de la NASA
    llenarControlesCapas(capas) {
        const contenedor = document.getElementById('controlesCapas');
        if (!contenedor) return;

        contenedor.innerHTML = '';

        if (capas.length === 0) {
            contenedor.innerHTML = '<div style="text-align: center; color: #a0a0a0;">No hay capas disponibles</div>';
            return;
        }

        // Crear un control para cada capa disponible
        capas.forEach((capa, indice) => {
            if (capa.serviceTypeId && capa.serviceTypeId.includes('WMS')) {
                const elementoCapa = document.createElement('div');
                elementoCapa.className = 'elemento-capa';
                elementoCapa.innerHTML = `
                        <input type="checkbox" id="capa_${indice}" data-capa="${indice}">
                        <label for="capa_${indice}">${capa.name || `Capa ${indice + 1}`}</label>
                    `;
                contenedor.appendChild(elementoCapa);
                this.capasNASA.set(indice, capa);
            }
        });
    }

    // Mostrar mensaje de error en los controles de capas
    actualizarControlesCapasError() {
        const contenedor = document.getElementById('controlesCapas');
        if (contenedor) {
            contenedor.innerHTML = '<div style="text-align: center; color: #ff6b6b;">Error cargando capas</div>';
        }
    }

    // Cargar eventos desde la API de la NASA según los filtros aplicados
    async cargarEventos() {
        if (this.cargando) return;

        this.mostrarCarga(true);
        this.cargando = true;

        try {
            const url = this.construirURLEventos();
            console.log('Cargando eventos desde:', url);

            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status} - ${respuesta.statusText}`);
            }

            const datos = await respuesta.json();
            console.log('Respuesta de la API:', datos);

            // Procesar los eventos según el formato de respuesta
            if (datos.features && Array.isArray(datos.features)) {
                this.eventosActuales = datos.features;
            } else if (datos.events && Array.isArray(datos.events)) {
                this.eventosActuales = this.convertirAGeoJSON(datos.events);
            } else {
                console.warn('No se encontraron eventos en la respuesta:', datos);
                this.eventosActuales = [];
            }

            this.mostrarEventos();
            this.actualizarEstadisticas();
            this.ocultarError();

            console.log(`Cargados ${this.eventosActuales.length} eventos`);

        } catch (error) {
            console.error('Error cargando eventos:', error);
            this.mostrarError(`Error cargando eventos: ${error.message}`);
            this.eventosActuales = [];
            this.actualizarEstadisticas();
        } finally {
            this.mostrarCarga(false);
            this.cargando = false;
        }
    }

    // Construir la URL para la solicitud de eventos con los filtros aplicados
    construirURLEventos() {
        const urlBase = 'https://eonet.gsfc.nasa.gov/api/v3/events';
        const parametros = new URLSearchParams();

        // Obtener valores de los filtros
        const elementoCategoria = document.getElementById('filtroCategoria');
        const elementoEstado = document.getElementById('filtroEstado');
        const elementoDias = document.getElementById('filtroDias');
        const elementoLimite = document.getElementById('filtroLimite');

        // Agregar parámetros según los filtros seleccionados
        if (elementoCategoria?.value) parametros.append('category', elementoCategoria.value);
        if (elementoEstado?.value) parametros.append('status', elementoEstado.value);
        if (elementoDias?.value) parametros.append('days', elementoDias.value);

        const limite = elementoLimite?.value || '50';
        if (limite) parametros.append('limit', limite);

        return `${urlBase}/geojson?${parametros.toString()}`;
    }

    // Convertir eventos al formato GeoJSON si es necesario
    convertirAGeoJSON(eventos) {
        return eventos.filter(evento => evento.geometry).map(evento => ({
            type: 'Feature',
            properties: {
                id: evento.id,
                title: evento.title,
                description: evento.description || '',
                closed: evento.closed,
                categories: evento.categories || [],
                sources: evento.sources || []
            },
            geometry: evento.geometry
        }));
    }

    // Mostrar los eventos en el mapa como marcadores
    mostrarEventos() {
        this.capaEventos.clearLayers();

        if (this.eventosActuales.length === 0) {
            console.log('No hay eventos para mostrar');
            return;
        }

        let marcadoresCreados = 0;
        this.eventosActuales.forEach((evento, indice) => {
            try {
                const marcador = this.crearMarcadorEvento(evento);
                if (marcador) {
                    this.capaEventos.addLayer(marcador);
                    marcadoresCreados++;
                }
            } catch (error) {
                console.error(`Error creando marcador para evento ${indice}:`, error);
            }
        });

        console.log(`Creados ${marcadoresCreados} marcadores de ${this.eventosActuales.length} eventos`);

        // Ajustar la vista del mapa para mostrar todos los marcadores
        if (marcadoresCreados > 0) {
            try {
                const limites = this.capaEventos.getBounds();
                if (limites.isValid()) {
                    this.mapa.fitBounds(limites, { padding: [20, 20] });
                }
            } catch (error) {
                console.error('Error ajustando vista del mapa:', error);
            }
        }
    }

    // Crear un marcador para un evento específico
    crearMarcadorEvento(evento) {
        const coordenadas = evento.geometry?.coordinates;
        if (!coordenadas || !Array.isArray(coordenadas)) {
            console.warn('Coordenadas inválidas para evento:', evento.properties?.id);
            return null;
        }

        let latLng;

        try {
            // Determinar la posición del marcador según el tipo de geometría
            if (evento.geometry.type === 'Point') {
                latLng = [coordenadas[1], coordenadas[0]]; // [lat, lng]
            } else {
                // Para geometrías más complejas, usar el centro del área
                const capaGeoJSON = L.geoJSON(evento.geometry);
                const limites = capaGeoJSON.getBounds();
                latLng = limites.getCenter();
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

        // Obtener información de categoría y estado
        const categoria = evento.properties.categories?.[0];
        const idCategoria = categoria?.id;
        const color = this.obtenerColorCategoria(idCategoria);
        const estaAbierto = !evento.properties.closed;

        // Crear icono personalizado
        const icono = this.crearIconoPersonalizado(idCategoria, color, estaAbierto);

        // Crear marcador
        const marcador = L.marker(latLng, {
            icon: icono
        });

        // Agregar ventana emergente con información
        const contenidoPopup = this.crearContenidoPopup(evento);
        marcador.bindPopup(contenidoPopup, {
            maxWidth: 300,
            className: 'popup-personalizado'
        });

        return marcador;
    }

    // Crear un icono personalizado para el marcador
    crearIconoPersonalizado(idCategoria, color, estaAbierto) {
        const claseIcono = this.obtenerIconoCategoria(idCategoria);

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
                        opacity: ${estaAbierto ? '1' : '0.7'};
                    ">
                        <i class="${claseIcono}" style="color: white; font-size: 14px;"></i>
                    </div>
                `,
            className: 'icono-marcador-personalizado',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    // Obtener el icono correspondiente a una categoría
    obtenerIconoCategoria(idCategoria) {
        const iconos = {
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
        return iconos[idCategoria] || 'bi bi-geo';
    }

    // Obtener el color correspondiente a una categoría
    obtenerColorCategoria(idCategoria) {
        const colores = {
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
        return colores[idCategoria] || '#00d4ff';
    }

    // Crear el contenido para la ventana emergente del marcador
    crearContenidoPopup(evento) {
        const propiedades = evento.properties;
        const estaAbierto = !propiedades.closed;
        const categoria = propiedades.categories?.[0];
        const idCategoria = categoria?.id;
        const claseIcono = this.obtenerIconoCategoria(idCategoria);

        // Obtener coordenadas para el enlace meteorológico
        const coordenadas = evento.geometry?.coordinates;
        let enlaceClima = '';

        if (coordenadas && evento.geometry.type === 'Point') {
            const lat = coordenadas[1];
            const lng = coordenadas[0];
        }

        return `
            <div class="contenido-popup">
                <div class="titulo-popup">
                    <i class="${claseIcono}" style="margin-right: 5px;"></i>
                    ${propiedades.title || 'Evento sin título'}
                </div>
                ${categoria ? `<div class="categoria-popup">${categoria.title}</div>` : ''}
                <div class="estado-popup ${estaAbierto ? 'estado-abierto' : 'estado-cerrado'}">
                    ${estaAbierto ? '🔴 ACTIVO' : '✅ FINALIZADO'}
                </div>
                ${propiedades.description ? `<p>${propiedades.description}</p>` : ''}
                ${enlaceClima}
                ${propiedades.sources?.length > 0 ? `
                    <p><strong>Fuentes:</strong><br>
                    ${propiedades.sources.map(fuente =>
            `<a href="${fuente.url}" target="_blank" rel="noopener">${fuente.id}</a>`
        ).join(', ')}
                    </p>
                ` : ''}
            </div>
        `;
    }

    // Actualizar las estadísticas en la interfaz
    actualizarEstadisticas() {
        const elementoContador = document.getElementById('contadorEventos');
        if (elementoContador) {
            elementoContador.textContent = this.eventosActuales.length;
        }
    }

    // Mostrar u ocultar el indicador de carga
    mostrarCarga(mostrar) {
        const elementoCarga = document.getElementById('cargando');
        const elementoBoton = document.getElementById('aplicarFiltros');

        if (elementoCarga) {
            elementoCarga.style.display = mostrar ? 'block' : 'none';
        }
        if (elementoBoton) {
            elementoBoton.disabled = mostrar;
        }
    }

    // Mostrar un mensaje de error
    mostrarError(mensaje) {
        let elementoError = document.getElementById('mensajeError');
        if (!elementoError) {
            elementoError = document.createElement('div');
            elementoError.id = 'mensajeError';
            elementoError.className = 'mensaje-error';
            document.querySelector('.panel-lateral').appendChild(elementoError);
        }
        elementoError.innerHTML = mensaje;
        elementoError.style.display = 'block';
    }

    // Ocultar el mensaje de error
    ocultarError() {
        const elementoError = document.getElementById('mensajeError');
        if (elementoError) {
            elementoError.style.display = 'none';
        }
    }

    // Configurar los event listeners para los controles de la interfaz
    configurarEventos() {
        const botonAplicar = document.getElementById('aplicarFiltros');
        const botonLimpiar = document.getElementById('limpiarFiltros');
        const botonSismo = document.getElementById('botonAbrirSismo');
        const controlesCapas = document.getElementById('controlesCapas');

        // Aplicar filtros
        if (botonAplicar) {
            botonAplicar.addEventListener('click', () => {
                this.cargarEventos();
            });
        }

        // Limpiar filtros
        if (botonLimpiar) {
            botonLimpiar.addEventListener('click', () => {
                this.limpiarFiltros();
            });
        }

        // Abrir página de clima
        if (botonSismo) {
            botonSismo.addEventListener('click', () => {
                window.open('sismos.html', '_blank');
            });
        }

        // Permitir aplicar filtros con la tecla Enter
        ['filtroCategoria', 'filtroEstado', 'filtroDias', 'filtroLimite'].forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.cargarEventos();
                    }
                });
            }
        });
    }

    // Restablecer todos los filtros a sus valores por defecto
    limpiarFiltros() {
        const filtros = [
            { id: 'filtroCategoria', valor: '' },
            { id: 'filtroEstado', valor: '' },
            { id: 'filtroDias', valor: '' },
            { id: 'filtroLimite', valor: '50' }
        ];

        filtros.forEach(filtro => {
            const elemento = document.getElementById(filtro.id);
            if (elemento) {
                elemento.value = filtro.valor;
            }
        });

        this.cargarEventos();
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

    // Verificar que el elemento del mapa exista
    const elementoMapa = document.getElementById('mapa');
    if (!elementoMapa) {
        console.error('Elemento #mapa no encontrado');
        alert('Error: El contenedor del mapa no se encontró en la página.');
        return;
    }

    try {
        // Crear instancia de la aplicación
        window.aplicacionEventosNASA = new MapaEventosNASA();
        console.log('Aplicación NASA EONET inicializada correctamente');
    } catch (error) {
        console.error('Error fatal inicializando la aplicación:', error);
        alert('Error inicializando la aplicación. Verifica la consola para más detalles.');
    }
});

// Manejar errores globales
window.addEventListener('error', (evento) => {
    console.error('Error global capturado:', evento.error);
});

window.addEventListener('unhandledrejection', (evento) => {
    console.error('Promise rechazada no manejada:', evento.reason);
});
