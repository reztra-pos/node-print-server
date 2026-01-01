const express = require('express');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
process.env.PKG_ROOT = __dirname;
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { createCanvas, loadImage } = require('canvas');
const app = express();
const port = 4313;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
                canvasHeight += 65; // base height for every item
            
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

            await drawKot(canvas, ctx, saleInfo, kitchen);

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

app.post('/reztra-bill', async (req, res) => {
    const data = req.body;   

    let results = [];

    let printInterface = '';
    if (data.print_details.type == 'windows' && data.print_details.path !== '') {
        printInterface = `//localhost/${data.print_details.path}`;
    } else if (data.print_details.type == 'network' && data.print_details.printer_ip_address !== '') {
        printInterface = `tcp://${data.print_details.printer_ip_address}:${data.print_details.printer_port ? data.print_details.printer_port : 9600}`;
    } else {
        console.error("Printer not connected:", data.print_details);
        results.push({
            message: 'printer type not defined!',
            printer_info: data.print_details
        });
    }
    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: printInterface
    });
    try {
        let defaultHeight = 1250;
        if(data.sale_info.order_type == 'Delivery') {
            defaultHeight += 30
        }
        if(data.sale_info.order_type == 'Dine In') {
            defaultHeight += 30
        }

        const [logoImage] = await Promise.all([
            loadImageSafe(data.sale_info.invoice_logo, 'Logo')
        ]);

        if (!logoImage) defaultHeight -= 350;
        
        const items = Array.isArray(data.sale_info.items) ? data.sale_info.items : [];
        let canvasHeight = defaultHeight;
        const tempCanvas = createCanvas(CANVAS_SETTINGS.canvasWidth, canvasHeight);
        const tempCtx = tempCanvas.getContext('2d');
        
        items.forEach(item => {
            canvasHeight += 80; // base height for every item
        
            if (item.modifiers) {
                tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            
                const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                const lineCount = getWrappedLineCount(tempCtx, `Modifiers: ${item.modifiers}`, maxWidth);
            
                // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
            }
        
            if (item.m_price) {
                tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            
                const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                const lineCount = getWrappedLineCount(tempCtx, `Modifier Price: ${item.m_price}`, maxWidth);
            
                // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
            }
        });
        const canvas = createCanvas(CANVAS_SETTINGS.canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");
        await drawBill(canvas, ctx, data.sale_info, logoImage);
        await printer.printImageBuffer(canvas.toBuffer('image/png'));
        printer.cut();
        await printer.execute();
        console.log(`Print command sent successfully!`);
        results.push({
            message: 'Print successful!',
            interface: printInterface
        });
    } catch (error) {
        console.error(`Print failed:`, error);
        results.push({
            message: 'Print failed!',
            error: error.message
        });
    }

    // ✅ Send response once after loop
    res.json({
        message: 'Printing completed',
        results
    });
});

