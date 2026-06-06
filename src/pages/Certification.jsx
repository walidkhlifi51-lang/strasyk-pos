import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useTenant } from "../components/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileCheck, Shield, Lock, Archive, CheckCircle2, Building2, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";

const EDITEUR = {
  nom: "STRASYK",
  formeJuridique: "SASU",
  siret: "990 508 665 00017",
  tva: "FR71 990508665",
  rcs: "990 508 665 R.C.S. Reims",
  adresse: "47 Rue Adolphe Laberte",
  ville: "51100 Reims - France",
  representant: "Walid Khlifi",
  logiciel: "Strasyk POS",
  module: "Module d'encaissement / caisse enregistreuse",
  version: "2.1",
};

const CERTIFICATION_PROFILE_FIELDS = [
  'id',
  'tenant_id',
  'nom_etablissement',
  'adresse',
  'ville',
  'telephone',
  'siret',
  'tva_intracommunautaire',
  'updated_date',
];

const addWrappedText = (doc, text, x, y, maxWidth, lineHeight = 5.5) => {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line) => {
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
};

const drawSectionTitle = (doc, text, y, margin, pageWidth) => {
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(text, margin + 3, y);
  doc.setTextColor(0, 0, 0);
  return y + 10;
};

const checkNewPage = (doc, y, threshold = 260) => {
  if (y > threshold) {
    doc.addPage();
    return 20;
  }
  return y;
};

