# Configuración de Builds iOS - Referencia Centralizada

Este documento centraliza toda la configuración de builds iOS (Production, Development, Ad Hoc) para facilitar cambios futuros.

## 📋 Información General del Proyecto

- **Bundle ID**: `com.bakitchenandbathdesigns.appprod`
- **Team ID**: `5G8B5KR88X`
- **Deployment Target**: iOS 14.0
- **Marketing Version**: 1.1.0
- **Current Project Version**: 6

---

## 🔧 Configuración de Development (Debug)

### Archivo: `ios/App/App.xcodeproj/project.pbxproj`

**Target: App, Configuration: Debug**

```text
CODE_SIGN_IDENTITY = "iPhone Developer";
CODE_SIGN_STYLE = Manual;
DEVELOPMENT_TEAM = 5G8B5KR88X;
PROVISIONING_PROFILE = "7dbcd6fc-fa2d-4df8-b36c-74acf323fc48";
```

**Ubicación en project.pbxproj:**
- Sección: `504EC3171FED79650016851F /* Debug */`
- Dentro de `buildSettings` del target App

### Archivo: `ios/App/App/exportOptions-development.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>development</string>
	<key>teamID</key>
	<string>5G8B5KR88X</string>
	<key>provisioningProfiles</key>
	<dict>
		<key>com.bakitchenandbathdesigns.appprod</key>
		<string>Bakitcheandbathdesigns Profile Dev</string>
	</dict>
	<key>signingStyle</key>
	<string>manual</string>
	<key>signingCertificate</key>
	<string>iPhone Developer</string>
</dict>
</plist>
```

**Nota:** El valor `Bakitcheandbathdesigns Profile Dev` en `provisioningProfiles` debe coincidir con el **nombre interno** del perfil de desarrollo que uses en Appflow. Si cambias de perfil, actualiza este nombre.

---

## 🚀 Configuración de Production (Release / App Store)

### Archivo: `ios/App/App.xcodeproj/project.pbxproj`

**Target: App, Configuration: Release**

```text
CODE_SIGN_IDENTITY = "Apple Distribution";
CODE_SIGN_STYLE = Automatic;
DEVELOPMENT_TEAM = 5G8B5KR88X;
```

**Ubicación en project.pbxproj:**
- Sección: `504EC3181FED79650016851F /* Release */`
- Dentro de `buildSettings` del target App

**Nota:** Release usa `Automatic` signing, por lo que Appflow gestiona automáticamente el perfil de distribución.

### Archivo: `ios/App/App/exportOptions.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store</string>
	<key>teamID</key>
	<string>5G8B5KR88X</string>
	<key>provisioningProfiles</key>
	<dict>
		<key>com.bakitchenandbathdesigns.appprod</key>
		<string>Bakitcheandbathdesigns Profile Prod</string>
	</dict>
</dict>
</plist>
```

**Nota:** El valor `Bakitcheandbathdesigns Profile Prod` debe coincidir con el nombre del perfil de distribución (App Store) que uses en Appflow.

---

## 📦 Configuración de Ad Hoc

### Archivo: `ios/App/App/exportOptions-adhoc.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>ad-hoc</string>
	<key>teamID</key>
	<string>5G8B5KR88X</string>
	<key>provisioningProfiles</key>
	<dict>
		<key>com.bakitchenandbathdesigns.appprod</key>
		<string>Bakitcheandbathdesigns Profile Ad Hoc</string>
	</dict>
	<key>signingStyle</key>
	<string>manual</string>
	<key>signingCertificate</key>
	<string>Apple Distribution</string>
