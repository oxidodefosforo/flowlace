@echo off
rem Flowlace Server command line (init, create-user, reset-password, list-users, list-workspaces, create-workspace, check, serve)
"%~dp0node\node.exe" --disable-warning=ExperimentalWarning "%~dp0app\server\src\index.js" %*
