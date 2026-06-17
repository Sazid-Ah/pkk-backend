// Deterministic invoice number, matching the mobile app's format:
//   PKK-<PREFIX>-<YYYYMMDD>-<last 6 of id, uppercase>
// e.g. PKK-ORD-20260617-1A2B3C
function makeInvoiceNumber(prefix, id, date) {
    const d = date ? new Date(date) : new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `PKK-${prefix}-${stamp}-${String(id).slice(-6).toUpperCase()}`;
}

module.exports = { makeInvoiceNumber };
