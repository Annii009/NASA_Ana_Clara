class WeatherApp {
      constructor() {
        this.apiKey = "TU_API_KEY_DE_OPENWEATHERMAP"; // Reemplaza con tu API key
        this.map = L.map("map").setView([40, -3], 5);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(this.map);

        this.marker = null;
        this.countrySelect = document.getElementById("countrySelect");

        this.countrySelect.addEventListener("change", () => {
          this.loadWeather(this.countrySelect.value);
        });

        // Mostrar clima inicial (España)
        this.loadWeather("Spain");
      }

      async loadWeather(country) {
        try {
          // Obtener coordenadas del país
          const geoRes = await fetch(
            `https://api.openweathermap.org/geo/1.0/direct?q=${country}&limit=1&appid=${this.apiKey}`
          );
          const geoData = await geoRes.json();

          if (!geoData.length) throw new Error("No se encontró el país");

          const { lat, lon, name, country: countryCode } = geoData[0];

          // Obtener clima
          const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=es`
          );
          const weather = await weatherRes.json();

          // Mostrar en mapa
          if (this.marker) this.map.removeLayer(this.marker);
          this.marker = L.marker([lat, lon]).addTo(this.map)
            .bindPopup(`<b>${name}, ${countryCode}</b><br>${weather.main.temp}°C - ${weather.weather[0].description}`)
            .openPopup();

          this.map.setView([lat, lon], 5);

          // Actualizar panel lateral
          document.getElementById("locationName").textContent = `${name}, ${countryCode}`;
          document.getElementById("temperature").textContent = Math.round(weather.main.temp);
          document.getElementById("description").textContent = weather.weather[0].description;
          document.getElementById("humidity").textContent = weather.main.humidity;
          document.getElementById("wind").textContent = weather.wind.speed;
        } catch (err) {
          alert("Error cargando el clima: " + err.message);
        }
      }
    }

    document.addEventListener("DOMContentLoaded", () => {
      new WeatherApp();
    });