</dict>
</plist>
```

**Nota:** El valor `Bakitcheandbathdesigns Profile Ad Hoc` debe coincidir con el nombre del perfil Ad Hoc que uses en Appflow.

---

## 🔄 Cómo Cambiar la Configuración

### Para Development:

1. **Si cambias el perfil de desarrollo en Appflow:**
   - Obtén el **UUID** del nuevo perfil (aparece en los logs de build de Appflow como `DOWNLOAD_CERTS_PROVISION_FILE_UUID`)
   - Actualiza `PROVISIONING_PROFILE` en `project.pbxproj` (Debug) con el nuevo UUID
   - Obtén el **nombre interno** del perfil (del archivo `.mobileprovision` o de Apple Developer Portal)
   - Actualiza `provisioningProfiles` en `exportOptions-development.plist` con el nuevo nombre

2. **Si cambias el certificado de desarrollo:**
   - Verifica que el certificado en Appflow sea de tipo "iPhone Developer"
   - El proyecto ya está configurado con `CODE_SIGN_IDENTITY = "iPhone Developer"`

### Para Production:

1. **Si cambias el perfil de distribución:**
   - Obtén el **nombre interno** del nuevo perfil de distribución
   - Actualiza `provisioningProfiles` en `exportOptions.plist` con el nuevo nombre
   - El proyecto usa `Automatic` signing en Release, así que no necesitas cambiar `PROVISIONING_PROFILE` en project.pbxproj

2. **Si cambias el certificado de distribución:**
   - Verifica que el certificado en Appflow sea de tipo "Apple Distribution"
   - El proyecto ya está configurado con `CODE_SIGN_IDENTITY = "Apple Distribution"`

### Para Ad Hoc:

1. **Si cambias el perfil Ad Hoc:**
   - Obtén el **nombre interno** del nuevo perfil Ad Hoc
   - Actualiza `provisioningProfiles` en `exportOptions-adhoc.plist` con el nuevo nombre

---

## 📝 Checklist para Cambios

Cuando cambies la configuración de builds iOS:

- [ ] Actualicé el UUID del perfil en `project.pbxproj` (solo Development)
- [ ] Actualicé el nombre del perfil en el `exportOptions-*.plist` correspondiente
- [ ] Verifiqué que el certificado en Appflow coincida con `CODE_SIGN_IDENTITY`
- [ ] Verifiqué que el Team ID (`5G8B5KR88X`) sea correcto en todos los archivos
- [ ] Verifiqué que el Bundle ID (`com.bakitchenandbathdesigns.appprod`) sea correcto
- [ ] Ejecuté un build de prueba en Appflow para verificar que funciona

---

## ❌ Error: "App ID does not match the bundle ID"

Si el build falla con:

```text
Provisioning profile "development" has app ID "com.bakitchenandbathdesigns.app", which does not match the bundle ID "com.bakitchenandbathdesigns.appprod".
```

**Causa:** El perfil de desarrollo subido en Appflow está asociado al App ID `com.bakitchenandbathdesigns.app`. El proyecto usa **solo** `com.bakitchenandbathdesigns.appprod`.

**Qué hacer (no se soluciona cambiando solo el repo):**

1. En **Apple Developer Portal** crear (o reutilizar) un perfil de tipo **iOS App Development** para el App ID **`com.bakitchenandbathdesigns.appprod`**.
2. Descargar el `.mobileprovision` y en **Appflow > Settings > Certificates** actualizar el Signing Config de **Development** con ese perfil.
3. Si el nuevo perfil tiene otro UUID, actualizar `PROVISIONING_PROFILE` en `ios/App/App.xcodeproj/project.pbxproj` (Debug) con el UUID que muestre el log de Appflow (`DOWNLOAD_CERTS_PROVISION_FILE_UUID`).

Detalle completo en `ios/DEVELOPMENT_SETUP.md`, sección "Solución de Problemas".

---

## 🔍 Ubicación de Archivos

- **project.pbxproj**: `ios/App/App.xcodeproj/project.pbxproj`
- **exportOptions.plist** (App Store): `ios/App/App/exportOptions.plist`
- **exportOptions-development.plist**: `ios/App/App/exportOptions-development.plist`
- **exportOptions-adhoc.plist**: `ios/App/App/exportOptions-adhoc.plist`

---

## 📚 Documentación Relacionada

- `ios/DEVELOPMENT_SETUP.md` - Guía detallada para configurar builds de desarrollo
- `ios/ADHOC_SETUP.md` - Guía detallada para configurar builds Ad Hoc

---

**Última actualización:** Febrero 2026
