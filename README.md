# Weather Dashboard

## Features
- Current weather conditions display
- 7-day weather forecast
- Search functionality for multiple locations
- Responsive design for mobile and desktop views

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
    - Create a `.env` file in the root directory and add your API key:
      ```plaintext
      API_KEY=your_api_key_here
      ```

## How to Run
- To start the development server, run:
    ```bash
    npm start
    ```  
- Navigate to `http://localhost:3000` in your web browser to view the application.

## API Configuration
- This application uses the OpenWeatherMap API to fetch weather data.
- Ensure your API key is properly configured in the `.env` file as mentioned above.

## Troubleshooting
- **If the weather data does not display**:
  - Check if your API key is valid.
  - Verify your internet connection.
- **If the application crashes**:
  - Review the console for error messages and address any missing dependencies.  

## Future Enhancements
- Add a feature to save favorite locations.
- Include weather alerts for severe weather conditions.
- Implement weather maps for visual representation of data.