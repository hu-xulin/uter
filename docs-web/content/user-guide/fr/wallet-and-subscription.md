# Portefeuille et abonnements

Après connexion, cliquez sur 'Wallet' dans la barre de navigation gauche, ou rendez-vous directement sur `/wallet` pour accéder à la page du portefeuille. La page du portefeuille centralise des fonctionnalités telles que les statistiques de solde, les recharges en ligne, les codes de redemption, l’historique des commandes, les plans d’abonnement, mes abonnements et les récompenses de parrainage. Les zones affichées, les montants, les moyens de paiement et le contenu des plans sont déterminés par la configuration de la plateforme.

<img alt="Page portefeuille et abonnements" src="01-wallet-subscriptions.webp" />

## Consulter le solde et l’utilisation

La zone de statistiques du portefeuille comprend les informations suivantes :

* **Solde actuel** : quota interne disponible pour les appels de modèles ou les autres opérations de facturation, et non un solde monétaire.
* **Consommation cumulée** : le quota historiquement utilisé par le compte.
* **Requêtes API** : le nombre de requêtes API initiées par le compte.

<Callout type="warn">
  1. Les unités d’affichage du solde et de l’utilisation sont déterminées par la devise et les règles d’affichage du quota configurées par Root dans 'System Settings' → 'Billing and Payments'.
  2. Ne déduisez pas de taux de change fixes d’après les symboles ou les valeurs affichés sur la page ; les déductions réelles sont également influencées par les règles de facturation du modèle, du groupe, du canal et de l’instance.
</Callout>

## Recharge en ligne

Si la plateforme a activé les paiements en ligne, la zone de recharge du portefeuille affichera les options de recharge disponibles. Les montants de recharge, les montants prédéfinis, les montants minimums de recharge, les remises et les taux de change sont tous déterminés par la configuration de la plateforme.

1. Dans la zone 'Top-up', sélectionnez un montant prédéfini proposé sur la page, ou saisissez un montant personnalisé.
2. Consultez le quota de recharge et le montant à payer calculés par le système.
3. Sélectionnez le moyen de paiement proposé par la plateforme actuelle.
4. Dans la fenêtre de confirmation, vérifiez le quota de recharge, le montant à payer, la remise et le moyen de paiement.
5. Après confirmation, vous serez redirigé vers la page de paiement tierce pour effectuer le paiement.
6. Une fois le paiement terminé, revenez au portefeuille et attendez la mise à jour du statut de la commande et du solde.

<Callout type="warn">
  1) Le code du projet prend en charge des passerelles de paiement telles que EPay, Stripe, Creem, Waffo et Waffo Pancake, mais seuls les moyens de paiement activés, entièrement configurés et actuellement disponibles seront affichés. Différentes passerelles peuvent également avoir des restrictions supplémentaires de montant ou de paiement ; veuillez consulter les indications de la page. Si aucun moyen de paiement n’est disponible, veuillez contacter l’administrateur de la plateforme.
  2) Un paiement réussi nécessite la confirmation de la commande par un rappel de paiement tiers ; le solde peut ne pas être mis à jour immédiatement après le paiement. Si le paiement est réussi mais que le solde n’a pas changé, veuillez conserver le numéro de commande et contacter l’administrateur ; n’effectuez pas de paiements en double.
  3) Les moyens de paiement, les montants minimums de recharge, les remises, les taux de change et les montants prédéfinis ne sont pas des valeurs fixes pour Uter ; vous ne pouvez pas déduire les règles de l’instance actuelle à partir d’autres instances ou de pages d’exemple.
</Callout>

## Codes de redemption

Lorsque des codes de redemption sont disponibles, la zone de recharge affiche un champ de saisie pour les codes de redemption ; si l’administrateur a configuré une adresse d’obtention des codes de redemption, la page affiche également un lien externe correspondant.

1. Repérez le champ de saisie 'Redemption Code' dans la zone de recharge.
2. Saisissez le code de redemption fourni par l’administrateur.
3. Cliquez sur 'Redeem', attendez l’indicateur de résultat, puis actualisez votre solde.

