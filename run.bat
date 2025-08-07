@echo off
echo Starting signsol-print-server using PM2...
pm2 start server.js --name signsol-print-server

echo.
echo Press Enter to exit...
pause > nul