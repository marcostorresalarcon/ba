const fs = require('fs');
const path = require('path');

/**
 * Script para sincronizar el ícono de la aplicación iOS desde el logo BA.
 * Genera un ícono 1024x1024 sin transparencias (requisito de Apple).
 */

const sourceIcon = path.join(__dirname, '..', 'public', 'BA - Logo_Color_Almond_GoldenBG@4x.png');
const targetIcon = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const targetDir = path.dirname(targetIcon);

// Color de fondo del logo (golden-almond) para padding si la imagen no es cuadrada
const LOGO_BACKGROUND = { r: 196, g: 165, b: 116, alpha: 1 };

async function validateIcon() {
  try {
    if (!fs.existsSync(sourceIcon)) {
      console.error(`❌ Error: No se encontró el archivo ${sourceIcon}`);
      process.exit(1);
    }

    try {
      const sharp = require('sharp');
      const metadata = await sharp(sourceIcon).metadata();

      const needsResize = metadata.width !== 1024 || metadata.height !== 1024;

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (needsResize) {
        console.warn(`⚠️  El ícono es de ${metadata.width}x${metadata.height} píxeles.`);
        console.warn(`   Redimensionando a 1024x1024 píxeles (requisito de Apple)...`);

        await sharp(sourceIcon)
          .resize(1024, 1024, {
            fit: 'contain',
            background: LOGO_BACKGROUND
          })
          .removeAlpha()
          .png()
          .toFile(targetIcon);

        console.log(`✅ Ícono redimensionado y sincronizado:`);
        console.log(`   Origen: ${path.basename(sourceIcon)} (${metadata.width}x${metadata.height})`);
        console.log(`   Destino: AppIcon-512@2x.png (1024x1024, sin transparencias)`);
        return;
      }

      if (metadata.hasAlpha) {
        await sharp(sourceIcon)
          .removeAlpha()
          .png()
          .toFile(targetIcon);
        console.log(`✅ Transparencias eliminadas y sincronizado.`);
      } else {
        fs.copyFileSync(sourceIcon, targetIcon);
        console.log(`✅ Ícono sincronizado (1024x1024).`);
      }
    } catch (sharpError) {
      console.warn(`⚠️  No se pudo procesar con sharp: ${sharpError.message}`);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(sourceIcon, targetIcon);
      console.warn(`⚠️  Ícono copiado sin validación. Verifica que sea 1024x1024 y sin transparencias.`);
    }
  } catch (error) {
    console.error(`❌ Error al sincronizar el ícono:`, error.message);
    process.exit(1);
  }
}

validateIcon();
