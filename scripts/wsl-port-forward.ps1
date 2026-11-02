param (
    [switch]$Reset
)

# ========================================================
# RESQ BhuRaksha - WSL2 LAN Access Port Forwarding Script
# Run this script in Windows PowerShell as Administrator
# ========================================================

# Check if running as Administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Please run PowerShell as Administrator to configure port forwarding and firewall rules."
    Exit
}

$ports = @(3000, 8000)

if ($Reset) {
    Write-Host "Resetting WSL2 port forwarding and firewall rules..." -ForegroundColor Yellow
    foreach ($port in $ports) {
        netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 | Out-Null
        Remove-NetFirewallRule -DisplayName "WSL2 RESQ (Port $port)" -ErrorAction SilentlyContinue
        Write-Host "  [OK] Removed portproxy and firewall rule for port $port" -ForegroundColor Green
    }
    Write-Host "Reset complete." -ForegroundColor Green
    Exit
}

# 1. Get WSL2 internal IP
$wslIp = (wsl hostname -I).Trim().Split(" ")[0]

if (-not $wslIp) {
    Write-Error "Could not detect WSL2 IP address. Ensure WSL is running (e.g. run 'wsl' first)."
    Exit
}

Write-Host "Detected WSL2 Internal IP: $wslIp" -ForegroundColor Cyan

# 2. Get Windows Host LAN IP for display
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "vEthernet|Loopback" -and $_.IPAddress -notmatch "169.254" } | Select-Object -First 1).IPAddress
Write-Host "Detected Windows Host LAN IP: $lanIp" -ForegroundColor Cyan

# 3. Configure port forwarding for ports 3000 (Vite) and 8000 (FastAPI)
$ports = @(3000, 8000)
foreach ($port in $ports) {
    # Remove any existing portproxy rule
    netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 | Out-Null
    
    # Add new portproxy rule
    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp
    Write-Host "  [OK] Port forwarding configured: 0.0.0.0:$port -> $wslIp:$port" -ForegroundColor Green
}

# 4. Configure Windows Firewall Inbound Rules
foreach ($port in $ports) {
    $ruleName = "WSL2 RESQ (Port $port)"
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow -Profile Any | Out-Null
    Write-Host "  [OK] Firewall rule created: Allow Inbound TCP $port" -ForegroundColor Green
}

Write-Host ""
Write-Host "SUCCESS! Your application is now accessible from other devices on the same Wi-Fi/LAN:" -ForegroundColor Green
if ($lanIp) {
    Write-Host "  Frontend: http://$($lanIp):3000" -ForegroundColor Yellow
    Write-Host "  Backend:  http://$($lanIp):8000" -ForegroundColor Yellow
    Write-Host "  API Docs: http://$($lanIp):8000/docs" -ForegroundColor Yellow
}
