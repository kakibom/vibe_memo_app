const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration(); // Sometimes helps with headless capture

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 256,
        height: 256,
        show: false, // hidden
        webPreferences: {
            offscreen: true // enable offscreen rendering
        }
    });

    const svg = `
    <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" fill="#ffffff"/>
        <!-- Banana -->
        <path d="M60 200 Q 140 260 220 80 Q 180 180 60 200 Z" fill="#FFE135" stroke="#D4AF37" stroke-width="10" stroke-linejoin="round"/>
        <!-- Stem -->
        <path d="M220 80 L 230 70" stroke="#8B4513" stroke-width="10" stroke-linecap="round"/>
    </svg>
    `;

    const html = `
    <html>
    <body style="margin:0; overflow:hidden;">
        ${svg}
    </body>
    </html>
    `;

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    win.loadURL(dataUrl);

    win.webContents.on('did-finish-load', async () => {
        try {
            const image = await win.capturePage();
            const pngBuffer = image.toPNG();
            const outputPath = path.join(__dirname, 'icon.png');
            fs.writeFileSync(outputPath, pngBuffer);
            console.log(`Icon captured and saved to ${outputPath}`);
            // Check size
            console.log(`Final Image Size: ${image.getSize().width}x${image.getSize().height}`);
            process.exit(0);
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    });
});
