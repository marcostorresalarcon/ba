const fs = require('fs');
const path = require('path');

/**
 * Script para sincronizar el ícono de la aplicación iOS desde public/icon.png
 * Este script copia el ícono al directorio de Assets de iOS
 */

const sourceIcon = path.join(__dirname, '..', 'public', 'icon.png');
const targetIcon = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const targetDir = path.dirname(targetIcon);

try {
  // Verificar que el archivo fuente existe
  if (!fs.existsSync(sourceIcon)) {
    console.error(`❌ Error: No se encontró el archivo ${sourceIcon}`);
    process.exit(1);
  }

  // Crear el directorio de destino si no existe
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copiar el ícono
  fs.copyFileSync(sourceIcon, targetIcon);
  console.log(`✅ Ícono sincronizado exitosamente:`);
  console.log(`   Origen: ${sourceIcon}`);
  console.log(`   Destino: ${targetIcon}`);
} catch (error) {
  console.error(`❌ Error al sincronizar el ícono:`, error.message);
  process.exit(1);
}

