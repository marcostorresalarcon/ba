const fs = require('fs');
const path = require('path');

/**
 * Script para sincronizar el ícono de la aplicación iOS desde public/icon.png
 * Este script valida que el ícono no tenga transparencias y lo copia al directorio de Assets de iOS
 */

const sourceIcon = path.join(__dirname, '..', 'public', 'icon.png');
const targetIcon = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const targetDir = path.dirname(targetIcon);

async function validateIcon() {
  try {
    // Verificar que el archivo fuente existe
    if (!fs.existsSync(sourceIcon)) {
      console.error(`❌ Error: No se encontró el archivo ${sourceIcon}`);
      process.exit(1);
    }

    // Validar el ícono usando sharp si está disponible
    try {
      const sharp = require('sharp');
      const metadata = await sharp(sourceIcon).metadata();
      
      // Verificar que no tenga canal alfa (transparencias) - PRIMERO
      if (metadata.hasAlpha) {
        console.error(`❌ Error: El ícono tiene transparencias (canal alfa).`);
        console.error(`   Apple rechaza iconos con transparencias. El ícono debe tener un fondo 100% sólido.`);
        console.error(`   Por favor, elimina las transparencias del ícono antes de continuar.`);
        process.exit(1);
      }

      // Verificar y redimensionar si es necesario (debe ser 1024x1024)
      const needsResize = metadata.width !== 1024 || metadata.height !== 1024;
      
      // Crear el directorio de destino si no existe
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (needsResize) {
        console.warn(`⚠️  El ícono es de ${metadata.width}x${metadata.height} píxeles.`);
        console.warn(`   Redimensionando a 1024x1024 píxeles (requisito de Apple)...`);
        
        // Redimensionar a 1024x1024 manteniendo la calidad y asegurando fondo sólido
        await sharp(sourceIcon)
          .resize(1024, 1024, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 } // Fondo blanco sólido
          })
          .removeAlpha() // Eliminar cualquier transparencia residual
          .toFile(targetIcon);
        
        console.log(`✅ Ícono redimensionado y sincronizado exitosamente:`);
        console.log(`   Origen: ${sourceIcon} (${metadata.width}x${metadata.height})`);
        console.log(`   Destino: ${targetIcon} (1024x1024, sin transparencias)`);
        return; // Salir temprano ya que ya procesamos el archivo
      }

      // Verificar que no sea un placeholder de Capacitor/Ionic
      const stats = fs.statSync(sourceIcon);
      const fileSize = stats.size;
      
      // Los iconos placeholder suelen ser muy pequeños (< 10KB)
      if (fileSize < 10000) {
        console.warn(`⚠️  Advertencia: El ícono parece ser muy pequeño (${fileSize} bytes).`);
        console.warn(`   Asegúrate de que no sea un placeholder de Capacitor/Ionic.`);
      }

      console.log(`✅ Validación del ícono exitosa:`);
      console.log(`   Tamaño: ${metadata.width}x${metadata.height} píxeles`);
      console.log(`   Formato: ${metadata.format}`);
      console.log(`   Sin transparencias: ✓`);
      
      // Crear el directorio de destino si no existe
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Si llegamos aquí, el ícono ya tiene el tamaño correcto, solo copiar
      fs.copyFileSync(sourceIcon, targetIcon);
      console.log(`✅ Ícono sincronizado exitosamente:`);
      console.log(`   Origen: ${sourceIcon}`);
      console.log(`   Destino: ${targetIcon}`);
      
    } catch (sharpError) {
      // Si sharp no está disponible o hay un error, continuar con advertencia
      console.warn(`⚠️  No se pudo validar el ícono con sharp: ${sharpError.message}`);
      console.warn(`   Asegúrate manualmente de que el ícono:`);
      console.warn(`   - Sea de 1024x1024 píxeles`);
      console.warn(`   - No tenga transparencias (fondo sólido)`);
      console.warn(`   - No sea un placeholder de Capacitor/Ionic`);
      
      // Crear el directorio de destino si no existe
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copiar sin validación
      fs.copyFileSync(sourceIcon, targetIcon);
      console.log(`⚠️  Ícono copiado sin validación. Verifica manualmente los requisitos.`);
    }
    
  } catch (error) {
    console.error(`❌ Error al sincronizar el ícono:`, error.message);
    process.exit(1);
  }
}

// Ejecutar validación
validateIcon();


