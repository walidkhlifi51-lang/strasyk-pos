import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Search, Download, ChevronRight, Settings, ShoppingBag, Lock, CreditCard, LayoutGrid, Truck, Users, Pizza, Calendar, BarChart3, FileCheck, Monitor } from 'lucide-react';

const MANUAL_SECTIONS = [
  {
    id: 'parametres',
    title: '⚙️ Paramètres de l\'établissement',
    icon: Settings,
    content: [
      {
        subtitle: 'Informations générales',
        steps: [
          'Allez dans "Paramètres" depuis le menu de gauche',
          'Remplissez le nom de l\'établissement, l\'adresse, le téléphone, et le SIRET',
          'Ajoutez votre logo en cliquant sur "Télécharger le logo"',
          'Configurez les horaires d\'ouverture pour chaque jour de la semaine',
          'Cliquez sur "Enregistrer" pour sauvegarder les modifications'
        ]
      },
      {
        subtitle: 'Configuration des frais',
        steps: [
          'Définissez les frais de livraison (montant fixe par commande)',
          'Fixez le montant minimum pour les commandes en livraison',
          'Configurez la zone de livraison en kilomètres'
        ]
      },
      {
        subtitle: 'Paramètres d\'impression',
        steps: [
          'Activez/désactivez l\'impression automatique après chaque commande',
          'Choisissez l\'impression simple ou double pour la cuisine',
          'Affichez/masquez le bouton d\'impression manuelle'
        ]
      }
    ]
  },
  {
    id: 'categories',
    title: '📂 Gestion des catégories',
    icon: LayoutGrid,
    content: [
      {
        subtitle: 'Créer une catégorie',
        steps: [
          'Dans "Paramètres" > "Catégories", cliquez sur "Nouvelle Catégorie"',
          'Donnez un nom à votre catégorie (ex: Pizzas, Boissons, Desserts)',
          'Choisissez une couleur pour faciliter l\'identification',
          'Activez "Gérer les tailles" si les produits ont différentes tailles (Petit, Moyen, Grand)',
          'Définissez les noms des tailles si nécessaire',
          'Cliquez sur "Créer" pour ajouter la catégorie'
        ]
      },
      {
        subtitle: 'Créer une sous-catégorie',
        steps: [
          'Créez une nouvelle catégorie',
          'Dans le champ "Catégorie parente", sélectionnez la catégorie principale',
          'La sous-catégorie apparaîtra sous la catégorie parente dans la caisse'
        ]
      }
    ]
  },
  {
    id: 'produits',
    title: '🍕 Gestion des produits',
    icon: Pizza,
    content: [
      {
        subtitle: 'Ajouter un produit',
        steps: [
          'Dans "Paramètres" > "Produits", cliquez sur "Nouveau Produit"',
          'Remplissez le nom du produit et sa description',
          'Sélectionnez la catégorie du produit',
          'Si la catégorie gère les tailles, définissez un prix pour chaque taille',
          'Sinon, entrez le prix de vente TTC (prix final)',
          'Choisissez le taux de TVA applicable (5.5%, 10%, 20%)',
          'Définissez le temps de préparation en minutes',
          'Ajoutez une image si souhaité',
          'Choisissez une couleur pour le bouton dans la caisse',
          'Cochez "Disponible" pour le rendre visible dans la caisse',
          'Cliquez sur "Créer" pour enregistrer'
        ]
      },
      {
        subtitle: 'Rendre un produit indisponible',
        steps: [
          'Dans la liste des produits, trouvez le produit concerné',
          'Cliquez sur "Modifier"',
          'Décochez "Disponible"',
          'Le produit n\'apparaîtra plus dans la caisse'
        ]
      }
    ]
  },
  {
    id: 'ingredients',
    title: '🥘 Gestion des ingrédients',
    icon: ShoppingBag,
    content: [
      {
        subtitle: 'Ajouter un ingrédient',
        steps: [
          'Dans "Paramètres" > "Ingrédients", cliquez sur "Nouvel Ingrédient"',
          'Donnez un nom à l\'ingrédient (ex: Tomate, Mozzarella)',
          'Sélectionnez l\'unité (kg, g, L, ml, pièce)',
          'Entrez le coût unitaire (prix d\'achat par unité)',
          'Indiquez la quantité en stock si vous gérez les stocks',
          'Cliquez sur "Créer"'
        ]
      },
      {
        subtitle: 'Lier un ingrédient à un produit',
        steps: [
          'Modifiez un produit existant',
          'Dans la section "Ingrédients", cliquez sur "Ajouter un ingrédient"',
          'Sélectionnez l\'ingrédient dans la liste',
          'Définissez la quantité utilisée par produit',
          'Cochez "Retirable" si le client peut l\'exclure lors de la commande',
          'Enregistrez le produit'
        ]
      },
      {
        subtitle: 'Analyse des coûts',
        steps: [
          'Allez dans "Analyse Coûts" depuis le menu',
          'Consultez le coût de revient de chaque produit',
          'Visualisez la marge bénéficiaire calculée automatiquement',
          'Identifiez les produits peu rentables'
        ]
      }
    ]
  },
  {
    id: 'options',
    title: '🎛️ Options et personnalisations',
    icon: Settings,
    content: [
      {
        subtitle: 'Créer un groupe d\'options',
        steps: [
          'Dans "Paramètres" > "Options Produits", cliquez sur "Nouveau Groupe"',
          'Donnez un nom (ex: Choix de sauce, Suppléments)',
          'Sélectionnez "Choix unique" ou "Choix multiple"',
          'Si multiple, définissez le nombre maximum de sélections',
          'Cochez "Obligatoire" si le client doit choisir une option',
          'Cliquez sur "Créer le groupe"'
        ]
      },
      {
        subtitle: 'Ajouter des options au groupe',
        steps: [
          'Cliquez sur le groupe créé',
          'Ajoutez des options (ex: Sauce tomate, Sauce crème)',
          'Définissez le supplément de prix pour chaque option',
          'Cochez "Par défaut" pour présélectionner une option',
          'Enregistrez'
        ]
      },
      {
        subtitle: 'Lier les options à un produit',
        steps: [
          'Modifiez un produit',
          'Dans "Groupes d\'options", sélectionnez les groupes à appliquer',
          'Le client pourra personnaliser le produit lors de la commande'
        ]
      }
    ]
  },
  {
    id: 'menus',
    title: '🍽️ Formules et menus',
    icon: Pizza,
    content: [
      {
        subtitle: 'Créer un menu',
        steps: [
          'Dans "Paramètres" > "Formules & Menus", cliquez sur "Nouveau Menu"',
          'Nommez le menu (ex: Menu Senior, Formule Famille)',
          'Définissez le prix fixe du menu',
          'Sélectionnez la catégorie du menu',
          'Ajoutez une description et une image',
          'Choisissez une couleur',
          'Cliquez sur "Créer"'
        ]
      },
      {
        subtitle: 'Composer le menu',
        steps: [
          'Cliquez sur "Composer ce menu"',
          'Pour chaque étape du menu (entrée, plat, dessert, etc.):',
          '  - Sélectionnez la catégorie des produits disponibles',
          '  - Donnez un nom d\'affichage (ex: "2 Pizzas au choix")',
          '  - Définissez la quantité de produits à choisir',
          '  - Choisissez les produits inclus dans cette étape',
          '  - Fixez une taille si nécessaire (optionnel)',
          'Enregistrez chaque étape',
          'Le client composera son menu lors de la commande'
        ]
      }
    ]
  },
  {
    id: 'offres',
    title: '🎁 Offres promotionnelles',
    icon: BarChart3,
    content: [
      {
        subtitle: 'Créer une offre (ex: 1 acheté = 1 offert)',
        steps: [
          'Dans "Paramètres" > "Offres & Promotions", cliquez sur "Nouvelle Offre"',
          'Nommez l\'offre (ex: Offre Pizza Famille)',
          'Ajoutez une description visible par les clients',
          'Définissez la condition (produit ou catégorie)',
          'Sélectionnez les produits/catégories concernés',
          'Choisissez la taille requise (optionnel)',
          'Indiquez la quantité à acheter',
          'Définissez la récompense (produit offert)',
          'Indiquez la quantité offerte',
          'Activez l\'offre en cochant "Active"',
          'L\'offre s\'appliquera automatiquement lors des commandes'
        ]
      }
    ]
  },
  {
    id: 'fidelite',
    title: '💎 Programme de fidélité',
    icon: Users,
    content: [
      {
        subtitle: 'Créer une règle de fidélité',
        steps: [
          'Dans "Paramètres" > "Fidélité", cliquez sur "Nouvelle Règle"',
          'Nommez la règle (ex: Cadeau 5ème commande)',
          'Définissez le numéro de commande déclencheur (ex: 5 pour la 5ème)',
          'Choisissez le type de récompense:',
          '  - Réduction en pourcentage',
          '  - Réduction montant fixe',
          '  - Produit gratuit',
          'Définissez la valeur ou sélectionnez le produit offert',
          'Activez la règle',
          'Elle s\'appliquera automatiquement aux clients fidèles'
        ]
      },
      {
        subtitle: 'Système de cagnotte',
        steps: [
          'Dans "Paramètres" > "Cagnotte", activez le système',
          'Définissez le taux d\'accumulation (ex: 5% du total)',
          'Les clients gagnent des points à chaque commande payée',
          'Ils peuvent utiliser leur cagnotte lors du paiement',
          'Consultez l\'historique dans la fiche client'
        ]
      }
    ]
  },
  {
    id: 'codes-promo',
    title: '🎟️ Codes promotionnels',
    icon: BarChart3,
    content: [
      {
        subtitle: 'Créer un code promo',
        steps: [
          'Dans "Paramètres" > "Marketing" > "Codes Promo"',
          'Cliquez sur "Nouveau Code"',
          'Définissez le code (ex: NOEL2024, BIENVENUE10)',
          'Choisissez le type de réduction (% ou montant fixe)',
          'Entrez la valeur de la réduction',
          'Fixez une date d\'expiration (optionnel)',
          'Limitez le nombre d\'utilisations (optionnel)',
          'Activez le code',
          'Le client pourra l\'appliquer dans le panier'
        ]
      }
    ]
  },
  {
    id: 'securite',
    title: '🔒 Codes de sécurité',
    icon: Lock,
    content: [
      {
        subtitle: 'Protéger une page par code PIN',
        steps: [
          'Dans "Paramètres" > "Sécurité"',
          'Pour chaque page sensible (Comptage Caisse, Statistiques, etc.)',
          'Entrez un code PIN à 4 chiffres',
          'Cliquez sur "Enregistrer les codes PIN"',
          'Les utilisateurs devront entrer le code pour accéder à ces pages',
          'Laissez vide pour retirer la protection'
        ]
      }
    ]
  },
  {
    id: 'forcer-encaissement',
    title: '💳 Forcer l\'encaissement immédiat',
    icon: CreditCard,
    content: [
      {
        subtitle: 'Activer le paiement obligatoire',
        steps: [
          'Dans "Paramètres" > "Sécurité"',
          'Activez "Forcer le paiement immédiat"',
          'Cette option interdit la mise en crédit pour:',
          '  - Les commandes sur place',
          '  - Les commandes à emporter',
          'Les commandes en livraison peuvent toujours être payées plus tard',
          'Cela oblige le personnel à encaisser directement'
        ]
      }
    ]
  },
  {
    id: 'tables',
    title: '🪑 Gestion des tables',
    icon: LayoutGrid,
    content: [
      {
        subtitle: 'Activer la gestion des tables',
        steps: [
          'Dans "Paramètres" > "Paramètres Généraux"',
          'Activez "Gérer le plan de tables"',
          'Un nouvel onglet "Plan de Tables" apparaît dans le menu'
        ]
      },
      {
        subtitle: 'Créer des tables',
        steps: [
          'Allez dans "Plan de Tables"',
          'Cliquez sur "Ajouter une table"',
          'Donnez un nom (ex: Table 1, Terrasse 2)',
          'Indiquez la capacité (nombre de places)',
          'Choisissez la forme (carrée, ronde, rectangulaire)',
          'La table apparaît sur le plan',
          'Déplacez-la en la faisant glisser',
          'Redimensionnez-la si nécessaire'
        ]
      },
      {
        subtitle: 'Utiliser les tables en caisse',
        steps: [
          'Dans la caisse, sélectionnez "Sur place"',
          'Cliquez sur "Sélectionner une table"',
          'Choisissez une table disponible (verte)',
          'Ajoutez les produits',
          'La table passe en "Occupée" (orange)',
          'Encaissez quand le client part',
          'La table passe en "À nettoyer" (grise)',
          'Marquez-la "Disponible" une fois nettoyée'
        ]
      }
    ]
  },
  {
    id: 'livraisons',
    title: '🚚 Gestion des livraisons',
    icon: Truck,
    content: [
      {
        subtitle: 'Activer les livraisons',
        steps: [
          'Dans "Paramètres" > "Paramètres Généraux"',
          'Activez "Gérer les livraisons"',
          'Les onglets "Livraisons" et "Encaissements" apparaissent'
        ]
      },
      {
        subtitle: 'Ajouter des livreurs',
        steps: [
          'Dans "Paramètres" > "Livreurs"',
          'Cliquez sur "Nouveau Livreur"',
          'Remplissez nom, prénom, téléphone',
          'Choisissez le type de véhicule',
          'Cochez "Disponible" pour l\'activer',
          'Enregistrez'
        ]
      },
      {
        subtitle: 'Gérer les commandes en livraison',
        steps: [
          'Dans la caisse, créez une commande "Livraison"',
          'Sélectionnez ou créez un client',
          'Vérifiez l\'adresse de livraison',
          'Ajoutez les produits',
          'Les frais de livraison s\'ajoutent automatiquement',
          'Encaissez ou mettez en crédit',
          'La commande apparaît dans "Livraisons"',
          'Assignez un livreur disponible',
          'Le livreur voit ses livraisons et peut les marquer "Livrées"'
        ]
      }
    ]
  },
  {
    id: 'clients',
    title: '👥 Gestion des clients',
    icon: Users,
    content: [
      {
        subtitle: 'Ajouter un client',
        steps: [
          'Dans "Clients" ou depuis la caisse, cliquez sur "Nouveau Client"',
          'Remplissez nom, prénom, téléphone (obligatoires)',
          'Ajoutez l\'adresse complète pour les livraisons',
          'Indiquez l\'étage et le code interphone si nécessaire',
          'Ajoutez des notes (allergies, préférences)',
          'Enregistrez'
        ]
      },
      {
        subtitle: 'Consulter l\'historique',
        steps: [
          'Dans "Clients", cliquez sur un client',
          'Visualisez toutes ses commandes passées',
          'Consultez son solde de cagnotte',
          'Vérifiez ses informations de livraison'
        ]
      },
      {
        subtitle: 'Importer des clients',
        steps: [
          'Dans "Clients", cliquez sur "Importer"',
          'Téléchargez le modèle CSV fourni',
          'Remplissez vos données clients dans Excel',
          'Importez le fichier CSV',
          'Les clients sont ajoutés automatiquement'
        ]
      }
    ]
  },
  {
    id: 'caisse',
    title: '💰 Utiliser la caisse',
    icon: CreditCard,
    content: [
      {
        subtitle: 'Prendre une commande',
        steps: [
          'Cliquez sur "Caisse" dans le menu',
          'Sélectionnez le type de commande (Sur place / Emporter / Livraison)',
          'Pour "Sur place", choisissez une table si activé',
          'Pour "Livraison", sélectionnez un client',
          'Cliquez sur les produits pour les ajouter au panier',
          'Modifiez les quantités avec + et -',
          'Personnalisez les produits si options disponibles',
          'Ajoutez des notes si besoin',
          'Cliquez sur "Encaisser" pour finaliser'
        ]
      },
      {
        subtitle: 'Encaisser une commande',
        steps: [
          'Sélectionnez le(s) mode(s) de paiement',
          'Entrez le montant reçu pour chaque mode',
          'Le système calcule la monnaie à rendre',
          'Si le client paie avec sa cagnotte, déduisez le montant',
          'Validez le paiement',
          'Le ticket s\'imprime automatiquement si activé',
          'La commande passe en "Prête" ou "En préparation"'
        ]
      },
      {
        subtitle: 'Mettre une commande en attente',
        steps: [
          'Ajoutez des produits au panier',
          'Cliquez sur "Mettre en attente"',
          'La commande est sauvegardée',
          'Retrouvez-la dans la liste des commandes à gauche',
          'Cliquez dessus pour la reprendre',
          'Encaissez quand le client revient'
        ]
      },
      {
        subtitle: 'Modifier une commande',
        steps: [
          'Dans la liste des commandes, trouvez la commande',
          'Cliquez sur "Modifier"',
          'Ajoutez ou retirez des produits',
          'Changez le type ou la table si besoin',
          'Enregistrez ou encaissez'
        ]
      },
      {
        subtitle: 'Annuler une commande',
        steps: [
          'Trouvez la commande dans la liste',
          'Cliquez sur "Annuler"',
          'Sélectionnez le motif d\'annulation',
          'Confirmez',
          'La commande est archivée et n\'apparaît plus dans les statistiques'
        ]
      }
    ]
  },
  {
    id: 'comptage',
    title: '📊 Comptage de caisse',
    icon: Calendar,
    content: [
      {
        subtitle: 'Effectuer le comptage quotidien',
        steps: [
          'À la fin de la journée, allez dans "Comptage Caisse"',
          'Le système affiche le total attendu par mode de paiement',
          'Comptez physiquement votre caisse',
          'Entrez les montants réels comptés pour chaque mode',
          'Le système calcule automatiquement les écarts',
          'Ajoutez des notes si nécessaire (explication des écarts)',
          'Cliquez sur "Clôturer la journée"',
          'La clôture est définitive et bloque la caisse pour ce jour'
        ]
      },
      {
        subtitle: 'Important',
        steps: [
          'Vous devez clôturer chaque journée avant de passer à la suivante',
          'Une fois clôturée, la journée ne peut plus être modifiée',
          'Les écarts sont enregistrés et tracés pour l\'audit',
          'Consultez l\'historique dans "Comptabilité"'
        ]
      }
    ]
  },
  {
    id: 'statistiques',
    title: '📈 Statistiques et rapports',
    icon: BarChart3,
    content: [
      {
        subtitle: 'Consulter les statistiques',
        steps: [
          'Allez dans "Statistiques" depuis le menu',
          'Sélectionnez la période (Aujourd\'hui, Mois, Année, Intervalle)',
          'Visualisez:',
          '  - Le chiffre d\'affaires',
          '  - Le nombre de commandes',
          '  - Le panier moyen',
          '  - Les nouveaux clients',
          'Consultez les graphiques de ventes',
          'Analysez les modes de paiement',
          'Identifiez les produits les plus vendus'
        ]
      },
      {
        subtitle: 'Exporter les données',
        steps: [
          'Dans "Statistiques", cliquez sur "Exporter"',
          'Choisissez "Toutes les commandes (CSV)" pour Excel',
          'Ou "Personnaliser l\'export" pour un rapport PDF/CSV détaillé',
          'Sélectionnez les sections à inclure',
          'Téléchargez le fichier',
          'Utilisez-le pour votre comptabilité ou analyses'
        ]
      },
      {
        subtitle: 'Rapport de TVA (NF525)',
        steps: [
          'Dans "Statistiques", consultez le rapport de TVA',
          'Vérifiez les montants HT, TVA et TTC',
          'Consultez le détail par taux de TVA',
          'Exportez ce rapport pour votre comptable',
          'Ce rapport est certifié conforme à la norme NF525'
        ]
      }
    ]
  },
  {
    id: 'analyse-produits',
    title: '📊 Analyse des produits',
    icon: BarChart3,
    content: [
      {
        subtitle: 'Analyser les ventes par produit',
        steps: [
          'Allez dans "Analyse Produits"',
          'Sélectionnez la période à analyser',
          'Filtrez par catégorie si besoin',
          'Utilisez la barre de recherche',
          'Consultez pour chaque produit:',
          '  - Quantité vendue',
          '  - Chiffre d\'affaires généré',
          '  - Prix moyen de vente',
          'Triez par colonne pour identifier les tops/flops',
          'Exportez les données en CSV ou PDF'
        ]
      }
    ]
  },
  {
    id: 'borne-commande',
    title: '🖥️ Borne de commande',
    icon: Monitor,
    content: [
      {
        subtitle: 'Activer la borne de commande',
        steps: [
          'Dans "Paramètres" > "Paramètres Généraux"',
          'Activez "Gérer la borne de commande"',
          'Un nouvel onglet "Borne Commande" apparaît dans le menu'
        ]
      },
      {
        subtitle: 'Personnaliser la borne',
        steps: [
          'Dans "Paramètres" > "Borne de Commande"',
          'Définissez un message de bienvenue personnalisé',
          'Téléchargez des images d\'accueil (carrousel)',
          'Choisissez la couleur principale (thème de la borne)',
          'Choisissez la couleur secondaire pour les boutons',
          'Activez le paiement par carte bancaire si vous avez un TPE',
          'Enregistrez les modifications'
        ]
      },
      {
        subtitle: 'Utiliser la borne',
        steps: [
          'Ouvrez la borne depuis le menu ou via un lien direct',
          'Le client voit l\'écran d\'accueil avec vos images',
          'Il choisit le type de commande (Sur place / À emporter)',
          'Il parcourt les catégories et sélectionne ses produits',
          'Il personnalise ses produits (options, exclusions)',
          'Il valide son panier',
          'Il choisit son mode de paiement (CB ou à la caisse)',
          'La commande s\'imprime automatiquement à la caisse principale',
          'Le personnel encaisse si paiement à la caisse'
        ]
      },
      {
        subtitle: 'Limites et quotas',
        steps: [
          'Seul un super administrateur peut activer/désactiver la borne',
          'Le nombre de bornes simultanées est limité selon votre abonnement',
          'Chaque borne fonctionne de manière indépendante',
          'Les tickets s\'impriment sur l\'imprimante principale configurée'
        ]
      }
    ]
  },
  {
    id: 'ecran-client',
    title: '📺 Écran client',
    icon: Monitor,
    content: [
      {
        subtitle: 'Activer l\'écran client',
        steps: [
          'Dans "Paramètres" > "Écran Client"',
          'Activez "Activer l\'écran client"',
          'Définissez une couleur principale pour l\'affichage',
          'Ajoutez un message informatif (promotions, horaires, etc.)',
          'Téléchargez des images promotionnelles à afficher',
          'Enregistrez et ouvrez l\'écran client sur un second écran'
        ]
      },
      {
        subtitle: 'Utilisation',
        steps: [
          'Connectez un second écran à votre poste de caisse',
          'Ouvrez la page "Écran Client" sur cet écran',
          'L\'écran affiche automatiquement:',
          '  - Les articles du panier en temps réel',
          '  - Le montant total de la commande',
          '  - Vos images promotionnelles en carrousel',
          '  - Votre message informatif',
          'Le client voit sa commande pendant que vous encaissez'
        ]
      }
    ]
  },
  {
    id: 'caisses-distantes',
    title: '💻 Caisses distantes',
    icon: Monitor,
    content: [
      {
        subtitle: 'Comprendre les caisses distantes',
        steps: [
          'Une caisse distante permet à un employé d\'utiliser son propre appareil',
          'Les tickets de cette caisse s\'impriment sur l\'imprimante principale',
          'Utile pour les restaurants avec plusieurs points de vente',
          'Nécessite l\'activation par un super administrateur'
        ]
      },
      {
        subtitle: 'Activer un utilisateur en caisse distante',
        steps: [
          'Dans "Paramètres" > "Accès Utilisateurs"',
          'Trouvez l\'utilisateur concerné',
          'Activez "Caisse distante"',
          'L\'utilisateur peut maintenant encaisser depuis n\'importe quel appareil',
          'Ses tickets s\'impriment automatiquement sur la caisse principale'
        ]
      },
      {
        subtitle: 'Limites',
        steps: [
          'Le nombre de caisses distantes est limité selon votre abonnement',
          'Seul un super administrateur peut gérer ces limites',
          'Chaque caisse distante compte dans votre quota d\'utilisateurs'
        ]
      }
    ]
  },
  {
    id: 'certification-nf525',
    title: '📜 Certification NF525',
    icon: FileCheck,
    content: [
      {
        subtitle: 'Comprendre la certification',
        steps: [
          'La loi anti-fraude à la TVA (Article 286 CGI) oblige tous les commerces',
          'Votre logiciel doit respecter 4 critères:',
          '  - Inaltérabilité des données',
          '  - Sécurisation des données',
          '  - Conservation des données (6 ans minimum)',
          '  - Archivage périodique',
          'Strasyk POS est conforme à ces exigences'
        ]
      },
      {
        subtitle: 'Télécharger l\'attestation',
        steps: [
          'Allez dans "Certification NF525" depuis le menu',
          'Vérifiez vos informations (commerce et utilisateur)',
          'Consultez les 4 critères de conformité détaillés',
          'Cliquez sur "Télécharger le PDF"',
          'Une attestation nominative est générée automatiquement',
          'Elle contient:',
          '  - Vos informations commerciales',
          '  - Vos informations utilisateur',
          '  - Le détail des fonctionnalités conformes',
          '  - L\'engagement de conformité',
          'Conservez ce document pour tout contrôle fiscal'
        ]
      },
      {
        subtitle: 'Important',
        steps: [
          'L\'attestation est nominative (liée à votre compte)',
          'Chaque utilisateur doit télécharger sa propre attestation',
          'Conservez-la pendant au moins 6 ans',
          'Présentez-la en cas de contrôle fiscal',
          'Le document inclut toutes les preuves de conformité'
        ]
      }
    ]
  },
  {
    id: 'prix-differencies',
    title: '💰 Prix différenciés par mode',
    icon: CreditCard,
    content: [
      {
        subtitle: 'Activer les prix différenciés',
        steps: [
          'Dans "Paramètres" > "Paramètres Généraux"',
          'Activez "Prix différenciés par mode de commande"',
          'Vous pouvez maintenant définir des prix différents pour:',
          '  - Sur place',
          '  - À emporter',
          '  - Livraison'
        ]
      },
      {
        subtitle: 'Configurer les prix',
        steps: [
          'Modifiez un produit existant',
          'Vous verrez maintenant 3 champs de prix au lieu d\'un',
          'Définissez le prix pour chaque mode de commande',
          'Pour les produits avec tailles, définissez les prix par taille ET par mode',
          'Enregistrez le produit',
          'Le prix correct s\'appliquera automatiquement selon le type de commande'
        ]
      }
    ]
  }
];

