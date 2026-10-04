# Profil et sécurité

* Après connexion, cliquez sur le bouton "Profil" dans la barre de navigation gauche pour accéder à la page de profil `/profile`.
  Vous pouvez y consulter ou gérer les informations du compte, les liaisons de compte, les préférences de notification et de comportement, la langue de l’interface, la barre latérale personnelle, le pointage, la 2FA, le Passkey, les jetons d’accès et les sessions de connexion.

## Consulter les informations du compte

Consultez les informations du compte, notamment le nom, l’identifiant utilisateur, le solde restant, le quota total consommé, le nombre de requêtes API et d’autres détails.

<img alt="Page des informations de compte personnel" src="01-personal.webp" />

## Gérer les informations de liaison du compte

Gérez les informations de liaison du compte, notamment l’adresse e-mail et les comptes OAuth tiers.

* Lier une adresse e-mail

1. Dans la zone des paramètres, recherchez "Liaison du compte" → "E-mail" → cliquez sur "Lier".
2. Saisissez l’adresse e-mail que vous souhaitez lier.
3. Cliquez sur "Envoyer" pour obtenir le code de vérification.
4. Saisissez le code de vérification, puis cliquez sur "Lier l’adresse e-mail".

<img alt="Page de liaison d’adresse e-mail" src="02-personal-link-email.webp" />

* Lier un compte OAuth tiers

1. Dans la zone des paramètres, recherchez "Liaison du compte" → "Comptes OAuth tiers".
2. Cliquez sur le bouton "Lier" correspondant à la plateforme OAuth tierce que vous souhaitez lier.
3. La page vous redirigera vers la page d’autorisation de la plateforme ; connectez-vous, puis cliquez sur "Autoriser".
4. Une fois l’autorisation terminée, vous serez automatiquement redirigé, et le statut de liaison passera à "Lié".

<img alt="Page de liaison d’un compte OAuth tiers" src="03-personal-link-OAuth.webp" />

## Définir les préférences de notification et de comportement

Cette page sert à configurer les méthodes de notification du compte et les préférences d’utilisation du système.

* Paramètres de notification

1. **Méthode de notification** : permet de sélectionner E-mail, Webhook, Bark ou Gotify pour recevoir les notifications du système.
2. **Seuil d’alerte de solde** : définit le montant de solde déclenchant une alerte ; lorsque le solde du compte passe sous cette valeur, une notification est envoyée.
3. **E-mail de notification** : spécifie l’adresse e-mail recevant les notifications ; si elle est laissée vide, l’adresse e-mail liée au compte est utilisée par défaut.
4. Saisissez les informations correspondantes, puis une fois la configuration terminée, cliquez sur "Enregistrer les paramètres" pour que les modifications prennent effet.

* Paramètres de préférence de comportement

1. **Recevoir les notifications de mise à jour des modèles Upstream** : lorsque cette option est activée, si les vérifications planifiées détectent des changements dans les modèles Upstream ou des échecs de vérification, une notification récapitulative est envoyée via la méthode de notification sélectionnée ; cette fonctionnalité n’est disponible que pour les administrateurs.
2. **Accepter les modèles non tarifés** : lorsque cette option est activée, elle autorise l’utilisation de modèles dont les prix n’ont pas encore été configurés. (Déconseillé)
3. **Enregistrer les adresses IP** : lorsque cette option est activée, elle enregistre les adresses IP des utilisateurs appelant les modèles ainsi que le moment où les requêtes rencontrent des erreurs.
4. Saisissez les informations correspondantes, puis une fois la configuration terminée, cliquez sur "Enregistrer les paramètres" pour que les modifications prennent effet.

<img alt="Page des préférences de notification et de comportement" src="04-personal-notification-behavior-preferences.webp" />

<Callout type="warn">
  Activer "Accepter les modèles non tarifés" peut entraîner une consommation anormalement élevée. Il est recommandé de conserver le réglage par défaut, c’est-à-dire "Accepter les modèles non tarifés" désactivé.
