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
  activite: "Conseil en systemes et logiciels informatiques",
  representant: "Walid Khlifi",
  logiciel: "Strasyk POS",
  module: "Module d'encaissement / caisse enregistreuse",
  version: "2.1",
  dateVersion: "2025-01-01",
};

const CERTIFICATION_PROFILE_FIELDS = [
  'id',
  'tenant_id',
  'nom_etablissement',
  'prenom_gerant',
  'nom_gerant',
  'adresse',
  'ville',
  'telephone',
  'siret',
  'tva_intracommunautaire',
  'updated_date',
];

const CERTIFICATION_PROFILE_FALLBACK_FIELDS = CERTIFICATION_PROFILE_FIELDS.filter(
  (field) => field !== 'prenom_gerant' && field !== 'nom_gerant'
);

const isMissingColumnError = (error, columnName) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return message.includes(`Could not find the '${columnName}' column`);
};

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

const loadImageAsBase64 = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    resolve(canvas.toDataURL('image/png'));
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

export default function CertificationPage() {
  const { currentTenant, currentUser } = useTenant();
  const [generating, setGenerating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', currentTenant?.id],
    queryFn: async () => {
      let profiles;
      try {
        profiles = await appClient.entities.RestaurantProfile.filter(
          { tenant_id: currentTenant?.id },
          '-updated_date',
          1,
          { fields: CERTIFICATION_PROFILE_FIELDS }
        );
      } catch (error) {
        if (isMissingColumnError(error, 'prenom_gerant') || isMissingColumnError(error, 'nom_gerant')) {
          profiles = await appClient.entities.RestaurantProfile.filter(
            { tenant_id: currentTenant?.id },
            '-updated_date',
            1,
            { fields: CERTIFICATION_PROFILE_FALLBACK_FIELDS }
          );
        } else {
          throw error;
        }
      }
      return profiles?.[0] || null;
    },
    enabled: !!currentTenant?.id,
  });

  const enseigneName = `${currentTenant?.nom_commercial || ''}`.trim();
  const establishmentName = `${profile?.nom_etablissement || ''}`.trim();
  const displayedEstablishmentName = establishmentName || 'Non renseigne';
  const displayedEnseigneName = enseigneName || establishmentName || 'Non renseigne';
  const displayedAddress = [profile?.adresse, profile?.ville].filter(Boolean).join(', ') || profile?.adresse || 'Non renseigne';
  const displayedManagerName = [profile?.prenom_gerant, profile?.nom_gerant]
    .filter(Boolean)
    .join(' ')
    .trim() || currentUser?.full_name || 'Non renseigne';
  const displayedCity = profile?.ville || '________________';

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const cachetBase64 = await loadImageAsBase64("https://media.base44.com/images/public/68fd3a46517ad27393f2904a/137f24d33_ChatGPTImage22mai202621_15_16.png");
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 48, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text("ATTESTATION INDIVIDUELLE DE CONFORMITE", pageWidth / 2, 13, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text("Article 286 I-3 bis du Code General des Impots", pageWidth / 2, 21, { align: 'center' });
      doc.setFontSize(8.5);
      doc.setTextColor(180, 200, 255);
      doc.text("Loi n 2015-1785 du 29 decembre 2015 - Arrete du 3 aout 2018", pageWidth / 2, 29, { align: 'center' });
      doc.setFontSize(8);
      doc.text("Cette attestation est etablie sous la responsabilite exclusive de l'editeur du logiciel.", pageWidth / 2, 37, { align: 'center' });
      doc.setTextColor(170, 190, 240);
      doc.text(`Document genere le : ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth / 2, 44, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      y = 58;

      doc.setFillColor(239, 246, 255);
      doc.rect(margin - 2, y - 3, maxWidth + 4, 7, 'F');
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text("PARTIE 1 - ATTESTATION DE L'EDITEUR", margin, y + 1);
      doc.setTextColor(0, 0, 0);
      y += 12;

      y = drawSectionTitle(doc, "1. IDENTIFICATION DE L'EDITEUR", y, margin, pageWidth);
      doc.setFontSize(9);
      [
        ["Raison sociale :", `${EDITEUR.nom} (${EDITEUR.formeJuridique})`],
        ["SIRET :", EDITEUR.siret],
        ["N TVA intracommunautaire :", EDITEUR.tva],
        ["RCS :", EDITEUR.rcs],
        ["Siege social :", `${EDITEUR.adresse}, ${EDITEUR.ville}`],
        ["Activite :", EDITEUR.activite],
        ["Representant legal :", EDITEUR.representant],
      ].forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin + 3, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 58, y);
        y += 6;
      });

      y += 4;
      y = drawSectionTitle(doc, "2. IDENTIFICATION DU LOGICIEL", y, margin, pageWidth);
      [
        ["Nom du logiciel :", EDITEUR.logiciel],
        ["Module concerne :", EDITEUR.module],
        ["Version :", EDITEUR.version],
        ["Date de version :", EDITEUR.dateVersion],
      ].forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin + 3, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 45, y);
        y += 6;
      });

      y += 4;
      y = drawSectionTitle(doc, "3. DECLARATION DE CONFORMITE DE L'EDITEUR", y, margin, pageWidth);
      y = addWrappedText(
        doc,
        `La societe ${EDITEUR.nom} ${EDITEUR.formeJuridique}, representee par ${EDITEUR.representant} en sa qualite de representant legal, declare que le logiciel ${EDITEUR.logiciel} - ${EDITEUR.module} - version ${EDITEUR.version}, satisfait aux conditions d'inalterabilite, de securisation, de conservation et d'archivage des donnees conformement a l'article 286 I-3 bis du Code General des Impots, tel que precise par l'arrete du 3 aout 2018. Cette attestation est etablie sous la responsabilite exclusive de l'editeur du logiciel.`,
        margin + 3,
        y,
        maxWidth - 6,
      );

      y += 5;
      y = drawSectionTitle(doc, "4. GARANTIES TECHNIQUES DE L'EDITEUR", y, margin, pageWidth);
      [
        "a) INALTERABILITE",
        "   • Numerotation sequentielle et continue des tickets de caisse",
        "   • Horodatage automatique et non modifiable de chaque transaction",
        "   • Interdiction de suppression ou modification des donnees d'encaissement validees",
        "   • Toute modification d'une donnee d'encaissement laisse une trace horodatee et journalisee",
        "   • Journal des annulations et avoirs trace avec motif, date et utilisateur",
        "",
        "b) SECURISATION",
        "   • Chiffrement des donnees en transit HTTPS/TLS et au repos",
        "   • Controle d'acces multi-niveaux : proprietaire, manager, employe",
        "   • Authentification par identifiant, mot de passe et code PIN pour les operations sensibles",
        "   • Journal des evenements et tracabilite complete des actions utilisateurs",
        "   • Journalisation des ouvertures du tiroir-caisse avec horodatage",
        "",
        "c) CONSERVATION",
        "   • Conservation de l'integralite des donnees de vente sur infrastructure cloud securisee",
        "   • Duree minimale legale de conservation : 6 ans garantie",
        "   • Acces permanent a l'historique complet des transactions",
        "   • Donnees exportables a tout moment pour controle fiscal",
        "",
        "d) ARCHIVAGE PERIODIQUE",
        "   • Clotures Z journalieres enregistrees avec totaux et ventilation par taux de TVA",
        "   • Rapports comptables periodiques jour, semaine, mois et annee",
        "   • Grand livre des operations accessible et exportable",
        "   • Journal fiscal exportable au format structure CSV et PDF",
        "   • Export des donnees fiscales au format structure compatible Factur-X / UBL / e-reporting",
      ].forEach((line) => {
        y = checkNewPage(doc, y);
        if (line) {
          doc.setFont(undefined, line.match(/^[a-d]\)/) ? 'bold' : 'normal');
          doc.text(line, margin + 3, y);
        }
        y += line === "" ? 3 : 5.5;
      });

      y = checkNewPage(doc, y, 220);
      y += 5;
      y = drawSectionTitle(doc, "5. COMPATIBILITE ET EVOLUTIONS REGLEMENTAIRES", y, margin, pageWidth);
      [
        "   • Preparation a la facturation electronique obligatoire reforme 2026/2027",
        "   • Compatibilite e-reporting B2C pour transmission des donnees de transactions",
        "   • Architecture compatible PDP et plateformes de dematerialisation partenaires",
        "   • Export des donnees fiscales au format structure compatible Factur-X / UBL / e-reporting",
        "   • Ventilation TVA multi-taux exportable pour declarations comptables",
        "   • Journal fiscal exportable pour transmission a l'administration fiscale",
      ].forEach((line) => {
        doc.setFont(undefined, 'normal');
        doc.text(line, margin + 3, y);
        y += 5.5;
      });

      y = checkNewPage(doc, y, 220);
      y += 8;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text("Signature et cachet de l'editeur :", margin, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(`Societe : ${EDITEUR.nom} ${EDITEUR.formeJuridique}`, margin + 3, y);
      y += 5;
      doc.text(`Representant legal : ${EDITEUR.representant}`, margin + 3, y);
      y += 5;
      doc.text(`Fait a Reims, le ${new Date().toLocaleDateString('fr-FR')}`, margin + 3, y);
      y += 10;

      if (cachetBase64) {
        const imgW = 70;
        const imgH = 70 / 2.12;
        doc.addImage(cachetBase64, 'PNG', margin, y, imgW, imgH);
        y += imgH + 4;
      } else {
        doc.setDrawColor(80, 80, 80);
        doc.rect(margin, y, 70, 20);
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.setFont(undefined, 'italic');
        doc.text("Cachet + Signature STRASYK SASU", margin + 3, y + 10);
        doc.setTextColor(0, 0, 0);
        y += 24;
      }

      y = checkNewPage(doc, y + 5, 230);
      y += 8;
      doc.setFillColor(239, 246, 255);
      doc.rect(margin - 2, y - 3, maxWidth + 4, 7, 'F');
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text("PARTIE 2 - IDENTIFICATION DE L'ETABLISSEMENT UTILISATEUR", margin, y + 1);
      doc.setTextColor(0, 0, 0);
      y += 12;

      y = drawSectionTitle(doc, "6. INFORMATIONS DE L'ETABLISSEMENT", y, margin, pageWidth);
      [
        ["Raison sociale :", displayedEstablishmentName],
        ["Enseigne :", displayedEnseigneName],
        ["Adresse :", profile?.adresse || 'Non renseigne'],
        ["Ville :", profile?.ville || 'Non renseigne'],
        ["Telephone :", profile?.telephone || 'Non renseigne'],
        ["SIRET :", profile?.siret || 'Non renseigne'],
        ["N TVA intracommunautaire :", profile?.tva_intracommunautaire || 'Non renseigne'],
      ].forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin + 3, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 65, y);
        y += 6;
      });

      y += 4;
      y = drawSectionTitle(doc, "7. RESPONSABLE DE L'ETABLISSEMENT", y, margin, pageWidth);
      [
        ["Nom et prenom :", displayedManagerName],
        ["Email :", currentUser?.email || 'Non renseigne'],
        ["Qualite :", "Proprietaire / Gerant"],
        ["Date de mise en service :", new Date().toLocaleDateString('fr-FR')],
      ].forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, margin + 3, y);
        doc.setFont(undefined, 'normal');
        doc.text(value, margin + 55, y);
        y += 6;
      });

      y += 4;
      y = drawSectionTitle(doc, "8. ENGAGEMENT DE L'UTILISATEUR", y, margin, pageWidth);
      y = addWrappedText(
        doc,
        `Je soussigne, ${displayedManagerName}, agissant en qualite de representant de l'etablissement utilisateur identifie dans le present document, atteste utiliser le logiciel ${EDITEUR.logiciel} version ${EDITEUR.version} pour les operations d'encaissement de l'etablissement. Je certifie que les donnees enregistrees dans ce systeme ne font l'objet d'aucune manipulation frauduleuse et que les conditions d'utilisation prevues par l'article 286 I-3 bis du Code General des Impots sont respectees.`,
        margin + 3,
        y,
        maxWidth - 6,
      );

      y += 8;
      doc.setFont(undefined, 'bold');
      doc.text("Signature de l'utilisateur :", margin, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      doc.text(`Nom et qualite : ${displayedManagerName}`, margin + 3, y);
      y += 5;
      doc.text(`Fait a ${displayedCity}, le ${new Date().toLocaleDateString('fr-FR')}`, margin + 3, y);
      y += 5;
      doc.setFont(undefined, 'bold');
      doc.text('Mention manuscrite obligatoire : "Lu et approuve"', margin + 3, y);
      doc.setFont(undefined, 'normal');
      y += 10;

      doc.setDrawColor(80, 80, 80);
      doc.rect(margin, y, 75, 22);
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont(undefined, 'italic');
      doc.text("Signature de l'utilisateur", margin + 3, y + 5);
      doc.text(displayedManagerName, margin + 3, y + 10);
      doc.text("(version papier)", margin + 3, y + 15);

      doc.rect(margin + 85, y, 55, 22);
      doc.text("Cachet de l'etablissement", margin + 88, y + 5);
      doc.text(displayedEstablishmentName, margin + 88, y + 10);
      doc.text("(version papier)", margin + 88, y + 15);
      doc.setTextColor(0, 0, 0);

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.setFont(undefined, 'italic');
        doc.text(
          "Ce document constitue une attestation de conformite a l'article 286 I-3 bis du CGI. Il doit etre conserve pendant 6 ans minimum et presente lors de tout controle fiscal.",
          margin,
          pageHeight - 12
        );
        doc.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }

      const nom = profile?.nom_etablissement?.replace(/\s+/g, '_') || 'etablissement';
      doc.save(`Attestation_CGI_286_${nom}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Erreur generation PDF:", error);
      alert("Erreur lors de la generation du PDF");
    } finally {
      setGenerating(false);
    }
  };

  const featuresData = [
    {
      icon: Lock,
      title: "Inalterabilite",
      color: "from-blue-500 to-blue-700",
      items: [
        "Numerotation sequentielle continue des tickets",
        "Horodatage automatique non modifiable",
        "Toute modification laisse une trace horodatee",
        "Journal des annulations et avoirs trace",
      ],
    },
    {
      icon: Shield,
      title: "Securisation",
      color: "from-indigo-500 to-indigo-700",
      items: [
        "Chiffrement HTTPS/TLS en transit et au repos",
        "Authentification multi-niveaux roles et PIN",
        "Journal des evenements et actions utilisateurs",
        "Tracabilite des ouvertures tiroir-caisse",
      ],
    },
    {
      icon: Archive,
      title: "Conservation",
      color: "from-emerald-500 to-emerald-700",
      items: [
        "Duree minimale legale : 6 ans garantie",
        "Historique complet des transactions",
        "Donnees exportables pour controle fiscal",
        "Infrastructure cloud securisee",
      ],
    },
    {
      icon: FileCheck,
      title: "Archivage periodique",
      color: "from-violet-500 to-violet-700",
      items: [
        "Clotures Z journalieres avec ventilation TVA",
        "Grand livre des operations accessible",
        "Journal fiscal exportable CSV et PDF",
        "Rapports comptables periodiques",
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
                  Ce document est une <strong>attestation individuelle de conformite a l'article 286 I-3 bis du CGI</strong>,
                  portee conjointement par l'editeur <strong>Strasyk</strong> et l'etablissement utilisateur.
                  Il remplace toute reference a une auto-certification ou a la norme NF525 qui necessite une certification par organisme agree.
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
                ["Activite", EDITEUR.activite],
                ["Representant legal", EDITEUR.representant],
                ["Logiciel / Module", `${EDITEUR.logiciel} - ${EDITEUR.module}`],
                ["Version", `${EDITEUR.version} (${EDITEUR.dateVersion})`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className="font-medium text-gray-900 text-xs">{value}</p>
                </div>
              ))}
              <p className="text-xs text-indigo-600 italic mt-1">
                Cette attestation est etablie sous la responsabilite exclusive de l'editeur du logiciel.
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-emerald-600" />
                Etablissement utilisateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Raison sociale", displayedEstablishmentName],
                ["Enseigne", displayedEnseigneName],
                ["SIRET", profile?.siret || 'Non renseigne'],
                ["TVA intracommunautaire", profile?.tva_intracommunautaire || 'Non renseigne'],
                ["Responsable", displayedManagerName],
                ["Email", currentUser?.email || 'Non renseigne'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className="font-medium text-gray-900">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Mentions de conformite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">
                Le logiciel respecte les exigences d'inalterabilite, de securisation, de conservation et d'archivage des donnees d'encaissement.
              </p>
              <p className="text-sm text-gray-700">
                Le PDF telecharge reprend une structure d'attestation detaillee avec partie editeur, partie etablissement et zones de signature.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
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
          {featuresData.map((feature) => (
            <Card key={feature.title} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className={`p-2 bg-gradient-to-br ${feature.color} rounded-lg`}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  {feature.title}
                </CardTitle>
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
                  Document officiel nominatif conforme a la loi anti-fraude a la TVA.
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
              <strong>Obligation :</strong> depuis le 1er janvier 2018, les logiciels de caisse doivent etre conformes aux conditions d'inalterabilite, de securisation, de conservation et d'archivage des donnees.
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