<Callout type="info">
  1) Les codes de redemption doivent respecter la période de validité et les règles d’utilisation configurées par la plateforme, être activés et inutilisés. Chaque code de redemption ne peut être utilisé avec succès qu’une seule fois.
  2) Si la redemption échoue, la page peut ne pas afficher de raison précise telle que 'déjà utilisé', 'expiré' ou 'inexistant'. Veuillez vérifier que le code de redemption est complet et confirmer son statut auprès de l’administrateur.
  3) Si la plateforme n’a pas terminé la configuration de conformité des paiements correspondante, la saisie et les opérations de redemption de codes seront désactivées, et la page affichera une indication correspondante.
</Callout>

## Plans d’abonnement

Les plans d’abonnement se trouvent dans la zone d’abonnement de la page du portefeuille. Seuls les plans activés et ayant passé les contrôles de conformité des paiements sur la plateforme actuelle seront renvoyés et affichés par l’API ; si aucun plan n’est disponible, la zone d’abonnement ne sera pas affichée.

La carte du plan comprend les informations suivantes :

| Élément               | Description                                                                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titre et sous-titre | Le nom et la description définis par l’administrateur pour le plan.                                                                                                                                                                               |
| Prix              | Le montant nécessaire pour acheter le plan ; la valeur précise est déterminée par la configuration de l’instance.                                                                                                                                         |
| Période de validité    | Peut être configurée par année, mois, jour, heure, ou durée personnalisée (secondes).                                                                                                                                                                    |
| Quota total        | Le quota d’abonnement inclus dans le plan ; une valeur configurée à 0 signifie un quota total illimité.                                                                                                                                                     |
| Réinitialisation du quota        | Peut être configurée sans réinitialisation, quotidiennement, hebdomadairement, mensuellement ou selon un cycle personnalisé.                                                                                                                                                                       |
| Limite d’achat     | Limite le nombre de fois où le même utilisateur peut acheter ; une valeur configurée à 0 signifie aucune limite.                                                                                                                                                        |
| Groupe de mise à niveau      | Peut basculer vers le groupe configuré par l’administrateur après un achat réussi.                                                                                                                                                                 |
| Groupe de rétrogradation    | Peut basculer vers le groupe configuré par l’administrateur après l’expiration de l’abonnement ; s’il n’est pas défini, ce n’est que si vous avez basculé via un groupe de mise à niveau lors de l’achat et que vous êtes toujours dans ce groupe à l’expiration qu’il reviendra généralement au groupe d’avant l’achat. |

<Callout type="warn">
  'Unlimited Total Quota' signifie uniquement que l’abonnement lui-même ne définit pas de limite de quota total, et n’implique pas des appels illimités. Les requêtes restent soumises aux règles de modèle, de routage, de groupe et de facturation.
</Callout>

## Acheter un plan d’abonnement

1. Ouvrez la zone d’abonnement de la page du portefeuille.
2. Sélectionnez un plan et consultez sa période de validité, son quota, son cycle de réinitialisation et ses limites d’achat.
3. Sélectionnez le moyen d’achat affiché sur la page.
4. Après avoir vérifié les informations de la commande, effectuez la déduction du solde ou le paiement tiers.
5. Lorsque vous utilisez un paiement tiers, revenez au portefeuille et attendez le rappel de paiement ; confirmez si l’abonnement est actif après la mise à jour du statut.

Les moyens d’achat disponibles dépendent de la passerelle de paiement globale et de la configuration propre du plan, et peuvent inclure :

* **Solde du portefeuille** : disponible lorsque le plan autorise le paiement par solde et que le solde du compte est suffisant. Le quota déduit est calculé comme 'Prix du plan × `QuotaPerUnit`' et arrondi à l’unité supérieure ; l’unité précise est déterminée par la configuration de la plateforme.
* **EPay** : nécessite que la plateforme active le paiement EPay, et que la configuration de paiement actuelle soit disponible.
* **Stripe, Creem ou Waffo Pancake** : en plus de la disponibilité de la passerelle globale, le plan doit également être configuré avec le produit de paiement correspondant.