export default function ManuelUtilisateur() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState([]);

  const filteredSections = useMemo(() => {
    if (!searchTerm) return MANUAL_SECTIONS;
    
    const term = searchTerm.toLowerCase();
    return MANUAL_SECTIONS.filter(section => {
      const titleMatch = section.title.toLowerCase().includes(term);
      const contentMatch = section.content.some(c => 
        c.subtitle?.toLowerCase().includes(term) ||
        c.steps?.some(s => s.toLowerCase().includes(term))
      );
      return titleMatch || contentMatch;
    });
  }, [searchTerm]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const expandAll = () => {
    setExpandedSections(MANUAL_SECTIONS.map(s => s.id));
  };

  const collapseAll = () => {
    setExpandedSections([]);
  };

  const exportToPDF = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Manuel d'Utilisation - Strasyk POS</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
          h1 { color: #f97316; border-bottom: 3px solid #f97316; padding-bottom: 10px; }
          h2 { color: #1e40af; margin-top: 30px; page-break-after: avoid; }
          h3 { color: #059669; margin-top: 20px; }
          ol { margin-left: 20px; }
          li { margin-bottom: 8px; }
          .section { page-break-inside: avoid; margin-bottom: 30px; }
          @media print {
            body { margin: 15px; font-size: 11pt; }
            .section { page-break-inside: avoid; }
            h2 { page-break-after: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>📖 Manuel d'Utilisation - Strasyk POS</h1>
        <p><em>Guide complet pour gérer votre établissement</em></p>
        ${MANUAL_SECTIONS.map(section => `
          <div class="section">
            <h2>${section.title}</h2>
            ${section.content.map(c => `
              <h3>${c.subtitle}</h3>
              <ol>
                ${c.steps.map(step => `<li>${step}</li>`).join('')}
              </ol>
            `).join('')}
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      setTimeout(() => {
        newWindow.print();
      }, 250);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-600" />
              Manuel d'Utilisation
            </h1>
            <p className="text-gray-600 mt-2">
              Guide complet pour maîtriser votre application de caisse
            </p>
          </div>
          <Button onClick={exportToPDF} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Exporter en PDF
          </Button>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Rechercher dans le manuel..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={expandAll}>
                Tout ouvrir
              </Button>
              <Button variant="outline" onClick={collapseAll}>
                Tout fermer
              </Button>
            </div>

            {searchTerm && (
              <p className="text-sm text-gray-600 mb-4">
                {filteredSections.length} résultat(s) trouvé(s)
              </p>
            )}

            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-4">
                {filteredSections.map((section) => {
                  const isExpanded = expandedSections.includes(section.id);
                  const Icon = section.icon;
                  
                  return (
                    <Card key={section.id} className="border-2 hover:border-blue-300 transition-colors">
                      <CardHeader 
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleSection(section.id)}
                      >
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className="w-6 h-6 text-blue-600" />
                            <span className="text-lg">{section.title}</span>
                          </div>
                          <ChevronRight 
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </CardTitle>
                      </CardHeader>
                      
                      {isExpanded && (
                        <CardContent className="space-y-6">
                          {section.content.map((content, idx) => (
                            <div key={idx} className="space-y-3">
                              <h3 className="font-semibold text-green-700 text-base">
                                {content.subtitle}
                              </h3>
                              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-2">
                                {content.steps.map((step, stepIdx) => (
                                  <li key={stepIdx} className="leading-relaxed">
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}

                {filteredSections.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun résultat trouvé pour "{searchTerm}"</p>
                    <p className="text-sm mt-2">Essayez d'autres mots-clés</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-100 to-indigo-100 border-0">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">
                  Besoin d'aide supplémentaire ?
                </h3>
                <p className="text-gray-700">
                  Ce manuel couvre toutes les fonctionnalités de base et avancées de votre application.
                  Si vous ne trouvez pas de réponse à votre question, utilisez la barre de recherche ci-dessus
                  ou consultez chaque section en détail.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
