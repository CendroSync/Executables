const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Minimal 1x1 transparent PNG base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

// Minimal ICO header + bitmap
const icoBase64 = 'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/';
const icoBuffer = Buffer.from(icoBase64, 'base64');

['32x32.png', '128x128.png', '128x128@2x.png'].forEach((file) => {
  fs.writeFileSync(path.join(iconsDir, file), pngBuffer);
});

['icon.ico', 'icon.icns'].forEach((file) => {
  fs.writeFileSync(path.join(iconsDir, file), icoBuffer);
});

console.log('Created Tauri icons successfully!');
