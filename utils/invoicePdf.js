// Server-side invoice PDF generation (pdfkit — lightweight, no headless browser).
// Produces a clean, on-brand invoice that mirrors the web invoice's data.
// Returns a Buffer, or null if generation fails (so emails still send without it).
const { makeInvoiceNumber } = require('./invoiceNumber');

const ORANGE = '#F97316';
const ORANGE_DARK = '#EA580C';
const DARK = '#111827';
const GREY = '#6B7280';
const LIGHT = '#9CA3AF';
const LINE = '#E5E7EB';

// pdfkit's built-in fonts don't include the ₹ glyph, so use "Rs." (matches appUtils.money).
const rupee = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtSlot = (s) => {
    if (!s) return '-';
    const n = Number(s);
    if (!isNaN(n) && String(s).trim().length <= 2) {
        if (n === 0) return '12:00 AM';
        if (n < 12) return `${n}:00 AM`;
        if (n === 12) return '12:00 PM';
        return `${n - 12}:00 PM`;
    }
    return String(s);
};

function streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}

function drawHeader(doc, { invoiceNo, invoiceDate, typeLabel }) {
    const top = 40;
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(20).text('Pandit Katha Kalyan', 40, top);
    doc.fillColor(ORANGE_DARK).font('Helvetica-Bold').fontSize(8).text('PUJA & RITUAL SERVICES', 40, top + 25, { characterSpacing: 1 });
    doc.fillColor(LIGHT).font('Helvetica').fontSize(8.5)
        .text('New Delhi, India', 40, top + 40)
        .text('support@panditkathakalyan.com', 40, top + 51)
        .text('https://panditkathakalyan.com', 40, top + 62);
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(26).text('INVOICE', 300, top, { width: 255, align: 'right' });
    doc.fillColor(GREY).font('Helvetica').fontSize(8.5).text(String(typeLabel).toUpperCase(), 300, top + 30, { width: 255, align: 'right', characterSpacing: 1 });
    doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10).text(invoiceNo, 300, top + 46, { width: 255, align: 'right' });
    doc.fillColor(GREY).font('Helvetica').fontSize(8.5).text('Date: ' + invoiceDate, 300, top + 61, { width: 255, align: 'right' });
    doc.moveTo(40, top + 88).lineTo(555, top + 88).lineWidth(2).strokeColor(ORANGE).stroke();
    return top + 104;
}

function drawMeta(doc, y, { customerName, contactLines, addressLine, metaRows }) {
    const colX = 310;
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text('BILLED TO', 40, y, { characterSpacing: 1 });
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text('INVOICE DETAILS', colX, y, { characterSpacing: 1 });

    let ly = y + 14;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text(customerName, 40, ly, { width: 250 });
    ly = doc.y + 2;
    doc.font('Helvetica').fontSize(9).fillColor(GREY);
    [...contactLines, addressLine].filter(Boolean).forEach((t) => {
        doc.text(t, 40, ly, { width: 250 });
        ly = doc.y + 2;
    });

    let ry = y + 14;
    metaRows.filter(Boolean).forEach(([k, v]) => {
        doc.font('Helvetica').fontSize(9).fillColor(LIGHT).text(k, colX, ry, { width: 95 });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text(v, colX + 95, ry, { width: 150, align: 'right' });
        ry += 15;
    });
    return Math.max(ly, ry) + 14;
}

