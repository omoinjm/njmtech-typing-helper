# Typing Helper installer for Windows.
#
#   irm https://typing.njmtech.co.za/install.ps1 | iex
#
# Downloads the latest GitHub Release and extracts the Chrome (also Brave /
# Opera), Edge and Firefox builds to %USERPROFILE%\typing-helper\<browser>.
# Re-running replaces those folders in place, so an update is just "Reload"
# on the browser's extensions page. Works on Windows PowerShell 5.1 and 7.

function Install-TypingHelper {
    $ErrorActionPreference = 'Stop'
    # The progress bar makes Invoke-WebRequest very slow on 5.1.
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $Repo = 'omoinjm/njmtech-typing-helper'
    $Browsers = 'chrome', 'edge', 'firefox'
    $UserHome = $env:USERPROFILE
    if (-not $UserHome) { $UserHome = $HOME }
    $Root = Join-Path $UserHome 'typing-helper'
    $Temp = [IO.Path]::GetTempPath()
    $Headers = @{ 'User-Agent' = 'typing-helper-installer'; 'Accept' = 'application/vnd.github+json' }

    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers $Headers
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 404) {
            Write-Host 'No public release found (the repository may still be private).' -ForegroundColor Red
        } else {
            Write-Host "Could not reach GitHub: $($_.Exception.Message)" -ForegroundColor Red
        }
        return
    }

    $tag = $release.tag_name
    Write-Host "Installing Typing Helper $tag to $Root" -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $Root | Out-Null

    $installed = @()
    foreach ($browser in $Browsers) {
        $asset = $release.assets | Where-Object { $_.name -like "*-$browser.zip" } | Select-Object -First 1
        if (-not $asset) {
            Write-Host "  $browser : no asset in $tag, skipped" -ForegroundColor Yellow
            continue
        }

        $zip = Join-Path $Temp $asset.name
        $staging = Join-Path $Root ".staging-$browser"
        $target = Join-Path $Root $browser
        try {
            Write-Host "  $browser : downloading $($asset.name)"
            Invoke-WebRequest -Uri $asset.browser_download_url -Headers $Headers -OutFile $zip -UseBasicParsing

            if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
            Expand-Archive -Path $zip -DestinationPath $staging -Force

            # Swap only after a successful extraction, so a failed run keeps
            # the previous install intact.
            if (Test-Path $target) { Remove-Item -Recurse -Force $target }
            Move-Item -Path $staging -Destination $target
            $installed += $browser
            Write-Host "  $browser : installed to $target" -ForegroundColor Green
        } catch {
            Write-Host "  $browser : failed - $($_.Exception.Message)" -ForegroundColor Red
            if (Test-Path $staging) { Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue }
        } finally {
            if (Test-Path $zip) { Remove-Item -Force $zip -ErrorAction SilentlyContinue }
        }
    }

    if ($installed.Count -eq 0) {
        Write-Host 'Nothing was installed.' -ForegroundColor Red
        return
    }
    Set-Content -Path (Join-Path $Root 'VERSION') -Value $tag

    Write-Host ''
    Write-Host "Typing Helper $tag is ready. Load it in your browser:" -ForegroundColor Cyan
    if ($installed -contains 'chrome') {
        Write-Host '  Chrome / Brave / Opera: chrome://extensions (brave://, opera://) -> Developer mode -> Load unpacked ->'
        Write-Host "    $(Join-Path $Root 'chrome')"
    }
    if ($installed -contains 'edge') {
        Write-Host '  Edge: edge://extensions -> Developer mode -> Load unpacked ->'
        Write-Host "    $(Join-Path $Root 'edge')"
    }
    if ($installed -contains 'firefox') {
        Write-Host '  Firefox: about:debugging#/runtime/this-firefox -> Load Temporary Add-on ->'
        Write-Host "    $(Join-Path (Join-Path $Root 'firefox') 'manifest.json')  (removed when Firefox closes)"
    }
    Write-Host ''
    Write-Host 'Already loaded? Just click Reload on the extension card to pick up the update.'
}

Install-TypingHelper
