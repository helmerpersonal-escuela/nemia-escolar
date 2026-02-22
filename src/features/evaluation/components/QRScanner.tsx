import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, XCircle } from 'lucide-react'

interface QRScannerProps {
    onScanSuccess: (decodedText: string) => void
    onScanError?: (errorMessage: string) => void
    onClose: () => void
}

export const QRScanner = ({ onScanSuccess, onScanError, onClose }: QRScannerProps) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null)
    const [isScanning, setIsScanning] = useState(true)

    useEffect(() => {
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        }

        const html5QrcodeScanner = new Html5QrcodeScanner("reader", config, false)
        scannerRef.current = html5QrcodeScanner

        html5QrcodeScanner.render(
            (decodedText) => {
                onScanSuccess(decodedText)
                // We keep scanning allowing rapid-fire attendance
            },
            (error) => {
                if (onScanError) onScanError(error)
            }
        )

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => console.error("Failed to clear html5QrcodeScanner. ", error))
            }
        }
    }, [onScanSuccess, onScanError])

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[60] bg-white/80 backdrop-blur text-slate-500 hover:text-rose-500 p-2 rounded-full transition-colors shadow-sm"
                >
                    <XCircle className="w-6 h-6" />
                </button>
                <div id="reader" className="w-full bg-slate-900 min-h-[300px]" style={{ border: 'none' }}></div>
            </div>
            <div className="flex items-center text-sm font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-full">
                <Camera className="w-4 h-4 mr-2" />
                Cámara Activa - Muestra el código QR
            </div>
        </div>
    )
}
