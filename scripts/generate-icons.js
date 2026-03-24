/**
 * Genera iconos y splash para iOS, Android y PWA desde el logo BA (Appflow / Capacitor).
 * Fuente principal: public/BA APP Logo Blanco-02.png (oro sobre blanco).
 * Fallback: public/BA - Logo_Color_Almond_GoldenBG@4x.png
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');
const primaryLogo = path.join(publicDir, 'BA APP Logo Blanco-02.png');
const fallbackLogo = path.join(publicDir, 'BA - Logo_Color_Almond_GoldenBG@4x.png');
const assetsDir = path.join(__dirname, '..', 'assets');
const targetLogo = path.join(assetsDir, 'logo.png');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const sourceLogo = fs.existsSync(primaryLogo) ? primaryLogo : fallbackLogo;
if (!fs.existsSync(sourceLogo)) {
  console.error(
    'No se encontró logo. Coloca public/BA APP Logo Blanco-02.png (o el fallback BA - Logo_Color_Almond_GoldenBG@4x.png).'
  );
  process.exit(1);
}

fs.copyFileSync(sourceLogo, targetLogo);
console.log(`✓ Logo copiado a assets/logo.png desde ${path.basename(sourceLogo)}`);

// Fondo icono: blanco (logo oro sobre blanco); modo oscuro charcoal para contraste con el oro.
execSync(
  [
    'npx',
    '@capacitor/assets',
    'generate',
    '--iconBackgroundColor',
    '#FFFFFF',
    '--iconBackgroundColorDark',
    '#332F28',
    '--splashBackgroundColor',
    '#ead1ba',
    '--splashBackgroundColorDark',
    '#332F28'
  ].join(' '),
  { stdio: 'inherit', cwd: path.join(__dirname, '..') }
);
