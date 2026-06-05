import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { useTenant } from "../components/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileCheck, Shield, Lock, Archive, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";

export default function CertificationPage() {
  const { currentTenant, currentUser } = useTenant();
  const [generating, setGenerating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', currentTenant?.id],
    queryFn: () => appClient.entities.RestaurantProfile.filter({ tenant_id: currentTenant?.id }),
    enabled: !!currentTenant?.id,
    select: (data) => data[0],
  });

  const enseigneName = `${currentTenant?.nom_commercial || ''}`.trim();
  const establishmentName = `${profile?.nom_etablissement || ''}`.trim();
  const showBothNames = enseigneName && establishmentName && enseigneName.toLowerCase() !== establishmentName.toLowerCase();

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // En-tête
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text("ATTESTATION D'AUTO-CERTIFICATION", pageWidth / 2, y, { align: 'center' });
      
      y += 10;
      doc.setFontSize(16);
      doc.text("Conformité Loi Anti-Fraude à la TVA", pageWidth / 2, y, { align: 'center' });
      
      y += 5;
      doc.setFontSize(12);
      doc.text("Article 286 du Code Général des Impôts", pageWidth / 2, y, { align: 'center' });
      
      y += 15;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, margin, y);

      // Informations du commerce
      y += 15;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("INFORMATIONS DU COMMERCE", margin, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Nom de l'établissement : ${establishmentName || 'Non renseigné'}`, margin, y);
      y += 7;
      doc.text(`Nom de l'enseigne : ${enseigneName || establishmentName || 'Non renseigné'}`, margin, y);
      y += 7;
      doc.text(`Adresse : ${profile?.adresse || 'Non renseigné'}`, margin, y);
      y += 7;
      doc.text(`SIRET : ${profile?.siret || 'Non renseigné'}`, margin, y);
      y += 7;
      doc.text(`TVA intracommunautaire : ${profile?.tva_intracommunautaire || 'Non renseigné'}`, margin, y);

      // Informations utilisateur
      y += 15;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("UTILISATEUR CERTIFIÉ", margin, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Email : ${currentUser?.email || 'Non renseigné'}`, margin, y);
      y += 7;
      doc.text(`Nom complet : ${currentUser?.full_name || 'Non renseigné'}`, margin, y);
      y += 7;
      doc.text(`Rôle : ${currentUser?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}`, margin, y);

      // Logiciel
      y += 15;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("LOGICIEL DE CAISSE", margin, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Nom du logiciel : Strasyk POS`, margin, y);
      y += 7;
      doc.text(`Éditeur : Strasyk`, margin, y);
      y += 7;
      doc.text(`Version : 2.0`, margin, y);
      y += 7;
      doc.text(`Date de mise en service : ${new Date().toLocaleDateString('fr-FR')}`, margin, y);

      // Nouvelle page pour les fonctionnalités
      doc.addPage();
      y = 20;

      // Fonctionnalités NF525
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("CONFORMITÉ AUX EXIGENCES NF525", margin, y);

      y += 15;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("1. INALTÉRABILITÉ DES DONNÉES", margin, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const inalt = [
        "✓ Enregistrement sécurisé de toutes les transactions",
        "✓ Numérotation séquentielle et continue des tickets",
        "✓ Impossibilité de modifier ou supprimer les commandes payées",
        "✓ Horodatage automatique de chaque opération",
        "✓ Journal des modifications (DrawerOpening) pour traçabilité",
        "✓ Archivage sécurisé des données"
      ];
      inalt.forEach(line => {
        doc.text(line, margin + 5, y);
        y += 6;
      });

      y += 8;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("2. SÉCURISATION DES DONNÉES", margin, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const secu = [
        "✓ Sauvegarde automatique dans le cloud",
        "✓ Chiffrement des données en transit et au repos",
        "✓ Contrôle d'accès par utilisateur avec authentification",
        "✓ Codes PIN pour les pages sensibles",
        "✓ Gestion des rôles (propriétaire, manager, employé)",
        "✓ Traçabilité complète des actions utilisateurs"
      ];
      secu.forEach(line => {
        doc.text(line, margin + 5, y);
        y += 6;
      });

      y += 8;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("3. CONSERVATION DES DONNÉES", margin, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const conserv = [
        "✓ Conservation de l'intégralité des données de vente",
        "✓ Historique complet des commandes accessible",
        "✓ Clôtures de caisse quotidiennes enregistrées",
        "✓ Rapports comptables NF525 disponibles",
        "✓ Export des données comptables",
        "✓ Conservation minimum de 6 ans garantie"
      ];
      conserv.forEach(line => {
        doc.text(line, margin + 5, y);
        y += 6;
      });

      y += 8;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("4. ARCHIVAGE PÉRIODIQUE", margin, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const arch = [
        "✓ Clôture de caisse journalière obligatoire",
        "✓ Comptage et vérification des encaissements",
        "✓ Calcul automatique des écarts de caisse",
        "✓ Rapports de vente détaillés par période",
        "✓ Grand livre des opérations",
        "✓ Exports comptables périodiques"
      ];
      arch.forEach(line => {
        doc.text(line, margin + 5, y);
        y += 6;
      });

      // Nouvelle page pour les fonctionnalités supplémentaires
      doc.addPage();
      y = 20;

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("5. FONCTIONNALITÉS COMPLÉMENTAIRES", margin, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const compl = [
        "✓ Gestion multi-taux de TVA",
        "✓ Détail des paiements (espèces, CB, chèque, tickets restaurant)",
        "✓ Gestion des avoirs et remboursements",
        "✓ Journal d'ouverture du tiroir-caisse",
        "✓ Tickets de caisse conformes avec mentions obligatoires",
        "✓ Impression automatique des tickets",
        "✓ Mode hors ligne avec synchronisation",
        "✓ Statistiques et analyses détaillées",
        "✓ Contrôle d'inventaire et gestion des stocks",
        "✓ Gestion des livraisons et livreurs"
      ];
      compl.forEach(line => {
        doc.text(line, margin + 5, y);
        y += 6;
      });

      y += 15;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("ENGAGEMENT DE CONFORMITÉ", margin, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const maxWidth = pageWidth - 2 * margin;
      const engagement = "Je soussigné(e), utilisateur du logiciel Strasyk POS, atteste que ce logiciel de caisse respecte les conditions d'inaltérabilité, de sécurisation, de conservation et d'archivage des données conformément à l'article 286 du Code Général des Impôts et à l'arrêté du 3 août 2018 modifiant les articles 286 et 88 du Code Général des Impôts.";
      const lines = doc.splitTextToSize(engagement, maxWidth);
      lines.forEach(line => {
        doc.text(line, margin, y);
        y += 6;
      });

      y += 15;
      doc.text(`Fait à ${profile?.adresse || '________________'}, le ${new Date().toLocaleDateString('fr-FR')}`, margin, y);
      
      y += 15;
      doc.text("Signature de l'utilisateur :", margin, y);
      y += 5;
      doc.text(`${currentUser?.full_name || '________________'}`, margin, y);

      // Pied de page
      y += 20;
      doc.setFontSize(8);
      doc.setFont(undefined, 'italic');
      doc.text("Ce document constitue une auto-certification de conformité à la loi anti-fraude à la TVA.", margin, y);
      y += 5;
      doc.text("Il doit être conservé et présenté en cas de contrôle fiscal.", margin, y);

      // Sauvegarder le PDF
      const fileName = `Certification_NF525_${profile?.nom_etablissement?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error("Erreur génération PDF:", error);
      alert("Erreur lors de la génération du PDF");
    } finally {
      setGenerating(false);
    }
  };

  const features = [
    {
      icon: Lock,
      title: "Inaltérabilité",
      description: "Les données enregistrées ne peuvent pas être modifiées ou supprimées",
      items: [
        "Numérotation séquentielle des tickets",
        "Horodatage automatique",
        "Impossibilité de modifier les commandes payées"
      ]
    },
    {
      icon: Shield,
      title: "Sécurisation",
      description: "Protection et contrôle d'accès aux données",
      items: [
        "Sauvegarde cloud automatique",
        "Authentification utilisateur",
        "Codes PIN pour pages sensibles"
      ]
    },
    {
      icon: Archive,
      title: "Conservation",
      description: "Archivage des données pour 6 ans minimum",
      items: [
        "Historique complet des ventes",
        "Clôtures de caisse enregistrées",
        "Exports comptables disponibles"
      ]
    },
    {
      icon: FileCheck,
      title: "Archivage périodique",
      description: "Clôtures et rapports réguliers",
      items: [
        "Clôture journalière obligatoire",
        "Rapports NF525 détaillés",
        "Grand livre des opérations"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <FileCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Certification
              </h1>
              <p className="text-gray-600">
                Attestation de conformité loi anti-fraude à la TVA
              </p>
            </div>
          </div>

          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Strasyk POS</strong> est conforme aux exigences de l'article 286 du Code Général des Impôts 
                    concernant les logiciels de caisse et de gestion.
                  </p>
                  <p className="text-sm text-gray-600">
                    Ce document d'auto-certification est nominatif et doit être conservé pour tout contrôle fiscal.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informations du commerce et utilisateur */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Commerce certifié
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Établissement</p>
                <p className="font-semibold text-gray-900">{establishmentName || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Enseigne</p>
                <p className="font-semibold text-gray-900">
                  {showBothNames ? enseigneName : (enseigneName || establishmentName || 'Non renseigné')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">SIRET</p>
                <p className="font-mono text-sm text-gray-900">{profile?.siret || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">TVA intracommunautaire</p>
                <p className="font-mono text-sm text-gray-900">{profile?.tva_intracommunautaire || 'Non renseigné'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-green-600" />
                Utilisateur certifié
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Nom complet</p>
                <p className="font-semibold text-gray-900">{currentUser?.full_name || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-mono text-sm text-gray-900">{currentUser?.email || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rôle</p>
                <p className="font-semibold text-gray-900">
                  {currentUser?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fonctionnalités NF525 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
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
                  {feature.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bouton de téléchargement */}
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold mb-2">
                  Télécharger l'attestation de certification
                </h3>
                <p className="text-blue-100 text-sm">
                  Document officiel nominatif conforme à la loi anti-fraude à la TVA
                </p>
              </div>
              <Button
                onClick={generatePDF}
                disabled={generating}
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg"
              >
                <Download className="w-5 h-5 mr-2" />
                {generating ? 'Génération...' : 'Télécharger le PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Informations légales */}
        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Informations légales</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>Référence légale :</strong> Article 286 du Code Général des Impôts, 
              modifié par l'arrêté du 3 août 2018
            </p>
            <p>
              <strong>Obligation :</strong> Depuis le 1er janvier 2018, tous les logiciels de caisse 
              doivent être conformes aux conditions d'inaltérabilité, de sécurisation, de conservation 
              et d'archivage des données.
            </p>
            <p>
              <strong>Conservation :</strong> Cette attestation doit être conservée et présentée 
              en cas de contrôle fiscal pendant une durée minimale de 6 ans.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