export default function CertificationPage() {
  const { currentTenant, currentUser } = useTenant();
  const [generating, setGenerating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', currentTenant?.id],
    queryFn: async () => {
      const profiles = await appClient.entities.RestaurantProfile.filter(
        { tenant_id: currentTenant?.id },
        '-updated_date',
        1,
        { fields: CERTIFICATION_PROFILE_FIELDS }
      );
      return profiles?.[0] || null;
    },
    enabled: !!currentTenant?.id,
  });

  const enseigneName = `${currentTenant?.nom_commercial || ''}`.trim();
  const establishmentName = `${profile?.nom_etablissement || ''}`.trim();
  const displayedEstablishmentName = establishmentName || 'Non renseigne';
  const displayedEnseigneName = enseigneName || establishmentName || 'Non renseigne';
  const displayedAddress = [profile?.adresse, profile?.ville].filter(Boolean).join(', ') || profile?.adresse || 'Non renseigne';
  const displayedManagerName = currentUser?.full_name || 'Non renseigne';
  const displayedRole = currentUser?.role === 'admin' ? 'Administrateur' : 'Utilisateur';
  const displayedCity = profile?.ville || '________________';

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 42, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text("ATTESTATION INDIVIDUELLE DE CONFORMITE", pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text("Article 286 I-3 bis du Code General des Impots", pageWidth / 2, 20, { align: 'center' });
      doc.text("Document etabli pour l'editeur et l'etablissement utilisateur", pageWidth / 2, 27, { align: 'center' });
      doc.text(`Date d'emission : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 34, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      y = 52;

      y = drawSectionTitle(doc, "PARTIE 1 - EDITEUR DU LOGICIEL", y, margin, pageWidth);
      doc.setFontSize(9);
      const editorInfo = [
        ["Raison sociale :", `${EDITEUR.nom} ${EDITEUR.formeJuridique}`],
        ["SIRET :", EDITEUR.siret],
        ["TVA intracommunautaire :", EDITEUR.tva],
        ["RCS :", EDITEUR.rcs],
        ["Siege social :", `${EDITEUR.adresse}, ${EDITEUR.ville}`],
        ["Representant legal :", EDITEUR.representant],
        ["Logiciel :", `${EDITEUR.logiciel} - ${EDITEUR.module}`],
        ["Version :", EDITEUR.version],
      ];
      editorInfo.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin + 2, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 58, y);
        y += 6;
      });

      y += 3;
      y = drawSectionTitle(doc, "DECLARATION DE CONFORMITE DE L'EDITEUR", y, margin, pageWidth);
      y = addWrappedText(
        doc,
        `La societe ${EDITEUR.nom} ${EDITEUR.formeJuridique}, representee par ${EDITEUR.representant}, atteste que ${EDITEUR.logiciel} version ${EDITEUR.version} respecte les exigences d'inalterabilite, de securisation, de conservation et d'archivage des donnees prevues par l'article 286 I-3 bis du Code General des Impots.`,
        margin + 2,
        y,
        maxWidth - 4,
      );

      y = checkNewPage(doc, y + 10, 235);
      y = drawSectionTitle(doc, "PARTIE 2 - ETABLISSEMENT UTILISATEUR", y, margin, pageWidth);
      const establishmentInfo = [
        ["Nom de l'etablissement :", displayedEstablishmentName],
        ["Nom de l'enseigne :", displayedEnseigneName],
        ["Adresse :", displayedAddress],
        ["Telephone :", profile?.telephone || 'Non renseigne'],
        ["SIRET :", profile?.siret || 'Non renseigne'],
        ["TVA intracommunautaire :", profile?.tva_intracommunautaire || 'Non renseigne'],
      ];
      establishmentInfo.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin + 2, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 58, y);
        y += 6;
      });

      y += 3;
      y = drawSectionTitle(doc, "RESPONSABLE DE L'ETABLISSEMENT", y, margin, pageWidth);
      const userInfo = [
        ["Nom et prenom :", displayedManagerName],
        ["Email :", currentUser?.email || 'Non renseigne'],
        ["Qualite :", displayedRole],
        ["Date d'emission :", new Date().toLocaleDateString('fr-FR')],
      ];
      userInfo.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin + 2, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 46, y);
        y += 6;
      });

      y = checkNewPage(doc, y + 10, 225);
      y = drawSectionTitle(doc, "GARANTIES TECHNIQUES", y, margin, pageWidth);
      const garanties = [
        "Inalterabilite : numerotation sequentielle des tickets, horodatage automatique, impossibilite de modifier une commande payee sans trace.",
        "Securisation : authentification utilisateur, gestion des roles, codes PIN sur les pages sensibles, chiffrement des donnees.",
        "Conservation : historique complet des ventes, clotures journalieres, exports comptables, conservation minimale de 6 ans.",
        "Archivage periodique : rapports detailles, grand livre des operations, ventilation des taux de TVA.",
      ];
      garanties.forEach((line) => {
        y = addWrappedText(doc, `- ${line}`, margin + 2, y, maxWidth - 4, 5.5);
        y += 1;
      });

      y = checkNewPage(doc, y + 10, 225);
      y = drawSectionTitle(doc, "ENGAGEMENT DE L'UTILISATEUR", y, margin, pageWidth);
      y = addWrappedText(
        doc,
        `Je soussigne, ${displayedManagerName}, atteste utiliser ${EDITEUR.logiciel} pour les operations d'encaissement de l'etablissement ${displayedEstablishmentName}. Je certifie que les donnees d'encaissement enregistrees dans le systeme sont conservees et securisees conformement a l'article 286 I-3 bis du Code General des Impots.`,
        margin + 2,
        y,
        maxWidth - 4,
      );

      y += 8;
      doc.setFont(undefined, 'bold');
      doc.text("Signature de l'utilisateur :", margin, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(`Nom : ${displayedManagerName}`, margin + 2, y);
      y += 5;
      doc.text(`Fait a ${displayedCity}, le ${new Date().toLocaleDateString('fr-FR')}`, margin + 2, y);
      y += 5;
      doc.text('Mention manuscrite : "Lu et approuve"', margin + 2, y);

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
        doc.setFontSize(7.5);
        doc.setFont(undefined, 'italic');
        doc.text(
          "Document a conserver et a presenter en cas de controle fiscal. Les informations editeur sont portees par Strasyk, les informations commerce par l'etablissement utilisateur.",
          margin,
          pageHeight - 12
        );
        doc.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
      }

      const fileName = `Attestation_CGI_286_${displayedEstablishmentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Erreur generation PDF:", error);
      alert("Erreur lors de la generation du PDF");
    } finally {
      setGenerating(false);
    }
  };

  const features = [
    {
      icon: Lock,
      title: "Inalterabilite",
      description: "Chaque encaissement reste trace et horodate",
      items: [
        "Numerotation sequentielle des tickets",
        "Horodatage automatique",
        "Trace des annulations et corrections",
      ],
    },
    {
      icon: Shield,
      title: "Securisation",
      description: "Protection et controle d'acces aux donnees",
      items: [
        "Sauvegarde cloud automatique",
        "Authentification utilisateur",
        "Codes PIN pour pages sensibles",
      ],
    },
    {
      icon: Archive,
      title: "Conservation",
      description: "Archivage des donnees sur la duree legale",
      items: [
        "Historique complet des ventes",
        "Clotures de caisse enregistrees",
        "Exports comptables disponibles",
      ],
    },
    {
      icon: FileCheck,
      title: "Archivage periodique",
      description: "Clotures et rapports reguliers",
      items: [
        "Cloture journaliere obligatoire",
        "Rapports detailles",
        "Grand livre des operations",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
              <FileCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Attestation de conformite</h1>
              <p className="text-gray-500 text-sm">Article 286 I-3 bis du Code General des Impots</p>
            </div>
          </div>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Document nominatif etabli pour l'editeur <strong>Strasyk</strong> et l'etablissement utilisateur.
                  Les donnees affichees ici sont limitees aux champs strictement utiles et proviennent du tenant actif
                  et du profil etablissement le plus recent.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-indigo-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Editeur du logiciel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Raison sociale", `${EDITEUR.nom} ${EDITEUR.formeJuridique}`],
                ["SIRET", EDITEUR.siret],
                ["TVA intracommunautaire", EDITEUR.tva],
                ["RCS", EDITEUR.rcs],
                ["Siege social", `${EDITEUR.adresse}, ${EDITEUR.ville}`],
                ["Representant", EDITEUR.representant],
                ["Logiciel", `${EDITEUR.logiciel} ${EDITEUR.version}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0">
                  <p className="text-slate-500">{label}</p>
                  <p className="font-medium text-right text-slate-900">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-5 h-5 text-blue-600" />
                Etablissement utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Etablissement", displayedEstablishmentName],
                ["Enseigne", displayedEnseigneName],
                ["Adresse", displayedAddress],
                ["Telephone", profile?.telephone || 'Non renseigne'],
                ["SIRET", profile?.siret || 'Non renseigne'],
                ["TVA intracommunautaire", profile?.tva_intracommunautaire || 'Non renseigne'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0">
                  <p className="text-slate-500">{label}</p>
                  <p className="font-medium text-right text-slate-900">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Utilisateur certifie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Nom complet</p>
                <p className="font-semibold text-gray-900">{displayedManagerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-mono text-sm text-gray-900">{currentUser?.email || 'Non renseigne'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Qualite</p>
                <p className="font-semibold text-gray-900">{displayedRole}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-green-600" />
                Portee du document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">
                Cette page reprend l'esprit de la certification Base44 avec une structure plus complete,
                tout en restant branchee uniquement sur des champs verifies dans le schema actuel.
              </p>
              <p className="text-sm text-gray-700">
                Les informations editeur sont fixes. Les informations commerce sont lues depuis le tenant actif
                et le profil etablissement le plus recent.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {features.map((feature) => (
            <Card key={feature.title} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  {feature.title}
                </CardTitle>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold mb-2">Telecharger l'attestation</h3>
                <p className="text-blue-100 text-sm">
                  PDF nominatif avec l'editeur, l'etablissement utilisateur et les garanties techniques.
                </p>
              </div>
              <Button
                onClick={generatePDF}
                disabled={generating}
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg"
              >
                <Download className="w-5 h-5 mr-2" />
                {generating ? 'Generation...' : 'Telecharger le PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Informations legales</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>Reference legale :</strong> Article 286 du Code General des Impots, modifie par l'arrete du 3 aout 2018.
            </p>
            <p>
              <strong>Obligation :</strong> le logiciel de caisse doit garantir l'inalterabilite, la securisation, la conservation et l'archivage des donnees d'encaissement.
            </p>
            <p>
              <strong>Conservation :</strong> cette attestation doit etre conservee et presentee en cas de controle fiscal pendant une duree minimale de 6 ans.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
