class MapaSismos {
  constructor() {
    // API gratuita del USGS (Servicio Geológico de EE.UU.)
    this.baseUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary";

    // Inicializar mapa centrado con configuración mejorada
    this.mapa = L.map('mapa', {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      preferCanvas: true
    });

    // Capa base del mapa con múltiples opciones
    this.capasBase = {
      'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }),
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
      }),
      'Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO'
      })
    };

    // Agregar capa por defecto
    this.capasBase['Dark'].addTo(this.mapa);

    // Control de capas
    L.control.layers(this.capasBase).addTo(this.mapa);

    // Configuración inicial
    this.marcadores = [];
    this.sismos = [];

    // Elementos del DOM
    this.contadorSismos = document.getElementById('contadorSismos');
    this.filtroMagnitud = document.getElementById('filtroMagnitud');
    this.filtroTiempo = document.getElementById('filtroTiempo');
    this.filtroLimite = document.getElementById('filtroLimite');
    this.autoActualizar = document.getElementById('autoActualizar');
    this.botonFiltros = document.getElementById('btnAplicarFiltros');
    this.botonActualizar = document.getElementById('btnActualizar');
    this.cargando = document.getElementById('cargando');
    this.ultimaActualizacion = document.getElementById('ultimaActualizacion');

    // Configurar eventos
    this.configurarEventos();

    // Esperar a que el mapa se inicialice completamente
    setTimeout(() => {
      this.mapa.invalidateSize();
      this.cargarDatosSismos();
    }, 100);

    // Auto-actualizar cada 5 minutos
    this.intervaloAuto = setInterval(() => {
      if (this.autoActualizar.checked) {
        this.cargarDatosSismos();
      }
    }, 300000); // 5 minutos
  }

  configurarEventos() {
    // Cuando se haga clic en "Aplicar filtros"
    this.botonFiltros.addEventListener('click', () => {
      this.cargarDatosSismos();
    });

    // Cuando se haga clic en "Actualizar ahora"
    this.botonActualizar.addEventListener('click', () => {
      this.cargarDatosSismos();
    });

    // Manejar redimensionamiento de ventana
    window.addEventListener('resize', () => {
      this.mapa.invalidateSize();
    });
  }

  async cargarDatosSismos() {
    try {
      this.mostrarCargando(true);

      const magnitud = this.filtroMagnitud.value;
      const tiempo = this.filtroTiempo.value;

      // Construir URL de la API con filtros
      const url = `${this.baseUrl}/${magnitud}_${tiempo}.geojson`;

      console.log('Cargando desde:', url);

      const respuesta = await fetch(url);

      if (!respuesta.ok) {
        throw new Error(`Error HTTP: ${respuesta.status}`);
      }

      const datos = await respuesta.json();
      this.sismos = datos.features;

      console.log(`Cargados ${this.sismos.length} sismos`);

      // Actualizar mapa y estadísticas
      this.actualizarMapa();
      this.actualizarEstadisticas();
      this.mostrarCargando(false);

    } catch (error) {
      console.error('Error cargando datos sísmicos:', error);
      this.mostrarError('Error cargando datos. Intentando nuevamente...');
      this.mostrarCargando(false);

      // Reintentar después de 10 segundos
      setTimeout(() => this.cargarDatosSismos(), 10000);
    }
  }

  actualizarMapa() {
    // Limpiar marcadores anteriores
    this.limpiarMarcadores();

    if (this.sismos.length === 0) {
      console.log('No hay sismos para mostrar con los filtros actuales');
      return;
    }

    // Agregar marcadores nuevos por cada sismo
    this.sismos.forEach(sismo => {
      const { geometry, properties } = sismo;
      const [longitud, latitud, profundidad] = geometry.coordinates;
      const magnitud = properties.mag;
      const lugar = properties.place;
      const tiempo = new Date(properties.time);
      const url = properties.url;

      // Validar coordenadas
      if (isNaN(latitud) || isNaN(longitud)) {
        return;
      }

      // Color y tamaño según magnitud
      const color = this.obtenerColorMagnitud(magnitud);
      const radio = this.obtenerRadioMagnitud(magnitud);

      // Crear marcador circular
      const marcador = L.circleMarker([latitud, longitud], {
        color: '#fff',
        fillColor: color,
        fillOpacity: 0.8,
        radius: radio,
        weight: 2,
        opacity: 1
      }).addTo(this.mapa);

      // Popup con información
      const popup = `
              <div class="info-sismo">
                  <div class="titulo-sismo">${lugar || 'Ubicación no especificada'}</div>
                  <div class="magnitud-sismo">Magnitud: ${magnitud.toFixed(1)}</div>
                  <div class="profundidad-sismo">Profundidad: ${(profundidad || 0).toFixed(1)} km</div>
                  <div class="tiempo-sismo">${tiempo.toLocaleString('es-ES')}</div>
                  ${url ? `<a href="${url}" target="_blank">
                      <i class="bi bi-info-circle"></i> Más información
                  </a>` : ''}
              </div>
          `;

      marcador.bindPopup(popup);
      this.marcadores.push(marcador);

      // Abrir popup automáticamente si es fuerte
      if (magnitud >= 6.0) {
        setTimeout(() => marcador.openPopup(), 100);
      }
    });

    // Ajustar vista si hay marcadores
    if (this.marcadores.length > 0) {
      const grupo = new L.featureGroup(this.marcadores);
      this.mapa.fitBounds(grupo.getBounds().pad(0.1));
    }

    // Mostrar hora de última actualización
    this.ultimaActualizacion.textContent = `Última actualización: ${new Date().toLocaleString('es-ES')}`;
  }

  actualizarEstadisticas() {
    this.contadorSismos.textContent = this.sismos.length;

    // Estadísticas adicionales en consola
    if (this.sismos.length > 0) {
      const magnitudes = this.sismos.map(s => s.properties.mag).filter(m => !isNaN(m));
      const max = Math.max(...magnitudes);
      const promedio = (magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length).toFixed(1);

      console.log(`Estadísticas: ${this.sismos.length} sismos, Max: ${max}, Prom: ${promedio}`);
    }
  }

  obtenerColorMagnitud(magnitud) {
    if (magnitud < 3.0) return '#2ecc71';
    if (magnitud < 5.0) return '#f1c40f';
    if (magnitud < 6.0) return '#e67e22';
    if (magnitud < 7.0) return '#e74c3c';
    return '#c0392b';
  }

  obtenerRadioMagnitud(magnitud) {
    return Math.max(4, Math.min(magnitud * 3, 20));
  }

  limpiarMarcadores() {
    this.marcadores.forEach(m => {
      if (this.mapa.hasLayer(m)) {
        this.mapa.removeLayer(m);
      }
    });
    this.marcadores = [];
  }

  mostrarCargando(mostrar) {
    this.cargando.style.display = mostrar ? 'block' : 'none';
    this.botonFiltros.disabled = mostrar;
    this.botonActualizar.disabled = mostrar;
  }

  mostrarError(mensaje) {
    console.error(mensaje);
    // Aquí podrías agregar una notificación visual del error
  }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('Inicializando mapa de sismos...');
  new MapaSismos();
});