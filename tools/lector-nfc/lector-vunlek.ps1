# Lector VUNLEK para ACR122U (y otros lectores NFC de PC/SC)
# 1) Lectura: al acercar una credencial escribe su numero de serie (UID) + Enter en la ventana activa,
#    como un lector tipo teclado (modo "Lector USB" de VUNLEK).
# 2) Grabacion: VUNLEK (Credenciales -> "Grabar con lector de PC") le pide grabar la direccion de la
#    credencial (https://www.vunlek.com/c/CODIGO) en etiquetas NTAG213/215/216. Esa direccion la abre un iPhone.
#    Solo acepta peticiones de esta misma computadora y solo direcciones de vunlek.com.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class VkPcsc {
    [StructLayout(LayoutKind.Sequential)]
    public struct SCARD_IO_REQUEST { public uint dwProtocol; public uint cbPciLength; }

    [DllImport("winscard.dll")] static extern int SCardEstablishContext(uint scope, IntPtr r1, IntPtr r2, out IntPtr ctx);
    [DllImport("winscard.dll")] static extern int SCardReleaseContext(IntPtr ctx);
    [DllImport("winscard.dll", CharSet = CharSet.Unicode)] static extern int SCardListReaders(IntPtr ctx, string groups, char[] readers, ref uint len);
    [DllImport("winscard.dll", CharSet = CharSet.Unicode)] static extern int SCardConnect(IntPtr ctx, string reader, uint share, uint proto, out IntPtr card, out uint active);
    [DllImport("winscard.dll")] static extern int SCardDisconnect(IntPtr card, uint disp);
    [DllImport("winscard.dll")] static extern int SCardTransmit(IntPtr card, ref SCARD_IO_REQUEST send, byte[] sendBuf, int sendLen, IntPtr recv, byte[] recvBuf, ref int recvLen);

    static IntPtr ctx = IntPtr.Zero;

    public static void Open() {
        if (ctx != IntPtr.Zero) return;
        int rc = SCardEstablishContext(2, IntPtr.Zero, IntPtr.Zero, out ctx);
        if (rc != 0) { ctx = IntPtr.Zero; throw new Exception("No se pudo iniciar el servicio de tarjetas inteligentes (codigo " + rc.ToString("X") + ")."); }
    }

    public static void Reset() {
        if (ctx != IntPtr.Zero) { SCardReleaseContext(ctx); ctx = IntPtr.Zero; }
    }

    public static string[] Readers() {
        Open();
        uint len = 0;
        int rc = SCardListReaders(ctx, null, null, ref len);
        if (rc != 0 || len == 0) return new string[0];
        char[] buf = new char[len];
        rc = SCardListReaders(ctx, null, buf, ref len);
        if (rc != 0) return new string[0];
        return new string(buf).Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
    }

    // Conecta con la tarjeta que este sobre el lector; IntPtr.Zero si no hay
    public static IntPtr Connect(string reader, out uint proto) {
        Open();
        IntPtr card;
        int rc = SCardConnect(ctx, reader, 2, 3, out card, out proto);
        if (rc != 0) return IntPtr.Zero;
        return card;
    }

    public static void Close(IntPtr card) {
        if (card != IntPtr.Zero) SCardDisconnect(card, 0);
    }

    // Envia un comando; regresa los datos si termina en 90 00, si no null
    public static byte[] Apdu(IntPtr card, uint proto, byte[] cmd) {
        SCARD_IO_REQUEST pci = new SCARD_IO_REQUEST();
        pci.dwProtocol = proto;
        pci.cbPciLength = 8;
        byte[] resp = new byte[300];
        int rlen = resp.Length;
        int rc = SCardTransmit(card, ref pci, cmd, cmd.Length, IntPtr.Zero, resp, ref rlen);
        if (rc != 0 || rlen < 2) return null;
        if (resp[rlen - 2] != 0x90 || resp[rlen - 1] != 0x00) return null;
        byte[] data = new byte[rlen - 2];
        Array.Copy(resp, data, rlen - 2);
        return data;
    }

    public static string Hex(byte[] b) {
        if (b == null) return null;
        return BitConverter.ToString(b).Replace("-", "");
    }
}
"@

$PORT = 47123
$script:reader = $null
$script:last = ''
$script:lastAt = [DateTime]::MinValue
$script:quietUntil = [DateTime]::MinValue   # tras grabar, no "teclear" esa credencial

function Find-Reader {
    $list = [VkPcsc]::Readers()
    $r = $list | Where-Object { $_ -match 'ACR122|ACS' } | Select-Object -First 1
    if (-not $r) { $r = $list | Select-Object -First 1 }
    return $r
}

function Read-Uid($card, $proto) {
    return [VkPcsc]::Hex([VkPcsc]::Apdu($card, $proto, [byte[]](0xFF, 0xCA, 0x00, 0x00, 0x00)))
}

