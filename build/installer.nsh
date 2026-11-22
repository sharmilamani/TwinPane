; Adds Explorer right-click entries for the current user:
;   "Twinpane: Select left side"  and  "Twinpane: Compare with left side"
; on files and folders. Removed again on uninstall.

!macro customInstall
  WriteRegStr HKCU "Software\Classes\*\shell\TwinpaneLeft" "" "Twinpane: Select left side"
  WriteRegStr HKCU "Software\Classes\*\shell\TwinpaneLeft" "Icon" "$INSTDIR\Twinpane.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\TwinpaneLeft\command" "" '"$INSTDIR\Twinpane.exe" --select-left "%1"'
  WriteRegStr HKCU "Software\Classes\*\shell\TwinpaneCompare" "" "Twinpane: Compare with left side"
  WriteRegStr HKCU "Software\Classes\*\shell\TwinpaneCompare" "Icon" "$INSTDIR\Twinpane.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\TwinpaneCompare\command" "" '"$INSTDIR\Twinpane.exe" --compare-to "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\shell\TwinpaneLeft" "" "Twinpane: Select left side"
  WriteRegStr HKCU "Software\Classes\Directory\shell\TwinpaneLeft" "Icon" "$INSTDIR\Twinpane.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\TwinpaneLeft\command" "" '"$INSTDIR\Twinpane.exe" --select-left "%1"'
  WriteRegStr HKCU "Software\Classes\Directory\shell\TwinpaneCompare" "" "Twinpane: Compare with left side"
  WriteRegStr HKCU "Software\Classes\Directory\shell\TwinpaneCompare" "Icon" "$INSTDIR\Twinpane.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\TwinpaneCompare\command" "" '"$INSTDIR\Twinpane.exe" --compare-to "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\TwinpaneLeft"
  DeleteRegKey HKCU "Software\Classes\*\shell\TwinpaneCompare"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\TwinpaneLeft"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\TwinpaneCompare"
!macroend
