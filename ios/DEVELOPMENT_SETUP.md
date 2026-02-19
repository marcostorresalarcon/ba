# Configuración para Builds de Desarrollo

Este documento explica cómo configurar tu proyecto para builds de desarrollo que permiten instalación directa en dispositivos conectados.

## ⚠️ Problema Actual

El build de desarrollo está fallando porque:
1. Appflow detectó un perfil para `com.bakitchenandbathdesigns.app`
2. Pero tu bundle ID real es `com.bakitchenandbathdesigns.appprod`
3. Necesitas un perfil de desarrollo que coincida con el bundle ID correcto

## 🔧 Solución: Configurar Perfil de Desarrollo en Appflow

### Opción 1: Usar Perfil de Desarrollo Existente (Recomendado)

1. **Ve a Apple Developer Portal**:
   - [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
   - Busca un perfil de tipo **"iOS App Development"** para `com.bakitchenandbathdesigns.appprod`
   - Si no existe, créalo (ver Opción 2)

2. **Descarga el perfil** (archivo `.mobileprovision`)

3. **Configura en Appflow**:
   - Ve a tu proyecto en Appflow
   - Ve a **Settings > Certificates**
   - Crea un nuevo **Signing Config** o edita uno existente:
     - **Name**: `Development`
     - **Certificate**: Selecciona el certificado de desarrollo (debe ser "iPhone Developer", no "Apple Distribution")
     - **Provisioning Profile**: Sube el archivo `.mobileprovision` del perfil de desarrollo
     - **Team ID**: `5G8B5KR88X`
   - Guarda la configuración

4. **Al crear el build**:
   - Selecciona tipo **"Development"**
   - Selecciona el Signing Config que acabas de crear

### Opción 2: Crear Nuevo Perfil de Desarrollo

Si no tienes un perfil de desarrollo para `com.bakitchenandbathdesigns.appprod`:

1. **Ve a Apple Developer Portal**:
   - [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
   - Haz clic en **"+"** para crear un nuevo perfil

2. **Configura el perfil**:
   - **Tipo**: Selecciona **"iOS App Development"**
   - **App ID**: Selecciona `com.bakitchenandbathdesigns.appprod`
   - **Certificados**: Selecciona tu certificado de desarrollo (iPhone Developer)
   - **Dispositivos**: Selecciona los dispositivos donde quieres instalar (incluye tu iPad/iPhone)
   - **Nombre**: Ejemplo: `BA Kitchen Development Profile`

3. **Descarga y configura en Appflow** (sigue los pasos de la Opción 1)

## 📱 Obtener UDID del Dispositivo

Para incluir tu dispositivo en el perfil de desarrollo:

1. **Conecta tu iPad/iPhone a tu Mac**
2. **Abre Xcode**
3. **Ve a Window > Devices and Simulators**
4. **Selecciona tu dispositivo**
5. **Copia el "Identifier" (UDID)**

## ✅ Verificación

Después de configurar el perfil en Appflow:

1. El proyecto está configurado con:
   - `CODE_SIGN_IDENTITY = "iPhone Developer"` para Debug ✅
   - `CODE_SIGN_IDENTITY = "Apple Distribution"` para Release (App Store) ✅
   - `CODE_SIGN_STYLE = Manual` ✅
   - `PROVISIONING_PROFILE = "7dbcd6fc-fa2d-4df8-b36c-74acf323fc48"` en Debug (UUID del perfil que instala Appflow) ✅
   - `CODE_SIGN_STYLE = Automatic` en Release (permite que Appflow gestione el perfil para App Store) ✅

2. Al crear el build en Appflow:
   - Selecciona tipo **"Development"**
   - Selecciona el Signing Config de desarrollo
   - El build debería completarse exitosamente

## 📝 Configuración en Repositorio

El proyecto usa **firma manual en Debug** con el perfil identificado por **UUID** para que coincida con el perfil que Appflow instala en el build.

### Perfil por UUID en project.pbxproj

En **`ios/App/App.xcodeproj/project.pbxproj`**, en la configuración **Debug** del target App, está configurado:

- **`PROVISIONING_PROFILE = "7dbcd6fc-fa2d-4df8-b36c-74acf323fc48"`**

Ese UUID debe ser el del perfil de desarrollo que usas en el **Signing Config** de Appflow para builds de tipo Development. Appflow instala el `.mobileprovision` y Xcode lo resuelve por ese UUID.

### Si cambias de perfil en Appflow

Si en Appflow usas otro Signing Config (otro perfil) para Development:

1. Anota el **UUID** del nuevo perfil (en Appflow o en el nombre del archivo `.mobileprovision`).
2. **Actualiza** en `project.pbxproj` la línea `PROVISIONING_PROFILE` en la sección Debug del target App con ese UUID.
3. En **`exportOptions-development.plist`** el valor de `provisioningProfiles` puede seguir siendo el **nombre** del perfil para la fase de export; si el export falla por perfil, ajusta ahí el nombre para que coincida con el perfil que estás usando.

## 🚀 Instalación en Dispositivo

Una vez que el build termine:

1. **Descarga el `.ipa`** desde Appflow
2. **En tu Mac**:
   - Conecta tu iPad/iPhone
   - Abre **Xcode**
   - Ve a **Window > Devices and Simulators**
   - Selecciona tu dispositivo
   - Arrastra el `.ipa` al área de "Installed Apps"
   - La app se instalará automáticamente

## 🔍 Notas Importantes

- **Certificado de Desarrollo**: Debe ser "iPhone Developer", no "Apple Distribution"
- **Perfil de Desarrollo**: Debe incluir el UDID de tu dispositivo
- **Bundle ID**: Debe coincidir exactamente con `com.bakitchenandbathdesigns.appprod`
- **Vigencia**: Los perfiles de desarrollo expiran después de 1 año

## 🆘 Solución de Problemas

### Error: "Provisioning profile has app ID ... which does not match the bundle ID ..."

**Mensaje típico:**  
`Provisioning profile "development" has app ID "com.bakitchenandbathdesigns.app", which does not match the bundle ID "com.bakitchenandbathdesigns.appprod".`

**Causa:** El perfil de desarrollo que está usando el Signing Config de Appflow fue creado para otro App ID (`com.bakitchenandbathdesigns.app`). El proyecto usa **solo** el bundle ID `com.bakitchenandbathdesigns.appprod`.

**Solución (obligatoria en Appflow/Apple Developer):**

1. **En Apple Developer Portal**
   - Ve a [Identifiers](https://developer.apple.com/account/resources/identifiers/list) y confirma que existe el App ID **`com.bakitchenandbathdesigns.appprod`**.
   - Ve a [Profiles](https://developer.apple.com/account/resources/profiles/list).
   - Crea un perfil de tipo **iOS App Development** (o usa uno existente) que esté asociado al App ID **`com.bakitchenandbathdesigns.appprod`** (no `com.bakitchenandbathdesigns.app`).
   - Incluye tu certificado "iPhone Developer" y los dispositivos donde quieres instalar.
   - Descarga el `.mobileprovision`.

2. **En Ionic Appflow**
   - Ve a **Settings > Certificates**.
   - Edita el **Signing Config** que usas para builds de tipo **Development** (o crea uno nuevo).
   - En **Provisioning Profile**, sube el nuevo archivo `.mobileprovision` que creaste para `com.bakitchenandbathdesigns.appprod`.
   - Guarda y asigna este Signing Config a los builds de tipo Development.

3. **En el repositorio (solo si cambió el UUID del perfil)**
   - Tras el primer build con el nuevo perfil, en el log de Appflow aparece `DOWNLOAD_CERTS_PROVISION_FILE_UUID` con el nuevo UUID.
   - Si es distinto a `7dbcd6fc-fa2d-4df8-b36c-74acf323fc48`, actualiza en `ios/App/App.xcodeproj/project.pbxproj` (configuración Debug del target App) la línea `PROVISIONING_PROFILE` con ese nuevo UUID.

No se puede “arreglar” este error solo cambiando código: el perfil debe ser para `com.bakitchenandbathdesigns.appprod`.

### Error: "No profile for team matching..."
- Verifica que el perfil de desarrollo esté activo en Apple Developer Portal
- Verifica que el bundle ID del perfil coincida exactamente con `com.bakitchenandbathdesigns.appprod`
- Verifica que el certificado en Appflow sea de tipo "iPhone Developer"

### Error: "Device not registered"
- Verifica que el UDID de tu dispositivo esté incluido en el perfil de desarrollo
- Si agregaste el dispositivo después de crear el perfil, crea un nuevo perfil

### Error: "Provisioning profile expired"
- Crea un nuevo perfil de desarrollo en Apple Developer
- Actualiza el perfil en Appflow
- Crea un nuevo build