function drawTable(doc, y, items) {
    doc.rect(40, y, 515, 22).fill('#F9FAFB');
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(8);
    doc.text('ITEM DESCRIPTION', 48, y + 7);
    doc.text('QTY', 300, y + 7, { width: 50, align: 'center' });
    doc.text('UNIT PRICE', 350, y + 7, { width: 100, align: 'right' });
    doc.text('AMOUNT', 455, y + 7, { width: 92, align: 'right' });
    let ry = y + 22;
    items.forEach((it) => {
        doc.fillColor(DARK).font('Helvetica').fontSize(10).text(it.name, 48, ry + 7, { width: 245 });
        const rowH = Math.max(24, doc.y - ry + 6);
        doc.fillColor(GREY).text(String(it.qty), 300, ry + 7, { width: 50, align: 'center' });
        doc.text(it.unit, 350, ry + 7, { width: 100, align: 'right' });
        doc.fillColor(DARK).font('Helvetica-Bold').text(it.amount, 455, ry + 7, { width: 92, align: 'right' });
        ry += rowH;
        doc.moveTo(40, ry).lineTo(555, ry).lineWidth(0.5).strokeColor('#F3F4F6').stroke();
    });
    return ry + 12;
}

function drawSummary(doc, y, rows, total) {
    const x = 315; const w = 240;
    rows.filter(Boolean).forEach(([k, v, color]) => {
        doc.font('Helvetica').fontSize(10).fillColor(GREY).text(k, x, y, { width: 130 });
        doc.font('Helvetica-Bold').fontSize(10).fillColor(color || '#374151').text(v, x + 120, y, { width: w - 120, align: 'right' });
        y += 17;
    });
    y += 4;
    doc.roundedRect(x, y, w, 32, 6).fillAndStroke('#FFF7ED', '#FED7AA');
    doc.fillColor('#374151').font('Helvetica-Bold').fontSize(12).text('Total Payable', x + 12, y + 10);
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(14).text(total, x + 12, y + 9, { width: w - 24, align: 'right' });
    doc.fillColor(LIGHT).font('Helvetica-Oblique').fontSize(7.5).text('Inclusive of all applicable taxes & charges', x, y + 38, { width: w, align: 'right' });
    return y + 52;
}

function drawFooter(doc) {
    const y = 778;
    doc.rect(40, y, 515, 36).fill('#1F2937');
    doc.fillColor(LIGHT).font('Helvetica').fontSize(8).text('This is a system-generated invoice. No physical signature required.', 52, y + 13, { width: 320 });
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(9).text('Pandit Katha Kalyan', 235, y + 9, { width: 310, align: 'right' });
    doc.fillColor(LIGHT).font('Helvetica').fontSize(7.5).text('support@panditkathakalyan.com', 235, y + 22, { width: 310, align: 'right' });
}

function newDoc() {
    // Lazy require so a missing dependency degrades gracefully (email still sends).
    const PDFDocument = require('pdfkit');
    return new PDFDocument({ size: 'A4', margin: 40 });
}

async function generateOrderInvoicePdf(order) {
    try {
        const doc = newDoc();
        const bufferPromise = streamToBuffer(doc);

        const customer = typeof order.user === 'object' && order.user ? order.user : {};
        const invoiceNo = order.invoiceNumber || makeInvoiceNumber('ORD', order._id, order.createdAt);
        const items = order.items || [];
        const total = Number(order.totalAmount) || 0;
        const itemsSubtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
        const gstAmt = Number(order.gstAmount) || 0;
        const discountAmt = Number(order.discountAmount) || 0;
        const discountPerc = Number(order.discountPercentage) || 0;

        const a = order.shippingAddress;
        let addressLine = '';
        if (a && typeof a === 'object') {
            addressLine = [a.label, a.street, a.city, a.state && a.zip ? `${a.state} - ${a.zip}` : (a.state || a.zip)].filter(Boolean).join(', ');
        } else if (typeof a === 'string') {
            addressLine = a;
        }

        let y = drawHeader(doc, { invoiceNo, invoiceDate: fmtDate(order.createdAt), typeLabel: 'Product Order' });
        y = drawMeta(doc, y, {
            customerName: customer.fullName || customer.username || 'Customer',
            contactLines: [customer.email, customer.phoneNumber].filter(Boolean),
            addressLine,
            metaRows: [
                ['Invoice No.', invoiceNo],
                ['Order Date', fmtDate(order.createdAt)],
                ['Items', `${items.length} item${items.length !== 1 ? 's' : ''}`],
                ['Payment', order.paymentMethod === 'CashOnDelivery' ? 'Cash on Delivery' : 'Online (Razorpay)'],
                ['Status', `${order.status || 'Pending'} / ${order.paymentStatus || 'Pending'}`],
                order.razorpayPaymentId ? ['Txn ID', order.razorpayPaymentId] : null,
            ],
        });
        y = drawTable(doc, y, items.map((i) => ({
            name: i.name || '-',
            qty: i.quantity || 1,
            unit: rupee(i.price),
            amount: rupee((Number(i.price) || 0) * (Number(i.quantity) || 1)),
        })));
        drawSummary(doc, y, [
            ['Items Subtotal', rupee(itemsSubtotal)],
            discountAmt > 0 ? [`Discount${discountPerc ? ` (${discountPerc}%)` : ''}`, `- ${rupee(discountAmt)}`, '#059669'] : null,
            gstAmt > 0 ? ['GST & Taxes', rupee(gstAmt), ORANGE] : null,
        ], rupee(total));
        drawFooter(doc);

        doc.end();
        return await bufferPromise;
    } catch (e) {
        console.error('Order invoice PDF generation failed:', e.message);
        return null;
    }
}

