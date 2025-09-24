class MapaSismos {
  constructor() {
    // API gratuita del USGS (Servicio Geológico de EE.UU.)
    this.baseUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary";

    // Inicializar mapa centrado
    this.mapa = L.map('mapa').setView([20, 0], 2);

    // Capa base del mapa
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors | Datos: USGS Earthquake Hazards Program'
    }).addTo(this.mapa);

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
    this.cargarDatosSismos();

    // Auto-actualizar cada 5 minutos
    this.intervaloAuto = setInterval(() => {
      if (this.autoActualizar.checked) {
        this.cargarDatosSismos();
      }
    }, 300000);
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
  }

  async cargarDatosSismos() {
    try {
      this.mostrarCargando(true);

      const magnitud = this.filtroMagnitud.value;
      const tiempo = this.filtroTiempo.value;
      const limite = this.filtroLimite.value;

      // Construir URL de la API con filtros
      const url = `${this.baseUrl}/${magnitud}_${tiempo}.geojson?limit=${limite}`;

      const respuesta = await fetch(url);

      if (!respuesta.ok) {
        throw new Error(`Error HTTP: ${respuesta.status}`);
      }

      const datos = await respuesta.json();
      this.sismos = datos.features;

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

    // Agregar marcadores nuevos por cada sismo
    this.sismos.forEach(sismo => {
      const { geometry, properties } = sismo;
      const [longitud, latitud, profundidad] = geometry.coordinates;
      const magnitud = properties.mag;
      const lugar = properties.place;
      const tiempo = new Date(properties.time);
      const url = properties.url;

      // Color y tamaño según magnitud
      const color = this.obtenerColorMagnitud(magnitud);
      const radio = this.obtenerRadioMagnitud(magnitud);

      // Crear marcador circular
      const marcador = L.circleMarker([latitud, longitud], {
        color: color,
        fillColor: color,
        fillOpacity: 0.7,
        radius: radio,
        weight: 2
      }).addTo(this.mapa);

      // Popup con información
      const popup = `
        <div class="info-sismo">
          <div class="titulo-sismo">${lugar}</div>
          <div class="magnitud-sismo">Magnitud: ${magnitud.toFixed(1)}</div>
          <div class="profundidad-sismo">Profundidad: ${profundidad.toFixed(1)} km</div>
          <div class="tiempo-sismo">${tiempo.toLocaleString('es-ES')}</div>
          <a href="${url}" target="_blank" style="color: #3498db; text-decoration: none;">
            <i class="bi bi-info-circle"></i> Más información
          </a>
        </div>
      `;

      marcador.bindPopup(popup);
      this.marcadores.push(marcador);

      // Abrir popup automáticamente si es fuerte
      if (magnitud >= 6.0) {
        marcador.openPopup();
      }
    });

    // Mostrar hora de última actualización
    this.ultimaActualizacion.textContent = `Última actualización: ${new Date().toLocaleString('es-ES')}`;
  }

  actualizarEstadisticas() {
    this.contadorSismos.textContent = this.sismos.length;

    // Estadísticas adicionales en consola
    if (this.sismos.length > 0) {
      const magnitudes = this.sismos.map(s => s.properties.mag);
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
    return Math.max(4, magnitud * 2);
  }

  limpiarMarcadores() {
    this.marcadores.forEach(m => this.mapa.removeLayer(m));
    this.marcadores = [];
  }

  mostrarCargando(mostrar) {
    this.cargando.style.display = mostrar ? 'block' : 'none';
  }

  mostrarError(mensaje) {
    console.error(mensaje);
  }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new MapaSismos();
});
