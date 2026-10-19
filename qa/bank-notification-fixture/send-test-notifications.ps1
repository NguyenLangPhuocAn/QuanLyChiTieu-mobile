param(
    [string]$Device = 'emulator-5554',
    [string]$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
)

$cases = @(
    @{ Id = 101; Title = 'Bien dong so du'; Text = 'TK 1234 ghi no -125.000 VND tai GRAB. So du 3.450.000 VND' },
    @{ Id = 102; Title = 'Bien dong so du'; Text = 'TK 1234 nhan tien +2.000.000 VND. Noi dung LUONG THANG 10. So du 5.450.000 VND' },
    @{ Id = 103; Title = 'So du tai khoan'; Text = 'So du tai khoan 5.450.000 VND' },
    @{ Id = 104; Title = 'Ma OTP'; Text = 'Ma OTP 123456 cho giao dich 500.000 VND' }
)

foreach ($case in $cases) {
    $remoteCommand = "am broadcast -n vn.codex.banktest/.NotificationFixtureReceiver " +
        "-a vn.codex.banktest.POST --ei id $($case.Id) " +
        "--es title '$($case.Title)' --es text '$($case.Text)'"
    & $Adb -s $Device shell $remoteCommand
    Start-Sleep -Milliseconds 700
}
