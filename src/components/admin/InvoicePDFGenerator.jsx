import { jsPDF } from 'jspdf';
import { PLATFORM_ISSUER_SNAPSHOT, buildTenantRecipientSnapshot } from '@/lib/invoiceSnapshots';
import { getInvoiceAmounts } from '@/lib/invoiceDocuments';

const euro = (value) => `${Number(value || 0).toFixed(2)} EUR`;

const typeLabels = {
  abonnement: 'Abonnement POS',
  achat_complet: 'Achat complet du systeme',
  module_supplementaire: 'Module supplementaire',
  materiel: 'Materiel',
  frais_de_maintenance: 'Frais de maintenance',
  autre: 'Prestation',
};

const splitText = (doc, value, width) => {
  const safeValue = `${value || ''}`.trim();
  return safeValue ? doc.splitTextToSize(safeValue, width) : [];
};

const writeBlock = (doc, lines, x, y) => {
  if (!lines.length) return y;
  doc.text(lines, x, y);
  return y + (lines.length * 5);
};

const parseHexColor = (value, fallback = [249, 115, 22]) => {
  const safe = `${value || ''}`.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(safe)) return fallback;
  return [
    parseInt(safe.slice(0, 2), 16),
    parseInt(safe.slice(2, 4), 16),
    parseInt(safe.slice(4, 6), 16),
  ];
};

