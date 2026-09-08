# Weather Dashboard

## Features
- Current weather conditions display
- 7-day weather forecast
- Search functionality for multiple locations
- Favorite locations (saved in browser)
- Weather alerts for severe conditions
- Input validation
- Responsive design for mobile and desktop views
- Spinner loading states and error messages

## Installation Instructions

1. **Clone the repository**:
    ```bash
    git clone https://github.com/flames778/weather-dashboard.git
    cd weather-dashboard
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **API Key Configuration**:
    - Sign up for a free API key at [OpenWeatherMap](https://openweathermap.org/api)
    - Copy the example env file and add your API key:
      ```bash
      cp .env.example .env
      ```
    - Edit `.env` and replace `your_openweathermap_api_key_here` with your actual key

## How to Run
- To start the server, run:
    ```bash
    npm start
    ```
- Navigate to `http://localhost:3000` in your web browser to view the application.

## API Configuration
- This application uses the OpenWeatherMap API to fetch weather data.
- The API key is stored server-side in `.env` and is never exposed to the browser.
- The server proxies API requests to keep the key secure.

## Architecture
- `server.js` — Express server that serves static files and proxies API calls
- `public/` — Frontend files (HTML, CSS, JS)
- `.env` — Environment variables (API key), git-ignored

## Troubleshooting
- **If the weather data does not display**:
  - Check if your API key is valid in the `.env` file.
  - Verify your internet connection.
  - Check the server terminal for error messages.
- **If the application crashes**:
  - Review the console for error messages and address any missing dependencies.

## Future Enhancements
- Include weather maps for visual representation of data.
- Add geolocation to auto-detect user's city.
