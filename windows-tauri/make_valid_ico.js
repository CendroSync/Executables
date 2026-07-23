const fs = require('fs');
const path = require('path');

// Create valid 32x32 32-bit ICO file structure
const header = Buffer.from([
  0, 0, 1, 0, 1, 0, // ICONDIR
  32, 32, 0, 0, 1, 0, 32, 0, // ICONDIRENTRY (32x32, 32bpp)
  0x68, 0x10, 0x00, 0x00, // Size: 4200 bytes
  0x16, 0x00, 0x00, 0x00  // Offset: 22
]);

const bih = Buffer.alloc(40);
bih.writeUInt32LE(40, 0);       // biSize
bih.writeInt32LE(32, 4);        // biWidth
bih.writeInt32LE(64, 8);        // biHeight (32 * 2 for XOR + AND)
bih.writeUInt16LE(1, 12);       // biPlanes
bih.writeUInt16LE(32, 14);      // biBitCount
bih.writeUInt32LE(0, 16);       // biCompression
bih.writeUInt32LE(32 * 32 * 4, 20); // biSizeImage

const xorMask = Buffer.alloc(32 * 32 * 4);
for (let i = 0; i < 32 * 32; i++) {
  xorMask[i * 4 + 0] = 0xf1; // B
  xorMask[i * 4 + 1] = 0x66; // G
  xorMask[i * 4 + 2] = 0x63; // R
  xorMask[i * 4 + 3] = 0xff; // A
}

const andMask = Buffer.alloc(32 * 4);

const validIcoBuffer = Buffer.concat([header, bih, xorMask, andMask]);
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon.ico'), validIcoBuffer);
console.log('Generated valid 32x32 ICO file successfully! Size:', validIcoBuffer.length);