async function generateBookingInvoicePdf(booking) {
    try {
        const doc = newDoc();
        const bufferPromise = streamToBuffer(doc);

        const customer = typeof booking.user === 'object' && booking.user ? booking.user : {};
        const pandit = typeof booking.pandit === 'object' && booking.pandit ? booking.pandit : {};
        const invoiceNo = booking.invoiceNumber || makeInvoiceNumber('BK', booking._id, booking.createdAt);
        const baseFee = Number(booking.price) || 0;
        const gstAmt = Number(booking.gstAmount) > 0 ? Number(booking.gstAmount) : Math.round(baseFee * 0.18 * 100) / 100;
        const total = Number(booking.totalAmount) > 0 ? Number(booking.totalAmount) : baseFee + gstAmt;
        const gstPerc = Number(booking.gstPercentage) || 18;
        const addr = booking.address;
        const addressLine = addr ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') : '';

        let y = drawHeader(doc, { invoiceNo, invoiceDate: fmtDate(booking.createdAt), typeLabel: 'Booking / Service' });
        y = drawMeta(doc, y, {
            customerName: customer.fullName || customer.username || 'Customer',
            contactLines: [customer.email, customer.phoneNumber].filter(Boolean),
            addressLine,
            metaRows: [
                ['Invoice No.', invoiceNo],
                ['Invoice Date', fmtDate(booking.createdAt)],
                ['Service Date', fmtDate(booking.bookingDate)],
                ['Time Slot', fmtSlot(booking.timeSlot)],
                ['Payment', booking.paymentMethod === 'Online' ? 'Online (Razorpay)' : 'Pay After Service'],
                ['Status', `${booking.status || 'Pending'} / ${booking.paymentStatus || 'Pending'}`],
                booking.razorpayPaymentId ? ['Txn ID', booking.razorpayPaymentId] : null,
            ],
        });
        y = drawTable(doc, y, [{
            name: `${booking.occasion || 'Puja Service'}${pandit.name ? `\nConducted by: ${pandit.name}` : ''}`,
            qty: 1,
            unit: rupee(baseFee),
            amount: rupee(baseFee),
        }]);
        drawSummary(doc, y, [
            ['Sub Total', rupee(baseFee)],
            ['GST & Taxes (' + gstPerc + '%)', rupee(gstAmt), ORANGE],
        ], rupee(total));
        drawFooter(doc);

        doc.end();
        return await bufferPromise;
    } catch (e) {
        console.error('Booking invoice PDF generation failed:', e.message);
        return null;
    }
}

module.exports = { generateOrderInvoicePdf, generateBookingInvoicePdf };
