$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [System.Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "HireScout - Voice Assistant.lnk"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $ScriptDir "Start_HireScout.bat"
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Launch HireScout Voice Assistant"
$Shortcut.IconLocation = "shell32.dll, 14"
$Shortcut.Save()
Write-Host "Created shortcut on Desktop: $ShortcutPath"
