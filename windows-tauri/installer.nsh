!macro customInstall
  DetailPrint "Configuring Windows Defender Firewall for P2P Local Sync..."
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="CendrosyncP2P" dir=in action=allow protocol=TCP localport=52431 profile=any'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="CendrosyncP2P"'
!macroend
