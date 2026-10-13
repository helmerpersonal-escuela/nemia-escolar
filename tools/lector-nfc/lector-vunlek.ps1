# Lector VUNLEK para ACR122U (y otros lectores NFC de PC/SC)
# Al acercar una credencial, lee su número de serie (UID) y lo "escribe" + Enter
# en la ventana que tenga el foco, como un lector tipo teclado.
# Úsalo con VUNLEK en el modo "Lector USB" (Credenciales o Control de acceso).

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

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

    // Regresa el UID en hexadecimal o null si no hay tarjeta
    public static string ReadUid(string reader) {
        Open();
        IntPtr card; uint proto;
        int rc = SCardConnect(ctx, reader, 2, 3, out card, out proto);
        if (rc != 0) return null;
        try {
            SCARD_IO_REQUEST pci = new SCARD_IO_REQUEST();
            pci.dwProtocol = proto;
            pci.cbPciLength = 8;
            byte[] cmd = new byte[] { 0xFF, 0xCA, 0x00, 0x00, 0x00 };
            byte[] resp = new byte[64];
            int rlen = resp.Length;
            rc = SCardTransmit(card, ref pci, cmd, cmd.Length, IntPtr.Zero, resp, ref rlen);
            if (rc != 0 || rlen < 3) return null;
            if (resp[rlen - 2] != 0x90 || resp[rlen - 1] != 0x00) return null;
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < rlen - 2; i++) sb.Append(resp[i].ToString("X2"));
            return sb.ToString();
        } finally {
            SCardDisconnect(card, 0);
        }
    }
}
"@

$host.UI.RawUI.WindowTitle = 'Lector VUNLEK'
Write-Host ''
Write-Host '  LECTOR VUNLEK  (ACR122U)' -ForegroundColor Cyan
Write-Host '  -----------------------------------------------'
Write-Host '  1. Deja esta ventana abierta (puedes minimizarla).'
Write-Host '  2. En VUNLEK elige el modo "Lector USB" y da clic'
Write-Host '     en la pantalla de VUNLEK para que tenga el foco.'
Write-Host '  3. Acerca la credencial al lector.'
Write-Host '  Para salir, cierra esta ventana.'
Write-Host ''

$last = ''
$lastAt = [DateTime]::MinValue
$reader = $null
$warned = $false

while ($true) {
    try {
        if (-not $reader) {
            $list = [VkPcsc]::Readers()
            $reader = $list | Where-Object { $_ -match 'ACR122|ACS' } | Select-Object -First 1
            if (-not $reader) { $reader = $list | Select-Object -First 1 }
            if ($reader) {
                Write-Host "  Lector listo: $reader" -ForegroundColor Green
                Write-Host '  Esperando credenciales...' ; Write-Host ''
                $warned = $false
            } elseif (-not $warned) {
                Write-Host '  No encuentro el lector. Revisa que este conectado por USB.' -ForegroundColor Yellow
                $warned = $true
            }
        }
        if ($reader) {
            $uid = [VkPcsc]::ReadUid($reader)
            if ($uid) {
                # La misma credencial sigue sobre el lector: no repetir
                if ($uid -ne $last -or ((Get-Date) - $lastAt).TotalSeconds -gt 4) {
                    [System.Windows.Forms.SendKeys]::SendWait($uid + '{ENTER}')
                    Write-Host ("  {0}  Credencial leida: {1}" -f (Get-Date -Format 'HH:mm:ss'), $uid) -ForegroundColor White
                }
                $last = $uid
                $lastAt = Get-Date
            } elseif (((Get-Date) - $lastAt).TotalSeconds -gt 1) {
                $last = ''
            }
        }
    } catch {
        if (-not $warned) {
            Write-Host ("  Aviso: " + $_.Exception.Message) -ForegroundColor Yellow
            Write-Host '  Si dice "servicio", abre services.msc y enciende "Tarjeta inteligente".' -ForegroundColor Yellow
            $warned = $true
        }
        [VkPcsc]::Reset()
        $reader = $null
        Start-Sleep -Milliseconds 1500
    }
    Start-Sleep -Milliseconds 250
}
