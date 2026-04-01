; =============================================================
; SyncFlow – Windows Firewall rules
; Injected into the NSIS installer via nsis.include.
;
; Rule names are kept stable across versions so upgrades are
; idempotent: the old rule is deleted before the new one is
; added with the updated $INSTDIR path.
; =============================================================

!define SF_RULE_TCP  "SyncFlow Sidecar TCP"
!define SF_RULE_MDNS "SyncFlow mDNS UDP"

; -------------------------------------------------------------
; Install / Upgrade
; -------------------------------------------------------------
!macro customInstall
  DetailPrint "Configuring Windows Firewall rules for SyncFlow..."

  ; Delete stale rules first.  netsh exits non-zero when no matching rule
  ; exists – that is expected on a fresh install, so we ignore the return code.
  nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="${SF_RULE_TCP}"'
  Pop $R0
  Pop $R1
  nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="${SF_RULE_MDNS}"'
  Pop $R0
  Pop $R1

  ; TCP 39393 – iPhone → sidecar file-transfer, scoped to the sidecar
  ; executable and restricted to the local subnet.
  nsExec::ExecToStack 'netsh advfirewall firewall add rule name="${SF_RULE_TCP}" dir=in action=allow protocol=TCP localport=39393 program="$INSTDIR\resources\syncflow-sidecar.exe" remoteip=localsubnet description="SyncFlow sidecar file transfer (TCP 39393)"'
  Pop $R0
  Pop $R1

  ; UDP 5353 – Bonjour/mDNS multicast used by mDNSResponder (Bonjour
  ; Service).  Not scoped to a program because the traffic originates from
  ; the Windows service process, not from dns-sd.exe.
  nsExec::ExecToStack 'netsh advfirewall firewall add rule name="${SF_RULE_MDNS}" dir=in action=allow protocol=UDP localport=5353 remoteip=localsubnet description="SyncFlow Bonjour/mDNS discovery (UDP 5353)"'
  Pop $R0
  Pop $R1

  DetailPrint "Windows Firewall rules configured."
!macroend

; -------------------------------------------------------------
; Uninstall
; -------------------------------------------------------------
!macro customUnInstall
  DetailPrint "Removing SyncFlow Windows Firewall rules..."
  nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="${SF_RULE_TCP}"'
  Pop $R0
  Pop $R1
  nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="${SF_RULE_MDNS}"'
  Pop $R0
  Pop $R1
!macroend