# Mensaje NDEF con un solo registro URI
function New-NdefUrl([string]$url) {
    $prefix = 0x04; $rest = $url
    if ($url.StartsWith('https://www.')) { $prefix = 0x02; $rest = $url.Substring(12) }
    elseif ($url.StartsWith('https://')) { $prefix = 0x04; $rest = $url.Substring(8) }
    $text = [System.Text.Encoding]::ASCII.GetBytes($rest)
    $payloadLen = 1 + $text.Length
    $record = [byte[]](@(0xD1, 0x01, $payloadLen, 0x55, $prefix) + $text)
    $tlv = [byte[]](@(0x03, $record.Length) + $record + @(0xFE))
    $pad = (4 - ($tlv.Length % 4)) % 4
    if ($pad -gt 0) { $tlv = [byte[]]($tlv + (,0x00 * $pad)) }
    return $tlv
}

# Graba la direccion en la credencial que este (o se ponga) sobre el lector. Regresa un objeto para responder a VUNLEK.
function Write-Credential([string]$url) {
    $deadline = (Get-Date).AddSeconds(25)
    $mustRemove = $script:lastWritten
    while ((Get-Date) -lt $deadline) {
        $proto = [uint32]0
        $card = [VkPcsc]::Connect($script:reader, [ref]$proto)
        if ($card -eq [IntPtr]::Zero) { $mustRemove = ''; $script:lastWritten = ''; Start-Sleep -Milliseconds 200; continue }
        try {
            $uid = Read-Uid $card $proto
            if (-not $uid) { Start-Sleep -Milliseconds 200; continue }
            # La credencial recien grabada sigue encima: esperar a que pongan la siguiente
            if ($mustRemove -and $uid -eq $mustRemove) { Start-Sleep -Milliseconds 200; continue }

            $cc = [VkPcsc]::Apdu($card, $proto, [byte[]](0xFF, 0xB0, 0x00, 0x03, 0x10))
            if (-not $cc -or $cc[0] -ne 0xE1) {
                return @{ ok = $false; error = 'Esta credencial no es compatible (usa etiquetas NTAG213, NTAG215 o NTAG216; las MIFARE Classic no las lee un iPhone).' }
            }
            $data = New-NdefUrl $url
            $capacity = [int]$cc[2] * 8
            if ($capacity -gt 0 -and $data.Length -gt $capacity) { return @{ ok = $false; error = 'La credencial no tiene espacio suficiente.' } }

            for ($i = 0; $i -lt $data.Length; $i += 4) {
                $page = 4 + ($i / 4)
                $cmd = [byte[]](@(0xFF, 0xD6, 0x00, $page, 0x04) + $data[$i..($i + 3)])
                if ($null -eq [VkPcsc]::Apdu($card, $proto, $cmd)) {
                    return @{ ok = $false; error = 'No se pudo grabar: la credencial se movio o esta bloqueada. Dejala quieta sobre el lector e intenta de nuevo.' }
                }
            }
            # Verificar lo grabado
            for ($i = 0; $i -lt $data.Length; $i += 16) {
                $page = 4 + ($i / 4)
                $back = [VkPcsc]::Apdu($card, $proto, [byte[]](0xFF, 0xB0, 0x00, $page, 0x10))
                $n = [Math]::Min(16, $data.Length - $i)
                if (-not $back -or [VkPcsc]::Hex($back[0..($n - 1)]) -ne [VkPcsc]::Hex($data[$i..($i + $n - 1)])) {
                    return @{ ok = $false; error = 'La grabacion no se pudo comprobar. Intenta de nuevo.' }
                }
            }
            $script:lastWritten = $uid
            $script:last = $uid; $script:lastAt = Get-Date
            $script:quietUntil = (Get-Date).AddSeconds(4)
            Write-Host ("  {0}  Credencial grabada: {1}" -f (Get-Date -Format 'HH:mm:ss'), $uid) -ForegroundColor Green
            return @{ ok = $true; uid = $uid }
        } finally {
            [VkPcsc]::Close($card)
        }
    }
    return @{ ok = $false; timeout = $true }
}

# --- Servidor local (solo 127.0.0.1) para que VUNLEK pida grabar ---
$allowed = '^https://([a-z0-9-]+\.)*vunlek\.com$|^http://localhost(:\d+)?$|^capacitor://localhost$'

function Send-Response($stream, [int]$code, [string]$origin, $obj) {
    $body = if ($obj) { ($obj | ConvertTo-Json -Compress) } else { '' }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $status = @{ 200 = 'OK'; 204 = 'No Content'; 403 = 'Forbidden'; 404 = 'Not Found'; 400 = 'Bad Request' }[$code]
    $h = "HTTP/1.1 $code $status`r`nContent-Type: application/json`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n"
    if ($origin) {
        $h += "Access-Control-Allow-Origin: $origin`r`nVary: Origin`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`n"
        $h += "Access-Control-Allow-Headers: Content-Type`r`nAccess-Control-Allow-Private-Network: true`r`n"
    }
    $head = [System.Text.Encoding]::ASCII.GetBytes($h + "`r`n")
    $stream.Write($head, 0, $head.Length)
    if ($bytes.Length) { $stream.Write($bytes, 0, $bytes.Length) }
    $stream.Flush()
}

