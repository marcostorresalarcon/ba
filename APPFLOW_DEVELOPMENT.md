# Configuración para Appflow → Development (Debug)

Checklist para desplegar una versión de desarrollo (debug) vía Ionic Appflow para pruebas internas.

## ✅ Verificación de Desarrollo

### 1. Build y entorno
- [x] **package.json** script: `build:appflow:dev` (usa `--configuration=development`)
- [x] **environment.ts** configurado para desarrollo (API de dev, S3 de dev)
- [x] **angular.json**: La configuración `development` tiene `optimization: false` y `sourceMap: true`.

### 2. Capacitor
- [x] **capacitor.config.ts** `appId`: `com.bakitchenandbathdesigns.app`
- [x] **capacitor.config.ts** `appName`: `BA Kitchen & Bath (Dev)`
- [x] **android**: `webContentsDebuggingEnabled: true` para poder inspeccionar desde Chrome DevTools.

### 3. iOS (Development)
- [x] **Signing (Appflow)**: Debe usarse un certificado de **Apple Development** y un **Development Provisioning Profile**.
- [x] **Appflow Build Type**: Seleccionar **Development** en lugar de App Store.
- [x] **Bundle ID**: `com.bakitchenandbathdesigns.app` (Team ID: `5G8B5KR88X`)

---

## 🚀 Cómo lanzar el build en Appflow

1. Asegúrate de que los cambios en `capacitor.config.ts` y `package.json` estén en la rama correcta.
2. En la consola de **Appflow**:
   - Ve a **Builds** → **New Build**.
   - **Branch**: Selecciona tu rama de desarrollo.
   - **Platform**: iOS o Android.
   - **Build Type**: 
     - Para iOS: **Development** (esto generará un `.ipa` para instalar en dispositivos registrados).
     - Para Android: **Debug** (genera un `.apk` instalable directamente).
   - **Build Command**: `npm run build:appflow:dev`.
   - **Signing Config**: Selecciona las credenciales de desarrollo correspondientes a `com.bakitchenandbathdesigns.appdev`.

## ⚠️ Notas importantes
- El `appId` ha cambiado a `.appdev`. Esto significa que se instalará como una aplicación separada de la de producción en el dispositivo.
- Los logs de la consola web serán visibles si conectas el dispositivo a Safari (iOS) o Chrome (Android) remoto.
