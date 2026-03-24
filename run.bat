@echo off
echo ============================================
echo   AI Interior Designer - Starting App
echo ============================================
echo.
echo Starting Flask backend on http://localhost:5000
echo Open your browser to http://localhost:5000
echo Press CTRL+C to stop the server
echo.
cd /d "%~dp0backend"
python app.py