</Callout>

## Définir la préférence de langue de l’interface

Vous pouvez définir votre préférence de langue d’interface, qui sera synchronisée sur tous les appareils connectés avec ce compte et qui influencera la langue des messages d’erreur de l’API.

<img alt="Page de paramètres de préférence de langue de l’interface" src="05-personal-language-preferences.webp" />

## Paramètres de la barre latérale gauche personnelle pour un affichage personnalisé

* Cette page sert à personnaliser les modules fonctionnels affichés dans la barre latérale gauche. Les utilisateurs peuvent activer ou masquer les entrées correspondantes selon leurs habitudes d’utilisation personnelle.

<img alt="Page des paramètres de la barre latérale personnelle" src="06-personal-sidebar-settings.webp" />

<Callout type="info">
  Cela ne modifie que l’affichage de la navigation personnelle et n’accorde aucune nouvelle autorisation ni ne désactive les interfaces correspondantes.
</Callout>

## Pointage quotidien

* Utilisé pour effectuer le pointage quotidien et consulter les relevés de pointage et les récompenses.

1. Cliquez sur "Pointer maintenant" pour recevoir la récompense de quota aléatoire du jour. (La plage de quota aléatoire est définie par l’administrateur système de la plateforme)
2. La page affiche le nombre cumulé de jours de pointage, le quota obtenu ce mois-ci et le quota cumulé obtenu.
3. Vous ne pouvez pointer qu’une fois par jour. Les récompenses sont créditées sur le solde de votre compte, et il peut y avoir un slight retard de crédit.

<img alt="Page de pointage quotidien" src="07-personal-check-in.webp" />

## Paramètres de sécurité

* Cette page sert à gérer les configurations de sécurité du compte et les autorisations d’accès au compte.

1. **Modifier le mot de passe** : sert à mettre à jour le mot de passe de connexion du compte afin de renforcer la sécurité du compte.
2. **Jetons d’accès** : sert à générer et gérer les jetons d’accès API, permettant aux applications ou services externes d’accéder aux interfaces concernées via des jetons.
3. **Supprimer le compte** : sert à supprimer définitivement le compte actuel et toutes les données associées. Cette opération est irréversible et doit être confirmée avec précaution avant exécution.

<img alt="Page des paramètres de sécurité" src="08-personal-security.webp" />

<Callout type="info">
  * Si vous soupçonnez qu’un jeton d’accès API a été compromis, vous pouvez le réinitialiser :

  1. Sur la page de profil, recherchez la zone "Paramètres de sécurité".
  2. Cliquez sur "Jetons d’accès" → "Régénérer".
  3. Après confirmation de l’opération, le système génère un jeton d’accès uter.
  4. L’ancien jeton d’accès API devient immédiatement invalide, et tous les services qui utilisent l’ancien jeton d’accès API devront être reconfigurés avec un nouveau.
</Callout>

<Callout type="warn">
  * Les jetons d’accès sont utilisés pour les interfaces de gestion de compte et sont distincts des clés API utilisées pour appeler les modèles ; ils ne doivent pas être saisis dans des clients IA tiers.
  * Après la réinitialisation d’un jeton d’accès API, tous les jetons d’accès API existants deviennent invalides et les jetons d’accès uter devront être recréés.
</Callout>

## Activer ou désactiver l’authentification à deux facteurs (2FA)

* Cette page sert à activer ou désactiver l’authentification à deux facteurs (2FA) pour votre compte, ajoutant une couche de sécurité supplémentaire au-delà de votre mot de passe.

