# Politique de confidentialité de la Plateforme de services de grands modèles Uter

| Élément | Contenu |
|---|---|
| Marque du Service | **Uter.ai** |
| Nom de la Plateforme | **Plateforme de services de grands modèles Uter** |
| Site officiel | https://uter.ai |
| Nom du document | Politique de confidentialité de la Plateforme de services de grands modèles Uter |
| Version | V1.0 |
| Date d'entrée en vigueur | 8 août 2026 |
| Dernière mise à jour | 8 août 2026 |
| Responsable du traitement | **Shenzhen Uter Network Co., Ltd.** |
| Adresse immatriculée | Shenzhen, province du Guangdong, République populaire de Chine |
| Courriel du Responsable de la protection des Données personnelles | privacy@uter.ai |
| Courriel du service client | support@uter.ai |

> **La présente Politique, conjointe avec les Conditions d'utilisation de la Plateforme de services de grands modèles Uter, constitue l'accord complet entre vous et Shenzhen Uter Network Co., Ltd.** La présente Politique fait partie de cet Accord ; ses règles relatives au traitement des Données personnelles complètent l'Article 8 (Protection des données, des contenus et des Données personnelles) des Conditions d'utilisation ; en cas d'incohérence quant au traitement des Données personnelles, **la présente Politique prévaut.**

---

## Synthèse

Afin de vous aider à comprendre rapidement, nous résumons d'abord l'essentiel de la présente Politique en un paragraphe. **La Synthèse ne remplace pas le corps du document ; les droits et obligations complets sont régis par le corps du document.**

| Ce qui vous intéresse le plus | Notre réponse |
|---|---|
| Quelles Données personnelles collectez-vous ? | Nous ne collectons que les informations de compte, les informations de vérification d'identité, les informations de paiement et les journaux d'appels nécessaires à la fourniture du Service — 4 catégories au total. **Nous ne collectons pas vos contacts, votre album photo, votre position, votre microphone ni toute autre information sans rapport avec notre activité.** |
| Conservez-vous le contenu des invites que j'envoie aux modèles ? | **Par défaut, nous ne conservons pas le contenu du corps des requêtes et réponses.** Nous n'enregistrons que les métadonnées utilisées à des fins de facturation et d'audit de sécurité (heure, identifiant de modèle, nombre de jetons, code de statut, latence). |
| Utiliserez-vous mes données pour entraîner des modèles ? | **Non.** Nous n'entraînons pas nous-mêmes de grands modèles et n'utilisons pas le contenu de vos requêtes à des fins d'entraînement, de réglage fin ou d'amélioration de modèles. |
| Mes données seront-elles transférées à l'étranger ? | Uniquement lorsque **vous choisissez activement d'appeler des nœuds de modèles situés à l'étranger** le contenu de la requête est transmis en temps réel vers des services en amont étrangers, et il n'est pas conservé sur le territoire national. Voir le Chapitre 4 ; un tel transfert est activement ordonné et déclenché par vous. |
| Que se passe-t-il si mes utilisateurs finaux soumettent des Données personnelles à mon application ? | **Vous êtes le Responsable du traitement et nous sommes le Sous-traitant chargé du Traitement confié.** Nous ne traitons que sur vos instructions et non pour nos propres finalités. Voir le Chapitre 2. |
| Comment supprimer mes données ? | Vous pouvez les supprimer vous-même dans la console ; ou écrire à privacy@uter.ai, et nous répondrons dans un délai de **15 jours ouvrables**. |

---

## Sommaire

1. Introduction et périmètre
2. Concepts clés et définition des rôles
3. Comment nous collectons et utilisons les Données personnelles
4. Comment nous confions le traitement, partageons, transférons et divulguons publiquement
5. Transfert de données hors de Chine
6. Comment nous stockons et protégeons les Données personnelles
7. Vos droits relatifs aux Données personnelles
8. Cookies et technologies similaires
9. Protection des mineurs
10. Remarques particulières sur les services d'IA générative
11. Mises à jour de la présente Politique
12. Comment nous contacter
13. Définitions

---

## Chapitre 1 Introduction et périmètre

**1.1 Qui nous sommes**

La Plateforme de services de grands modèles Uter (ci-après la « Plateforme ») est exploitée par **Shenzhen Uter Network Co., Ltd.** (ci-après « nous » ou « Uter »). Immatriculée à Shenzhen, dans la province du Guangdong, en République populaire de Chine, nous sommes le **Responsable du traitement** des Données personnelles collectées par la présente Plateforme.

**1.2 Périmètre de la présente Politique**

1.2.1 La présente Politique s'applique à notre traitement de vos Données personnelles lorsque vous utilisez les services de la Plateforme au moyen du site officiel Uter.ai, de la console, de la documentation développeur, des SDK et des interfaces API.

1.2.2 **La présente Politique ne s'applique pas aux circonstances suivantes** :

