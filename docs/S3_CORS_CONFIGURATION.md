# Configuración de CORS para S3

Este documento explica cómo configurar CORS en el bucket de S3 para permitir subidas directas desde el frontend.

## Problema

Si ves el error `Upload failed due to network error` al intentar subir archivos a S3, es muy probable que el bucket no tenga configurada correctamente la política de CORS.

## Solución: Configurar CORS en el Bucket S3

### Paso 1: Acceder a la Consola de AWS S3

1. Ve a [AWS Console](https://console.aws.amazon.com/s3/)
2. Selecciona el bucket `ba-bucket-aws`
3. Ve a la pestaña **Permissions** (Permisos)
4. Desplázate hasta la sección **Cross-origin resource sharing (CORS)**

### Paso 2: Configurar la Política de CORS

Copia y pega la siguiente configuración de CORS en el editor:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:4200",
      "http://localhost:4201",
      "https://ba-back.marcostorresalarcon.com",
      "capacitor://localhost",
      "ionic://localhost",
      "http://localhost",
      "https://localhost"
    ],
    "ExposeHeaders": ["ETag", "x-amz-server-side-encryption", "x-amz-request-id", "x-amz-id-2"],
    "MaxAgeSeconds": 3000
  }
]
```

### Paso 3: Explicación de la Configuración

- **AllowedHeaders**: `["*"]` permite todos los headers, necesario para que las URLs presignadas funcionen correctamente.
- **AllowedMethods**: Incluye `PUT` que es el método usado para subir archivos con URLs presignadas.
- **AllowedOrigins**: Lista de orígenes permitidos:
  - `http://localhost:4200` y `http://localhost:4201`: Desarrollo local
  - `https://ba-back.marcostorresalarcon.com`: Producción
  - `capacitor://localhost` e `ionic://localhost`: Apps nativas de Capacitor
  - `http://localhost` y `https://localhost`: Variantes de localhost
- **ExposeHeaders**: Headers que el navegador puede leer en la respuesta.
- **MaxAgeSeconds**: Tiempo en segundos que el navegador cachea la respuesta de CORS (3000 = ~50 minutos).

### Paso 4: Agregar Orígenes Adicionales (si es necesario)

Si tu aplicación se ejecuta en otros dominios, agrégalos a la lista de `AllowedOrigins`. Por ejemplo:

```json
"AllowedOrigins": [
  "http://localhost:4200",
  "http://localhost:4201",
  "https://ba-back.marcostorresalarcon.com",
  "https://tu-dominio.com",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost"
]
```

### Paso 5: Verificar la Configuración

Después de guardar la configuración de CORS:

1. Espera unos segundos para que los cambios se propaguen
2. Intenta subir un archivo nuevamente desde la aplicación
3. Si el error persiste, verifica en la consola del navegador (F12) si hay errores de CORS más específicos

## Verificación desde el Navegador

Si quieres verificar que CORS está configurado correctamente, abre la consola del navegador (F12) y busca errores como:

- `Access to fetch at 'https://ba-bucket-aws.s3...' from origin '...' has been blocked by CORS policy`
- `No 'Access-Control-Allow-Origin' header is present on the requested resource`

Si ves estos errores, significa que CORS no está configurado o el origen no está en la lista de permitidos.

## Notas Importantes

1. **Seguridad**: En producción, es recomendable ser más específico con los orígenes permitidos en lugar de usar `*` o muchos orígenes.

2. **Propagación**: Los cambios en CORS pueden tardar unos minutos en propagarse.

3. **Bucket Policy**: Además de CORS, asegúrate de que el bucket tenga una política que permita operaciones desde las URLs presignadas. El backend debe estar generando URLs presignadas con los permisos correctos.

4. **Content-Type**: El servicio de subida ya limpia el Content-Type para evitar problemas con codecs (ej: `audio/mp4; codecs=mp4a.40.2` → `audio/m4a`).

## Troubleshooting Adicional

Si después de configurar CORS el problema persiste:

1. **Verificar que la URL presignada sea válida**: Revisa en los logs del backend que la URL presignada se esté generando correctamente.

2. **Verificar permisos del bucket**: Asegúrate de que el bucket permita operaciones PUT desde las credenciales de AWS configuradas.

3. **Verificar región**: Confirma que la región del bucket (`us-east-1`) coincida con la configuración en el backend.

4. **Revisar logs del servicio**: El servicio ahora registra más detalles sobre los errores en los logs del sistema.