app.post('/reztra-invoice', async (req, res) => {
    const data = req.body;   

    let results = [];

    let printInterface = '';
    if (data.print_details.type == 'windows' && data.print_details.path !== '') {
        printInterface = `//localhost/${data.print_details.path}`;
    } else if (data.print_details.type == 'network' && data.print_details.printer_ip_address !== '') {
        printInterface = `tcp://${data.print_details.printer_ip_address}:${data.print_details.printer_port ? data.print_details.printer_port : 9600}`;
    } else {
        console.error("Printer not connected:", data.print_details);
        results.push({
            message: 'printer type not defined!',
            printer_info: data.print_details
        });
    }
    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: printInterface
    });
    try {
        let defaultHeight = 1350;
        if(data.sale_info.order_type == 'Delivery') {
            defaultHeight += 25
        }
        if(data.sale_info.order_type == 'Dine In') {
            defaultHeight += 25
        }

        const base64Data = data.sale_info?.qr_code?.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync("qr.png", base64Data, "base64");

        const [logoImage, qrCodeImage] = await Promise.all([
            loadImageSafe(data.sale_info.invoice_logo, 'Logo'),
            loadImageSafe('qr.png', 'QR Code')
        ]);

        if (!logoImage) defaultHeight -= 350;
        if (!qrCodeImage) defaultHeight -= 250;

        if(data.sale_info.customer_id && data.sale_info.customer_id != 1 && data.sale_info.sale_type != 'Delivery') {
            defaultHeight += 50
        }
        let canvasHeight = defaultHeight;
        const tempCanvas = createCanvas(CANVAS_SETTINGS.canvasWidth, canvasHeight);
        const tempCtx = tempCanvas.getContext('2d');

        const refundItems = Array.isArray(data.sale_info?.refund?.items) ? data.sale_info?.refund?.items : [];
        if(refundItems.length > 0) {
            canvasHeight += 80
        
            refundItems.forEach(item => {
                canvasHeight += 70; // base height for every item
            
                if (item.modifiers) {
                    tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
                
                    const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                    const lineCount = getWrappedLineCount(tempCtx, `Modifiers: ${item.modifiers}`, maxWidth);
                
                    // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                    canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
                }
            
                if (item.m_price) {
                    tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
                
                    const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                    const lineCount = getWrappedLineCount(tempCtx, `Modifier Price: ${item.m_price}`, maxWidth);
                
                    // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                    canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
                }
            });
        }
        
        const items = Array.isArray(data.sale_info.items) ? data.sale_info.items : [];
        
        items.forEach(item => {
            canvasHeight += 70; // base height for every item
        
            if (item.modifiers) {
                tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            
                const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                const lineCount = getWrappedLineCount(tempCtx, `Modifiers: ${item.modifiers}`, maxWidth);
            
                // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
            }
        
            if (item.m_price) {
                tempCtx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            
                const maxWidth = CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2);
                const lineCount = getWrappedLineCount(tempCtx, `Modifier Price: ${item.m_price}`, maxWidth);
            
                // add extra height for wrapped lines (1 line already covered in base 85, so add only the rest)
                canvasHeight += (lineCount * CANVAS_SETTINGS.lineHeight);
            }
        });
        const canvas = createCanvas(CANVAS_SETTINGS.canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");
        await drawInvoice(canvas, ctx, data.sale_info, logoImage, qrCodeImage);
        await printer.printImageBuffer(canvas.toBuffer('image/png'));
        printer.cut();
        printer.openCashDrawer();
        await printer.execute();
        console.log(`Print command sent successfully!`);
        results.push({
            message: 'Print successful!',
            interface: printInterface
        });
    } catch (error) {
        console.error(`Print failed:`, error);
        results.push({
            message: 'Print failed!',
            error: error.message
        });
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
    canvasWidth: 384,        // ✅ 56mm printer width
    lineHeight: 28,          // tighter lines
    smallFontSize: 18,
    mediumFontSize: 20,
    largeFontSize: 22,
    headerFontSize: 24,
    paddingX: 8,
    logoHeight: 180,         // reduced
    qrCodeSize: 180          // reduced
};

