; Instalador de Fénix AO para Windows (se compila con makensis).
Unicode true
!include "MUI2.nsh"

!ifndef APPDIR
  !define APPDIR "dist\win-unpacked"
!endif
!ifndef OUTFILE
  !define OUTFILE "dist\FenixAO-Instalador.exe"
!endif

Name "Fenix AO"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Fenix AO"
InstallDirRegKey HKCU "Software\FenixAO" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define MUI_ICON "icono.ico"
!define MUI_UNICON "icono.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a Fénix AO"
!define MUI_WELCOMEPAGE_TEXT "Este asistente va a instalar Fénix AO en tu computadora.$\r$\n$\r$\nHacé clic en Siguiente para continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Fenix AO.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Jugar Fénix AO ahora"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Section "Fenix AO" SecMain
  SetOutPath "$INSTDIR"
  ; Cierra el juego si está abierto
  nsExec::Exec 'taskkill /F /IM "Fenix AO.exe"'
  File /r "${APPDIR}\*.*"
  File "icono.ico"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "Software\FenixAO" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\FenixAO" "DisplayName" "Fenix AO"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\FenixAO" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\FenixAO" "DisplayIcon" "$INSTDIR\icono.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\FenixAO" "Publisher" "Fenix AO"
  CreateShortCut "$DESKTOP\Fenix AO.lnk" "$INSTDIR\Fenix AO.exe" "" "$INSTDIR\icono.ico"
  CreateDirectory "$SMPROGRAMS\Fenix AO"
  CreateShortCut "$SMPROGRAMS\Fenix AO\Fenix AO.lnk" "$INSTDIR\Fenix AO.exe" "" "$INSTDIR\icono.ico"
  CreateShortCut "$SMPROGRAMS\Fenix AO\Desinstalar.lnk" "$INSTDIR\Desinstalar.exe"
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM "Fenix AO.exe"'
  Delete "$DESKTOP\Fenix AO.lnk"
  RMDir /r "$SMPROGRAMS\Fenix AO"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\FenixAO"
  DeleteRegKey HKCU "Software\FenixAO"
SectionEnd