function Invoke-Request($client) {
    $client.ReceiveTimeout = 3000
    $stream = $client.GetStream()
    $sr = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $first = $sr.ReadLine()
    if (-not $first) { return }
    $parts = $first.Split(' ')
    $method = $parts[0]; $path = $parts[1]
    $headers = @{}
    while ($true) {
        $line = $sr.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { break }
        $k = $line.IndexOf(':')
        if ($k -gt 0) { $headers[$line.Substring(0, $k).Trim().ToLower()] = $line.Substring($k + 1).Trim() }
    }
    $origin = $headers['origin']
    $okOrigin = if ($origin -and $origin -match $allowed) { $origin } else { $null }
    if ($origin -and -not $okOrigin) { Send-Response $stream 403 $null @{ ok = $false; error = 'Origen no permitido' }; return }

    if ($method -eq 'OPTIONS') { Send-Response $stream 204 $okOrigin $null; return }
    if ($path -eq '/status') { Send-Response $stream 200 $okOrigin @{ ok = [bool]$script:reader; reader = $script:reader }; return }
    if ($path -eq '/write' -and $method -eq 'POST') {
        $len = [int]$headers['content-length']
        $buf = New-Object char[] $len
        $read = 0
        while ($read -lt $len) { $n = $sr.Read($buf, $read, $len - $read); if ($n -le 0) { break }; $read += $n }
        $url = $null
        try { $url = ([string]::new($buf, 0, $read) | ConvertFrom-Json).url } catch { }
        if (-not $url -or $url -notmatch '^https://www\.vunlek\.com/c/[A-Za-z0-9]{4,40}$') {
            Send-Response $stream 400 $okOrigin @{ ok = $false; error = 'Direccion no valida' }; return
        }
        if (-not $script:reader) { Send-Response $stream 200 $okOrigin @{ ok = $false; error = 'No encuentro el lector. Revisa que este conectado.' }; return }
        Write-Host '  VUNLEK pidio grabar una credencial: ponla sobre el lector...' -ForegroundColor Cyan
        $client.SendTimeout = 5000
        Send-Response $stream 200 $okOrigin (Write-Credential $url)
        return
    }
    Send-Response $stream 404 $okOrigin @{ ok = $false }
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $PORT)
try { $listener.Start() } catch {
    Write-Host '  El lector VUNLEK ya esta abierto en otra ventana. Cierra esta.' -ForegroundColor Yellow
    Start-Sleep -Seconds 8; exit
}
$script:lastWritten = ''

$host.UI.RawUI.WindowTitle = 'Lector VUNLEK'
Write-Host ''
Write-Host '  LECTOR VUNLEK  (ACR122U)' -ForegroundColor Cyan
Write-Host '  -----------------------------------------------'
Write-Host '  Deja esta ventana abierta (puedes minimizarla).'
Write-Host '  - Grabar credenciales: en VUNLEK > Credenciales,'
Write-Host '    boton "Grabar con lector de PC".'
Write-Host '  - Leer (entradas o ligar): en VUNLEK modo "Lector USB",'
Write-Host '    da clic en VUNLEK y acerca la credencial.'
Write-Host '  Para salir, cierra esta ventana.'
Write-Host ''

$warned = $false
while ($true) {
    try {
        if (-not $script:reader) {
            $script:reader = Find-Reader
            if ($script:reader) {
                Write-Host "  Lector listo: $($script:reader)" -ForegroundColor Green
                Write-Host '  Esperando credenciales...'; Write-Host ''
                $warned = $false
            } elseif (-not $warned) {
                Write-Host '  No encuentro el lector. Revisa que este conectado por USB.' -ForegroundColor Yellow
                $warned = $true
            }
        }

        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            try { Invoke-Request $client } catch { } finally { $client.Close() }
        }

        if ($script:reader) {
            $proto = [uint32]0
            $card = [VkPcsc]::Connect($script:reader, [ref]$proto)
            $uid = $null
            if ($card -ne [IntPtr]::Zero) { try { $uid = Read-Uid $card $proto } finally { [VkPcsc]::Close($card) } }
            if ($uid) {
                $repeat = ($uid -eq $script:last -and ((Get-Date) - $script:lastAt).TotalSeconds -le 4)
                if (-not $repeat -and (Get-Date) -gt $script:quietUntil) {
                    [System.Windows.Forms.SendKeys]::SendWait($uid + '{ENTER}')
                    Write-Host ("  {0}  Credencial leida: {1}" -f (Get-Date -Format 'HH:mm:ss'), $uid)
                }
                $script:last = $uid; $script:lastAt = Get-Date
            } elseif (((Get-Date) - $script:lastAt).TotalSeconds -gt 1) {
                $script:last = ''
            }
        }
    } catch {
        if (-not $warned) {
            Write-Host ("  Aviso: " + $_.Exception.Message) -ForegroundColor Yellow
            Write-Host '  Si habla del servicio: Windows + R, services.msc, enciende "Tarjeta inteligente".' -ForegroundColor Yellow
            $warned = $true
        }
        [VkPcsc]::Reset()
        $script:reader = $null
        Start-Sleep -Milliseconds 1500
    }
    Start-Sleep -Milliseconds 200
}
