#!/usr/bin/env pwsh
<#
.SYNOPSIS
    OptiAqua Changelog Helper Script
    Aqua-Aerobic Systems, Inc.

.DESCRIPTION
    Automates CHANGELOG.md management for the OptiAqua Analytics Platform.
    Run this script after code changes are approved and committed.

.PARAMETER Mode
    append  - Append recent commits to [Unreleased] section (default)
    release - Promote [Unreleased] to a numbered version
    show    - Print the current [Unreleased] section

.PARAMETER Version
    Required when Mode is 'release'. Example: 1.0.0

.EXAMPLE
    .\Update-Changelog.ps1
    .\Update-Changelog.ps1 -Mode append
    .\Update-Changelog.ps1 -Mode release -Version 1.0.0
    .\Update-Changelog.ps1 -Mode show
#>

param(
    [ValidateSet('append','release','show')]
    [string]$Mode = 'append',
    [string]$Version = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { Write-Error "Not inside a git repository."; exit 1 }

$changelog = Join-Path $repoRoot "CHANGELOG.md"
if (-not (Test-Path $changelog)) { Write-Error "CHANGELOG.md not found at $changelog"; exit 1 }

# ---- MODE: show ----
if ($Mode -eq 'show') {
    Write-Host ""
    Write-Host "  Current [Unreleased] section in CHANGELOG.md" -ForegroundColor Yellow
    Write-Host ""
    $content = Get-Content $changelog -Raw
    if ($content -match '(?s)## \[Unreleased\](.*?)(?=## \[)') {
        Write-Host $Matches[1].Trim()
    } else {
        Write-Host "(empty)" -ForegroundColor Gray
    }
    exit 0
}

# ---- MODE: append ----
if ($Mode -eq 'append') {
    $lastTag = $null
    try { $lastTag = (git describe --tags --abbrev=0 2>&1) | Where-Object { $_ -notmatch 'fatal:' } | Select-Object -First 1 } catch {}
    if ($lastTag) {
        $commits = git log "$lastTag..HEAD" --format="%h|%s|%an|%ad" --date=format:'%Y-%m-%d' 2>$null
    } else {
        $commits = git log -10 --format="%h|%s|%an|%ad" --date=format:'%Y-%m-%d' 2>$null
    }

    if (-not $commits) {
        Write-Host ""
        Write-Host "  No new commits to append." -ForegroundColor Yellow
        Write-Host ""
        exit 0
    }

    $existingContent = Get-Content $changelog -Raw
    $newEntries = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $commits) {
        $parts  = $line -split '\|', 4
        $hash   = $parts[0]
        $msg    = $parts[1]
        $author = $parts[2]
        $date   = $parts[3]

        # Skip if this commit hash is already in the changelog (deduplication)
        if ($existingContent -match [regex]::Escape("[$hash]")) {
            Write-Host "  Skipping $hash (already in changelog)" -ForegroundColor Gray
            continue
        }

        $changedFiles = git diff-tree --no-commit-id -r --name-only $hash 2>$null
        if ($changedFiles) {
            $fileList = ($changedFiles | ForEach-Object { "  - ``$_``" }) -join "`n"
        } else {
            $fileList = "  (no file changes recorded)"
        }

        $entry = "### [$hash] $date | $author`n**$msg**`n$fileList`n"
        $newEntries.Add($entry)
    }

    $block = $newEntries -join "`n"

    $content = Get-Content $changelog -Raw
    $marker  = "## [Unreleased]"

    if ($content -notmatch [regex]::Escape($marker)) {
        Write-Error "Could not find '## [Unreleased]' in CHANGELOG.md"
        exit 1
    }

    # Insert entries right after the [Unreleased] heading line (handles CRLF and LF)
    $escapedMarker = [regex]::Escape($marker)
    $updated = $content -replace "($escapedMarker`r?`n)", "`$1`n$block`n"
    Set-Content $changelog $updated -NoNewline -Encoding UTF8

    Write-Host ""
    Write-Host "  CHANGELOG.md updated -- $($newEntries.Count) commit(s) added to [Unreleased]." -ForegroundColor Green
    Write-Host ""
    exit 0
}

# ---- MODE: release ----
if ($Mode -eq 'release') {
    if (-not $Version) {
        Write-Error "Provide -Version when using -Mode release. Example: -Version 1.0.0"
        exit 1
    }
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        Write-Error "Version must be SemVer format: MAJOR.MINOR.PATCH (e.g. 1.0.0)"
        exit 1
    }

    $today   = Get-Date -Format "yyyy-MM-dd"
    $content = Get-Content $changelog -Raw

    if ($content -notmatch '(?s)## \[Unreleased\](.*?)(?=\r?\n## \[)') {
        Write-Error "No [Unreleased] section found in CHANGELOG.md."
        exit 1
    }
    $unreleasedBody = $Matches[1].Trim()

    if (-not $unreleasedBody) {
        Write-Error "[Unreleased] section is empty -- nothing to release."
        exit 1
    }

    $newUnreleased = "## [Unreleased]`n`n> Changes staged but not yet in a versioned release.`n`n---`n`n"
    $newVersion    = "## [$Version] -- $today`n`n$unreleasedBody`n`n---`n`n"

    $updated = $content -replace '(?s)## \[Unreleased\].*?(?=## \[)', ($newUnreleased + $newVersion)
    Set-Content $changelog $updated -NoNewline -Encoding UTF8

    git add $changelog
    git commit -m "chore: release v$Version -- update CHANGELOG.md"
    git tag -a "v$Version" -m "Release v$Version"

    Write-Host ""
    Write-Host "  Released v$Version -- CHANGELOG.md updated and git tag v$Version created." -ForegroundColor Green
    Write-Host "  Push with: git push origin main --tags" -ForegroundColor Gray
    Write-Host ""
    exit 0
}
