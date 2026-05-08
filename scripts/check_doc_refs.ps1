param(
  [string[]]$DocDirs = @(
    "hello-claude-code",
    "hello-codex",
    "hello-gemini-cli",
    "hello-opencode",
    "hello-hermes"
  ),
  [switch]$StrictSuffix
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path ".").Path
$sourceRoots = @{
  "hello-claude-code" = @("claude-code")
  "hello-codex" = @("codex")
  "hello-gemini-cli" = @("gemini-cli")
  "hello-opencode" = @("opencode", "opencode/packages/opencode/src")
  "hello-hermes" = @("hermes-agent")
}

$extensions = "ts|tsx|rs|js|jsx|json|toml|yaml|yml|md|go|py"
$refPattern = "([A-Za-z0-9_./@+-]+\.($extensions)):(\d+)(?:-(\d+))?"
$allIssues = New-Object System.Collections.Generic.List[object]

function Convert-ToRepoPath([string]$path) {
  return ($path -replace "/", [IO.Path]::DirectorySeparatorChar)
}

function Resolve-RefPath([string]$docDir, [string]$refPath) {
  $normalized = Convert-ToRepoPath $refPath
  $candidates = New-Object System.Collections.Generic.List[string]
  $candidates.Add((Join-Path $repoRoot $normalized))

  foreach ($root in ($sourceRoots[$docDir] | Where-Object { $_ })) {
    $candidates.Add((Join-Path (Join-Path $repoRoot $root) $normalized))
  }

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  if ($StrictSuffix) {
    return $null
  }

  foreach ($root in ($sourceRoots[$docDir] | Where-Object { $_ })) {
    $rootPath = Join-Path $repoRoot $root
    if (-not (Test-Path -LiteralPath $rootPath)) {
      continue
    }

    $normalizedForward = $normalized -replace "\\", "/"
    $matches = Get-ChildItem -LiteralPath $rootPath -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $fullNameForward = $_.FullName -replace "\\", "/"
        $fullNameForward.EndsWith($normalizedForward, [StringComparison]::OrdinalIgnoreCase)
      }

    if (($matches | Measure-Object).Count -eq 1) {
      return $matches[0].FullName
    }
  }

  return $null
}

foreach ($docDir in $DocDirs) {
  if (-not (Test-Path -LiteralPath $docDir)) {
    continue
  }

  Get-ChildItem -LiteralPath $docDir -File -Filter "*.md" | ForEach-Object {
    $doc = $_
    $text = Get-Content -LiteralPath $doc.FullName -Raw

    [regex]::Matches($text, $refPattern) | ForEach-Object {
      $refPath = $_.Groups[1].Value
      $lineStart = [int]$_.Groups[3].Value
      $lineEnd = if ($_.Groups[4].Success) { [int]$_.Groups[4].Value } else { $lineStart }
      $resolved = Resolve-RefPath $docDir $refPath

      if (-not $resolved) {
        $allIssues.Add([pscustomobject]@{
          Doc = Resolve-Path -Relative $doc.FullName
          Ref = $_.Value
          Issue = "missing-file"
          Detail = "No source file resolved"
        })
        return
      }

      $lineCount = ([System.IO.File]::ReadLines($resolved) | Measure-Object).Count
      if ($lineStart -gt $lineCount -or $lineEnd -gt $lineCount) {
        $allIssues.Add([pscustomobject]@{
          Doc = Resolve-Path -Relative $doc.FullName
          Ref = $_.Value
          Issue = "line-out-of-range"
          Detail = "File has $lineCount lines"
        })
      }
    }
  }
}

if ($allIssues.Count -gt 0) {
  $allIssues | Sort-Object Doc, Ref | Format-Table -AutoSize
  Write-Error "Found $($allIssues.Count) invalid documentation source reference(s)."
}

Write-Output "Documentation source references OK."