1. **Activer l’authentification à deux facteurs** : sur la page de profil, cliquez sur le bouton "Activer" à côté de "Authentification à deux facteurs".
2. **Scanner le code QR** : utilisez une application d’authentification telle que Google Authenticator ou Microsoft Authenticator pour scanner le code QR affiché sur la page, ou saisissez manuellement la clé à lier.
3. **Enregistrer les codes de secours** : conservez les codes de secours générés par le système. Chaque code ne peut généralement être utilisé qu’une seule fois pour récupérer l’accès au compte si l’application d’authentification est indisponible.
4. **Saisir le code de vérification** : ouvrez votre application d’authentification et saisissez le code de vérification à 6 chiffres actuellement généré.
5. **Terminer l’activation** : cliquez sur le bouton "Activer la 2FA". Une fois la vérification effectuée, la configuration de l’authentification à deux facteurs sera terminée.
6. **Régénérer les codes de secours ou désactiver la 2FA** : cliquez sur le bouton "Régénérer les codes de secours" ou sur le bouton "Désactiver la 2FA", puis suivez les invites pour effectuer l’action correspondante.

<img alt="Page des paramètres 2FA" src="09-personal-2fa.webp" />

<Callout type="warn">
  Les codes de secours ne s’affichent qu’une seule fois et ne peuvent plus être consultés après la fermeture de la fenêtre contextuelle. Si vous perdez les codes de secours et ne pouvez pas utiliser l’application d’authentification, vous devez contacter un administrateur pour les réinitialiser.
</Callout>

## Activer ou désactiver la connexion sans mot de passe par Passkey

* Vous pouvez activer ou désactiver la fonctionnalité de connexion par Passkey pour ce compte. Une fois activée, vous pouvez vous connecter à l’aide de la biométrie, du verrouillage d’écran ou de la clé de sécurité de votre appareil, sans avoir à saisir de mot de passe.

1. **Activer Passkey** : dans la zone "Connexion par Passkey", cliquez sur "Activer Passkey".
2. **Effectuer la vérification de sécurité** : comme demandé, saisissez le code de vérification dynamique à 6 chiffres généré par votre application d’authentification, ou saisissez le code de secours à 8 chiffres, puis cliquez sur "Vérifier".
3. **Enregistrer le Passkey** : le navigateur affichera une invite de vérification du système. Suivez les instructions pour terminer l’enregistrement du Passkey à l’aide de l’empreinte digitale, de la reconnaissance faciale, du code PIN ou d’autres méthodes de vérification système de votre appareil.
4. **Consulter le statut** : après un enregistrement réussi, la page affiche "Authentification Passkey · Activée" et enregistre l’heure de la dernière utilisation.
5. **Détacher le Passkey** : pour désactiver cette fonctionnalité, cliquez sur "Détacher Passkey". Après avoir effectué la vérification d’identité, la connexion par Passkey du compte actuel sera supprimée.

<img alt="Page des paramètres Passkey" src="10-personal-passkey.webp" />

## Gestion des sessions de connexion

* Servit à consulter et gérer les sessions de connexion du compte actuel sur différents appareils et navigateurs, ce qui aide les utilisateurs à détecter et supprimer rapidement les états de connexion anormaux.

1. **Consulter les informations de session** : consultez les appareils connectés, les systèmes d’exploitation, les navigateurs, les adresses IP, les méthodes de connexion, l’heure de dernière activité et l’heure d’expiration de la session.
2. **Se déconnecter d’une session spécifique** : cliquez sur "Se déconnecter" ou "Révoquer" à droite de la session de connexion correspondante pour déconnecter cet appareil du compte actuel.
3. **Se déconnecter des autres sessions** : cliquez sur "Se déconnecter des autres sessions" dans le coin supérieur droit de la page pour vous déconnecter de tous les autres appareils connectés, à l’exception de l’actuel.
4. **Gérer l’état de connexion** : si vous découvrez des appareils inconnus ou des enregistrements de connexion inhabituels, révoquez immédiatement la session correspondante et modifiez rapidement le mot de passe de votre compte.

<img alt="Page de gestion des sessions de connexion" src="11-personal-login-sessions.webp" />