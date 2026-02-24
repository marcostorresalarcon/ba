/**
 * Genera iconos y splash para iOS, Android y PWA desde el logo BA.
 * Requiere: assets/logo.png (se copia desde public si no existe).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceLogo = path.join(__dirname, '..', 'public', 'BA - Logo_Color_Almond_GoldenBG@4x.png');
const assetsDir = path.join(__dirname, '..', 'assets');
const targetLogo = path.join(assetsDir, 'logo.png');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

if (fs.existsSync(sourceLogo)) {
  fs.copyFileSync(sourceLogo, targetLogo);
  console.log('✓ Logo copiado a assets/logo.png');
}

execSync(
  'npx @capacitor/assets generate --iconBackgroundColor "#C4A574" --iconBackgroundColorDark "#C4A574" --splashBackgroundColor "#ead1ba" --splashBackgroundColorDark "#ead1ba"',
  { stdio: 'inherit', cwd: path.join(__dirname, '..') }
);
