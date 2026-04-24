import { jsPDF } from 'jspdf';

export const generateInvoicePDF = (invoice, tenant) => {
  const doc = new jsPDF();
  
  // En-tête
  doc.setFillColor(249, 115, 22); // Orange
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(invoice.is_devis ? 'DEVIS' : 'FACTURE', 15, 20);
  
  doc.setFontSize(10);
  doc.text(`N° ${invoice.numero_facture || invoice.id.substring(0, 8).toUpperCase()}`, 15, 30);
  
  // Informations Strasyk
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Strasyk', 15, 50);
  doc.setFont(undefined, 'normal');
  doc.text('Conseil et solutions technologiques', 15, 55);
  doc.text('contact@strasyk.com', 15, 60);
  doc.text('www.strasyk.com', 15, 65);
  
  // Informations client
  doc.setFont(undefined, 'bold');
  doc.text('FACTURÉ À:', 120, 50);
  doc.setFont(undefined, 'normal');
  doc.text(tenant.nom_commercial, 120, 55);
  doc.text(tenant.owner_email, 120, 60);
  
  let yClient = 65;
  
  // Chercher l'adresse et le téléphone du RestaurantProfile
  const adresse = tenant.profile?.adresse || '';
  const telephone = tenant.profile?.telephone || '';
  
  console.log('PDF Generation - Tenant:', tenant.nom_commercial);
  console.log('PDF Generation - Adresse:', adresse);
  console.log('PDF Generation - Téléphone:', telephone);
  
  if (adresse) {
    const adresseLines = doc.splitTextToSize(adresse, 70);
    doc.text(adresseLines, 120, yClient);
    yClient += adresseLines.length * 5;
  }
  if (telephone) {
    doc.text(`Tél: ${telephone}`, 120, yClient);
  }
  
  // Date et période
  doc.setFont(undefined, 'bold');
  doc.text('Date de facturation:', 15, 85);
  doc.setFont(undefined, 'normal');
  doc.text(new Date(invoice.date_facturation).toLocaleDateString('fr-FR'), 60, 85);
  
  if (invoice.periode_debut && invoice.periode_fin) {
    doc.setFont(undefined, 'bold');
    doc.text('Période:', 15, 92);
    doc.setFont(undefined, 'normal');
    doc.text(`${new Date(invoice.periode_debut).toLocaleDateString('fr-FR')} - ${new Date(invoice.periode_fin).toLocaleDateString('fr-FR')}`, 60, 92);
  }
  
  // Tableau des prestations
  let yPos = 110;
  
  // En-tête du tableau
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setFont(undefined, 'bold');
  doc.text('Description', 20, yPos + 5);
  doc.text('Montant HT', 140, yPos + 5);
  doc.text('TVA', 165, yPos + 5);
  doc.text('Total TTC', 180, yPos + 5);
  
  yPos += 12;
  doc.setFont(undefined, 'normal');
  
  // Type de facture
  const typeLabels = {
    abonnement: 'Abonnement Strasyk POS',
    achat_complet: 'Achat complet du système',
    module_supplementaire: 'Module supplémentaire',
    materiel: 'Matériel',
    frais_de_maintenance: 'Frais de maintenance',
    autre: 'Prestation'
  };
  
  // Calculer totaux globaux
  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;
  
  // Si pas de lignes de matériel, afficher la ligne principale
  if (!invoice.lignes_materiel || invoice.lignes_materiel.length === 0) {
    // Utiliser directement le montant payé (déjà avec réduction si applicable)
    const montantTTC = invoice.montant;
    const montantHT = invoice.tva_taux ? montantTTC / (1 + invoice.tva_taux / 100) : montantTTC;
    const montantTVA = montantTTC - montantHT;
    
    doc.text(typeLabels[invoice.type] || invoice.type, 20, yPos);
    doc.text(`${montantHT.toFixed(2)} €`, 140, yPos);
    doc.text(`${invoice.tva_taux || 0}%`, 165, yPos);
    doc.text(`${montantTTC.toFixed(2)} €`, 180, yPos);
    yPos += 8;
    
    totalHT = montantHT;
    totalTVA = montantTVA;
    totalTTC = montantTTC;
  } else {
    // Afficher les lignes de matériel
    invoice.lignes_materiel.forEach((ligne) => {
      const ligneHT = ligne.quantite * ligne.prix_unitaire_ht;
      const ligneTVA = ligneHT * (ligne.tva_taux / 100);
      const ligneTTC = ligneHT + ligneTVA;
      
      const designation = ligne.quantite > 1 ? `${ligne.designation} (x${ligne.quantite})` : ligne.designation;
      doc.text(designation, 20, yPos);
      doc.text(`${ligneHT.toFixed(2)} €`, 140, yPos);
      doc.text(`${ligne.tva_taux}%`, 165, yPos);
      doc.text(`${ligneTTC.toFixed(2)} €`, 180, yPos);
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
    const lines = doc.splitTextToSize(invoice.description, 170);
    doc.text(lines, 20, yPos);
    yPos += lines.length * 5;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
  }
  
  if (invoice.materiel) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Matériel fourni:', 20, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    const materielLines = doc.splitTextToSize(invoice.materiel, 170);
    doc.text(materielLines, 20, yPos);
    yPos += materielLines.length * 5;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
  }
  
  // Totaux
  yPos += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, 195, yPos);
  
  yPos += 8;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.text('Total HT:', 140, yPos);
  doc.text(`${totalHT.toFixed(2)} €`, 180, yPos);
  
  yPos += 6;
  doc.text('Total TVA:', 140, yPos);
  doc.text(`${totalTVA.toFixed(2)} €`, 180, yPos);
  
  yPos += 8;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL TTC:', 140, yPos);
  doc.text(`${totalTTC.toFixed(2)} €`, 180, yPos);
  
  // Paiements mensuels PAYÉS uniquement pour abonnement et frais de maintenance
  if ((invoice.type === 'abonnement' || invoice.type === 'frais_de_maintenance') && invoice.monthly_payments) {
    const paidPayments = Object.entries(invoice.monthly_payments).filter(([_, payment]) => payment.paye);
    
    if (paidPayments.length > 0) {
      yPos += 15;
      doc.setFontSize(10);
      doc.text('Détail des paiements effectués:', 15, yPos);
      yPos += 8;
      
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 6, 'F');
      doc.setFont(undefined, 'bold');
      doc.text('Mois', 20, yPos + 4);
      doc.text('Montant', 100, yPos + 4);
      doc.text('Date de paiement', 150, yPos + 4);
      
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(34, 197, 94); // Green
      
      paidPayments.forEach(([month, payment]) => {
        const monthDate = new Date(month);
        doc.text(monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), 20, yPos);
        doc.text(`${payment.montant.toFixed(2)} €`, 100, yPos);
        if (payment.date_paiement) {
          doc.text(new Date(payment.date_paiement).toLocaleDateString('fr-FR'), 150, yPos);
        }
        yPos += 6;
      });
      doc.setTextColor(0, 0, 0);
    }
  }
  
  // Pied de page
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Merci de votre confiance.', 105, 275, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Strasyk', 105, 282, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Conseil et solutions technologiques', 105, 287, { align: 'center' });
  
  // Téléchargement
  const docType = invoice.is_devis ? 'Devis' : 'Facture';
  const filename = `${docType}_${tenant.nom_commercial.replace(/[^a-z0-9]/gi, '_')}_${invoice.numero_facture || invoice.id.substring(0, 8)}.pdf`;
  doc.save(filename);
};
