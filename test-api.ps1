$ErrorActionPreference = 'SilentlyContinue'
try {
    $body = '{"email":"tes@tes.com","password":"pass123","display_name":"tester"}'
    $r = Invoke-WebRequest -Uri 'https://east3-h1nv30nna-tenshi-xs-projects.vercel.app/api/auth/register' -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
    Write-Output "STATUS=$($r.StatusCode)"
    Write-Output "BODY=$($r.Content)"
} catch {
    Write-Output "ERROR=$($_.Exception.Message)"
}