1. **les services de modèles en amont que vous appelez par l'intermédiaire de la présente Plateforme** : les règles de confidentialité des fournisseurs de modèles en amont relatives à leurs propres activités de traitement sont établies et publiées de manière indépendante par eux, ce que nous ne pouvons pas contrôler et dont nous ne sommes pas responsables ;
2. **les sites web ou services de tiers vers lesquels renvoyant des liens depuis l'extérieur de la présente Plateforme** ;
3. **lorsque vous, en tant que développeur ou client entreprise, fournissez des services à vos utilisateurs finaux par l'intermédiaire de la présente Plateforme — votre propre traitement des Données personnelles de vos utilisateurs finaux** — dans de telles activités, vous êtes le Responsable du traitement ; voir le Chapitre 2.

**1.3 Nos engagements fondamentaux**

Nous nous engageons à respecter les principes de licéité, de légalité, de nécessité et de bonne foi, en collectant les Données personnelles de manière **strictement nécessaire** ; à ne pas utiliser les Données personnelles sans rapport avec le Service à quelque fin que ce soit ; à ne pas utiliser vos Données personnelles pour **l'entraînement de modèles** ; et à ne pas vendre vos Données personnelles à un quelconque tiers.

---

## Chapitre 2 Concepts clés et définition des rôles

> Le présent Chapitre constitue le cœur de la présente Politique. En tant que **plateforme API de grands modèles destinée aux développeurs et aux clients entreprise**, la chaîne d'activité implique deux couches : « vous » et « vos utilisateurs finaux ». Comprendre précisément le rôle juridique de chaque partie constitue le fondement de la détermination des droits et obligations.

**2.1 Relation de données à deux couches**

```
Your end user --(submits information to your app)--> Your app --(calls Platform API)--> Platform --> Upstream Model Provider
       ↑                                                                  ↑
   【You】 as processor                                           【You】 as processor, 【we】 as entrusted processor
```

**2.2 Nos deux rôles**

| Scénario | Données concernées | Votre rôle | Notre rôle | Règles applicables |
|---|---|---|---|---|
| **Scénario A : vous vous inscrivez, vous vous vérifiez, vous effectuez une recharge et vous vous connectez à la Plateforme** | Votre numéro de téléphone, votre courriel, vos informations d'identité ou de licence d'exploitation, vos informations de paiement, vos journaux de connexion | Personne physique | **Responsable du traitement** | Les Chapitres 3 à 7 de la présente Politique dans leur intégralité |
| **Scénario B : vous soumettez via l'API un contenu de requête contenant des Données personnelles** | Invites, fichiers téléversés, contenu renvoyé par le modèle | **Responsable du traitement** | **Sous-traitant chargé du Traitement confié** | Nous ne traitons que sur vos instructions, non pour nos propres finalités ; l'Article 2.3 de la présente Politique s'applique |

**2.3 Dispositions particulières en qualité de Sous-traitant chargé du Traitement confié**

2.3.1 Dans le Scénario B :

1. **Vous devez recueillir vous-même l'autorisation licite de vos utilisateurs finaux** (information et consentement ou toute autre base licite) et remplir vos obligations d'information dans votre propre politique de confidentialité ;
2. Nous traitons les données conformément à vos instructions ; la finalité, la méthode et la durée du traitement sont déterminées par votre comportement d'appel ;
3. **Nous n'utilisons ces données à aucune autre finalité que celle du Scénario A de l'Article 2.2**, y compris, sans limitation, l'exploitation commerciale, l'entraînement de modèles, le Profilage des utilisateurs et la revente de données ;
4. En cas d'incident de sécurité, nous vous en informons sans délai, et vous fulfillez vos obligations d'information et de déclaration envers vos utilisateurs finaux et les autorités de régulation ;
5. Vous pouvez conclure séparément avec nous un Contrat de traitement des données (DPA), précisant les modalités de traitement et les dispositions d'audit.

2.3.2 **Nous vous recommandons et vous accompagnons dans l'anonymisation des Données personnelles avant leur soumission.** Si les données que vous soumettez comprennent des Données personnelles sensibles (telles que les données biométriques, médicales et de santé, les comptes financiers, la localisation, ou les Données personnelles des mineurs de moins de 14 ans), vous devez vous assurer que vous avez obtenu un **consentement distinct** et réalisé une analyse d'impact de la protection des Données personnelles.

2.3.3 Sauf disposition légale contraire, nous **n'accédons pas activement** au contenu de vos requêtes. Ce n'est que dans les circonstances suivantes que nous pouvons le consulter dans la limite strictement nécessaire : pour diagnostiquer des défaillances techniques avec votre autorisation ; sur demande licite des autorités de régulation ou judiciaires ; lors de la découverte d'un contenu suspecté d'illégalité grave ou de mise en danger de la sécurité publique.

---

## Chapitre 3 Comment nous collectons et utilisons les Données personnelles

**3.1 Liste des Données personnelles que nous collectons**

Nous ne collectons que les 4 catégories de Données personnelles suivantes, directement liées au Service :

