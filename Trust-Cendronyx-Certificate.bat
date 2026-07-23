@echo off
title Trust CendrosyncP2P Certificate
echo =======================================================
echo   Installing Cendronyx Trusted Root Certificate...
echo =======================================================
echo.
powershell -Command "Import-Certificate -FilePath '%~dp0CendronyxRootCert.cer' -CertStoreLocation cert:\CurrentUser\Root" >nul 2>&1
powershell -Command "Import-Certificate -FilePath '%~dp0CendronyxRootCert.cer' -CertStoreLocation cert:\CurrentUser\TrustedPublisher" >nul 2>&1
echo [SUCCESS] Cendronyx certificate installed!
echo Windows Defender SmartScreen will no longer block CendrosyncP2P.
echo.
pause
