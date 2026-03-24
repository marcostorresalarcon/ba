# Configuración para Appflow → App Store

Checklist para verificar que el proyecto está listo para desplegar en App Store vía Ionic Appflow.

## ✅ Verificación de producción

### 1. Build y entorno
- [x] **package.json** `version`: 1.2.0
- [x] **angular.json** `defaultConfiguration`: production
- [x] **environment.production.ts** con API y S3 de producción
- [x] **fileReplacements** en producción usa `environment.production.ts`

### 2. Capacitor
- [x] **capacitor.config.ts** `appId`: com.bakitchenandbathdesigns.app (ajustar a `appprod` en rama de store si aplica)
- [x] **capacitor.config.ts** `appName`: **BA Kitchen & Bath Design**
- [x] **webDir**: dist/ba/browser (coincide con salida de Angular)

### 3. iOS (Release / App Store)
- [x] **project.pbxproj** Release: `PRODUCT_BUNDLE_IDENTIFIER` = com.bakitchenandbathdesigns.appprod
- [x] **project.pbxproj** Release: `CODE_SIGN_STYLE` = Automatic
- [x] **project.pbxproj** Release: `CODE_SIGN_IDENTITY` = Apple Distribution
- [x] **project.pbxproj** `MARKETING_VERSION` = 1.2.0
- [x] **project.pbxproj** `CURRENT_PROJECT_VERSION` = 7
- [x] **Info.plist** `CFBundleDisplayName` = BA Kitchen & Bath Design
- [x] **exportOptions.plist** method = app-store

### 4. Iconos y splash
- [x] **Fuente del logo**: `public/BA APP Logo Blanco-02.png` (oro sobre blanco)
- [x] Script: `npm run generate:icons` → copia a `assets/logo.png` y ejecuta `@capacitor/assets`
- [x] Fondos icono: claro `#FFFFFF`, oscuro `#332F28`; splash: `#ead1ba` / `#332F28`
- [x] Tras generar: `npx cap sync` (o `npm run sync:ios`) y commit de `ios/…/AppIcon.appiconset/`, `android/app/src/main/res/mipmap-*`, `icons/`, etc.

---

## 🚀 Configuración en Appflow

### Build command (opcional)
En **Appflow → Tu app → Build → Native build configuration**:

- **Build command**: `npm run build:appflow`  
  (genera iconos + build producción; si los iconos ya están en el repo, `npm run build` es suficiente)

- O dejar por defecto: `npm run build`

### Signing (App Store)
- **Build type**: App Store (Release)
- **Signing certificate**: Apple Distribution
- **Provisioning profile**: Perfil de distribución para `com.bakitchenandbathdesigns.appprod`  
  - Nombre en `exportOptions.plist`: `Bakitcheandbathdesigns Profile Prod`

### Checklist antes de lanzar build
1. Commit y push de todos los cambios (incluidos iconos en `ios/App/App/Assets.xcassets/`)
2. En Appflow, seleccionar el commit correcto
3. Plataforma: **iOS**
4. Build type: **App Store**
5. Signing config con perfil de distribución correcto

---

## ⚠️ Notas

- **Stripe**: `environment.production.ts` tiene `stripePublicKey: 'pk_test_placeholder'`. Sustituir por `pk_live_...` cuando vayas a cobros reales.
- **Secrets**: Las claves S3 y API están en `environment.production.ts`. Para mayor seguridad, considera usar variables de entorno en Appflow y un build step que genere el archivo.

---

## Solución de errores al subir a TestFlight / App Store (Fastlane / altool)

### `FORBIDDEN_ERROR.CONTRACT_NOT_VALID` — *You do not have required contracts*

**No se arregla en el repositorio ni en Xcode.** Apple bloquea la subida hasta que la cuenta del programa de desarrolladores tenga los acuerdos al día.

1. Entra como **Account Holder** o **Admin** en [App Store Connect](https://appstoreconnect.apple.com/) → revisa avisos en rojo o banner de **Agreements, Tax, and Banking**.
2. Entra en [developer.apple.com/account](https://developer.apple.com/account) → **Agreements** → acepta el **Apple Developer Program License Agreement** y cualquier **Paid Applications Agreement** / **Free Apps Agreement** pendiente.
3. Completa **Tax** y **Banking** si la app es de pago o tiene compras dentro de la app.
4. Espera unos minutos tras firmar; vuelve a lanzar el deploy en Appflow.

Sin esto, `upload_ipa_to_app_store` / `altool` seguirá devolviendo **403 CONTRACT_NOT_VALID**.

### *Team ID supplied (5G8B5KR88X) does not appear to be a team of which you are a member*

El **Apple ID** que usa Appflow (usuario de Transporter / API Key / contraseña de aplicación) **no pertenece** al equipo `5G8B5KR88X`, o el Team ID en la config ya no es el correcto.

1. En Appflow, revisa **qué credenciales** usan el paso de subida a App Store (mismo Apple ID que firma el IPA).
2. En [developer.apple.com/account#MembershipDetailsCard](https://developer.apple.com/account) confirma el **Team ID** real de la organización que posee la app `6755149730`.
3. Si el Team ID cambió, actualiza **Appflow** (signing / variables) y, en el repo, `DEVELOPMENT_TEAM` en `project.pbxproj` y `teamID` en los `exportOptions*.plist` (ver `ios/IOS_BUILD_CONFIG.md`).

El aviso de *Could not get providers from altool* suele ir ligado al mismo desajuste de cuenta o a sesión/credenciales incorrectas.
