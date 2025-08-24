const express = require('express');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
const puppeteer = require('puppeteer');
const path = require('path');
const { print } = require('pdf-to-printer');
process.env.PKG_ROOT = __dirname;
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const { createCanvas, loadImage } = require('canvas');
const app = express();
const port = 4444;

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

app.get('/a4-print-server', async (req, res) => {
    console.log(req.body);
    
    // const htmlContent = req.body.html;
    // const printerName = req.body.printerDetails?.deviceName;
    const pdfPath = path.join(__dirname, 'generated-print.pdf');
    
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setContent(`
            <html lang="en"><head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALM-INV-197</title>
    <link rel="stylesheet" href="http://localhost/Reztra/supermarket/assets/plugins/local/google_font.css">
    <link rel="stylesheet" href="http://localhost/Reztra/supermarket/frequent_changing/css/print_invoice_a4.css">
    <link rel="stylesheet" href="http://localhost/Reztra/supermarket/frequent_changing/css/inv_common.css">
    <link rel="stylesheet" href="http://localhost/Reztra/supermarket/assets/bootstrap/bootstrap.min.css?var=1.6">
<style>
    * {
        border-color: #6b6e73 !important;
    }
    .table>:not(caption)>*>* {
        padding: .3rem;
    }
    .trm-cond p {
        margin-bottom: 0;
    }
    .p-zero p {
        padding: 0 !important;
        margin: 0 !important;
    }
    .bg-00c53 {
        background-color: #f2f5f7 !important;
    }
    table tbody tr:nth-child(even) {
        background-color: white !important;
    }
    .border-dark {
        border-color: #6b6e73 !important;
    }
    .remove-here-tr-top {
        border-top: none !important;
    }
    .remove-here-tr-bottom {
        border-bottom: none !important;
    }
    .note-p p {
        font-size: 10px;
    }
</style><link rel="stylesheet" type="text/css" href="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/styles/inject.css"><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/utils/constants.js"></script><div id="vsc-constants-loaded" style="display: none;">Constants loaded at 2025-08-07T15:53:49.896Z</div><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/utils/logger.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/utils/debug-helper.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/utils/dom-utils.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/utils/event-manager.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/core/storage-manager.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/core/settings.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/observers/media-observer.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/observers/mutation-observer.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/core/action-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/core/video-controller.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/ui/controls.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/ui/drag-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/ui/shadow-dom.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/site-handlers/base-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/site-handlers/netflix-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/site-handlers/youtube-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/site-handlers/facebook-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/site-handlers/amazon-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/site-handlers/apple-handler.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/site-handlers/index.js"></script><script src="chrome-extension://nffaoalbilbmmfgbnbgppjihopabppdk/src/content/inject.js"></script><div id="vsc-test-indicator" style="display: none;"></div></head>

<body class="vsc-domain-localhost vsc-initialized">
    <div id="wrapper" class="m-auto border-2s-e4e5ea br-5">
                        <div class="container my-4">
                    <!-- Company Info and Logo -->
<div class="align-items-center mb-1 row">
    <div class="col-2">
        <div class="border border-1 p-1 border-dark text-center mt-3">
                            <img src="http://localhost/Reztra/supermarket/uploads/site_settings/1751716596.png" alt="Logo" style="width: 100%;">
                    </div>
    </div>
    <div class="col-8 text-center">
        <p class="font-size-18"><b>Tax Invoice / فاتورة ضريبية</b></p>
        <table class="table table-bordered mb-1">
            <tbody><tr>
                <th class="font-size-12 text-left bg-00c53"> Invoice Number</th>
                <th class="font-size-12 text-left">ALM-INV-197</th>
                <th class="font-size-12 text-end">ALM-INV-197</th>
                <th class="font-size-12 text-end bg-00c53"> رقم الفاتورة</th>
            </tr>
            <tr>
                <th class="font-size-12 text-left bg-00c53"> Invoice Date</th>
                <th class="font-size-12 text-left">06/08/2025</th>
                <th class="font-size-12 text-end">٢٠٢٥-٠٨-٠٦</th>
                <th class="font-size-12 text-end bg-00c53"> تاريخ الفاتورة</th>
            </tr>
            <tr>
                <th class="font-size-12 text-left bg-00c53"> Supply Date</th>
                <th class="font-size-12 text-left"></th>
                <th class="font-size-12 text-end"></th>
                <th class="font-size-12 text-end bg-00c53"> تاريخ التوريد</th>
            </tr>
        </tbody></table>
    </div>
    <div class="col-2">
        <div class="border border-1 p-1 border-dark text-center  mt-3">
                            <img src="http://localhost/Reztra/supermarket/uploads/qr_code/100.png" alt="QR Code" style="width: 100%;filter: brightness(0.6) contrast(0.7);">
                    </div>
    </div>
    <div class="col-12 mt-1">
        <div class="border-bottom-dotted-gray"></div>
    </div>
</div>                    <div class="row align-items-center mb-1">
    <div class="col-6">
        <p class="mb-0 pb-0 font-size-14"><strong>Seller Information</strong></p>
        <p class="bg-00c53 border p-1 px-2 rounded-3 font-size-12 mb-1"><b>Al Madina Electronics Co.</b></p>
    </div>
    <div class="col-6 text-end">
        <p class="mb-0 pb-0 font-size-14"><strong>معلومات البائع</strong></p>
        <p class="bg-00c53 border p-1 px-2 rounded-3 font-size-12 mb-1"><b>شركة المدينة للإلكترونيات</b></p>
    </div>
</div>
<table class="table table-bordered font-size-10 mb-1">
    <tbody><tr>
        <th class="bg-00c53" style="width: 12%;">Street Name</th>
        <th class="" colspan="5">Prince Sultan Road</th>
        <th class="text-end" colspan="5">طريق الأمير سلطان</th>
        <th class="text-end bg-00c53" style="width: 12%;">اسم الشارع</th>
    </tr>
    <tr>
        <th class="bg-00c53">Building No </th>
        <th colspan="2">45</th>
        <th class="bg-00c53" style="width: 8%;">City</th>
        <th colspan="2">Jeddah</th>
        <th class="text-end" colspan="2">جدة</th>
        <th class="text-end bg-00c53" style="width: 8%;">مدينة </th>
        <th class="text-end" colspan="2">45</th>
        <th class="text-end bg-00c53">رقم المبنى</th>
    </tr>
    <tr>
        <th class="bg-00c53">Secondary No </th>
        <th colspan="2">1234</th>
        <th class="bg-00c53">District</th>
        <th colspan="2">An Nahdah</th>
        <th class="text-end" colspan="2">النهضة</th>
        <th class="text-end bg-00c53">اﻟﺤﻲ</th>
        <th class="text-end" colspan="2">1234</th>
        <th class="text-end bg-00c53">اﻟﺮﻗﻢ اﻟﻔﺮﻋﻲ</th>
    </tr>
    <tr>
        <th class="bg-00c53">Postal Code</th>
        <th colspan="2">23523</th>
        <th class="bg-00c53">Country</th>
        <th colspan="2">Saudi Arabia</th>
        <th class="text-end" colspan="2">المملكة العربية السعودية</th>
        <th class="text-end bg-00c53">دولة</th>
        <th class="text-end" colspan="2">23523</th>
        <th class="text-end bg-00c53">رمز بريدي</th>
    </tr>
    <tr>
        <th class="bg-00c53">TRN</th>
        <th colspan="2">310456789100004</th>
        <th class="bg-00c53">CRN</th>
        <th colspan="2">9876543210</th>
        <th class="text-end" colspan="2">9876543210</th>
        <th class="text-end bg-00c53">رقم السجل</th>
        <th class="text-end" colspan="2">310456789100004</th>
        <th class="text-end bg-00c53">الرقم الضريبي</th>
    </tr>
</tbody></table>                    <div class="row align-items-center mb-1">
    <div class="col-6">
        <p class="mb-0 pb-0 font-size-14"><strong>Customer Information</strong></p>
    </div>
    <div class="col-6 text-end">
        <p class="mb-0 pb-0 font-size-14"><strong>معلومات العملاء</strong></p>
    </div>
</div>
<table class="table table-bordered font-size-10 mb-1">
    <tbody><tr>
        <th class="bg-00c53" style="width: 12%;">Name</th>
        <th class="" colspan="5">Walk-in Customer</th>
        <th class="text-end" colspan="5"></th>
        <th class="text-end bg-00c53" style="width: 12%;">اسم</th>
    </tr>
    <tr>
        <th class="bg-00c53">Street Name</th>
        <th class="" colspan="5"></th>
        <th class="text-end" colspan="5"></th>
        <th class="text-end bg-00c53">اسم الشارع</th>
    </tr>
    <tr>
        <th class="bg-00c53">Building No </th>
        <th colspan="2"></th>
        <th class="bg-00c53" style="width: 8%;">City</th>
        <th colspan="2"></th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53" style="width: 8%;">مدينة </th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53">رقم المبنى</th>
    </tr>
    <tr>
        <th class="bg-00c53">Secondary No </th>
        <th colspan="2"></th>
        <th class="bg-00c53">District</th>
        <th colspan="2"></th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53">اﻟﺤﻲ</th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53">اﻟﺮﻗﻢ اﻟﻔﺮﻋﻲ</th>
    </tr>
    <tr>
        <th class="bg-00c53">Postal Code</th>
        <th colspan="2"></th>
        <th class="bg-00c53">Country</th>
        <th colspan="2"></th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53">دولة</th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53">رمز بريدي</th>
    </tr>
    <tr>
        <th class="bg-00c53">TRN</th>
        <th colspan="2"></th>
        <th class="bg-00c53">CRN</th>
        <th colspan="2"></th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53">رقم السجل</th>
        <th class="text-end" colspan="2"></th>
        <th class="text-end bg-00c53">الرقم الضريبي</th>
    </tr>
</tbody></table>                    <table class="table table-bordered text-center mb-1">
    <tbody>
        <tr>
                            <th class="bg-00c53">
                    <p class="font-size-10 p-0 m-0"><b>م إشعار التسليم	<br>Delivery Note No.	</b></p>
                </th>
                            <th class="bg-00c53">
                    <p class="font-size-10 p-0 m-0"><b>طقة المبيعات	<br>Sales Region	</b></p>
                </th>
                    </tr>
        <tr>
                            <td>
                    <p class="font-size-10 p-0 m-0"></p>
                </td>
                            <td>
                    <p class="font-size-10 p-0 m-0"></p>
                </td>
                    </tr>
    </tbody>
</table>                    
                    <table class="table table-bordered mb-1 text-center mb-1 remove-here">
                        <tbody>
                            <tr class="bg-00c53">
                                <th style="width: 3%;">
                                    <p class="font-size-10 p-0 m-0"><b>م<br>SN</b></p>
                                </th>
                                <th style="width: 48%;" colspan="2">
                                    <p class="font-size-10 p-0 m-0"><b>طبيعة السلع / الخدمات<br>Nature of Goods / Service</b></p>
                                </th>
                                <th style="width: 6%;">
                                    <p class="font-size-10 p-0 m-0"><b>وحدة<br>Unit</b></p>
                                </th>
                                <th style="width: 6%;">
                                    <p class="font-size-10 p-0 m-0"><b>سعر وحدة<br>Unit Price</b></p>
                                </th>
                                <th style="width: 5%;">
                                    <p class="font-size-10 p-0 m-0"><b>الكمية<br>QTY</b></p>
                                </th>
                                <th style="width: 7%;">
                                    <p class="font-size-10 p-0 m-0"><b>المجموع<br>Total</b></p>
                                </th>
                                <th style="width: 7%;">
                                    <p class="font-size-10 p-0 m-0"><b>% ضريبة<br>VAT %</b></p>
                                </th>
                                <th style="width: 10%;">
                                    <p class="font-size-10 p-0 m-0"><b>مبلغ الضريبة<br>VAT Amount</b></p>
                                </th>
                                <th style="width: 10%;">
                                    <p class="font-size-10 p-0 m-0"><b>المبلغ&nbsp;الإجمالي<br>Total Amount</b></p>
                                </th>
                            </tr>
                                                                <tr class="remove-here-tr-top remove-here-tr-bottom m-0">
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">1</p>
                                        </td>
                                        <td class="m-0" colspan="2">
                                            <div class="d-flex justify-content-between">
                                                <p class="font-size-10 p-0 m-0 text-left">*Crispy Kreme Rings</p>
                                                <p class="font-size-10 p-0 m-0 text-right">*كرسبي حلقات</p>
                                            </div>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">PCS</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0"> 0.50</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">22</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">11.00</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">15%</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">1.65</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">12.65</p>
                                        </td>
                                    </tr>
                                                                                                    <tr class="remove-here-tr-top remove-here-tr-bottom m-0">
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">2</p>
                                        </td>
                                        <td class="m-0" colspan="2">
                                            <div class="d-flex justify-content-between">
                                                <p class="font-size-10 p-0 m-0 text-left">00Lux1</p>
                                                <p class="font-size-10 p-0 m-0 text-right">00لوكس1</p>
                                            </div>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">PCS</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0"> 2.00</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">13</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">26.00</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">15%</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">3.90</p>
                                        </td>
                                        <td class="m-0">
                                            <p class="font-size-10 p-0 m-0">29.90</p>
                                        </td>
                                    </tr>
                                                                                                                            <tr class="remove-here-tr-top remove-here-tr-bottom">
                                    <td></td>
                                    <td colspan="2"></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                                            <tr class="remove-here-tr-top remove-here-tr-bottom">
                                    <td></td>
                                    <td colspan="2"></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                                            <tr class="remove-here-tr-top remove-here-tr-bottom">
                                    <td></td>
                                    <td colspan="2"></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                                            <tr class="remove-here-tr-top remove-here-tr-bottom">
                                    <td></td>
                                    <td colspan="2"></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                                        <tr></tr>
                        </tbody>
                    </table>
                            
                    <table class="table table-bordered mb-1 text-center font-size-12 mb-1">
                        <tbody>
                            <tr>
                                <td colspan="2" rowspan="5" style="width: 50%;">
                                    <div class="amount-box text-left">
                                        <p class="font-size-12 p-0 m-0"><b>Amount In Words / المبلغ كتابة</b></p>
                                        <p class="font-size-12 p-0 m-0 text-right">إثنان و أربعون ريال سعودي و خمسة و خمسون هللة</p>
                                        <p class="font-size-12 p-0 m-0">Forty-two Saudi Riyals and fifty-five halalas</p>
                                    </div>
                                </td>
                                <td colspan="3" style="width: 31%;" class="bg-00c53">
                                    <p class="font-size-12 p-0 m-0 text-right"><b>Amount / المبلغ الإجمالي</b></p>
                                </td>
                                <td style="width: 19%;">
                                    <p class="font-size-12 p-0 m-0">37.00</p>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="3" class="bg-00c53">
                                    <p class="font-size-12 p-0 m-0 text-right"><b>Discount / خصم </b></p>
                                </td>
                                <td>
                                    <p class="font-size-12 p-0 m-0">0.00</p>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="3" class="bg-00c53">
                                    <p class="font-size-12 p-0 m-0 text-right"><b>Total without TAX / المجموع بدون&nbsp;الضريبة </b></p>
                                </td>
                                <td>
                                    <p class="font-size-12 p-0 m-0">37.00</p>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="3" class="bg-00c53">
                                    <p class="font-size-12 p-0 m-0 text-right"><b>VAT Amount / القيمة للضريبة </b></p>
                                </td>
                                <td>
                                                                        <p class="font-size-12 p-0 m-0">5.55</p>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="3" class="bg-00c53">
                                    <p class="font-size-12 p-0 m-0 text-right"><b>Grand Total / القيمة&nbsp;الإجمالية </b></p>
                                </td>
                                <td>
                                    <p class="font-size-12 p-0 m-0">42.55</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
    
                    
<table class="table table-bordered m-0 font-size-12 p-zero">
    <tbody>
        <tr>
            <th style="width: 50%;">
                <p class="font-size-12 font-width-700 p-0 m-0">Bank Details / تفاصيل البنك</p>
                                        <p class="font-size-11 p-0 m-0">Account Name: Fletcher Booker</p>
                        <p class="font-size-11 p-0 m-0">Account Number: 366</p>
                        <p class="font-size-11 p-0 m-0">IBAN: Vel eius voluptatem</p>
                        <p class="font-size-11 p-0 m-0">Bank: Keane Rowland</p>
                        <p class="font-size-11 p-0 m-0">Swift Code: Corrupti quis neque</p>
                                </th>
            <th style="width: 31%;">
                <p class="font-size-12 font-width-700 p-0 m-0">Note / ملحوظة</p>
                <p class="font-size-12 p-0 m-0 note-p"></p>
            </th>
            <th style="width: 19%;">
                <p class="font-size-12 font-width-700 p-0 m-0">Sign / توقيع</p>
            </th>
        </tr>
    </tbody>
</table>                    <div class="font-size-12 p-0 m-0 mt-2 text-center">
                        <div class="row">
                            <div class="col-2"></div>
                            <div class="col-8">
                                <p>Powered by: www.signsolsa.com</p>
                            </div>
                            <div class="col-2">Page 1 of&nbsp;1</div>
                        </div>
                    </div>
                </div>
                    </div>
    <script src="http://localhost/Reztra/supermarket/assets/bower_components/jquery/dist/jquery.min.js"></script>
    <!-- <script src="http://localhost/Reztra/supermarket/frequent_changing/js/onload_print.js"></script> -->
    <script>
    $(document).ready(function() {
        "use strict";
        $(window).on('load', function() {
            if (window.PrintChannel) {
                window.PrintChannel.postMessage("print");
            } else {
                <!-- window.print(); -->
            }
            setTimeout(function() {
                <!-- window.location.href = "http://localhost/Reztra/supermarket//Sale/invoice"
                window.close(); -->
            }, 10); // Adjust the timeout if needed
        });
    });
</script>

</body></html>
            `, { waitUntil: 'networkidle0'});

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true
        })

        await browser.close()

        await print(pdfPath, {
            printer: 'Bullzip PDF Printer'
        })

        res.json({message: 'Printed successfully!'})
    } catch (error) {
        console.error("Print failed:", error);
        res.json({
            message: 'Print failed!',
            error: error
        });
    }
})

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