import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nemia.app',
  appName: 'NEMIA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'nemia.app', // Custom hostname to look more "native" / secure
    allowNavigation: [
      '*.mercadopago.com',
      '*.mercadopago.com.mx',
      '*.mercadocdn.com',
      'fonts.googleapis.com'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    }
  }
};

export default config;
