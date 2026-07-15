# Install NVIDIA ARDY (nv-tlabs/ardy) for Moonwell clip bake / local demo.
# Requires: Python 3.10+, CUDA GPU, VS Build Tools (cl), CMake, HF token for Llama-3-8B.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Venv = Join-Path $Root ".venv-ardy"
$Ardy = Join-Path $Root "third_party\ardy"
$Py310 = "C:\pinokio\bin\miniconda\python.exe"
if (-not (Test-Path $Py310)) {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { $Py310 = $cmd.Source } else { $Py310 = $null }
}
if (-not $Py310) { throw "Need Python 3.10+ on PATH (or Pinokio miniconda)." }

New-Item -ItemType Directory -Force -Path (Join-Path $Root "third_party") | Out-Null
if (-not (Test-Path (Join-Path $Ardy ".git"))) {
  git clone --depth 1 https://github.com/nv-tlabs/ardy.git $Ardy
}

if (-not (Test-Path $Venv)) {
  & $Py310 -m venv $Venv
}

$Python = Join-Path $Venv "Scripts\python.exe"
& $Python -m pip install --upgrade pip setuptools wheel
& $Python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
& $Python -m pip install "numpy>=1.23,<2"

$VsDev = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\Launch-VsDevShell.ps1"
if (Test-Path $VsDev) {
  & $VsDev -Arch amd64 -HostArch amd64 | Out-Null
}
$env:Path = "C:\Program Files\CMake\bin;" + $env:Path

Push-Location $Ardy
try {
  & $Python -m pip install -e .
  & $Python -m pip install "viser @ git+https://github.com/nv-tlabs/kimodo-viser.git@7c82ad8f8640bad9dff8ded5c5eee908eeb08f11" "gradio>=6.8.0" "trimesh>=4.0" "pandas>=2.0"
} finally {
  Pop-Location
}

& $Python -c "import torch, ardy, motion_correction; print('OK torch', torch.__version__, 'cuda', torch.cuda.is_available())"
Write-Host "ARDY ready. Bake: npm run ardy:bake  | Demo: npm run ardy:demo"
