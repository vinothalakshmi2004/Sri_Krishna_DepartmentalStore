@echo off
REM ------------------------------------------------------------------
REM  Sri Krishna Store - start the local MongoDB (portable, no install needed)
REM  Database files are kept in the "mongodb\data" folder.
REM  Keep this window open while using the app. Close it to stop MongoDB.
REM ------------------------------------------------------------------
title Sri Krishna Store - MongoDB
if not exist "%~dp0mongodb\data" mkdir "%~dp0mongodb\data"
echo Starting MongoDB on mongodb://127.0.0.1:27017 ...
"%~dp0mongodb\bin\mongod.exe" --dbpath "%~dp0mongodb\data" --port 27017 --bind_ip 127.0.0.1
echo.
echo MongoDB stopped. (If you see "address already in use", MongoDB is already running.)
pause