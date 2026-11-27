param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$doc = Get-Content -LiteralPath $Source -Raw | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en' })
    if ($voices.Count -eq 0) { throw 'No installed English speech voice' }
    $format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    foreach ($hero in $doc.heroes) {
        $matching = @($voices | Where-Object { $_.VoiceInfo.Gender.ToString() -eq $hero.gender })
        $voice = if ($matching.Count -gt 0) { $matching[0] } else { $voices[0] }
        $synth.SelectVoice($voice.VoiceInfo.Name)
        $synth.Rate = [int]$hero.rate
        $synth.Volume = 85
        foreach ($slot in @('selection','ultimate')) {
            $path = Join-Path $Destination ($hero.id + '_' + $slot + '.wav')
            $synth.SetOutputToWaveFile($path,$format)
            $synth.Speak([string]$hero.$slot)
            $synth.SetOutputToNull()
        }
    }
    $announcer = $doc.announcer
    $matching = @($voices | Where-Object { $_.VoiceInfo.Gender.ToString() -eq $announcer.gender })
    $voice = if ($matching.Count -gt 0) { $matching[0] } else { $voices[0] }
    $synth.SelectVoice($voice.VoiceInfo.Name)
    $synth.Rate = [int]$announcer.rate
    $synth.SetOutputToWaveFile((Join-Path $Destination 'announcer_battle_start.wav'),$format)
    $synth.Speak([string]$announcer.battleStart)
    $synth.SetOutputToNull()
} finally { $synth.Dispose() }
