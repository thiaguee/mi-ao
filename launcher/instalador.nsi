; Instalador de Norway AO para Windows (se compila con makensis).
Unicode true
!include "MUI2.nsh"

!ifndef APPDIR
  !define APPDIR "dist\win-unpacked"
!endif
!ifndef OUTFILE
  !define OUTFILE "dist\NorwayAO-Instalador.exe"
!endif

Name "Norway AO"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Norway AO"
InstallDirRegKey HKCU "Software\NorwayAO" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define MUI_ICON "icono.ico"
!define MUI_UNICON "icono.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a Norway AO"
!define MUI_WELCOMEPAGE_TEXT "Este asistente va a instalar Norway AO en tu computadora.$\r$\n$\r$\nHacé clic en Siguiente para continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Norway AO.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Jugar Norway AO ahora"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Section "Norway AO" SecMain
  SetOutPath "$INSTDIR"
  ; Cierra el juego si está abierto
  nsExec::Exec 'taskkill /F /IM "Norway AO.exe"'
  File /r "${APPDIR}\*.*"
  File "icono.ico"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "Software\NorwayAO" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NorwayAO" "DisplayName" "Norway AO"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NorwayAO" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NorwayAO" "DisplayIcon" "$INSTDIR\icono.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NorwayAO" "Publisher" "Norway AO"
  CreateShortCut "$DESKTOP\Norway AO.lnk" "$INSTDIR\Norway AO.exe" "" "$INSTDIR\icono.ico"
  CreateDirectory "$SMPROGRAMS\Norway AO"
  CreateShortCut "$SMPROGRAMS\Norway AO\Norway AO.lnk" "$INSTDIR\Norway AO.exe" "" "$INSTDIR\icono.ico"
  CreateShortCut "$SMPROGRAMS\Norway AO\Desinstalar.lnk" "$INSTDIR\Desinstalar.exe"
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM "Norway AO.exe"'
  Delete "$DESKTOP\Norway AO.lnk"
  RMDir /r "$SMPROGRAMS\Norway AO"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NorwayAO"
  DeleteRegKey HKCU "Software\NorwayAO"
SectionEnd
