# Sync Google Workspace SMTP env to Vercel (Production + Preview).
# Prerequisite: run `npx vercel login`
# Target project: apracticexamonline (www.apracticexamonline.com)
#
# Usage (PowerShell):
#   $env:SMTP_PASS = "your-16-char-app-password"
#   .\scripts\sync-vercel-mail-env.ps1

$ErrorActionPreference = "Stop"
$Project = "apracticexamonline"

if (-not $env:SMTP_PASS) {
  Write-Error "Set SMTP_PASS to the Google Workspace App Password before running."
}

$vars = @{
  MAIL_PROVIDER      = "smtp"
  SMTP_HOST          = "smtp.gmail.com"
  SMTP_PORT          = "587"
  SMTP_USER          = "info@apracticexamonline.com"
  SMTP_PASS          = $env:SMTP_PASS
  MAIL_FROM_EMAIL    = "info@apracticexamonline.com"
  MAIL_FROM_NAME     = "AP Practice Exam Online"
}

$remove = @("GMAIL_USER", "GMAIL_APP_PASSWORD", "MAIL_PROVIDER")

Write-Host "Removing legacy Gmail env vars from Vercel..."
foreach ($name in $remove) {
  npx vercel@latest env rm $name production --project $Project --yes 2>$null
  npx vercel@latest env rm $name preview --project $Project --yes 2>$null
}

Write-Host "Adding SMTP env vars to Production and Preview..."
foreach ($entry in $vars.GetEnumerator()) {
  $value = $entry.Value
  Write-Host "  $($entry.Key)"
  $value | npx vercel@latest env add $entry.Key production --project $Project --force
  $value | npx vercel@latest env add $entry.Key preview --project $Project --force
}

Write-Host ""
Write-Host "Done. Redeploy production for changes to take effect:"
Write-Host "  npx vercel@latest --prod --project $Project"
