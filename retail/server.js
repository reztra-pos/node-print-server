const express = require('express');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
process.env.PKG_ROOT = __dirname;
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { createCanvas, loadImage } = require('canvas');
const app = express();
const port = 43110;

// Middleware to parse JSON body
app.use(express.json());
app.use(cors())
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // Or specific origin
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});
// POST API
app.post('/print-server', async (req, res) => {
    const data = req.body;   

    let printInterface = ''
    if (data.printerDetails.type == 'windows' && data.printerDetails.deviceName !== '') {
        printInterface = `//localhost/${data.printerDetails.deviceName}`
    } else if (data.printerDetails.type == 'network' && data.printerDetails.ipAddress !== '') {
        printInterface = `tcp://${data.printerDetails.ipAddress}:${data.printerDetails.port ? data.printerDetails.port : 9600}`
    } else {
        console.error("Printer not connected:", data.printerDetails);
        res.json({
            message: 'printer type not defined!',
            data: data.printerDetails
        });
        return;
    }

    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: printInterface
    })

    try {
        let defaultHeight = 1300;

        const [logoImage, qrCodeImage] = await Promise.all([
            loadImageSafe(data.receiptData.logo, 'Logo'),
            loadImageSafe(data.receiptData.qrCode, 'QR Code')
        ]);

        if (!logoImage) defaultHeight -= 350;
        if (!qrCodeImage) defaultHeight -= 250;

        if (data.receiptData.changeAmount != "") {
            defaultHeight += 40;
        }
        if (data.receiptData.bankDetails.length > 0) {
            data.receiptData.bankDetails.forEach(() => {
                defaultHeight += 25;
            })
        }
        if (data.receiptData.customer.name) {
            defaultHeight += 30;
            if (data.receiptData.customer.vatNo) {
                defaultHeight += 30;
            }
            if (data.receiptData.customer.phone) {
                defaultHeight += 30;
            }
            if (data.receiptData.customer.address) {
                defaultHeight += 30;
            }
        }

        const items = Array.isArray(data.receiptData.items) ? data.receiptData.items : [];
        const canvasHeight = defaultHeight + (data.receiptData.items.length * 115);
        const canvas = createCanvas(CANVAS_SETTINGS.canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");

        const usedHeight = await drawReceipt(canvas, ctx, data.receiptData, logoImage, qrCodeImage);

        await printer.printImageBuffer(canvas.toBuffer('image/png'));
        printer.cut();

        const result = await printer.execute();
        console.log("Print command sent successfully!");
        res.json({
            message: 'Print successful!',
            data: data
        });
    } catch (error) {
        console.error("Print failed:", error);
        res.json({
            message: 'Print failed!',
            error: error
        });
    }
});