| Catégorie | Champs précis | Obligatoire | Scénario de collecte |
|---|---|---|---|
| **① Informations de compte** | Numéro de téléphone mobile, courriel, mot de passe du compte (stockage chiffré), pseudonyme / raison sociale | Obligatoire | Inscription, connexion |
| **② Informations de vérification d'identité** | Personne physique : nom, numéro de pièce d'identité (vérifié par une institution tiers de vérification d'identité) ; Entreprise : raison sociale, code de crédit social unifié, nom du représentant légal, image de la licence d'exploitation | Obligatoire | Exécution de l'obligation d'identité réelle prévue par la Loi sur la cybersécurité et les Mesures provisoires relatives à la gestion des services d'IA générative |
| **③ Informations de paiement et de facturation** | Numéro de commande de recharge, canal de paiement, montant de la transaction, entité de facturation et numéro fiscal | Obligatoire | Recharge, facturation |
| **④ Journaux et métadonnées** | Adresse IP, identifiant d'appareil (User-Agent), heure d'accès, identifiant de modèle, nombre de jetons d'entrée/sortie, code de statut de la requête, latence de réponse, identifiant de Clé API | Obligatoire | Fourniture du Service, facturation, audit de sécurité |

**3.2 Informations que nous ne collecterons pas**

**Nous ne collecterons ni ne demanderons les permissions ou informations suivantes** : contacts, journaux d'appels, contenu de SMS, album photo et images (sauf ceux que vous téléversez activement), position géographique précise, microphone et caméra, contenu du presse-papiers, ou liste des autres applications installées sur votre appareil.

**3.3 Finalité et base légale du traitement**

| Activité de traitement | Finalité du traitement | Base légale (LIPD) |
|---|---|---|
| Inscription et connexion au compte | Établir et maintenir la relation de service | Article 13(1)(ii) : nécessaire à la conclusion et à l'exécution d'un contrat |
| Vérification d'identité | Exécution d'obligations légales | Article 13(1)(iii) : nécessaire à l'exécution de missions ou d'obligations légales |
| Facturation et émission des factures | Liquidation des frais de service, exécution des obligations fiscales | Idem supra |
| Comptage et journaux d'appels | Rapprochement de la facturation, diagnostic de défaillances, amélioration de la qualité du service | Article 13(1)(ii) |
| Contrôle des risques de sécurité et lutte contre la fraude | Identification des appels malveillants, de la revente, du vol de compte, du contournement du contrôle des risques, etc. | Article 13(1)(ii) ; en cas de Décision automatisée, l'Article 24 s'applique |
| Notifications relatives au Service et aux modifications de l'Accord | Exécution des obligations d'information | Article 13(1)(ii)(iii) |
| Communications promotionnelles (**non obligatoires**) | Mises à jour du produit, activités promotionnelles | Exige votre **consentement distinct** ; vous pouvez vous désabonner à tout moment |

**3.4 À propos de la vérification d'identité**

3.4.1 En vertu de l'Article 24 de la Loi sur la cybersécurité de la République populaire de Chine, des Mesures administratives relatives aux services d'information sur Internet et des Mesures provisoires relatives à la gestion des services d'IA générative, vous devez effectuer une vérification d'identité avant d'appeler le présent Service.

3.4.2 La vérification d'identité est réalisée par un institution tiers de vérification qualifié. **Nous ne conservons que le résultat de la vérification et l'identifiant anonymisé après réussite de la vérification, et ne conservons pas l'image complète du document** (sauf disposition légale contraire).

3.4.3 Si la vérification d'identité n'est pas effectuée, nous ne pouvons pas activer le Service pour vous ; le solde de recharge non consommé peut alors être remboursé en vertu de l'Article 6 des Conditions d'utilisation.

**3.5 Circonstances dans lesquelles le consentement n'est pas requis**

En vertu de l'Article 13 de la Loi sur la protection des Données personnelles (LIPD), nous pouvons traiter vos Données personnelles sans votre consentement dans les circonstances suivantes : traitement nécessaire à la conclusion ou à l'exécution d'un contrat auquel vous êtes partie ; traitement nécessaire à l'exécution de missions ou d'obligations légales ; traitement nécessaire pour répondre à des urgences de santé publique ou pour protéger, en cas d'urgence, la vie, la santé et la sécurité patrimoniale des personnes physiques ; traitement dans un cadre raisonnable à des fins d'information journalistique ou de contrôle d'intérêt public ; traitement des Données personnelles que vous avez volontairement rendues publiques ou qui sont autrement licitement publiques, dans un cadre raisonnable selon la loi ; et autres circonstances prévues par les lois et les règlements administratifs.

**3.6 Explication de la Décision automatisée**

3.6.1 Nous utilisons un système automatisé de contrôle des risques afin d'identifier les comportements d'appel anormaux (tels que la revente de Clés API, l'inflation malveillante du trafic, le contournement des restrictions régionales). Ces décisions automatisées sont **utilisées uniquement à des fins de sécurité et de conformité du Service et ne serviront pas à l'évaluation de votre solvabilité ni à une tarification différenciée**.

3.6.2 En vertu de l'Article 24 de la LIPD, si une telle Décision automatisée a un impact significatif sur vos droits et intérêts (par exemple la restriction ou la résiliation du Service), **vous avez le droit de nous demander une explication et de refuser une décision prise exclusivement au moyen de moyens automatisés**. Vous pouvez le faire via privacy@uter.ai.

---

## Chapitre 4 Comment nous confions le traitement, partageons, transférons et divulguons publiquement

**4.1 Traitement confié**

Afin de vous fournir le Service, nous pouvons confier le traitement de vos Données personnelles aux catégories de partenaires suivantes :

| Type de partie déléguée | Finalité du traitement | Types d'informations concernés |
|---|---|---|
| Fournisseur d'infrastructure cloud (national) | Hébergement des serveurs, stockage des données, transmission réseau | Les quatre catégories |
| Institution de vérification d'identité | Vérification des informations d'identité ou d'entreprise | ② Informations de vérification d'identité |
| Établissement de paiement de tiers | Règlement des paiements | ③ Informations de paiement et de facturation |
| Prestataire de services de facturation électronique | Émission des factures | ③ Informations de paiement et de facturation |
| Prestataire de services SMS/courriel | Envoi de codes de vérification et de notifications relatives au Service | ① Informations de compte |
| Prestataire de services de contrôle des risques de sécurité | Lutte contre la fraude et identification des anomalies | ④ Journaux et métadonnées |
| **Fournisseur de modèle en amont** | **Inférence de modèle** | **Le contenu de vos requêtes (uniquement lorsque vous initiez un appel)** |

Nous avons conclu, et conclurons avec les parties déléguées ci-dessus, des accords écrits leur imposant de respecter les mêmes normes de protection des Données personnelles, de signer des accords de confidentialité, de ne pas traiter au-delà de la finalité confiée et de supprimer ou de restituer les données à la fin de la relation de sous-traitance.

**4.2 Remarques particulières sur les Fournisseurs de modèles en amont**

4.2.1 Les Fournisseurs de modèles en amont constituent un maillon indispensable de la chaîne de service de la Plateforme. **Lorsque vous initiez un appel API, le contenu de la requête est transmis au Fournisseur de modèle en amont correspondant afin d'y effectuer l'inférence.**

4.2.2 Concernant le traitement de ces données par les fournisseurs de modèles en amont :

- **certains** fournisseurs en amont interviennent en qualité de parties déléguées dans ce maillon, liés par l'accord conclu entre nous et eux ;
- **d'autres** fournisseurs en amont peuvent agir en qualité de **Responsables du traitement indépendants**, dont les activités de traitement sont régies par leurs propres politiques de confidentialité et conditions d'utilisation d'API publiées. Nous avons fait des efforts raisonnables pour sélectionner des fournisseurs appliquant des normes de traitement des données plus élevées, mais **nous ne pouvons pas contrôler leur comportement de traitement spécifique**.

4.2.3 **Si vous ne souhaitez pas supporter les risques susmentionnés, veuillez sélectionner les nœuds de modèles nationaux de la Plateforme, ou anonymiser le contenu de la requête avant utilisation.**

**4.3 Partage**

Sauf dans les circonstances suivantes, nous **ne partageons pas vos Données personnelles avec un quelconque tiers** :

1. Nous avons obtenu votre **consentement distinct** ;
2. Comme l'exigent les lois et réglementations ou les exigences impératives des autorités de régulation ou judiciaires (nous vous en informerons dans la limite permise par la loi) ;
3. Nécessaire pour protéger l'intérêt public ou les droits et intérêts légitimes importants de vous ou d'autres personnes, lorsqu'il est difficile d'obtenir votre consentement ;
4. Nécessaire à l'exécution du contrat conclu entre vous et nous (par exemple la transmission du contenu des requêtes aux fournisseurs en amont).

**4.4 Transfert**

Nous ne transférerons pas vos Données personnelles à un quelconque tiers. En cas de fusion, division, dissolution, acquisition ou cession d'actifs, nous vous informerons du nom et des coordonnées du recipient et exigerons de celui-ci qu'il continue d'exécuter les obligations prévues par la présente Politique ; si le recipient modifie la finalité ou la méthode initiale de traitement, nous recommencerons à recueillir votre consentement.

**4.5 Divulgation publique**

Nous ne{divulguons pas publiquement vos Données personnelles. Lorsque la divulgation est légalement requise, nous prendrons des mesures de protection de la sécurité et vous informerons de la finalité, du type et de l'éventuelle portée de la divulgation.

**4.6 Exceptions**

En vertu de l'Article 13 de la LIPD et des dispositions connexes, nous n'avons pas besoin d'obtenir séparément votre consentement dans les circonstances suivantes : traitement directement lié à la sécurité nationale ou à la défense nationale ; traitement directement lié à la sécurité publique, à la santé publique ou à des intérêts publics importants ; traitement directement lié à l'enquête, à la poursuite, au jugement et à l'exécution des décisions pénales ; traitement nécessaire à la protection des droits et intérêts légitimes importants de vous ou d'autres personnes lorsqu'il est difficile d'obtenir le consentement ; Données personnelles que vous avez volontairement rendues publiques ; Données personnelles collectées à partir d'informations publiquement divulguées de manière licite ; et autres circonstances prévues par les lois et réglementations.

---

## Chapitre 5 Transfert de données hors de Chine

**5.1 Condition de déclenchement**

Par défaut, la Plateforme utilise des nœuds et des modèles nationaux, **les données ne quittant pas le territoire national**.

**Le contenu de vos requêtes n'est transmis aux Fournisseurs de modèles en amont étrangers et n'est susceptible d'être traité et stocké à l'étranger que lorsque vous choisissez activement d'appeler des nœuds de modèles situés à l'étranger.**

**5.2 Nos principes de traitement**

5.2.1 Un tel transfert est **choisi et déclenché activement par vous**. Votre acte de sélection d'un modèle étranger dans la console constitue votre instruction explicite pour un transfert transfrontalier de données.

5.2.2 Nous **ne conservons pas sur le territoire national le contenu du corps de vos requêtes et réponses** ; le transfert sortant est un simple relais en temps réel et ne constitue pas un stockage incrémental de données nationales (seules les métadonnées nécessaires à la facturation et à l'audit sont conservées, et ces métadonnées sont stockées dans le territoire de la Chine).

5.2.3 **En vertu de la Section 3 du Chapitre 3 de la LIPD et des Mesures relatives à l'évaluation de sécurité des transferts de données sortants, vous devez effectuer les procédures de conformité requises en matière de transfert transfrontalier de données avant de soumettre à la présente Plateforme un contenu de requête contenant des Données personnelles**, y compris sans limitation : la conclusion et le dépôt du contrat type de transfert transfrontalier de Données personnelles, la certification de protection des Données personnelles, ou le dépôt d'une demande d'évaluation de sécurité (lorsque le seuil de dépôt est atteint).

5.2.4 Nous vous recommandons et vous accompagnons dans la réduction du risque de transfert sortant par les moyens suivants : sélection de modèles nationaux ; mise en œuvre de la dépersonnalisation des données, du remplacement de champs et de la pseudonymisation côté client ; et abstention complète de transférer des Données personnelles sensibles.

**5.3 Exceptions au transfert transfrontalier**

Les données impliquant des opérateurs d'infrastructures d'information critiques, des données importantes ou des données dont le transfert sortant est interdit par les lois et réglementations **ne doivent en aucun cas être traitées au moyen des nœuds étrangers de la Plateforme**. Vous supportez les conséquences de la violation de la présente disposition.

---

## Chapitre 6 Comment nous stockons et protégeons les Données personnelles

**6.1 Lieu de stockage**

Vos Données personnelles sont stockées sur des serveurs **situés dans le territoire de la République populaire de Chine** (hébergés dans des centres de données nationaux). Sauf disposition contraire prévue à l'Article 5.1, nous ne transmettons pas vos Données personnelles à l'étranger.

**6.2 Durée de stockage**

Nous suivons le principe de la **durée strictement nécessaire**, comme suit :

| Type d'information | Durée de stockage | Base |
|---|---|---|
| **Contenu du corps** des requêtes et réponses | **Non conservé par défaut** (libéré après relais en temps réel) | Principe de minimisation |
| Métadonnées d'appel (heure, modèle, nombre de jetons, code de statut, latence) | **12 mois** | Besoins de rapprochement de facturation et d'audit |
| Informations de compte et de vérification d'identité | Pendant la durée d'existence du compte, supprimées ou anonymisées dans les **6 mois** suivant l'annulation du compte | Relation de service et besoins de vérification réglementaire |
| Enregistrements de paiement et de facturation | Conformément à la Loi sur le commerce électronique et aux Mesures relatives à la gestion des archives comptables, **au moins 3 ans** à compter de l'achèvement de la transaction | Obligation légale |
| Journaux de cybersécurité | **Au moins 6 mois** | Article 21 de la Loi sur la cybersécurité |
| Enregistrements de traitement des incidents de sécurité | **3 ans** | Besoins de traçabilité de la conformité |

**Au-delà des durées susmentionnées, nous supprimons ou anonymisons les données et ne les utilisons à aucune fin.**

**6.3 Mesures de protection de la sécurité**

Nous adoptons des mesures de sécurité conformes aux normes du secteur pour protéger vos Données personnelles :

| Couche | Mesures |
|---|---|
| Sécurité de la transmission | Chiffrement HTTPS / TLS 1.3 sur l'ensemble du site ; authentification obligatoire par clé pour les API |
| Sécurité du stockage | Chiffrement des champs sensibles (numéros de pièce d'identité, mots de passe) au stockage ; accès à la base de données à privilèges minimal |
| Contrôle d'accès | Habilitation des employés par niveaux, piste d'audit des opérations ; la Clé API prend en charge la liste d'adresses IP autorisées et la rotation |
| Audit de sécurité | Analyse régulière des vulnérabilités, tests d'intrusion, audit des journaux |
| Organisation | Accords de confidentialité des employés, formation spécialisée pour les postes de traitement des données, révocation immédiate des permissions lors des départs |
| Évaluation de conformité | Analyse d'impact de la protection des Données personnelles (AIPD) en vertu de l'Article 55 de la LIPD |

**6.4 Traitement des incidents de sécurité**

Lorsqu'une fuite, une altération ou une perte de Données personnelles survient ou est susceptible de survenir, nous :

1. activons immédiatement le plan d'urgence et prenons des mesures correctives ;
2. signalons l'incident au service chargé de la protection des Données personnelles en vertu de l'Article 57 de la LIPD ;
3. vous informons sans délai par message sur le site, par courriel ou par SMS : les faits essentiels de l'incident, l'impact possible, les mesures correctives que nous avons prises, les recommandations pour prévenir vous-même les risques et nos coordonnées ;
4. lorsqu'il est difficile de notifier chaque personne, publions une annonce par des moyens raisonnables et efficaces.

**6.5 Avertissement inhérent sur la sécurité des informations**

L'environnement Internet n'est pas absolument sécurisé. **Veuillez utiliser des mots de passe de compte suffisamment complexes, conserver votre Clé API en lieu sûr et ne pas coder des clés en dur côté client.** Si une fuite d'information est causée par votre propre mauvaise conservation, nous n'assumons aucune responsabilité pour les conséquences qui en découlent.

---

## Chapitre 7 Vos droits relatifs aux Données personnelles

En vertu du Chapitre 4 de la LIPD, vousrições des droits suivants sur vos propres Données personnelles. Nous répondons dans un délai de **15 jours ouvrables** après réception de votre demande et vérification de votre identité (lorsque la situation est complexe, ce délai peut être porté à 30 jours ouvrables, après vous en avoir informé).

| Droit | Moyen de l'exercer | Observations |
|---|---|---|
| **Accès et copie** | Consultation en libre-service dans la console, rubrique « Paramètres du compte → Données personnelles » ; ou demande par courriel | Nous fournissons une copie dans un format structuré et commun |
| **Rectification et complément** | Modification en libre-service dans la console ; une nouvelle vérification d'identité est requise pour les informations d'identité réelle | Nous rectifions sans délai après vérification |
| **Suppression** | Suppression en libre-service dans la console ; ou demande par courriel | S'applique à l'Article 47 de la LIPD : finalité du traitement atteinte ou devenue inutile ; arrêt du service ou expiration de la durée de stockage ; vous retirez votre consentement ; traitement illicite ; autres circonstances prévues par les lois et réglementations |
| **Retrait du consentement** | Console, rubrique « Paramètres de confidentialité » ; ou demande par courriel | Le retrait ne remet pas en cause la validité des activités de traitement déjà effectuées sur la base du consentement avant le retrait |
| **Annulation du compte** | Annulation en libre-service dans la console | Réglez les frais et sauvegardez les données avant l'annulation ; le compte est irrécupérable après l'annulation |
| **Portabilité** | Demande par courriel | Lorsque les conditions fixées par l'autorité nationale du cyberespace sont réunies, nous fournissons un canal de portabilité |
| **Limitation ou refus du traitement** | Demande par courriel | Par exemple, refuser une décision prise exclusivement au moyen de moyens automatisés et ayant un impact majeur sur vous |
| **Explication** | Demande par courriel | Vous avez le droit de demander une explication de la présente Politique et des règles de traitement des Données personnelles |
| **Réclamation et signalement** | privacy@uter.ai | Nous répondons dans un délai de 15 jours ouvrables |

**7.1 Canal de réception des demandes**

- Courriel : privacy@uter.ai
- Console : Paramètres du compte → Confidentialité et données → Exercice des droits
- Nous pouvons être amenés à vous demander de fournir les informations nécessaires à la vérification de votre identité ; **la vérification sert uniquement à confirmer l'identité et n'a pas pour effet d'étendre la portée de la collecte d'informations**.

**7.2 Circonstances dans lesquelles nous pouvons refuser de répondre**

Nous pouvons être dans l'impossibilité de répondre à votre demande, et vous expliquerons la raison, dans les circonstances suivantes : demande liée à l'exécution de nos obligations prévues par les lois et réglementations ; demande directement liée à la sécurité nationale ou à la défense nationale ; demande directement liée à la sécurité publique, à la santé publique ou à des intérêts publics importants ; demande directement liée à l'enquête, à la poursuite, au jugement et à l'exécution des décisions pénales ; éléments suffisants indiquant que vous agissez de mauvaise foi ou abusez de vos droits ; réponse qui causerait un préjudice grave aux droits et intérêts légitimes de vous ou d'autres personnes ou organisations ; implication de secrets commerciaux.

**7.3 Voies de recours externes**

Si vous estimez que nos activités de traitement portent atteinte à vos droits et intérêts légitimes et que la négociation avec nous a échoué, vous avez le droit d'introduire une réclamation ou un signalement auprès du **service chargé de la protection des Données personnelles**. Vous pouvez :

- signaler au **Centre national de notification de la cybersécurité et de la sécurité des informations** ou au **Centre 12377 de signalement des informations illicites et dépendantes** ;
- introduire une réclamation auprès du **Bureau de Shenzhen de l'administration du cyberespace** ou de l'**Administration des communications de Shenzhen** ;
- saisir le **tribunal populaire ayant la Compétence juridictionnelle**.

---

## Chapitre 8 Cookies et technologies similaires

8.1 Nous utilisons les technologies de Cookie et de stockage local (LocalStorage) pour mettre en œuvre les fonctions nécessaires suivantes : maintien de l'état de connexion, mémorisation des préférences de langue et d'interface, et prévention des falsifications de requêtes intersites (CSRF).

8.2 La présente Plateforme **n'utilise pas** de Cookies pour le pistage publicitaire intersite ni pour la diffusion de publicités personnalisées.

8.3 Vous pouvez gérer ou supprimer les Cookies par les paramètres de votre navigateur. **La désactivation des Cookies nécessaires peut vous empêcher de vous connecter normalement ou d'utiliser les fonctions de la console.**

---

## Chapitre 9 Protection des mineurs

9.1 La présente Plateforme **ne fournit pas de services aux mineurs**. En vertu de l'Article 1.5 des Conditions d'utilisation de la Plateforme de services de grands modèles Uter, les utilisateurs doivent être âgés d'au moins **18 ans** et jouir de la pleine capacité juridique.

9.2 Nous ne collecterons pas activement les Données personnelles des mineurs, n'exigerons pas des mineurs qu'ils fournissent des Données personnelles. Si vous êtes mineur, veuillez ne pas vous inscrire aux services de la présente Plateforme ni les utiliser.

9.3 En vertu de l'Article 31 de la LIPD, **les Données personnelles des mineurs de moins de 14 ans sont des Données personnelles sensibles**. Si nous découvrons avoir collecté par erreur les Données personnelles d'un mineur, nous les supprimerons immédiatement ; les tuteurs sont invités à nous contacter via privacy@uter.ai.

9.4 **Note pour les utilisateurs qui sont développeurs** : si l'application que vous développez sur la base de la présente Plateforme s'adresse à des mineurs ou peut être utilisée par des mineurs, **vous devez recueillir vous-même le consentement distinct de leurs tuteurs** et concevoir des règles de traitement des données et des mesures de sécurité des contenus spécifiquement destinées aux mineurs. Cette obligation vous incombe ; la présente Plateforme n'intervient pas dans la relation juridique entre vous et vos utilisateurs finaux.

---

## Chapitre 10 Remarques particulières sur les services d'IA générative

**10.1 Nous n'entraînons pas de modèles**

10.1.1 Nous-mêmes, nous **ne développons pas et n'entraînons pas** de grands modèles. Le rôle de la présente Plateforme est celui d'agrégateur et de relais de la capacité des modèles.

10.1.2 **Nous n'utiliserons pas le contenu de vos requêtes pour entraîner ou régler finement un quelconque modèle**, ni l'utiliser pour améliorer les performances des modèles, construire des jeux de données d'entraînement ou procéder à l'annotation de données.

10.1.3 L'utilisation de vos données par un Fournisseur de modèle en amont pour entraîner ses modèles **dépend de la politique propre de cet amont et de vos arrangements contractuels**. Nous vous recommandons de consulter la politique de confidentialité de l'amont concerné ; pour les fournisseurs qui s'engagent explicitement à ne pas utiliser les données de leurs clients à des fins d'entraînement, nous les signalerons dans le catalogue des modèles.

**10.2 Obligations de marquage des contenus générés**

10.2.1 En vertu de l'Article 12 des Mesures provisoires relatives à la gestion des services d'IA générative et de l'Article 17 des Dispositions sur l'administration de la synthèse profonde d'informations sur Internet, **en tant que fournisseur de services d'IA générative, vous devez apposer sur les contenus générés un marquage explicite comme l'exige la loi, ou apposer un marquage implicite dans les métadonnées du fichier.**

10.2.2 Nous pouvons fournir un support technique pour la capacité de marquage, mais **ne nous substituons pas à vous dans l'accomplissement de l'obligation légale de marquage**.

**10.3 Sécurité des contenus**

10.3.1 Nous pouvons déployer une capacité de revue de la sécurité des contenus côté serveur afin d'intercepter les entrées et sorties manifestement illicites. Une telle revue est fondée sur **le contenu lui-même** et ne cible pas votre identité personnelle.

10.3.2 Si vous utilisez la capacité générative de la présente Plateforme dans des scénarios ayant des **attributs d'opinion publique ou une capacité de mobilisation sociale**, au sens des Dispositions sur l'administration de la recommandation par algorithme pour les services d'information sur Internet et des Mesures provisoires relatives à la gestion des services d'IA générative, vous devez accomplir les obligations d'**enregistrement d'algorithme** et d'**évaluation de sécurité** prévues par la loi.

**10.4 Risques du contenu de sortie**

La sortie des grands modèles de langage est probabiliste et non déterministe, et **peut contenir des erreurs factuelles, des biais ou des contenus inappropriés**. Veuillez ne pas utiliser la sortie comme base unique de décisions professionnelles telles que médicales, juridiques ou d'investissement financier.

---

## Chapitre 11 Mises à jour de la présente Politique

11.1 Nous pouvons mettre à jour la présente Politique en fonction des évolutions des lois et réglementations, des ajustements commerciaux ou des améliorations technologiques. La Politique mise à jour sera publiée de manière bien visible sur la Plateforme, avec la date de mise à jour indiquée.

11.2 Pour les **modifications substantielles** suivantes, nous vous **notifierons de manière bien visible** par message sur le site, par courriel ou par fenêtre contextuelle, et recueillerons à nouveau votre consentement lorsque cela est nécessaire :

1. la finalité, le type ou la méthode de traitement des Données personnelles change de manière substantielle ;
2. les principaux destinataires du partage, du transfert ou de la divulgation publique des Données personnelles changent ;
3. vos droits relatifs au traitement des Données personnelles et les modalités de leur exercice changent de manière substantielle ;
4. la finalité, le destinataire ou le type de transfert transfrontalier de données change ;
5. l'analyse d'impact de la sécurité des Données personnelles indique un niveau de risque élevé.

11.3 À l'expiration du délai de publication, votre utilisation continue du présent Service vaut acceptation de la Politique mise à jour ; si vous ne l'acceptez pas, vous pouvez cesser d'utiliser le Service et annuler votre compte.

**Historique des versions**

| Version | Date d'entrée en vigueur | Notes de révision |
|---|---|---|
| V1.0 | 8 août 2026 | Première publication |

---

## Chapitre 12 Comment nous contacter

| Objet | Contact |
|---|---|
| Responsable de la protection des Données personnelles | privacy@uter.ai |
| Exercice des droits relatifs aux Données personnelles et réclamations | privacy@uter.ai |
| Service et support technique | tech@uter.ai |
| Signalement d'abus et de violations | abuse@uter.ai |
| Questions commerciales et contrats | bd@uter.ai |
| Adresse postale | Bâtiment T2, Ali Center, district de Nanshan, Shenzhen, province du Guangdong, République populaire de Chine |

Nous répondons dans un délai de **15 jours ouvrables** après réception de votre question ou réclamation.

---

## Chapitre 13 Définitions

| Terme | Signification |
|---|---|
| **Données personnelles** | Diverses informations enregistrées par voie électronique ou autre, se rapportant à des personnes physiques identifiées ou identifiables, à l'exclusion des informations ayant fait l'objet d'une anonymisation |
| **Données personnelles sensibles** | Données personnelles dont la divulgation ou l'utilisation illicite est susceptible de porter atteinte à la dignité d'une personne physique ou de mettre en danger la sécurité des personnes ou des biens, comprenant les données biométriques, les croyances religieuses, l'identité spécifique, les données médicales et de santé, les comptes financiers, la localisation et autres informations, ainsi que les Données personnelles des mineurs de moins de 14 ans |
| **Responsable du traitement** | Une organisation ou une personne physique qui détermine de manière autonome la finalité et la méthode de traitement des Données personnelles |
| **Sous-traitant chargé du Traitement confié** | Une organisation ou une personne physique qui accepte une mission d'un Responsable du traitement et traite les Données personnelles selon ses instructions |
| **Dé-identification** | Le processus par lequel les Données personnelles sont traitées de manière qu'une personne physique déterminée ne puisse pas être identifiée sans le secours d'informations supplémentaires |
| **Anonymisation** | Le processus par lequel les Données personnelles sont traitées de manière qu'une personne physique déterminée ne puisse être ni identifiée ni reconstituée |
| **Décision automatisée** | Les activités utilisant des programmes informatiques pour analyser et évaluer automatiquement les habitudes comportementales, les intérêts, les loisirs ou la situation économique, sanitaire ou de crédit d'une personne, et pour prendre des décisions |
| **Transfert de données hors de Chine** | La transmission ou le stockage, hors du territoire de la Chine, des Données personnelles collectées et générées au cours des opérations, ou l'autorisation d'accès ou de consultation de ces informations par des institutions, organisations ou personnes physiques à l'étranger |
| **Fournisseur de modèle en amont** | Un tiers qui fournit effectivement la capacité d'inférence des grands modèles, comprenant sans limitation OpenAI, Anthropic, Google, Alibaba Cloud, ByteDance, Tencent, DeepSeek, Zhipu, etc. |
