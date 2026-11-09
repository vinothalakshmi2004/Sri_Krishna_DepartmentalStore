@echo off
REM ------------------------------------------------------------------
REM  Sri Krishna Store - start everything with one double-click
REM    1. MongoDB   (port 27017)
REM    2. Backend   (http://localhost:5000)
REM    3. Frontend  (http://localhost:5173)
REM  Each one opens in its own window. Close the windows to stop them.
REM ------------------------------------------------------------------
echo Starting MongoDB...
start "Sri Krishna Store - MongoDB" cmd /k call "%~dp0start-mongodb.bat"
timeout /t 5 /nobreak >nul

echo Starting backend...
start "Sri Krishna Store - Backend" /d "%~dp0backend" cmd /k npm run dev
timeout /t 4 /nobreak >nul

echo Starting frontend...
start "Sri Krishna Store - Frontend" /d "%~dp0frontend" cmd /k npm run dev
timeout /t 6 /nobreak >nul

echo Opening the store in your browser...
start "" http://localhost:5173
echo.
echo Customer site : http://localhost:5173
echo Admin portal  : http://localhost:5173/admin   (admin / admin123)
echo.
pause