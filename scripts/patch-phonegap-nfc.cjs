/**
 * phonegap-nfc 1.2.0 usa "Android Beam", que Google eliminó en Android 14 (API 34):
 * setNdefPushMessage, setOnNdefPushCompleteCallback, setBeamPushUris, isNdefPushEnabled y OnNdefPushCompleteCallback.
 * Este script quita esas llamadas (VUNLEK no usa Beam) para que compile.
 * Además, en Android 12+ el PendingIntent debe declarar FLAG_MUTABLE o la app se cierra al usar NFC.
 * Corre solo después de "npm install" y se puede correr a mano: node scripts/patch-phonegap-nfc.cjs
 */
const fs = require('fs')
const path = require('path')

const files = [
    'node_modules/phonegap-nfc/src/android/src/com/chariotsolutions/nfc/plugin/NfcPlugin.java',
    'android/capacitor-cordova-android-plugins/src/main/java/com/chariotsolutions/nfc/plugin/NfcPlugin.java',
].map(f => path.join(__dirname, '..', f))

for (const file of files) {
    if (!fs.existsSync(file)) continue
    let s = fs.readFileSync(file, 'utf8')
    if (s.includes('VUNLEK: sin Android Beam') && s.includes('FLAG_MUTABLE') && !s.includes('isNdefPushEnabled()')) { console.log('ya parchado:', path.relative(process.cwd(), file)); continue }
    s = s
        .replace(/\s+implements\s+NfcAdapter\.OnNdefPushCompleteCallback/, ' /* VUNLEK: sin Android Beam */')
        .replace(/^(\s*)(nfcAdapter\.(setNdefPushMessage|setOnNdefPushCompleteCallback|setBeamPushUris)\([^;]*\);)/gm, '$1// $2')
        .replace(/import android\.nfc\.NfcEvent;\s*\n/, '')
        .replace(/@Override\s*\n(\s*)public void onNdefPushComplete\(NfcEvent event\)/, '$1public void onNdefPushComplete(Object event)')
        .replace(/!nfcAdapter\.isNdefPushEnabled\(\)/g, 'true /* VUNLEK: Beam no existe */')
        .replace('PendingIntent.getActivity(activity, 0, intent, 0)',
            'PendingIntent.getActivity(activity, 0, intent, android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0)')
    fs.writeFileSync(file, s)
    console.log('parchado:', path.relative(process.cwd(), file))
}
