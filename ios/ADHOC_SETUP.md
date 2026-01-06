# Configuración para Builds Ad Hoc

Este documento explica cómo configurar tu proyecto para builds Ad Hoc que permiten instalación directa en dispositivos sin pasar por TestFlight.

## 📋 Requisitos Previos

1. **Perfil de Aprovisionamiento Ad Hoc** en Apple Developer
2. **UDID del dispositivo** donde quieres instalar la app
3. **Certificado de Distribución** (el mismo que usas para App Store)

## 🔧 Paso 1: Crear Perfil Ad Hoc en Apple Developer

1. Ve a [Apple Developer Portal](https://developer.apple.com/account/resources/profiles/list)
2. Haz clic en **"+"** para crear un nuevo perfil
3. Selecciona **"Ad Hoc"** como tipo
4. Selecciona el **App ID**: `com.bakitchenandbathdesigns.appprod`
5. Selecciona el **Certificado de Distribución** (el mismo que usas para App Store)
6. **Agrega los UDIDs** de los dispositivos donde quieres instalar:
   - Para obtener el UDID de tu iPad/iPhone:
     - Conecta el dispositivo a tu Mac
     - Abre Xcode > Window > Devices and Simulators
     - Selecciona tu dispositivo
     - Copia el "Identifier" (UDID)
7. **Nombra el perfil**: Ejemplo: `Bakitcheandbathdesigns Profile Ad Hoc`
8. **Descarga el perfil** (archivo `.mobileprovision`)

## 🔧 Paso 2: Configurar en Appflow

1. Ve a tu proyecto en Appflow
2. Ve a **Settings > Certificates**
3. Crea un nuevo **Signing Config** o edita el existente:
   - **Name**: `Ad Hoc Distribution`
   - **Certificate**: Selecciona el mismo certificado `.p12` que usas para App Store
   - **Provisioning Profile**: Sube el archivo `.mobileprovision` del perfil Ad Hoc que descargaste
   - **Team ID**: `5G8B5KR88X`
4. Guarda la configuración

## 🔧 Paso 3: Actualizar exportOptions-adhoc.plist

Si el nombre de tu perfil Ad Hoc es diferente a `Bakitcheandbathdesigns Profile Ad Hoc`, actualiza el archivo:

**Archivo**: `ios/App/App/exportOptions-adhoc.plist`

```xml
<key>provisioningProfiles</key>
<dict>
    <key>com.bakitchenandbathdesigns.appprod</key>
    <string>TU_NOMBRE_DE_PERFIL_ADHOC_AQUI</string>
</dict>
```

**⚠️ IMPORTANTE**: El nombre debe ser **exactamente** igual al que aparece en Apple Developer Portal.

## 🚀 Paso 4: Crear Build Ad Hoc en Appflow

1. Ve a **Builds** en Appflow
2. Haz clic en **"New Build"**
3. Selecciona:
   - **Platform**: iOS
   - **Build Type**: **Ad Hoc**
   - **Signing Config**: Selecciona el config que creaste en el Paso 2
   - **Branch**: Tu rama actual
4. Inicia el build

## 📱 Paso 5: Instalar en Dispositivo

Una vez que el build termine:

1. **Descarga el `.ipa`** desde Appflow
2. **En tu Mac**:
   - Conecta tu iPad/iPhone
   - Abre **Xcode**
   - Ve a **Window > Devices and Simulators**
   - Selecciona tu dispositivo
   - Arrastra el `.ipa` al área de "Installed Apps"
   - La app se instalará automáticamente

## ⚠️ Notas Importantes

- **Límite de dispositivos**: Un perfil Ad Hoc puede incluir hasta **100 dispositivos**
- **Vigencia**: Los perfiles Ad Hoc expiran después de 1 año
- **Actualización**: Si agregas nuevos dispositivos, debes crear un nuevo perfil y actualizar el build
- **Debug vs Release**: El proyecto está configurado para que Appflow inyecte automáticamente el perfil Ad Hoc en builds de tipo Ad Hoc

## 🔍 Verificar Configuración

Para verificar que todo está correcto:

1. El archivo `project.pbxproj` tiene `CODE_SIGN_STYLE = Manual` en Debug
2. El archivo `project.pbxproj` **NO** tiene `PROVISIONING_PROFILE_SPECIFIER` en Debug (permite que Appflow lo inyecte)
3. El archivo `exportOptions-adhoc.plist` tiene el nombre correcto del perfil
4. El perfil Ad Hoc incluye el UDID de tu dispositivo

## 🆘 Solución de Problemas

### Error: "No profile for team matching..."
- Verifica que el nombre del perfil en `exportOptions-adhoc.plist` sea exactamente igual al de Apple Developer
- Verifica que el perfil esté activo en Apple Developer Portal

### Error: "Device not registered"
- Verifica que el UDID de tu dispositivo esté incluido en el perfil Ad Hoc
- Si agregaste el dispositivo después de crear el perfil, crea un nuevo perfil

### Error: "Provisioning profile expired"
- Crea un nuevo perfil Ad Hoc en Apple Developer
- Actualiza el perfil en Appflow
- Crea un nuevo build

