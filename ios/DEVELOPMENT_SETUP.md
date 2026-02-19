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
   - `PROVISIONING_PROFILE_SPECIFIER = "Bakitcheandbathdesigns Profile Dev"` en Debug ✅
   - `CODE_SIGN_STYLE = Automatic` en Release (permite que Appflow gestione el perfil para App Store) ✅

2. Al crear el build en Appflow:
   - Selecciona tipo **"Development"**
   - Selecciona el Signing Config de desarrollo
   - El build debería completarse exitosamente

## 📝 Configuración en Repositorio

El proyecto usa **firma manual en Debug** con `PROVISIONING_PROFILE_SPECIFIER` configurado explícitamente. Esto requiere que el nombre del perfil de desarrollo esté sincronizado en tres lugares:

### 1. Apple Developer Portal
El nombre del perfil de tipo "iOS App Development" para `com.bakitchenandbathdesigns.appprod` debe ser exactamente: **`Bakitcheandbathdesigns Profile Dev`**

### 2. Archivos del Repositorio
El nombre del perfil debe aparecer exactamente igual en:
- **`ios/App/App.xcodeproj/project.pbxproj`**: En la configuración Debug del target App, dentro de `buildSettings`, la línea `PROVISIONING_PROFILE_SPECIFIER`
- **`ios/App/App/exportOptions-development.plist`**: En la clave `provisioningProfiles`, dentro del diccionario para `com.bakitchenandbathdesigns.appprod`

### 3. Ionic Appflow Signing Config
Cuando subes el archivo `.mobileprovision` del perfil de desarrollo en Appflow, el nombre interno del perfil (que viene del archivo .mobileprovision) debe coincidir exactamente con el nombre usado en los archivos del repositorio.

### ⚠️ Importante: Sincronización del Nombre

Si cambias el nombre del perfil en Apple Developer Portal:
1. **Actualiza** `PROVISIONING_PROFILE_SPECIFIER` en `project.pbxproj` (configuración Debug)
2. **Actualiza** el valor en `exportOptions-development.plist` dentro de `provisioningProfiles`
3. **Descarga** el nuevo perfil y súbelo a Appflow
4. **Verifica** que el nombre interno del perfil en el .mobileprovision coincida con el nombre usado en el repositorio

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

