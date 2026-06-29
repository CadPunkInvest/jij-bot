; Default the reinstall page to "Do not uninstall" so wallet and grid data are never wiped.
; Must run in .onInit (PREREQUESTSADMINRIGHTS) — the reinstall page only sets $ReinstallPageCheck
; when it is 0, so seeding it to 2 here preserves "Do not uninstall" as the default.
!macro NSIS_HOOK_PREREQUESTSADMINRIGHTS
  StrCpy $ReinstallPageCheck 2
!macroend
