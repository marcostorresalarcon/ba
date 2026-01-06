import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bakitchenandbathdesigns.app',
  appName: 'BA Kitchen & Bath Design',
  webDir: 'dist/ba/browser',
  server: {
    // Configuraciones para mejorar el rendimiento del webview
    androidScheme: 'https',
    iosScheme: 'https',
    // Deshabilitar errores de CORS en desarrollo (solo para desarrollo)
    // hostname: 'localhost',
    // Permitir peticiones a dominios externos (S3)
    allowNavigation: [
      'https://*.s3.*.amazonaws.com',
      'https://*.s3.amazonaws.com',
      'https://ba-bucket-aws.s3.us-east-1.amazonaws.com'
    ]
  },
  android: {
    // Mejoras de rendimiento para Android
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  ios: {
    // Mejoras de rendimiento para iOS
    // El scroll se maneja automáticamente por el webview
  },
  plugins: {
    // Configuraciones de plugins que pueden afectar el scroll
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ead1ba',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#3a7344',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
