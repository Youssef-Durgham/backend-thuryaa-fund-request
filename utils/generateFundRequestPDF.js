const PDFDocument = require('pdfkit');

/**
 * Generates a PDF buffer for a fund request with approval chain.
 * Uses basic Latin text since PDFKit's default fonts don't support Arabic well.
 * Arabic text is transliterated/simplified where possible.
 * @param {Object} fundRequest - The fund request document
 * @param {Object} workflow - The approval workflow document
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateFundRequestPDF = async (fundRequest, workflow) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100; // margins

      // Header
      doc.fontSize(20).font('Helvetica-Bold')
        .text('Thuryaa Company - Fund Request', { align: 'center' });
      doc.fontSize(12).font('Helvetica')
        .text('Sharikat Al-Thurayya - Talab Sarf', { align: 'center' });
      doc.moveDown(0.5);

      // Divider
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      // Request Details
      doc.fontSize(14).font('Helvetica-Bold').text('Request Details');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');

      const details = [
        ['Code', fundRequest.uniqueCode || 'N/A'],
        ['Amount', `${fundRequest.balance || fundRequest.amount || 0} ${fundRequest.currency || ''}`],
        ['Department', fundRequest.department || 'N/A'],
        ['Description', fundRequest.description || 'N/A'],
        ['Details', fundRequest.details || 'N/A'],
        ['Handed To', fundRequest.handedTo || 'N/A'],
        ['Status', fundRequest.status || 'N/A'],
        ['Date', fundRequest.requestDate ? new Date(fundRequest.requestDate).toLocaleDateString('en-US', { timeZone: 'Asia/Baghdad' }) : 'N/A'],
        ['Time', fundRequest.requestTime || 'N/A'],
      ];

      // Requester info
      if (fundRequest.requestedBy) {
        const requester = fundRequest.requestedBy;
        if (typeof requester === 'object') {
          details.push(['Requester', requester.name || 'N/A']);
          details.push(['Requester Email', requester.email || 'N/A']);
        }
      }

      details.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
      });

      doc.moveDown(0.5);

      // Items Table
      if (fundRequest.items && fundRequest.items.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Items');
        doc.moveDown(0.3);

        // Table header
        const colWidths = [30, 200, 80, 80, 80];
        const tableX = 50;
        let tableY = doc.y;

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('#', tableX, tableY, { width: colWidths[0] });
        doc.text('Item Name', tableX + colWidths[0], tableY, { width: colWidths[1] });
        doc.text('Quantity', tableX + colWidths[0] + colWidths[1], tableY, { width: colWidths[2] });
        doc.text('Price', tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY, { width: colWidths[3] });
        doc.text('Total', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY, { width: colWidths[4] });

        tableY += 15;
        doc.moveTo(tableX, tableY).lineTo(tableX + pageWidth, tableY).stroke();
        tableY += 5;

        doc.font('Helvetica').fontSize(9);
        let grandTotal = 0;

        fundRequest.items.forEach((item, index) => {
          if (tableY > doc.page.height - 100) {
            doc.addPage();
            tableY = 50;
          }
          const itemTotal = (item.quantity || 0) * (item.price || 0);
          grandTotal += itemTotal;

          doc.text(`${index + 1}`, tableX, tableY, { width: colWidths[0] });
          doc.text(item.name || '', tableX + colWidths[0], tableY, { width: colWidths[1] });
          doc.text(`${item.quantity || 0}`, tableX + colWidths[0] + colWidths[1], tableY, { width: colWidths[2] });
          doc.text(`${item.price || 0}`, tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY, { width: colWidths[3] });
          doc.text(`${itemTotal}`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY, { width: colWidths[4] });
          tableY += 15;
        });

        // Total row
        doc.moveTo(tableX, tableY).lineTo(tableX + pageWidth, tableY).stroke();
        tableY += 5;
        doc.font('Helvetica-Bold');
        doc.text('Grand Total:', tableX, tableY, { width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] });
        doc.text(`${grandTotal} ${fundRequest.currency || ''}`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY);

        doc.y = tableY + 20;
      }

      doc.moveDown(0.5);

      // Approval Chain
      if (workflow && workflow.steps && workflow.steps.length > 0) {
        if (doc.y > doc.page.height - 200) doc.addPage();

        doc.fontSize(14).font('Helvetica-Bold').text('Approval Chain');
        doc.moveDown(0.3);

        doc.fontSize(9).font('Helvetica');
        workflow.steps.forEach((step) => {
          if (doc.y > doc.page.height - 80) doc.addPage();

          const statusIcon = step.status === 'Approved' ? '[OK]' :
                             step.status === 'Rejected' ? '[X]' :
                             step.status === 'Pending' ? '[...]' : '[ ]';

          doc.font('Helvetica-Bold')
            .text(`Step ${step.level}: ${step.stepName || ''} ${statusIcon}`, { underline: true });

          doc.font('Helvetica');
          doc.text(`  Status: ${step.status || 'Pending'}`);

          if (step.approvers && step.approvers.length > 0) {
            const approverNames = step.approvers.map(a =>
              typeof a === 'object' ? (a.name || a.email || 'Unknown') : String(a)
            ).join(', ');
            doc.text(`  Approvers: ${approverNames}`);
          }

          if (step.approvedBy) {
            const approverName = typeof step.approvedBy === 'object' ? step.approvedBy.name : step.approvedBy;
            doc.text(`  Approved By: ${approverName}`);
          }
          if (step.approvedAt) {
            doc.text(`  Approved At: ${new Date(step.approvedAt).toLocaleString('en-US', { timeZone: 'Asia/Baghdad' })}`);
          }
          if (step.rejectedBy) {
            const rejectorName = typeof step.rejectedBy === 'object' ? step.rejectedBy.name : step.rejectedBy;
            doc.text(`  Rejected By: ${rejectorName}`);
          }
          if (step.rejectedAt) {
            doc.text(`  Rejected At: ${new Date(step.rejectedAt).toLocaleString('en-US', { timeZone: 'Asia/Baghdad' })}`);
          }
          if (step.comments) {
            doc.text(`  Comments: ${step.comments}`);
          }
          doc.moveDown(0.3);
        });
      }

      // Footer
      doc.moveDown(1);
      doc.fontSize(8).font('Helvetica').fillColor('gray')
        .text(`Generated on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' })}`, { align: 'center' });
      doc.text('Thuryaa Company - Baghdad, Iraq', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateFundRequestPDF;
