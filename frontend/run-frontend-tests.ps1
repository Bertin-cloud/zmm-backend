Set-Location 'C:\Users\T.Bertin\Documents\z\zmm\frontend'
$env:CI='true'
npm test -- --watchAll=false --runInBand --passWithNoTests > run.log 2>&1
Write-Host "EXIT=$LASTEXITCODE"
