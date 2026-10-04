# Aperçu et Tableau de bord

## Page d’aperçu

* Après connexion, cliquez sur le bouton "Aperçu" dans la barre de navigation gauche pour accéder à la page d’aperçu `/dashboard/overview`.
  Vous pouvez consulter des cartes telles que le Guide de démarrage rapide, l’Utilisation et l’état de santé, les Informations sur l’API, les Annonces, la FAQ et la Disponibilité.

### Guide de démarrage rapide

1. Cliquez sur "Créer une clé API" pour accéder à `/keys`.
2. Ajoutez du quota à votre portefeuille (si la facturation est activée).
3. Ouvrez le bac à sable ou utilisez votre client pour envoyer la première requête et vérifier la route.

<img alt="Page de démarrage rapide" src="01-overview-get-started.webp" />

### Utilisation et état de santé

La page récapitule des indicateurs tels que le solde, la consommation, le nombre de requêtes, le taux de réussite, la latence et le débit, à partir des données actuelles du compte et de l’instance.

<img alt="Page d’informations d’aperçu 1" src="02-overview-info-1.webp" />

### Informations sur l’API, Annonces, FAQ et Disponibilité

La page affiche des informations telles que les Informations sur l’API, les Annonces, la FAQ et la Disponibilité.

<img alt="Page d’informations d’aperçu 2" src="03-overview-info-2.webp" />

<Callout type="info">
  Ces cartes sont configurées par Root dans "Paramètres système" → "Contenu de la console".
</Callout>

## Tableau de bord

* Après connexion, cliquez sur le bouton "Tableau de bord" dans la barre de navigation gauche pour accéder à la page du tableau de bord `/dashboard/models`.
  Vous pouvez consulter l’analyse des appels de modèles et la répartition du trafic ; pour les statistiques sur les utilisateurs, veuillez accéder à `/dashboard/users` (uniquement pour les utilisateurs Admin et Root).

### Analyse des appels de modèles

Consultez le nombre d’appels, l’utilisation de jetons, la répartition de la consommation et les indicateurs de performance par période, par modèle et par groupe.

<img alt="Page d’informations du tableau de bord 1" src="04-dashboard-info-1.webp" />

### Répartition du trafic

Consultez le flux des requêtes entre les utilisateurs, les clés API, les groupes, les modèles et les canaux.

<img alt="Page d’informations du tableau de bord 2" src="05-dashboard-info-2.webp" />

### Statistiques sur les utilisateurs

Seuls les utilisateurs Admin et Root peuvent accéder à `/dashboard/users` pour consulter l’analyse des utilisateurs ; cette section n’est pas affichée dans la navigation pour les utilisateurs ordinaires.

<img alt="Page d’informations du tableau de bord 3" src="06-dashboard-info-3.webp" />