// POST API
app.get('/', (req, res) => {
    res.json({
        message: 'Server running successfully!'
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});


const CANVAS_SETTINGS = {
    canvasWidth: 550,
    lineHeight: 35,
    smallFontSize: 24,
    mediumFontSize: 26,
    largeFontSize: 30,
    headerFontSize: 34,
    paddingX: 10,
    logoHeight: 300,
    qrCodeSize: 260
};

// Util: Load image with fallback
const loadImageSafe = async (url, label = 'Image') => {
    try {
        const img = await loadImage(url);
        console.log(`${label} loaded successfully.`);
        return img;
    } catch (err) {
        console.warn(`Failed to load ${label}:`, err.message);
        return null;
    }
};

// Util: Draw LTR and RTL aligned fields
const drawTripleColumn = (ctx, y, left, center, right, fontSize = CANVAS_SETTINGS.smallFontSize) => {
    const colWidth = CANVAS_SETTINGS.canvasWidth / 3;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "right"; ctx.fillText(left, colWidth - 5, y);
    ctx.textAlign = "center"; ctx.fillText(center, colWidth * 1.5, y);
    ctx.textAlign = "left"; ctx.fillText(right, colWidth * 2 + 5, y);
};

// Util: Draw LTR and RTL aligned fields
const drawTripleColumnOppo = (ctx, y, left, center, right, fontSize = CANVAS_SETTINGS.smallFontSize) => {
    const totalWidth = CANVAS_SETTINGS.canvasWidth;
    const leftWidth = totalWidth * 0.28;
    const centerWidth = totalWidth * 0.44;
    const rightWidth = totalWidth * 0.28;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "right"; ctx.fillText(left, leftWidth - 5, y);
    ctx.textAlign = "center"; ctx.fillText(center, leftWidth + centerWidth / 2, y);
    ctx.textAlign = "left"; ctx.fillText(right, leftWidth + centerWidth + 5, y);
};

const drawReceipt = async (canvas, ctx, receiptData, logoImage, qrCodeImage) => {
    let y = 0;

    const drawText = (text, size, align = 'center', offsetY = CANVAS_SETTINGS.lineHeight, bold = false) => {
        ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
        ctx.textAlign = align;
        ctx.fillText(text, CANVAS_SETTINGS.canvasWidth / 2, y += offsetY);
    };

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';

    // Logo
    if (logoImage) {
        const scale = CANVAS_SETTINGS.logoHeight / logoImage.height;
        const logoX = (CANVAS_SETTINGS.canvasWidth - logoImage.width * scale) / 2;
        ctx.drawImage(logoImage, logoX, y, logoImage.width * scale, CANVAS_SETTINGS.logoHeight);
        y += CANVAS_SETTINGS.logoHeight + 5;
    }

    drawText(receiptData.companyNameArabic, CANVAS_SETTINGS.headerFontSize, 'center');
    drawText(receiptData.companyName, CANVAS_SETTINGS.headerFontSize, 'center');

    y += 10;
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "VAT NO", receiptData.vatNo, "الرقم الضريبي");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "CR NO", receiptData.crNo, "رقم السجل");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "PHONE NO", receiptData.phoneNo, "رقم الهاتف");

    // Address
    ctx.font = `${CANVAS_SETTINGS.smallFontSize - 2}px sans-serif`;
    ctx.textAlign = "center";
    wrapText(ctx, receiptData.address, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX * 2).forEach(line => {
        ctx.fillText(line, CANVAS_SETTINGS.canvasWidth / 2, y += CANVAS_SETTINGS.lineHeight - 5);
    });
    y += 15;

    // Invoice label
    ctx.fillStyle = "#ccc";
    ctx.fillRect(0, y, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight);
    ctx.fillStyle = "black";
    drawText("SIMPLIFIED TAX INVOICE / فاتورة ضريبية مبسطة", CANVAS_SETTINGS.smallFontSize - 2, 'center', CANVAS_SETTINGS.lineHeight / 2, true);
    y += 15;

    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Invoice No:", receiptData.invoiceNo, "رقم الفاتورة");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Date:", receiptData.date, "تاريخ الفاتورة");
    y += 20;

    if (receiptData.customer.name) {
        ctx.fillStyle = "#ccc";
        ctx.fillRect(0, y, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight);
        ctx.fillStyle = "black";
        drawText("Customer Information / معلومات العملاء", CANVAS_SETTINGS.smallFontSize - 2, 'center', CANVAS_SETTINGS.lineHeight / 2, true);
        drawTripleColumnOppo(ctx, y += CANVAS_SETTINGS.lineHeight, "Name", receiptData.customer.name, "اسم");
        if (receiptData.customer.vatNo) {
            drawTripleColumnOppo(ctx, y += CANVAS_SETTINGS.lineHeight, "VAT No", receiptData.customer.vatNo, "الرقم الضريبي");
        }
        if (receiptData.customer.phone) {
            drawTripleColumnOppo(ctx, y += CANVAS_SETTINGS.lineHeight, "Phone No", receiptData.customer.phone, "رقم الهاتف");
        }
        if (receiptData.customer.address) {
            ctx.font = `${CANVAS_SETTINGS.smallFontSize - 2}px sans-serif`;
            ctx.textAlign = "center";
            wrapText(ctx, receiptData.customer.address, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX * 2).forEach(line => {
                ctx.fillText(line, CANVAS_SETTINGS.canvasWidth / 2, y += CANVAS_SETTINGS.lineHeight - 5);
            });
        }
    }
    y += 10;

    // Header separator
    drawLine(ctx, y += 5);

    // Table Headers
    ctx.font = `bold ${CANVAS_SETTINGS.mediumFontSize}px sans-serif`;
    ctx.textAlign = "left"; ctx.fillText("Product", CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
    ctx.textAlign = "right";
    ctx.fillText("Price", CANVAS_SETTINGS.canvasWidth * 0.55, y + CANVAS_SETTINGS.lineHeight);
    ctx.fillText("Qty", CANVAS_SETTINGS.canvasWidth * 0.75, y + CANVAS_SETTINGS.lineHeight);
    ctx.fillText("Total", CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
    y += CANVAS_SETTINGS.lineHeight;

    drawLine(ctx, y += 5);

    receiptData.items.forEach((item, i) => {
        ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
        ctx.textAlign = "right"; ctx.fillText(item.nameArabic, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
        ctx.textAlign = "left"; ctx.fillText(`${i + 1}. ${item.nameEnglish}`, CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
        ctx.textAlign = "right";
        ctx.fillText(item.price, CANVAS_SETTINGS.canvasWidth * 0.55, y += CANVAS_SETTINGS.lineHeight);
        ctx.fillText(item.qty, CANVAS_SETTINGS.canvasWidth * 0.75, y);
        ctx.fillText(item.total, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y);
        y += 10;
    });

    ctx.font = `bold ${CANVAS_SETTINGS.mediumFontSize}px sans-serif`;
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Total", receiptData.subTotal, "الإجمالي بدون ضريبة");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Tax", receiptData.tax, "قيمة الضريبة");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Grand Total", receiptData.grandTotal, "المبلغ الإجمالي");

    // Payment
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.fillStyle = "#eee";
    ctx.fillRect(0, y += 10, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight + 5);
    ctx.fillStyle = "black";
    ctx.textAlign = "left"; ctx.fillText(`Paid by: ${receiptData.paymentMethod}`, CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight / 2 + 5);
    ctx.textAlign = "right"; ctx.fillText(`Amount: ${receiptData.paidAmount}`, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight / 2 + 5);
    if (receiptData.changeAmount != "") {
        y += CANVAS_SETTINGS.lineHeight;
        ctx.textAlign = "left"; ctx.fillText(`Change: ${receiptData.changeAmount}`, CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight / 2 + 5);
    }
    y += CANVAS_SETTINGS.lineHeight + 15;

    // QR code
    if (qrCodeImage) {
        ctx.drawImage(qrCodeImage, (CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.qrCodeSize) / 2, y, CANVAS_SETTINGS.qrCodeSize, CANVAS_SETTINGS.qrCodeSize);
        y += CANVAS_SETTINGS.qrCodeSize + 10;
    }

    // Footer
    drawText(receiptData.footerText, CANVAS_SETTINGS.smallFontSize);
    y += CANVAS_SETTINGS.lineHeight;

    ctx.font = `${CANVAS_SETTINGS.largeFontSize}px sans-serif`;
    receiptData.bankDetails.forEach(line => drawText(line, CANVAS_SETTINGS.smallFontSize - 2, 'center', CANVAS_SETTINGS.smallFontSize));
    return y;
};

// Draw line
const drawLine = (ctx, y) => {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(CANVAS_SETTINGS.canvasWidth, y); ctx.stroke();
};

// Text wrapping
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    let line = '', lines = [];
    for (let word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxWidth) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line = test;
        }
    }
    if (line) lines.push(line.trim());
    return lines;
}