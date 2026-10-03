Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & WshShell.CurrentDirectory & "\listen_space_global.ps1""", 0, False
