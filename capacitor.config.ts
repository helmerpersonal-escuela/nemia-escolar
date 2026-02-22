import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nemia.app',
  appName: 'VUNLEK',
  webDir: 'dist',
  server: {
    allowNavigation: [
      '*.mercadopago.com',
      '*.mercadopago.com.mx',
      '*.mercadocdn.com',
      'fonts.googleapis.com'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#4f46e5",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "large",
      spinnerColor: "#ffffff"
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
