$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$userDataDir = Join-Path $env:TEMP "cdp-test-profile"
$shotDir = "C:\Users\Kevin.Chovanec\Desktop\CoP Examples\embedding-explorer\scripts\screenshots"
New-Item -ItemType Directory -Force -Path $shotDir | Out-Null
if (Test-Path $userDataDir) { Remove-Item -Recurse -Force $userDataDir }

$proc = Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new","--disable-gpu","--remote-debugging-port=9333",
  "--user-data-dir=$userDataDir","--no-first-run","--no-default-browser-check",
  "about:blank"
) -PassThru

try {
  $target = $null
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $targets = Invoke-RestMethod -Uri "http://localhost:9333/json"
      $target = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
      if ($target) { break }
    } catch {}
  }
  if (-not $target) { throw "Could not find page target" }

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $uri = [Uri]$target.webSocketDebuggerUrl
  $cts = New-Object System.Threading.CancellationTokenSource
  $ws.ConnectAsync($uri, $cts.Token).GetAwaiter().GetResult() | Out-Null

  $msgId = 0
  function Send-Cdp($method, $params) {
    $script:msgId++
    $id = $script:msgId
    $obj = @{ id = $id; method = $method; params = $params }
    $json = $obj | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $seg = New-Object System.ArraySegment[byte] (,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).GetAwaiter().GetResult() | Out-Null
    return $id
  }

  function Receive-OneMessage($perReadTimeoutMs = 30000) {
    $buffer = New-Object byte[] 65536
    $ms = New-Object System.IO.MemoryStream
    while ($true) {
      $seg = New-Object System.ArraySegment[byte] (,$buffer)
      $readCts = [System.Threading.CancellationTokenSource]::CreateLinkedTokenSource($cts.Token)
      $readCts.CancelAfter($perReadTimeoutMs)
      $result = $ws.ReceiveAsync($seg, $readCts.Token).GetAwaiter().GetResult()
      $ms.Write($buffer, 0, $result.Count)
      if ($result.EndOfMessage) { break }
    }
    return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
  }

  function Receive-CdpUntil($id, $timeoutMs = 30000) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt $timeoutMs) {
      $remaining = [Math]::Max(1000, $timeoutMs - $sw.ElapsedMilliseconds)
      $text = Receive-OneMessage $remaining
      try {
        $parsed = $text | ConvertFrom-Json
      } catch { continue }
      if ($parsed.id -eq $id) { return $parsed }
    }
    throw "Timed out waiting for CDP response id=$id"
  }

  function Eval-Js($expr, $awaitPromise = $false, $timeoutMs = 30000) {
    $id = Send-Cdp "Runtime.evaluate" @{ expression = $expr; returnByValue = $true; awaitPromise = $awaitPromise }
    $resp = Receive-CdpUntil $id $timeoutMs
    if ($resp.result.exceptionDetails) {
      return "JS ERROR: $($resp.result.exceptionDetails.exception.description)"
    }
    return $resp.result.result.value
  }

  function Screenshot($name) {
    $id = Send-Cdp "Page.captureScreenshot" @{ format = "png" }
    $resp = Receive-CdpUntil $id 15000
    $bytes = [Convert]::FromBase64String($resp.result.data)
    $path = Join-Path $shotDir $name
    [System.IO.File]::WriteAllBytes($path, $bytes)
    Write-Output "Saved screenshot: $path"
  }

  Send-Cdp "Page.enable" @{} | Out-Null
  Send-Cdp "Runtime.enable" @{} | Out-Null

  $errCaptureScript = @"
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push('error: ' + e.message));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
"@
  Send-Cdp "Page.addScriptToEvaluateOnNewDocument" @{ source = $errCaptureScript } | Out-Null

  $navId = Send-Cdp "Page.navigate" @{ url = "http://localhost:8420/index.html" }
  Receive-CdpUntil $navId 10000 | Out-Null
  Start-Sleep -Seconds 1

  Write-Output "--- Waiting for GloVe status ready ---"
  $statusResult = Eval-Js @"
new Promise((resolve) => {
  const start = Date.now();
  const check = () => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text').textContent;
    if (dot.classList.contains('ready') || Date.now() - start > 20000) {
      resolve({ ready: dot.classList.contains('ready'), text });
    } else {
      setTimeout(check, 300);
    }
  };
  check();
})
"@ $true 25000
  Write-Output ("status: " + ($statusResult | ConvertTo-Json -Compress))
  Screenshot "01-loaded.png"

  Write-Output "--- Word lookup: king ---"
  $wordResult = Eval-Js @"
