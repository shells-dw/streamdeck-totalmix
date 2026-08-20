<#
    capture-osc.ps1 — record raw OSC packets from TotalMix FX to a log file.

    Creates the test fixture the rewrite is validated against. No dependencies;
    Windows PowerShell 5.1 or PowerShell 7+ both work.

    SETUP IN TOTALMIX FIRST:
      Options -> Settings -> OSC tab
        - Pick a Remote Controller slot NOT used by the plugin (slot 3 or 4).
        - Tick "In Use".
        - Set its "Remote Controller Address" to THIS machine's IP
          (127.0.0.1 if TotalMix runs on this machine).
        - Set its "Port outgoing" to the -Port value below (default 9001).
        - Options menu -> tick "Enable OSC Control".
      Also: quit the Stream Deck app first, so the plugin isn't competing
      for the same port.

    USAGE:
      powershell -ExecutionPolicy Bypass -File capture-osc.ps1
      powershell -ExecutionPolicy Bypass -File capture-osc.ps1 -Port 9001 -Out fixtures\osc-capture.log

    Then exercise TotalMix while it records: switch banks, move faders,
    toggle mutes, change submix, let it idle a few seconds for heartbeats.
    Press Ctrl+C to stop.
#>

param(
    [int]$Port = 9001,
    [string]$Out = "osc-capture.log"
)

$ErrorActionPreference = "Stop"

# Resolve output path and make sure the folder exists
$Out = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Out))
$dir = [System.IO.Path]::GetDirectoryName($Out)
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

try {
    $udp = New-Object System.Net.Sockets.UdpClient($Port)
}
catch {
    Write-Host ""
    Write-Host "Could not bind UDP port $Port." -ForegroundColor Red
    Write-Host "Usually means something else is already listening on it." -ForegroundColor Red
    Write-Host "Quit the Stream Deck app, or pick another port with -Port and" -ForegroundColor Red
    Write-Host "set the same port in TotalMix's OSC settings." -ForegroundColor Red
    Write-Host ""
    exit 1
}

$udp.Client.ReceiveTimeout = 1000
$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)

$writer = New-Object System.IO.StreamWriter($Out, $false)
$writer.AutoFlush = $true
$writer.WriteLine("# OSC capture started $(Get-Date -Format o) on UDP port $Port")

Write-Host ""
Write-Host "Listening on UDP $Port -> $Out" -ForegroundColor Green
Write-Host "Now go poke TotalMix: switch banks, move faders, toggle mutes," -ForegroundColor Cyan
Write-Host "then leave it idle a few seconds to catch heartbeats." -ForegroundColor Cyan
Write-Host "Press Ctrl+C when done." -ForegroundColor Cyan
Write-Host ""

$count = 0
$lastReport = Get-Date

try {
    while ($true) {
        try {
            $bytes = $udp.Receive([ref]$endpoint)
        }
        catch [System.Net.Sockets.SocketException] {
            # 1s receive timeout so Ctrl+C stays responsive
            if ($_.Exception.SocketErrorCode -eq 'TimedOut') { continue }
            throw
        }

        $count++
        $ts = (Get-Date).ToString("o")

        # Hex is the authoritative record — parser-agnostic and lossless.
        $hex = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ''

        # Printable-ASCII rendering, purely so the log is eyeball-friendly.
        $ascii = -join ($bytes | ForEach-Object {
            if ($_ -ge 32 -and $_ -le 126) { [char]$_ } else { '.' }
        })

        $writer.WriteLine("")
        $writer.WriteLine("# $ts from=$($endpoint.Address):$($endpoint.Port) len=$($bytes.Length)")
        $writer.WriteLine("hex: $hex")
        $writer.WriteLine("txt: $ascii")

        if (((Get-Date) - $lastReport).TotalSeconds -ge 2) {
            Write-Host "  captured $count packets..." -ForegroundColor DarkGray
            $lastReport = Get-Date
        }
    }
}
finally {
    $writer.WriteLine("")
    $writer.WriteLine("# ended $(Get-Date -Format o), $count packets")
    $writer.Close()
    $udp.Close()
    Write-Host ""
    Write-Host "Saved $count packets to $Out" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check it before committing: it may contain your channel names," -ForegroundColor Yellow
    Write-Host "device names or IP addresses." -ForegroundColor Yellow
    Write-Host ""
}
