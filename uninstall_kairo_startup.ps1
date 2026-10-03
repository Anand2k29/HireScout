# uninstall_kairo_startup.ps1
$StartupFolder = [Environment]::GetFolderPath("Startup")
$OldShortcut = Join-Path $StartupFolder "KAIRO Voice Assistant.lnk"
if (Test-Path $OldShortcut) {
    Remove-Item $OldShortcut -Force
    Write-Host "Removed legacy startup shortcut: KAIRO Voice Assistant.lnk"
}
$OldShortcut2 = Join-Path $StartupFolder "KAIRO.lnk"
if (Test-Path $OldShortcut2) {
    Remove-Item $OldShortcut2 -Force
    Write-Host "Removed legacy startup shortcut: KAIRO.lnk"
}
Write-Host "HireScout startup cleanup complete."
