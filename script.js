// script.js

const apiKey = 'YOUR_API_KEY';
const city = 'YOUR_CITY';

async function fetchWeather() {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
        const data = await response.json();
        displayWeather(data);
    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}

function displayWeather(data) {
    const weatherContainer = document.getElementById('weather');
    if (data.cod === 200) {
        const temp = data.main.temp;
        const weatherDescription = data.weather[0].description;
        weatherContainer.innerHTML = `<h2>${data.name}</h2><p>Temperature: ${temp} &#8451;</p><p>${weatherDescription}</p>`;
    } else {
        weatherContainer.innerHTML = `<p>City not found. Please try again.</p>`;
    }
}

fetchWeather();