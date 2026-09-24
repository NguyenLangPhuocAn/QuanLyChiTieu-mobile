param(
  [string]$SourceDirectory = (Join-Path $PSScriptRoot '..\demo-receipts-public-real'),
  [string]$AndroidDirectory = '/sdcard/Pictures/HoaDonMau'
)

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbCommand) {
  throw 'Không tìm thấy adb trong PATH.'
}

$devices = @(adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' })
if ($devices.Count -ne 1) {
  throw "Cần đúng 1 thiết bị Android đang kết nối; hiện có $($devices.Count)."
}

$supportedExtensions = @('.jpg', '.jpeg', '.png')
$images = @(
  Get-ChildItem -LiteralPath $SourceDirectory -File |
    Where-Object { $supportedExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name
)
if ($images.Count -ne 10) {
  throw "Bộ hóa đơn phải có đúng 10 ảnh JPG/JPEG/PNG; hiện có $($images.Count)."
}

adb shell mkdir -p $AndroidDirectory | Out-Null
foreach ($image in $images) {
  adb push $image.FullName "$AndroidDirectory/$($image.Name)" | Out-Null
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://$AndroidDirectory/$($image.Name)" | Out-Null
}

Write-Output "Đã thêm 10 hóa đơn vào album Pictures/HoaDonMau mà không mở ứng dụng."