const drawKot = async (canvas, ctx, saleInfo, kitchen) => {
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
    drawText(`Order No: ${saleInfo.order_no}`, CANVAS_SETTINGS.headerFontSize, 'center');
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

const drawBill = async (canvas, ctx, saleInfo, logoImage) => {
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

    drawText(saleInfo.firm_name_1, CANVAS_SETTINGS.headerFontSize, 'center');
    drawText(saleInfo.firm_name_2, CANVAS_SETTINGS.headerFontSize, 'center');

    y += 10;
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "VAT NO", saleInfo.vat_no, "الرقم الضريبي");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "CR NO", saleInfo.cr_no, "رقم السجل");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "PHONE NO", saleInfo.phone, "رقم الهاتف");

    let centerX = CANVAS_SETTINGS.canvasWidth / 2;

    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    let lineCounts = wrapText(
        ctx,
        saleInfo.address,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );

    // move y down according to wrapped lines
    y += (lineCounts - 1) * CANVAS_SETTINGS.lineHeight;
    y += 20;

    // Invoice label
    ctx.fillStyle = "#ccc";
    ctx.fillRect(0, y, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight);
    ctx.fillStyle = "black";
    drawText("DRAFT INVOICE / مسودة الفاتورة", CANVAS_SETTINGS.smallFontSize - 2, 'center', CANVAS_SETTINGS.lineHeight / 2, true);
    y += 15;

    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Draft No", saleInfo.sale_no, "رقم الفاتورة");
    // y += CANVAS_SETTINGS.lineHeight;
    // const [date, time] = saleInfo.date_time.split(" ");
    // drawTripleColumn(ctx, y, "Date", date, "تاريخ الفاتورة");
    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    lineCounts = wrapText(
        ctx,
        `Date: ${saleInfo.date_time} : تاريخ الفاتورة`,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );
    // drawTripleColumn(ctx, y, "", time, "");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Order Type", saleInfo.order_type, "نوع الطلب");
    if(saleInfo.orders_table_text != '') {
        drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Table Name", saleInfo.orders_table_text, "اسم الجدول");
    }
    if(saleInfo.order_type == 'Delivery') {
        drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Reference No", saleInfo.delivery_partner_ref_no, "الرقم المرجعي");
    }
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Order No", saleInfo.order_no, "رقم الطلب", 28);
    y += 10;

    // Header separator
    drawLine(ctx, y += 5);

    // Table Headers
    ctx.font = `bold ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "left"; ctx.fillText("Product", CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
    ctx.textAlign = "right";
    ctx.fillText("Price", CANVAS_SETTINGS.canvasWidth * 0.55, y + CANVAS_SETTINGS.lineHeight);
    ctx.fillText("Qty", CANVAS_SETTINGS.canvasWidth * 0.75, y + CANVAS_SETTINGS.lineHeight);
    ctx.fillText("Total", CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
    y += CANVAS_SETTINGS.lineHeight;

    drawLine(ctx, y += 5);

    saleInfo.items.forEach((item, i) => {
        ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
        ctx.textAlign = "right"; ctx.fillText(item.name2, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
        ctx.textAlign = "left"; ctx.fillText(`${i + 1}. ${item.name}`, CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
        ctx.textAlign = "right";
        ctx.fillText(item.price, CANVAS_SETTINGS.canvasWidth * 0.55, y += CANVAS_SETTINGS.lineHeight);
        ctx.fillText(item.qty, CANVAS_SETTINGS.canvasWidth * 0.75, y);
        ctx.fillText(item.total, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y);
        y += 10;
        if (item.modifiers) {
            y += CANVAS_SETTINGS.lineHeight;
            ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            ctx.textAlign = "left";
            const lineCount = wrapText(
                ctx,
                `Modifiers: ${item.modifiers}`,
                CANVAS_SETTINGS.paddingX,
                y,
                CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                CANVAS_SETTINGS.lineHeight
            );
        
            // move y down according to wrapped lines
            y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
            y += 10;
        }
        if (item.m_price) {
            y += CANVAS_SETTINGS.lineHeight;
            ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            ctx.textAlign = "left";
            const lineCount = wrapText(
                ctx,
                `Modifier Price: ${item.m_price}`,
                CANVAS_SETTINGS.paddingX,
                y,
                CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                CANVAS_SETTINGS.lineHeight
            );
        
            // move y down according to wrapped lines
            y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
            y += 10;
        }
    });

    y += 30;

    // Header separator
    drawLine(ctx, y += 5);
    y += 10;

    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Total", saleInfo.sub_total, "الإجمالي بدون ضريبة", CANVAS_SETTINGS.mediumFontSize);
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Tax", saleInfo.tax_amt, "قيمة الضريبة", CANVAS_SETTINGS.mediumFontSize);
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Grand Total", saleInfo.total_payable, "المبلغ الإجمالي", CANVAS_SETTINGS.mediumFontSize);

    // Header separator
    drawLine(ctx, y += 5);
    y += 20;

    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    let lineCount = wrapText(
        ctx,
        `هذه مسودة فاتورة أولية، يرجى استلام الفاتورة الأصلية من أمين الصندوق`,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );

    // move y down according to wrapped lines
    y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;

    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    lineCount = wrapText(
        ctx,
        `This is a primary draft invoice, please collect original invoice from cashier`,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );

    // move y down according to wrapped lines
    y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;

    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    lineCount = wrapText(
        ctx,
        saleInfo.invoice_footer,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );

    // move y down according to wrapped lines
    y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;

    return y;
};

const drawInvoice = async (canvas, ctx, saleInfo, logoImage, qrCodeImage) => {
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

    drawText(saleInfo.firm_name_1, CANVAS_SETTINGS.headerFontSize, 'center');
    drawText(saleInfo.firm_name_2, CANVAS_SETTINGS.headerFontSize, 'center');

    y += 10;
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "VAT NO", saleInfo.vat_no, "الرقم الضريبي");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "CR NO", saleInfo.cr_no, "رقم السجل");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "PHONE NO", saleInfo.phone, "رقم الهاتف");

    let centerX = CANVAS_SETTINGS.canvasWidth / 2;

    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    let lineCounts = wrapText(
        ctx,
        saleInfo.address,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );

    // move y down according to wrapped lines
    y += (lineCounts - 1) * CANVAS_SETTINGS.lineHeight;
    y += 20;

    // Invoice label
    ctx.fillStyle = "#ccc";
    ctx.fillRect(0, y, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight);
    ctx.fillStyle = "black";
    drawText("SIMPLIFIED TAX INVOICE / فاتورة ضريبية مبسطة", CANVAS_SETTINGS.smallFontSize - 2, 'center', CANVAS_SETTINGS.lineHeight / 2, true);
    y += 15;

    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Invoice No", saleInfo.sale_no, "رقم الفاتورة");
    // y += CANVAS_SETTINGS.lineHeight;
    // drawTripleColumn(ctx, y, "Date", saleInfo.date, "تاريخ الفاتورة");
    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    lineCounts = wrapText(
        ctx,
        `Date: ${saleInfo.date} ${saleInfo.time_inv} : تاريخ الفاتورة`,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );
    // drawTripleColumn(ctx, y, "", saleInfo.time_inv, "");
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Order No", saleInfo.order_no, "رقم الطلب", 28);
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Order Type", saleInfo.sale_type, "نوع الطلب");
    y += CANVAS_SETTINGS.lineHeight;
    if(saleInfo.sale_type == 'Delivery') {
        drawTripleColumn(ctx, y, "", saleInfo.delivery_partner_name, "");
        drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Reference No", saleInfo.delivery_partner_ref_no, "الرقم المرجعي");
        y += CANVAS_SETTINGS.lineHeight;
    }
    if(saleInfo.customer_id && saleInfo.customer_id != 1 && saleInfo.sale_type != 'Delivery') {
        // Customer label
        ctx.fillStyle = "#ccc";
        ctx.fillRect(0, y, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight);
        ctx.fillStyle = "black";
        drawText("Customer Detail / تفاصيل العميل", CANVAS_SETTINGS.smallFontSize - 2, 'center', CANVAS_SETTINGS.lineHeight / 2, true);
        if(saleInfo.customer_name && saleInfo.customer_name != '') {
            drawText(saleInfo.customer_name, CANVAS_SETTINGS.smallFontSize, 'center');
        }
        if(saleInfo.customer_trn_number && saleInfo.customer_trn_number != '') {
            drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "TRN", saleInfo.customer_trn_number, "الرقم الضريبي");
        }
    }
    y += 10;

    // Header separator
    drawLine(ctx, y += 5);

    // Table Headers
    ctx.font = `bold ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "left"; ctx.fillText("Product", CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
    ctx.textAlign = "right";
    ctx.fillText("Price", CANVAS_SETTINGS.canvasWidth * 0.55, y + CANVAS_SETTINGS.lineHeight);
    ctx.fillText("Qty", CANVAS_SETTINGS.canvasWidth * 0.75, y + CANVAS_SETTINGS.lineHeight);
    ctx.fillText("Total", CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
    y += CANVAS_SETTINGS.lineHeight;

    drawLine(ctx, y += 5);

    saleInfo.items.forEach((item, i) => {
        ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
        ctx.textAlign = "right"; ctx.fillText(item.name2, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
        ctx.textAlign = "left"; ctx.fillText(`${i + 1}. ${item.name}`, CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
        ctx.textAlign = "right";
        ctx.fillText(item.price, CANVAS_SETTINGS.canvasWidth * 0.55, y += CANVAS_SETTINGS.lineHeight);
        ctx.fillText(item.qty, CANVAS_SETTINGS.canvasWidth * 0.75, y);
        ctx.fillText(item.total, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y);
        y += 10;
        if (item.modifiers) {
            y += CANVAS_SETTINGS.lineHeight;
            ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            ctx.textAlign = "left";
            const lineCount = wrapText(
                ctx,
                `Modifiers: ${item.modifiers}`,
                CANVAS_SETTINGS.paddingX,
                y,
                CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                CANVAS_SETTINGS.lineHeight
            );
        
            // move y down according to wrapped lines
            y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
            y += 10;
        }
        if (item.m_price) {
            y += CANVAS_SETTINGS.lineHeight;
            ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            ctx.textAlign = "left";
            const lineCount = wrapText(
                ctx,
                `Modifier Price: ${item.m_price}`,
                CANVAS_SETTINGS.paddingX,
                y,
                CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                CANVAS_SETTINGS.lineHeight
            );
        
            // move y down according to wrapped lines
            y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
            y += 10;
        }
    });

    y += 30;

    // Header separator
    drawLine(ctx, y += 5);
    y += 10;

    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Total", saleInfo.sub_total, "الإجمالي بدون ضريبة", CANVAS_SETTINGS.mediumFontSize);
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Tax", saleInfo.tax_amt, "قيمة الضريبة", CANVAS_SETTINGS.mediumFontSize);
    drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Grand Total", saleInfo.total_payable, "المبلغ الإجمالي", CANVAS_SETTINGS.mediumFontSize);

    // Payment
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.fillStyle = "#eee";
    ctx.fillRect(0, y += 10, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight + 5);
    ctx.fillStyle = "black";

    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "left";

    const startX = CANVAS_SETTINGS.paddingX; // left side position

    lineCounts = wrapText(
        ctx,
        `Paid by: ${saleInfo.payments}`,
        startX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );

    // move down based on wrapped lines
    y += (lineCounts - 1) * CANVAS_SETTINGS.lineHeight;

    ctx.textAlign = "left";
    ctx.fillText(`Amount: ${saleInfo.given_amount}`, CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight / 2 + 5);

    ctx.textAlign = "right";
    ctx.fillText(
        `Change: ${saleInfo.change_amount}`,
        CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX,
        y + CANVAS_SETTINGS.lineHeight / 2 + 5
    );
    y += CANVAS_SETTINGS.lineHeight + 15;

    // Header separator
    drawLine(ctx, y += 5);

    const refundItems = Array.isArray(saleInfo.refund?.items) ? saleInfo.refund?.items : [];
    if(refundItems.length > 0) {
        // Refund label
        y += 15;
        ctx.fillStyle = "#ccc";
        ctx.fillRect(0, y, CANVAS_SETTINGS.canvasWidth, CANVAS_SETTINGS.lineHeight);
        ctx.fillStyle = "black";
        drawText("REFUND / استرداد", CANVAS_SETTINGS.smallFontSize - 2, 'center', CANVAS_SETTINGS.lineHeight / 2, true);
        y += 15;

        // Header separator
        drawLine(ctx, y += 5);

        // Table Headers
        ctx.font = `bold ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
        ctx.textAlign = "left"; ctx.fillText("Product", CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
        ctx.textAlign = "right";
        ctx.fillText("Price", CANVAS_SETTINGS.canvasWidth * 0.55, y + CANVAS_SETTINGS.lineHeight);
        ctx.fillText("Qty", CANVAS_SETTINGS.canvasWidth * 0.75, y + CANVAS_SETTINGS.lineHeight);
        ctx.fillText("Total", CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y + CANVAS_SETTINGS.lineHeight);
        y += CANVAS_SETTINGS.lineHeight;

        drawLine(ctx, y += 5);

        refundItems.forEach((item, i) => {
            ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
            ctx.textAlign = "right"; ctx.fillText(item.name2, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
            ctx.textAlign = "left"; ctx.fillText(`${i + 1}. ${item.name}`, CANVAS_SETTINGS.paddingX, y += CANVAS_SETTINGS.lineHeight);
            ctx.textAlign = "right";
            ctx.fillText(item.price, CANVAS_SETTINGS.canvasWidth * 0.55, y += CANVAS_SETTINGS.lineHeight);
            ctx.fillText(item.qty, CANVAS_SETTINGS.canvasWidth * 0.75, y);
            ctx.fillText(item.total, CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX, y);
            y += 10;
            if (item.modifiers) {
                y += CANVAS_SETTINGS.lineHeight;
                ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
                ctx.textAlign = "left";
                const lineCount = wrapText(
                    ctx,
                    `Modifiers: ${item.modifiers}`,
                    CANVAS_SETTINGS.paddingX,
                    y,
                    CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                    CANVAS_SETTINGS.lineHeight
                );
            
                // move y down according to wrapped lines
                y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
                y += 10;
            }
            if (item.m_price) {
                y += CANVAS_SETTINGS.lineHeight;
                ctx.font = `italic ${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
                ctx.textAlign = "left";
                const lineCount = wrapText(
                    ctx,
                    `Modifier Price: ${item.m_price}`,
                    CANVAS_SETTINGS.paddingX,
                    y,
                    CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
                    CANVAS_SETTINGS.lineHeight
                );
            
                // move y down according to wrapped lines
                y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;
                y += 10;
            }
        });

        y += 30;

        // Header separator
        drawLine(ctx, y += 5);
        y += 10;

        drawTripleColumn(ctx, y += CANVAS_SETTINGS.lineHeight, "Total", saleInfo.refund.total, "الإجمالي بدون ضريبة", CANVAS_SETTINGS.mediumFontSize);

        y += CANVAS_SETTINGS.lineHeight;
        ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
        ctx.textAlign = "left";

        const startXs = CANVAS_SETTINGS.paddingX; // left side position

        lineCounts = wrapText(
            ctx,
            `Paid by: ${saleInfo.refund.payment}`,
            startXs,
            y,
            CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
            CANVAS_SETTINGS.lineHeight
        );

        // move down based on wrapped lines
        y += (lineCounts - 1) * CANVAS_SETTINGS.lineHeight;
    }

    // QR code
    if (qrCodeImage) {
        ctx.drawImage(qrCodeImage, (CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.qrCodeSize) / 2, y, CANVAS_SETTINGS.qrCodeSize, CANVAS_SETTINGS.qrCodeSize);
        y += CANVAS_SETTINGS.qrCodeSize + 10;
    }

    y += CANVAS_SETTINGS.lineHeight;
    ctx.font = `${CANVAS_SETTINGS.smallFontSize}px sans-serif`;
    ctx.textAlign = "center";
    lineCount = wrapText(
        ctx,
        saleInfo.invoice_footer,
        centerX,
        y,
        CANVAS_SETTINGS.canvasWidth - (CANVAS_SETTINGS.paddingX * 2),
        CANVAS_SETTINGS.lineHeight
    );

    // move y down according to wrapped lines
    y += (lineCount - 1) * CANVAS_SETTINGS.lineHeight;

    return y;
};

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth && n > 0) {
            lines.push(line.trim());
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line.trim());

    // Draw with left alignment
    lines.forEach((l, i) => {
        ctx.fillText(l, x, y + (i * lineHeight));
    });

    return lines.length;
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

// Util: Draw LTR and RTL aligned fields
const drawTripleColumn = (
    ctx,
    y,
    left,
    center,
    right,
    fontSize = CANVAS_SETTINGS.smallFontSize
) => {
    const totalWidth = CANVAS_SETTINGS.canvasWidth;

    const leftWidth   = totalWidth * 0.28; // 28%
    const centerWidth = totalWidth * 0.44; // 44%
    const rightWidth  = totalWidth * 0.28; // 28%

    ctx.font = `${fontSize}px sans-serif`;

    // LEFT
    ctx.textAlign = "left";
    ctx.fillText(left, CANVAS_SETTINGS.paddingX, y);

    // CENTER
    ctx.textAlign = "center";
    ctx.fillText(center, leftWidth + centerWidth / 2, y);

    // RIGHT
    ctx.textAlign = "right";
    ctx.fillText(
        right,
        CANVAS_SETTINGS.canvasWidth - CANVAS_SETTINGS.paddingX,
        y
    );
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

// Draw line
const drawLine = (ctx, y) => {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(CANVAS_SETTINGS.canvasWidth, y); ctx.stroke();
};