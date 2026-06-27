; Default the reinstall page to "Do not uninstall" so wallet and grid data are never wiped.
!macro NSIS_HOOK_PREINSTALL
  StrCpy $ReinstallPageCheck 2
!macroend