const loadImageAsDataUrl = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const generateInvoicePDF = async (invoice, tenant) => {
  const doc = new jsPDF();
  const issuer = {
    ...PLATFORM_ISSUER_SNAPSHOT,
    ...(invoice?.issuer_snapshot || {}),
  };
  const recipient = {
    ...buildTenantRecipientSnapshot(tenant),
    ...(invoice?.recipient_snapshot || {}),
  };

  const issuerName = issuer.display_name || issuer.legal_name || 'Strasyk';
  const issuerTagline = issuer.tagline || '';
  const issuerEmail = issuer.email || '';
  const issuerPhone = issuer.phone || '';
  const issuerWebsite = issuer.website || '';
  const recipientName = recipient.recipient_name || tenant?.nom_commercial || 'Client';
  const recipientEmail = recipient.contact_email || tenant?.owner_email || '';
  const recipientAddress = recipient.address || '';
  const recipientPhone = recipient.phone || '';
  const [primaryR, primaryG, primaryB] = parseHexColor(issuer.primary_color, [249, 115, 22]);
  const [secondaryR, secondaryG, secondaryB] = parseHexColor(issuer.secondary_color, [29, 78, 216]);
  const logoDataUrl = await loadImageAsDataUrl(issuer.logo_url);

  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(145, 8, 50, 24, 4, 4, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 149, 10, 18, 18);
    } catch {
      // Ignore logo rendering errors and keep the PDF generation working.
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(invoice?.is_devis ? 'DEVIS' : 'FACTURE', 15, 20);

  doc.setFontSize(10);
  doc.text(`No ${invoice?.numero_facture || invoice?.id?.substring(0, 8)?.toUpperCase() || 'N/A'}`, 15, 30);
  doc.setTextColor(primaryR, primaryG, primaryB);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.text(issuerName, logoDataUrl ? 171 : 149, 18);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  if (issuerEmail) doc.text(issuerEmail, logoDataUrl ? 171 : 149, 24);
  else if (issuerWebsite) doc.text(issuerWebsite, logoDataUrl ? 171 : 149, 24);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(issuerName, 15, 50);
  doc.setFont(undefined, 'normal');
  if (issuerTagline) doc.text(issuerTagline, 15, 55);
  if (issuerEmail) doc.text(issuerEmail, 15, 60);
  if (issuerPhone) doc.text(`Tel: ${issuerPhone}`, 15, 65);
  if (issuerWebsite) doc.text(issuerWebsite, 15, issuerPhone ? 70 : 65);

  doc.setFont(undefined, 'bold');
  doc.text('FACTURE A :', 120, 50);
  doc.setFont(undefined, 'normal');
  doc.text(recipientName, 120, 55);
  if (recipientEmail) doc.text(recipientEmail, 120, 60);

  let yClient = 65;
  yClient = writeBlock(doc, splitText(doc, recipientAddress, 70), 120, yClient);
  if (recipientPhone) {
    doc.text(`Tel: ${recipientPhone}`, 120, yClient);
  }

  doc.setFont(undefined, 'bold');
  doc.text('Date de facturation:', 15, 85);
  doc.setFont(undefined, 'normal');
  doc.text(new Date(invoice.date_facturation).toLocaleDateString('fr-FR'), 60, 85);

  if (invoice.periode_debut && invoice.periode_fin) {
    doc.setFont(undefined, 'bold');
    doc.text('Periode:', 15, 92);
    doc.setFont(undefined, 'normal');
    doc.text(
      `${new Date(invoice.periode_debut).toLocaleDateString('fr-FR')} - ${new Date(invoice.periode_fin).toLocaleDateString('fr-FR')}`,
      60,
      92,
    );
  }

  let yPos = 110;
  doc.setFillColor(secondaryR, secondaryG, secondaryB);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text('Description', 20, yPos + 5);
  doc.text('Montant HT', 140, yPos + 5);
  doc.text('TVA', 165, yPos + 5);
  doc.text('Total TTC', 180, yPos + 5);

  yPos += 12;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);

  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;

  if (!invoice.lignes_materiel || invoice.lignes_materiel.length === 0) {
    const {
      amountHT,
      amountTVA,
      amountTTC,
      monthlyAmountHT,
      monthlyAmountTTC,
    } = getInvoiceAmounts(invoice);
    const recurringSuffix = invoice.monthly_payments ? ' / mois' : '';

    doc.text(typeLabels[invoice.type] || invoice.type || 'Prestation', 20, yPos);
    doc.text(`${euro(invoice.monthly_payments ? monthlyAmountHT : amountHT)}${recurringSuffix}`, 140, yPos);
    doc.text(`${invoice.tva_taux || 0}%`, 165, yPos);
    doc.text(`${euro(invoice.monthly_payments ? monthlyAmountTTC : amountTTC)}${recurringSuffix}`, 180, yPos);
    yPos += 8;

    totalHT = amountHT;
    totalTVA = amountTVA;
    totalTTC = amountTTC;
  } else {
    invoice.lignes_materiel.forEach((ligne) => {
      const ligneHT = Number(ligne.quantite || 0) * Number(ligne.prix_unitaire_ht || 0);
      const ligneTVA = ligneHT * (Number(ligne.tva_taux || 0) / 100);
      const ligneTTC = ligneHT + ligneTVA;
      const designation = Number(ligne.quantite || 0) > 1 ? `${ligne.designation} (x${ligne.quantite})` : ligne.designation;

      doc.text(designation || 'Ligne materiel', 20, yPos);
      doc.text(euro(ligneHT), 140, yPos);
      doc.text(`${ligne.tva_taux || 0}%`, 165, yPos);
      doc.text(euro(ligneTTC), 180, yPos);
      yPos += 6;

      totalHT += ligneHT;
      totalTVA += ligneTVA;
      totalTTC += ligneTTC;
    });

    yPos += 2;
  }

  if (invoice.description) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    yPos = writeBlock(doc, splitText(doc, invoice.description, 170), 20, yPos);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
  }

  if (invoice.materiel) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Materiel fourni:', 20, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    yPos = writeBlock(doc, splitText(doc, invoice.materiel, 170), 20, yPos);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
  }

  yPos += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, 195, yPos);

  yPos += 8;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.text('Total HT:', 140, yPos);
  doc.text(euro(totalHT), 180, yPos);

  yPos += 6;
  doc.text('Total TVA:', 140, yPos);
  doc.text(euro(totalTVA), 180, yPos);

  yPos += 8;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL TTC:', 140, yPos);
  doc.text(euro(totalTTC), 180, yPos);

  if ((invoice.type === 'abonnement' || invoice.type === 'frais_de_maintenance') && invoice.monthly_payments) {
    const paidPayments = Object.entries(invoice.monthly_payments).filter(([, payment]) => payment.paye);

    if (paidPayments.length > 0) {
      yPos += 15;
      doc.setFontSize(10);
      doc.text('Detail des paiements effectues:', 15, yPos);
      yPos += 8;

      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 6, 'F');
      doc.setFont(undefined, 'bold');
      doc.text('Mois', 20, yPos + 4);
      doc.text('Montant', 100, yPos + 4);
      doc.text('Date de paiement', 150, yPos + 4);

      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(34, 197, 94);

      paidPayments.forEach(([month, payment]) => {
        const monthDate = new Date(month);
        doc.text(monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), 20, yPos);
        doc.text(euro(payment.montant), 100, yPos);
        if (payment.date_paiement) {
          doc.text(new Date(payment.date_paiement).toLocaleDateString('fr-FR'), 150, yPos);
        }
        yPos += 6;
      });

      doc.setTextColor(0, 0, 0);
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Merci de votre confiance.', 105, 275, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(issuerName, 105, 282, { align: 'center' });
  if (issuerTagline) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(issuerTagline, 105, 287, { align: 'center' });
  }

  const docType = invoice?.is_devis ? 'Devis' : 'Facture';
  const filenameTarget = recipientName || tenant?.nom_commercial || 'client';
  const filename = `${docType}_${filenameTarget.replace(/[^a-z0-9]/gi, '_')}_${invoice?.numero_facture || invoice?.id?.substring(0, 8) || 'document'}.pdf`;
  doc.save(filename);
};
