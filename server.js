const express = require('express');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
process.env.PKG_ROOT = __dirname;
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { createCanvas, loadImage } = require('canvas');
const app = express();
const port = 4311;

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
app.post('/reztra-kot', async (req, res) => {
    const data = req.body;   

    let results = [];

    for (const [key, kitchen] of Object.entries(data.kitchens)) {
        let printInterface = '';
        if (kitchen.printer_info.type == 'windows' && kitchen.printer_info.share_name !== '') {
            printInterface = `//localhost/${kitchen.printer_info.share_name}`;
        } else if (kitchen.printer_info.type == 'network' && kitchen.printer_info.ip_address !== '') {
            printInterface = `tcp://${kitchen.printer_info.ip_address}:${kitchen.printer_info.port ? kitchen.printer_info.port : 9600}`;
        } else {
            console.error("Printer not connected:", kitchen.printer_info);
            results.push({
                kitchen: key,
                message: 'printer type not defined!',
                printer_info: kitchen.printer_info
            });
            continue; // skip to next kitchen
        }

        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: printInterface
        });

        try {
            let defaultHeight = 180;
            if(data.sale_type == 'Delivery') {
                defaultHeight += 30
            }
            if(data.sale_type == 'Dine In') {
                defaultHeight += 30
            }

            const saleInfo = {
                sale_type: data.sale_type,
                order_no: data.order_no,
                customer_name: data.customer_name,
                is_self_order: data.is_self_order,
                delivery_partner_name: data.delivery_partner_name,
                delivery_partner_ref_no: data.delivery_partner_ref_no,
                waiter_name: data.waiter_name,
                sale_no: data.sale_no,
                date: data.date,
                table_details: data.table_details,
                table_id: data.table_id,
            };

            const items = Array.isArray(kitchen.items) ? kitchen.items : [];
            let canvasHeight = defaultHeight;

            const tempCanvas = createCanvas(CANVAS_SETTINGS.canvasWidth, canvasHeight);
            const tempCtx = tempCanvas.getContext('2d');
            
            items.forEach(item => {
                canvasHeight += 85; // base height for every item
            
                if (item.note) {
                    tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
                
                    const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                    const lineCount = getWrappedLineCount(tempCtx, `Note: ${item.note}`, maxWidth);
                
                    // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                    canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
                }
            
                if (item.modifiers_name) {
                    tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
                
                    const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                    const lineCount = getWrappedLineCount(tempCtx, `Modifiers: ${item.modifiers_name}`, maxWidth);
                
                    // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                    canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
                }
            });

            const canvas = createCanvas(CANVAS_SETTINGS.canvasWidth, canvasHeight);
            const ctx = canvas.getContext("2d");

            await drawReceipt(canvas, ctx, saleInfo, kitchen);

            await printer.printImageBuffer(canvas.toBuffer('image/png'));
            printer.cut();
            await printer.execute();

            console.log(`Print command sent successfully for kitchen ${key}!`);
            results.push({
                kitchen: key,
                message: 'Print successful!',
                interface: printInterface
            });

        } catch (error) {
            console.error(`Print failed for kitchen ${key}:`, error);
            results.push({
                kitchen: key,
                message: 'Print failed!',
                error: error.message
            });
        }
    }

    // ✅ Send response once after loop
    res.json({
        message: 'Printing completed',
        results
    });
});

// POST API
app.get('/', (req, res) => {
    res.json({
        message: 'Server running successfullys!'
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

const drawReceipt = async (canvas, ctx, saleInfo, kitchen) => {
    let y = 0;

    const drawText = (text, size, align = 'center', offsetY = CANVAS_SETTINGS.lineHeight, bold = false) => {
        ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
        ctx.textAlign = align;
        ctx.fillText(text, CANVAS_SETTINGS.canvasWidth / 2, y += offsetY);
    };

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';

    drawText(`KOT: ${kitchen.kitchen_name}`, CANVAS_SETTINGS.headerFontSize, 'center');
    drawText(`Order Type: ${saleInfo.sale_type}`, CANVAS_SETTINGS.headerFontSize, 'center');
    drawText(`Order Number: ${saleInfo.order_no}`, CANVAS_SETTINGS.headerFontSize, 'center');
    if(saleInfo.sale_type == 'Dine In') {
        drawText(`Table Name: ${saleInfo.table_details}`, CANVAS_SETTINGS.headerFontSize, 'center');
    }

    y += 10;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    drawText(`Customer: ${saleInfo.customer_name}, Waiter: ${saleInfo.waiter_name}`, CANVAS_SETTINGS.smallFontSize, 'center');
    drawText(`Date: ${saleInfo.date}`, CANVAS_SETTINGS.smallFontSize, 'center');
    if(saleInfo.sale_type == 'Delivery') {
        drawText(`Reference No: ${saleInfo.delivery_partner_ref_no}`, CANVAS_SETTINGS.smallFontSize, 'center');
    }

    kitchen.items.forEach((item, i) => {
        ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
        ctx.textAlign = "right"; ctx.fillText(`${item.parent_secondary_name} ${item.secondary_name}`, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
        y += CANVAS_SETTINGS.lineHeight;
        ctx.textAlign = "left";ctx.fillText(`#${i + 1}. ${item.parent_primary_name} ${item.primary_name}`, CANVAS_SETTINGS.paddingX, y);
        ctx.textAlign = "right";ctx.fillText(`QTY: ${item.qty}`, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y);
        y += 10;
        if (item.modifiers_name) {
            y += CANVAS_SETTINGS.lineHeight;
            ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            ctx.textAlign = "left";
            const lineCount = wrapText(
                ctx,
                `Modifiers: ${item.modifiers_name}`,
                CANVAS_SETTINGS.paddingX,
                y,
                CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                CANVAS_SETTINGS.lineHeight
            );
        
            // move y down according to wrapped lines
            y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
            y += 10;
        }
        if (item.note) {
            y += CANVAS_SETTINGS.lineHeight;
            ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            ctx.textAlign = "left";
            const lineCount = wrapText(
                ctx,
                `Note: ${item.note}`,
                CANVAS_SETTINGS.paddingX,
                y,
                CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                CANVAS_SETTINGS.lineHeight
            );
        
            // move y down according to wrapped lines
            y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
        }
    });

    return y;
};

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    lines.forEach((l, i) => {
        ctx.fillText(l.trim(), x, y + (i * lineHeight));
    });

    return lines.length; // return number of lines so you can adjust y
}

function getWrappedLineCount(ctx, text, maxWidth) {
    const words = text.split(' ');
    let line = '';
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth && n > 0) {
            lineCount++;
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lineCount++;
    return lineCount;
}
