# CartoPermis IDF

**Visualisez et explorez les permis de construire en Île-de-France**

Prototype web fonctionnel en un seul fichier HTML — aucune installation requise.

## Lancement

Ouvrir `cartopermis-idf.html` directement dans un navigateur (Chrome, Safari, Edge, Firefox) avec une connexion internet. Ne pas utiliser un aperçu intégré : les bibliothèques externes (Leaflet, fonds de carte) y sont parfois bloquées.

## Fonctionnalités

- **Carte interactive** (Leaflet) : 8 000+ dossiers d'urbanisme en temps réel, clustering, vues Plan/Satellite, étiquettes, marqueurs colorés par statut (vert = accordé, bleu = en instruction, rouge = refusé)
- **Filtres** : statut, type de dossier, circonscription, arrondissement, type de décision, période de dépôt, recherche plein texte
- **Fiches détaillées à 3 onglets** :
  - *Général* : demandeur, dates, décision, objet, programme (1 crédit)
  - *Détails* : référence décodée, délai d'instruction vs moyenne de l'arrondissement, parcelle cadastrale (API Carto IGN), adresse normalisée (BAN), GPS
  - *Infos* (libre) : mairie d'arrondissement (☎ 39 75), liens Google Maps / Street View / Géoportail, statistiques locales
- **Système de crédits** : 20 crédits offerts, 1 crédit = 1 fiche débloquée définitivement
- **Paiement Stripe simulé** : 3 packs (9 € / 39 € / 129 €) — instructions d'intégration réelle (Stripe Checkout + webhook) commentées dans le code, fonction `payNow`
- **Recherche avancée** : annuaire avec tri et pagination
- **Données & Rapports** : 4 graphiques temps réel (Chart.js)
- **Back-office** (identifiants démo : `admin` / `demo`) : gestion des dossiers, import, utilisateurs, rapports, filtres, modération
- Favoris, mode sombre, secours hors-ligne si l'API est indisponible

## Sources de données (publiques et gratuites)

| Source | Usage |
|---|---|
| Paris Data — `dossiers-recents-durbanisme` (Opendatasoft v2.1) | Dossiers d'urbanisme |
| API Carto IGN — cadastre | Parcelles cadastrales |
| Base Adresse Nationale (data.gouv.fr) | Adresses normalisées |
| OpenStreetMap / CARTO / Esri World Imagery | Fonds de carte |

## Passage en production (pistes)

- Backend Node.js/Express ou Django + PostgreSQL/PostGIS
- Stripe Checkout réel : voir les commentaires au-dessus de `payNow()` dans le fichier
- Comptes utilisateurs, crédits stockés en base, webhook `checkout.session.completed`
- Synchronisation quotidienne de l'API Paris Data côté serveur

---
Prototype généré le 18/07/2026.