<Callout type="warn">
  Lorsque le moyen de paiement Waffo ordinaire est utilisé pour les recharges en ligne, cela ne signifie pas que les achats d’abonnement sont pris en charge. Le bouton d’achat peut être désactivé ou l’opération peut échouer si la limite d’achat de l’utilisateur est atteinte, si le plan est désactivé, si le moyen de paiement est indisponible ou si le solde est insuffisant.
</Callout>

## Consulter le statut d’abonnement

La zone 'My Subscriptions' affiche les statuts d’abonnement actuels et historiques ; les statuts courants comprennent :

* **Actif** : l’abonnement est actif. La page affiche les jours restants et l’heure de fin ; si une heure de réinitialisation suivante est configurée, elle sera également affichée ; pour les abonnements à quota limité, le quota total, le quota utilisé, le quota restant et la progression de l’utilisation seront également affichés.
* **Expiré** : l’abonnement a expiré et le quota d’abonnement ne peut plus être utilisé.
* **Annulé** : l’abonnement a été annulé ou invalidé prématurément. Il n’existe aucune entrée d’annulation en libre-service du côté utilisateur ; ce statut est généralement généré par les opérations de l’administrateur.

<Callout type="info">
  1. Une fois l’heure de réinitialisation du quota atteinte, le quota utilisé des abonnements à quota limité est effacé et un nouveau cycle de quota commence. Si l’heure de réinitialisation suivante est déjà postérieure à l’heure de fin de l’abonnement, cette réinitialisation ne sera pas définie.
  2. Le groupe après l’expiration de l’abonnement est déterminé par la configuration du plan : si un groupe de rétrogradation est défini, le système basculera généralement vers ce groupe ; s’il n’est pas défini, ce n’est que si vous avez basculé via un groupe de mise à niveau lors de l’achat et que vous êtes toujours dans ce groupe de mise à niveau à l’expiration qu’il reviendra généralement au groupe d’avant l’achat. Si aucune mise à niveau n’a eu lieu, ou s’il existe d’autres abonnements en cours de mise à niveau actifs sur le compte, le groupe actuel peut être conservé ; le groupe final sera traité conjointement avec les autres statuts d’abonnement.
  3. Il n’existe actuellement aucune fonctionnalité de renouvellement automatique pour les plans d’abonnement. Si vous souhaitez continuer à utiliser un abonnement après son expiration, veuillez racheter le plan.
</Callout>

## Choisir une préférence de facturation

La page du portefeuille permet de choisir l’ordre de déduction du quota pour les requêtes. Après avoir enregistré les préférences, le backend traitera selon les règles suivantes :

| Préférence de facturation          | Règle de déduction                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prioriser l’abonnement** | Déduire d’abord des abonnements actifs ; si le quota d’abonnement est insuffisant, le portefeuille ne sera utilisé que si tous les abonnements actifs autorisent le repli vers le portefeuille. Utiliser le portefeuille s’il n’existe aucun abonnement actif. |
| **Prioriser le portefeuille**       | Déduire d’abord du portefeuille ; si le solde du portefeuille est insuffisant, tenter ensuite d’utiliser les abonnements.                                                                                                                             |
| **Abonnement uniquement**       | Utiliser uniquement les abonnements. S’il n’existe aucun abonnement actif ou si le quota d’abonnement est insuffisant, la requête échoue et ne basculera pas vers le portefeuille.                                                                        |
| **Portefeuille uniquement**             | Utiliser uniquement le portefeuille. Si le solde est insuffisant, la requête échoue et n’utilisera pas les abonnements.                                                                                                                          |

<Callout type="info">
  La règle 'Wallet Overflow Fallback' du plan affecte le résultat de 'Prioriser l’abonnement' : si ne serait-ce qu’un seul abonnement actif interdit le repli, le portefeuille ne peut pas être utilisé lorsque le quota d’abonnement est insuffisant. Lorsqu’il n’existe aucun abonnement actif, les options 'Prioriser l’abonnement' et 'Abonnement uniquement' seront désactivées sur la page.
</Callout>

## Récompenses de parrainage

