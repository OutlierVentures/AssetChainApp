@echo off

REM Serve static files within the current directory.

SET PORTNUMBER=1564

REM We send the start command first, which returns control immediately, 
REM then start http-server. In practice the http-server is started quickly 
REM enough to serve the first file when the browser asks for it.
start http://localhost:%PORTNUMBER%
http-server -p %PORTNUMBER%
