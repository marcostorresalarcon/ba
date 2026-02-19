# Skill: Configuración de Builds iOS

Este skill ayuda a modificar la configuración de builds iOS (Development, Production, Ad Hoc) de forma rápida y segura.

## Cuándo usar este skill

- Cuando necesites cambiar el perfil de aprovisionamiento (provisioning profile) para Development, Production o Ad Hoc
- Cuando necesites actualizar el UUID del perfil de desarrollo en el proyecto Xcode
- Cuando necesites cambiar certificados o Team ID
- Cuando Appflow indique errores relacionados con provisioning profiles

## Archivos de configuración

### 1. project.pbxproj (Configuración del proyecto Xcode)

**Ubicación:** `ios/App/App.xcodeproj/project.pbxproj`

**Configuración Debug (Development):**
- Buscar sección: `504EC3171FED79650016851F /* Debug */`
- Dentro de `buildSettings` del target App:
  - `PROVISIONING_PROFILE` - UUID del perfil de desarrollo
  - `CODE_SIGN_IDENTITY` - "iPhone Developer"
  - `CODE_SIGN_STYLE` - Manual
  - `DEVELOPMENT_TEAM` - 5G8B5KR88X

**Configuración Release (Production):**
- Buscar sección: `504EC3181FED79650016851F /* Release */`
- Dentro de `buildSettings` del target App:
  - `CODE_SIGN_IDENTITY` - "Apple Distribution"
  - `CODE_SIGN_STYLE` - Automatic (Appflow gestiona el perfil)
  - `DEVELOPMENT_TEAM` - 5G8B5KR88X

### 2. exportOptions-development.plist

**Ubicación:** `ios/App/App/exportOptions-development.plist`

**Campos clave:**
- `method`: "development"
- `teamID`: "5G8B5KR88X"
- `provisioningProfiles`: Diccionario con bundle ID → nombre del perfil
- `signingStyle`: "manual"
- `signingCertificate`: "iPhone Developer"

**Importante:** El valor en `provisioningProfiles` debe ser el **nombre interno** del perfil (no el UUID). Este nombre está dentro del archivo `.mobileprovision` y debe coincidir exactamente con el perfil que uses en Appflow.

### 3. exportOptions.plist (App Store)

**Ubicación:** `ios/App/App/exportOptions.plist`

**Campos clave:**
- `method`: "app-store"
- `teamID`: "5G8B5KR88X"
- `provisioningProfiles`: Diccionario con bundle ID → nombre del perfil de distribución

### 4. exportOptions-adhoc.plist

**Ubicación:** `ios/App/App/exportOptions-adhoc.plist`

**Campos clave:**
- `method`: "ad-hoc"
- `teamID`: "5G8B5KR88X"
- `provisioningProfiles`: Diccionario con bundle ID → nombre del perfil Ad Hoc
- `signingStyle`: "manual"
- `signingCertificate`: "Apple Distribution"

## Proceso para cambiar configuración

### Cambiar perfil de Development

1. **Obtener UUID del nuevo perfil:**
   - En los logs de build de Appflow, buscar `DOWNLOAD_CERTS_PROVISION_FILE_UUID`
   - O en Apple Developer Portal, el UUID aparece en la URL del perfil

2. **Actualizar project.pbxproj:**
   - Buscar `PROVISIONING_PROFILE` en la sección Debug
   - Reemplazar el UUID con el nuevo

3. **Obtener nombre interno del perfil:**
   - Abrir el archivo `.mobileprovision` en un editor de texto
   - Buscar la clave `<key>Name</key>` y el valor siguiente
   - O usar: `security cms -D -i profile.mobileprovision | grep -A1 "Name"`

4. **Actualizar exportOptions-development.plist:**
   - Reemplazar el valor en `provisioningProfiles` con el nombre interno del perfil

### Cambiar perfil de Production

1. **Obtener nombre interno del perfil de distribución:**
   - Del archivo `.mobileprovision` o Apple Developer Portal

2. **Actualizar exportOptions.plist:**
   - Reemplazar el valor en `provisioningProfiles` con el nuevo nombre

**Nota:** No necesitas cambiar `PROVISIONING_PROFILE` en project.pbxproj porque Release usa `Automatic` signing.

### Cambiar perfil Ad Hoc

1. **Obtener nombre interno del perfil Ad Hoc**
2. **Actualizar exportOptions-adhoc.plist:**
   - Reemplazar el valor en `provisioningProfiles` con el nuevo nombre

## Valores constantes del proyecto

- **Bundle ID**: `com.bakitchenandbathdesigns.appprod`
- **Team ID**: `5G8B5KR88X`
- **Deployment Target**: iOS 14.0
- **Marketing Version**: 1.0.3
- **Current Project Version**: 5

## Errores comunes y soluciones

### Error: "Provisioning profile has app ID ... which does not match the bundle ID ..."

**Mensaje:**  
`Provisioning profile "development" has app ID "com.bakitchenandbathdesigns.app", which does not match the bundle ID "com.bakitchenandbathdesigns.appprod".`

**Causa:** El perfil de desarrollo del Signing Config en Appflow está asociado a `com.bakitchenandbathdesigns.app`. El proyecto solo usa `com.bakitchenandbathdesigns.appprod`.

**Solución (en Apple Developer + Appflow, no en código):**
1. En Apple Developer Portal, crear o usar un perfil **iOS App Development** para el App ID **`com.bakitchenandbathdesigns.appprod`**.
2. Descargar el `.mobileprovision` y en Appflow sustituir el perfil del Signing Config de Development por este.
3. Si el nuevo perfil tiene otro UUID, actualizar `PROVISIONING_PROFILE` en `project.pbxproj` (Debug) con el UUID que aparezca en el log de Appflow (`DOWNLOAD_CERTS_PROVISION_FILE_UUID`).

Ver `ios/DEVELOPMENT_SETUP.md` para los pasos detallados.

### Error: "No profile for team matching 'X' found"

**Causa:** El UUID en `PROVISIONING_PROFILE` (Development) o el nombre en `exportOptions-*.plist` no coincide con el perfil instalado.

**Solución:**
- Verificar que el UUID/nombre coincida exactamente con el perfil en Appflow
- Verificar que el perfil esté activo en Apple Developer Portal
- Verificar que el Team ID sea correcto

### Error: "App requires a provisioning profile"

**Causa:** Falta `PROVISIONING_PROFILE` en Debug o el perfil no está instalado.

**Solución:**
- Asegurar que `PROVISIONING_PROFILE` tenga el UUID correcto en Debug
- Verificar que Appflow esté instalando el perfil correctamente

### Error en export: "No profile matching..."

**Causa:** El nombre en `exportOptions-*.plist` no coincide con el perfil instalado.

**Solución:**
- Verificar el nombre interno del perfil en el `.mobileprovision`
- Actualizar el valor en `provisioningProfiles` del plist correspondiente

## Referencias

- Documento centralizado: `ios/IOS_BUILD_CONFIG.md`
- Guía de desarrollo: `ios/DEVELOPMENT_SETUP.md`
- Guía Ad Hoc: `ios/ADHOC_SETUP.md`
