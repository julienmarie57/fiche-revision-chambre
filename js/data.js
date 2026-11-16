const CHECKLIST = [
  {
    category: "Meubles",
    items: [
      { name: "Armoires", detail: "planches, charnières, serrures" },
      { name: "Tables", detail: "état général, tiroirs" },
      { name: "Lits", detail: "état général" },
      { name: "Chaises", detail: "état général" }
    ]
  },
  {
    category: "Électricité",
    items: [
      { name: "Lampes de chevet", detail: "présence, état général" },
      { name: "Lampes plafond", detail: "état général" },
      { name: "Lampes murales", detail: "état général" },
      { name: "Prises", detail: "état général" },
      { name: "Goulottes", detail: "état général" },
      { name: "Détecteur incendie", detail: "état général" },
      { name: "Détecteur de présence", detail: "état général" }
    ]
  },
  {
    category: "HVAC",
    items: [
      { name: "Radiateur", detail: "état général" },
      { name: "Vanne thermo", detail: "état général" },
      { name: "Ventilation", detail: "nettoyer, contrôler débit d'air" }
    ]
  },
  {
    category: "Peintures",
    items: [
      { name: "Murs", detail: "état général" },
      { name: "Portes", detail: "état général" }
    ]
  },
  {
    category: "Salle de bain",
    items: [
      { name: "Évier", detail: "état général" },
      { name: "Siphon évier", detail: "nettoyage" },
      { name: "Robinet", detail: "mousseur, piles" },
      { name: "Vannes d'arrêt", detail: "manœuvrer" },
      { name: "Mitigeur douche", detail: "état général" },
      { name: "Pommeau douche", detail: "nettoyer, détartrer" },
      { name: "Avaloir douches", detail: "nettoyer" },
      { name: "Distributeurs de savon", detail: "état général" },
      { name: "Miroir", detail: "état général" }
    ]
  },
  {
    category: "WC",
    items: [
      { name: "Boutons chasse", detail: "état général" },
      { name: "Planche", detail: "état général" },
      { name: "Cuvette", detail: "détartrer" },
      { name: "Évacuation", detail: "écoulement et étanchéité" }
    ]
  },
  {
    category: "Ouvertures",
    items: [
      { name: "Portes", detail: "état, charnières, serrures, ferme-porte" },
      { name: "Fenêtre", detail: "fonctionnement, sécurité" }
    ]
  }
];

const ROOMS = ["302", "304", "311", "404", "414"];

const TECHNICIANS = ["Julien", "Julien 2"];

const REPORT_EMAIL = "technique@csfds.be";