(function() {
  const input = document.getElementById('word-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'king');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})();
new Promise((resolve) => setTimeout(() => {
  resolve({
    errorHidden: document.getElementById('word-error').hidden,
    errorText: document.getElementById('word-error').textContent,
    resultsHidden: document.getElementById('word-results').hidden,
    chartBars: document.getElementById('word-chart').children.length,
    neighborsText: document.getElementById('word-neighbors').innerText,
  });
}, 600))
"@ $true 10000
  Write-Output ("word lookup: " + ($wordResult | ConvertTo-Json -Compress))
  Screenshot "02-word-king.png"

  Write-Output "--- Analogy preset: king - man + woman ---"
  $analogyResult = Eval-Js @"
document.querySelectorAll('#analogy-presets button')[0].click();
new Promise((resolve) => setTimeout(() => {
  resolve({
    resultsHidden: document.getElementById('analogy-results').hidden,
    errorHidden: document.getElementById('analogy-error').hidden,
    errorText: document.getElementById('analogy-error').textContent,
    neighborsText: document.getElementById('analogy-neighbors').innerText,
  });
}, 500))
"@ $true 10000
  Write-Output ("analogy: " + ($analogyResult | ConvertTo-Json -Compress))

  Write-Output "--- Switch to analogy tab + screenshot ---"
  Eval-Js "document.querySelector(`"nav.tabs button[data-tab='analogy']`").click();" | Out-Null
  Start-Sleep -Milliseconds 300
  Screenshot "03-analogy.png"

  Write-Output "--- Similarity: king vs queen (GloVe path) ---"
  Eval-Js "document.querySelector(`"nav.tabs button[data-tab='similarity']`").click();" | Out-Null
  $simResult = Eval-Js @"
(function() {
  document.getElementById('sim-a').value = 'king';
  document.getElementById('sim-b').value = 'queen';
  document.getElementById('sim-run').click();
})();
new Promise((resolve) => setTimeout(() => {
  resolve({
    resultsHidden: document.getElementById('sim-results').hidden,
    errorHidden: document.getElementById('sim-error').hidden,
    errorText: document.getElementById('sim-error').textContent,
    value: document.getElementById('sim-value').textContent,
    method: document.getElementById('sim-method').textContent,
  });
}, 800))
"@ $true 10000
  Write-Output ("similarity (glove): " + ($simResult | ConvertTo-Json -Compress))
  Screenshot "04-similarity-glove.png"

  Write-Output "--- Similarity: transformer path (multi-word text) ---"
  $simTransformerResult = Eval-Js @"
(function() {
  document.getElementById('sim-a').value = 'a happy dog running in a field';
  document.getElementById('sim-b').value = 'a joyful puppy sprinting through grass';
  document.getElementById('sim-run').click();
})();
new Promise((resolve) => {
  const start = Date.now();
  const check = () => {
    const btn = document.getElementById('sim-run');
    if (!btn.disabled || Date.now() - start > 60000) {
      resolve({
        resultsHidden: document.getElementById('sim-results').hidden,
        errorHidden: document.getElementById('sim-error').hidden,
        errorText: document.getElementById('sim-error').textContent,
        value: document.getElementById('sim-value').textContent,
        method: document.getElementById('sim-method').textContent,
        timedOut: Date.now() - start > 60000,
      });
    } else {
      setTimeout(check, 400);
    }
  };
  setTimeout(check, 400);
})
"@ $true 65000
  Write-Output ("similarity (transformer): " + ($simTransformerResult | ConvertTo-Json -Compress))
  Screenshot "05-similarity-transformer.png"

  Write-Output "--- Paragraph Space ---"
  Eval-Js "document.querySelector(`"nav.tabs button[data-tab='space']`").click();" | Out-Null
  $spaceResult = Eval-Js @"
document.getElementById('space-run').click();
new Promise((resolve) => {
  const start = Date.now();
  const check = () => {
    const btn = document.getElementById('space-run');
    if (!btn.disabled || Date.now() - start > 60000) {
      resolve({
        resultsHidden: document.getElementById('space-results').hidden,
        errorHidden: document.getElementById('space-error').hidden,
        errorText: document.getElementById('space-error').textContent,
        scatterPoints: document.querySelectorAll('#space-chart circle').length,
        tableHtmlLen: document.getElementById('space-table').innerHTML.length,
        timedOut: Date.now() - start > 60000,
      });
    } else {
      setTimeout(check, 400);
    }
  };
  setTimeout(check, 400);
})
"@ $true 65000
  Write-Output ("paragraph space: " + ($spaceResult | ConvertTo-Json -Compress))
  Screenshot "06-paragraph-space.png"

  Write-Output "--- Window errors captured ---"
  $consoleCheck = Eval-Js "JSON.stringify(window.__errors)"
  Write-Output $consoleCheck

} finally {
  if ($ws -and $ws.State -eq 'Open') { $ws.Abort() }
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