La zone des récompenses de parrainage de la page du portefeuille affiche le lien de parrainage, les récompenses en attente, les récompenses cumulées historiques et le nombre de personnes parrainées. Le code de parrainage est intégré dans le paramètre `aff` du lien de parrainage ; le format du lien est :

```text
Adresse du site actuel/sign-up?aff=<code de parrainage>
```

Processus d’utilisation :

1. Copiez le lien de parrainage dans la zone des récompenses de parrainage.
2. Envoyez le lien à de nouveaux utilisateurs, qui pourront créer un compte via le lien ; certaines inscriptions de nouveaux utilisateurs via les processus d’inscription par mot de passe et OAuth liront ce paramètre, tandis que les processus de connexion indépendants comme WeChat et Telegram ne sont pas concernés.
3. Une fois les conditions de parrainage configurées par la plateforme remplies, les récompenses seront distribuées selon les règles.
4. Les récompenses du parrain entrent généralement d’abord dans les récompenses en attente ; une fois que les récompenses remplissent les conditions de transfert, cliquez sur 'Transfer to Balance' pour les ajouter au solde principal.

<Callout type="warn">
  * Les récompenses de la personne invitée (si activées par la plateforme) sont directement ajoutées à son quota de compte ; les récompenses du parrain entrent généralement d’abord dans les récompenses en attente.
  * Le montant, les conditions de distribution et le montant minimum de transfert des récompenses de parrainage sont déterminés par la configuration de la plateforme.
  * Le transfert vers le solde prend en charge les transferts partiels, mais ne peut pas dépasser les récompenses en attente actuelles, ni être inférieur aux exigences d’unité de quota de la plateforme ; il ne s’agit pas d’un retrait d’espèces, d’un remboursement ni d’une demande de retrait.
  * Si les exigences de conformité des paiements ne sont pas remplies, les récompenses peuvent ne pas être versées, et l’opération 'Transfer to Balance' peut également être indisponible.
  * Les codes de parrainage non valides n’empêcheront pas l’inscription, et les utilisateurs inscrits ne recevront pas à nouveau de récompenses en cas d’utilisation répétée de codes de parrainage.
</Callout>

## Historique des commandes

* Cliquez sur 'Order History' dans le coin supérieur droit de la carte de recharge pour consulter les enregistrements des commandes de recharge et de paiement.
* La page prend en charge la recherche par numéro de commande et la pagination, et affiche le numéro de commande, l’heure de création, le moyen de paiement, le quota ou le montant rechargé, le montant payé et le statut de la commande.

<Callout type="info">
  1. Les utilisateurs ordinaires ne peuvent interroger que leurs enregistrements des 30 derniers jours ; les critères de recherche ne correspondent qu’aux numéros de commande.
  2. Cette liste sert principalement à consulter les commandes de recharge et de paiement et ne garantit pas la couverture de toutes les commandes d’abonnement.
</Callout>

## Restrictions courantes

Les situations suivantes peuvent entraîner l’indisponibilité des fonctionnalités liées au portefeuille ou à l’abonnement :

1. La plateforme n’a configuré aucune passerelle de paiement ni produit de paiement, ce qui entraîne l’absence de moyens de paiement ou de plans d’abonnement disponibles.
2. Les exigences de conformité des paiements n’ont pas encore été remplies, ce qui entraîne l’indisponibilité des moyens de paiement ou des plans d’abonnement, et l’affichage des opérations de code de redemption comme désactivées.
3. Le montant de la recharge est inférieur au montant minimum requis par la plateforme ou la passerelle.
4. Solde insuffisant, plan désactivé, ou limite d’achat personnelle atteinte.
5. Le rappel de paiement tiers n’est pas encore arrivé à son terme et la commande est toujours en cours de traitement.

<Callout type="warn">
  Si le paiement est réussi mais que la commande ou le solde n’a pas été mis à jour depuis longtemps, veuillez conserver le numéro de commande, la preuve de paiement et l’heure de survenue, contacter l’administrateur de la plateforme pour vérification, et n’effectuez pas de paiements en double.
</Callout>