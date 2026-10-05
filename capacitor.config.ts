import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nemia.app',
  appName: 'VUNLEK',
  webDir: 'dist',
  server: {
    allowNavigation: [
      'fonts.googleapis.com'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#42428F",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "large",
      spinnerColor: "#ffffff"
    },
    CapacitorHttp: {
      enabled: true
    },
    // Avisos del chat con el ícono y el sonido de VUNLEK
    LocalNotifications: {
      smallIcon: 'ic_stat_vunlek',
      iconColor: '#42428F'
    }
  }
};

export default config;
