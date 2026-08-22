<#
.SYNOPSIS
    Gives the plugin a new identity so it can live on Marketplace alongside the
    already-published de.shells.totalmix, instead of replacing it.

.DESCRIPTION
    Renames the .sdPlugin folder and rewrites every reference to the plugin
    identifier: the manifest UUID and the seven action UUIDs, the matching
    @action decorators in src/, and the build config that points at the plugin
    folder.

    Deliberately left alone: the two "de.shells.totalmix.exe.config" mentions in
    README.md, which are history about the old C# plugin.

.EXAMPLE
    .\Rename-Plugin.ps1
    Renames to de.shells.totalmix2.

.EXAMPLE
    .\Rename-Plugin.ps1 -NewId de.shells.totalmixfx -WhatIf
    Shows what would change, without writing anything.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$OldId = 'de.shells.totalmix2',

    # Stream Deck UUID rules: lowercase a-z, 0-9, hyphens and periods only.
    [ValidatePattern('^[a-z0-9]+(\.[a-z0-9-]+)+$')]
    [string]$NewId = 'de.shellsdw.totalmix2'
)

$ErrorActionPreference = 'Stop'

$oldFolder = "$OldId.sdPlugin"
$newFolder = "$NewId.sdPlugin"

if (-not (Test-Path $oldFolder -PathType Container)) {
    throw "$oldFolder not found - run this from the repo root."
}

# UTF-8 without BOM. The manifest tooltips contain em dashes, and Windows
# PowerShell 5.1's default Set-Content encoding would mangle them.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Update-File {
    param([string]$Path, [string]$Pattern, [string]$Replacement)

    if (-not (Test-Path $Path -PathType Leaf)) {
        Write-Warning "skipped (not found): $Path"
        return
    }

    $full = (Resolve-Path $Path).Path
    $text = [System.IO.File]::ReadAllText($full)
    $updated = $text -replace $Pattern, $Replacement

    if ($updated -ceq $text) {
        Write-Verbose "no change: $Path"
        return
    }

    if ($PSCmdlet.ShouldProcess($Path, 'rewrite plugin identifier')) {
        # WriteAllText, not Set-Content: no trailing newline is appended, so
        # files that end without one stay that way and the diff stays minimal.
        [System.IO.File]::WriteAllText($full, $updated, $utf8NoBom)
        Write-Host "  updated  $Path"
    }
}

$escapedOld = [regex]::Escape($OldId)

# 1. The plugin folder. Stream Deck resolves the plugin by this folder name, so
#    it has to match the manifest UUID exactly.
if ($PSCmdlet.ShouldProcess($oldFolder, "rename to $newFolder")) {
    if (Test-Path '.git' -PathType Container) {
        git mv -- $oldFolder $newFolder
        if ($LASTEXITCODE -ne 0) { throw 'git mv failed.' }
    }
    else {
        Rename-Item -LiteralPath $oldFolder -NewName $newFolder
    }
    Write-Host "  renamed  $oldFolder -> $newFolder"
}

# 2. Plugin UUID + the seven action UUIDs, and the matching @action decorators.
#    These two sets must never drift apart.
Update-File -Path (Join-Path $newFolder 'manifest.json') -Pattern $escapedOld -Replacement $NewId

Get-ChildItem -Path 'src/actions' -Filter '*.ts' -File | ForEach-Object {
    Update-File -Path $_.FullName -Pattern $escapedOld -Replacement $NewId
}

# 3. Build config that writes into the plugin folder, plus the watch script's
#    `streamdeck restart <uuid>` call.
foreach ($f in 'rollup.config.mjs', 'tsconfig.json', 'package.json', '.gitignore') {
    Update-File -Path $f -Pattern $escapedOld -Replacement $NewId
}

# 4. README: only the log path moves. The .exe.config mentions stay.
Update-File -Path 'README.md' -Pattern "$escapedOld\.sdPlugin" -Replacement "$NewId.sdPlugin"

Write-Host ''
Write-Host "Renamed $OldId -> $NewId" -ForegroundColor Green
Write-Host ''
Write-Host 'Remaining references (expected: the two .exe.config lines in README.md):'

Get-ChildItem -Recurse -File |
    Where-Object {
        $_.FullName -notmatch '[\\/](\.git|node_modules)[\\/]' -and
        $_.Extension -notin '.png', '.jpg', '.gif', '.svg', '.pyc'
    } |
    Select-String -Pattern "$escapedOld(?![0-9])" -SimpleMatch:$false |
    ForEach-Object { "  $($_.Path -replace [regex]::Escape($PWD.Path + [IO.Path]::DirectorySeparatorChar), ''):$($_.LineNumber)" }
