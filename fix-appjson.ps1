$json = Get-Content 'app.json' -Raw
$json = $json -replace '"icon":"./assets/icon.png",', ''
$json = $json -replace '"foregroundImage":"./assets/android-icon-foreground.png",', ''
$json = $json -replace '"backgroundImage":"./assets/android-icon-background.png",', ''
$json = $json -replace '"monochromeImage":"./assets/android-icon-monochrome.png"', ''
$json = $json -replace '"favicon":"./assets/favicon.png"', ''
Set-Content 'app.json' $json
Write-Output "Done"
