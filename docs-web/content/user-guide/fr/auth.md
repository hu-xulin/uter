# Inscription et connexion

Le système prend en charge l’enregistrement d’un compte, la réinitialisation du mot de passe oublié, la connexion par mot de passe, ainsi que la connexion en un clic avec Passkey et différents fournisseurs OAuth tiers. Veuillez vous inscrire avant votre première utilisation.

## Connexion

### Connexion par mot de passe

1. Ouvrez la page d’accueil de la plateforme, cliquez sur le bouton "Connexion" dans le coin supérieur droit, ou rendez-vous directement sur `/sign-in`.
2. Saisissez votre nom d’utilisateur ou votre adresse e-mail ainsi que votre mot de passe.
3. Si Cloudflare Turnstile s’affiche sur la page, vous devez effectuer la vérification humaine.
4. Cliquez d’abord pour confirmer que vous avez lu et que vous acceptez les conditions d’utilisation et la politique de confidentialité, puis cliquez sur "Connexion".
5. Lorsque l’authentification à deux facteurs (2FA) est activée pour le compte, la connexion nécessite également de saisir un code de vérification à usage unique ou un code de secours.

<img alt="Page de connexion" src="01-login.webp" />

### Connexion par Passkey et OAuth tiers

La page de connexion affiche des icônes pour les plateformes tierces activées par la plateforme, telles que GitHub, Discord, LinuxDO, ou Passkey. Pour vous connecter à l’aide d’un compte tiers ou d’un Passkey :

1. Cliquez pour confirmer que vous avez lu et que vous acceptez les conditions d’utilisation et la politique de confidentialité.
2. Cliquez sur l’icône de la plateforme correspondante (GitHub, Discord, LinuxDO, etc.) ou sur l’icône Passkey située en bas de la page.
3. Lorsque vous utilisez un compte tiers, vous serez redirigé vers la page d’autorisation tierce afin de terminer l’autorisation ; lorsque vous utilisez Passkey, effectuez la vérification comme demandé par votre navigateur ou votre appareil.

<img alt="Page de connexion OAuth" src="02-login.webp" />

<Callout type="info">
  Les méthodes de connexion Passkey et OAuth tierces, ainsi que l’activation ou non de la vérification humaine, sont configurées par le super administrateur de la plateforme (Root) dans "Paramètres système" → "Authentification". Les méthodes désactivées n’apparaissent pas sur la page de connexion.
</Callout>

## Inscription

### Processus d’inscription

1. Sur la page de connexion, cliquez sur "S’inscrire", ou rendez-vous directement sur `/sign-up`.
2. Renseignez votre nom d’utilisateur, votre mot de passe et la confirmation du mot de passe.
3. Si les paramètres de la plateforme exigent une vérification par e-mail, saisissez votre adresse e-mail, envoyez le code de vérification, puis saisissez le code reçu.
4. Si Cloudflare Turnstile est activé sur la plateforme, vous devez effectuer la vérification humaine.
5. Cliquez d’abord pour confirmer que vous avez lu et que vous acceptez les conditions d’utilisation et la politique de confidentialité, puis cliquez sur "Créer un compte" pour terminer l’inscription.

<img alt="Page d’inscription" src="03-register.webp" />

<Callout type="info">
  L’autorisation ou non de l’inscription par mot de passe, l’inscription par OAuth, la vérification par e-mail, ainsi que les restrictions de domaines ou d’alias e-mail sont déterminées par les paramètres d’authentification du Root.
</Callout>

### Gestion des sessions de connexion

Une fois la connexion réussie, une session indépendante est établie. Les utilisateurs connectés peuvent cliquer sur "Profil" → "Sessions de connexion" dans la barre latérale gauche pour consulter les sessions de connexion actuelles sur les autres appareils, révoquer une session individuelle, ou se déconnecter de toutes les autres sessions en une seule fois ; révoquer la session actuelle vous ramènera à la page de connexion.

<img alt="Page des sessions de connexion" src="04-login-session.webp" />

## Réinitialisation du mot de passe oublié

1. Sur la page de connexion, cliquez sur "Mot de passe oublié".
2. Saisissez l’adresse e-mail associée à votre compte, puis validez.
3. Ouvrez le lien de réinitialisation envoyé par le système.
4. Définissez un nouveau mot de passe sur la page de réinitialisation, puis reconnectez-vous.

<img alt="Page de mot de passe oublié" src="05-forgot-password.webp" />