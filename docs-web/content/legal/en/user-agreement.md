# URouters Large Model Service Platform Terms of Service

| Item | Content |
|---|---|
| Service Brand | **Urouters 优特斯** |
| Platform Name | **URouters Large Model Service Platform** |
| Official Website | https://urouters.com |
| Document Name | URouters Large Model Service Platform Terms of Service |
| Version | V1.0 |
| Effective Date | August 8, 2026 |
| Last Updated | August 8, 2026 |
| Contracting Entity | **Shenzhen Urouters Intelligent Co., Ltd.** (the sole contracting entity for the services under this Agreement) |
| Applicable To | Individual and enterprise users who register for and use the URouters Large Model Service Platform (urouters.com) |

> **Important Notice:** This Agreement is a standard-form contract. Before registering for or using this Service, please read all provisions of this Agreement carefully and in full, **especially the clauses highlighted in bold that exempt or limit our liabilities, restrict your rights, and govern dispute resolution and governing law.** If you do not agree to any part of this Agreement, please immediately stop registering for or using this Service. Checking the acceptance box, completing registration, or actually calling any API interface shall be deemed as your full understanding and acceptance of all terms of this Agreement.

---

## Table of Contents

1. General Provisions and Acceptance
2. Definitions
3. Account Registration, Verification and Security
4. Service Scope and Content
5. Usage Rules and Prohibited Conduct
6. Top-up, Billing and Settlement
7. Service Levels, Quotas and Availability
8. Data, Content and Personal Information Protection
9. Third-Party Services and Upstream Model Terms
10. Intellectual Property Rights
11. Disclaimers and Limitation of Liability
12. Changes, Suspension and Termination of Service
13. Breach and Handling
14. Export Control, Sanctions and Cross-Border Compliance
15. Governing Law and Dispute Resolution
16. Notices and Service of Documents
17. Miscellaneous
- Appendix A Core Prohibited List of the Acceptable Use Policy (AUP)
- Appendix B List of Upstream Model Providers and Sub-processors

---

## Article 1 General Provisions and Acceptance

**1.1 Contracting Entity**

This Agreement is entered into between you (hereinafter "User" or "you") and **Shenzhen Urouters Intelligent Co., Ltd.** (hereinafter collectively "Urouters 优特斯", "优特斯" or "we").

- **Contracting Entity**: **Shenzhen Urouters Intelligent Co., Ltd.**, registered in Shenzhen, Guangdong Province, the People's Republic of China, holding an ICP license, algorithm filing and generative AI service filing. The company operates the **URouters Large Model Service Platform** (official website: urouters.com, hereinafter the "Platform"), providing this Service to users within **the territory of the People's Republic of China (excluding the Hong Kong, Macao and Taiwan regions of China)**.
- **Single Entity**: The **sole contracting entity for the services under this Agreement is Shenzhen Urouters Intelligent Co., Ltd.** We do not currently provide services to you through any overseas affiliated entity. Should we provide services through an overseas affiliated entity in the future, we will execute a separate service agreement and notify you in advance.

**1.2 Composition of the Agreement**

This Agreement, together with the following documents, constitutes the complete agreement and has the same legal effect as the main text of this Agreement; in the event of any inconsistency between an appendix and the main text, the main text shall prevail, except where the appendix imposes stricter obligations on a specific matter:

1. the Privacy Policy;
2. the Acceptable Use Policy (see Appendix A);
3. the Service Level Agreement (SLA);
4. the Pricing Page, Model Catalog and Rate-Limiting Rules published on the Platform;
5. written documents separately executed between you and us, such as the Enterprise Service Agreement, Data Processing Agreement (DPA) and Order Confirmation.

**1.3 Modes of Acceptance**

You shall be deemed to have fully and unconditionally accepted this Agreement upon any of the following:

- Checking "I have read and agree to the Terms of Service" on the registration page;
- Completing account registration, enterprise identity verification or top-up;
- Initiating any model call request using an API Key (or equivalent credential) issued by us.

**1.4 Amendment of the Agreement**

1.4.1 We may amend this Agreement as necessitated by changes in laws and regulations, regulatory requirements, adjustments to upstream model providers' policies, or product iteration. The amended Agreement will be prominently published on the Platform, with at least **7 calendar days'** advance notice (for clauses that materially affect you, such as billing rules, limitation of liability and dispute resolution, **15 calendar days'** advance notice).

1.4.2 Upon expiry of the publication period, your continued use of this Service shall be deemed as acceptance of the amendments. If you do not accept them, you have the right to stop using the Service before the publication period expires and apply for settlement of your account balance.

1.4.3 We recommend that you check the latest version of this Agreement periodically. The Platform will retain historical versions for traceability.

**1.5 User Eligibility**

1.5.1 If you are a **natural person**, you should be at least **18 years of age** and have full capacity for civil conduct. If you are under 18, you should read this Agreement in the company of a guardian and use this Service only with the guardian's consent.

1.5.2 If you register in the name of an **enterprise, institution, social organization or other organization**, you represent and warrant that you are duly authorized by that organization, have the right to accept this Agreement on its behalf and assume the corresponding obligations, and that the qualification documents you submit to us (business license, power of attorney, etc.) are true, lawful and valid.

1.5.3 You undertake that you are not a sanctioned or restricted subject under Article 14 of this Agreement.

**1.6 Effectiveness**

This Agreement takes effect on **August 8, 2026**. For users who registered before the effectiveness of this Agreement, this Agreement applies from the date of its effectiveness.

---

## Article 2 Definitions

Unless the context otherwise requires, the following terms have the meanings set out below:

| Term | Definition |
|---|---|
| **Service** | The services provided by the URouters Large Model Service Platform to users through its official website (urouters.com) and unified API gateway, including multi-model aggregation calling, routing and scheduling, usage metering, and account management |
| **Platform** | The URouters Large Model Service Platform, collectively the Urouters official website (urouters.com), console, developer documentation, SDK and API interfaces |
| **API Key** | The calling credential issued by us to users for identity authentication and metering/billing (including keys, tokens, temporary credentials and all equivalent forms) |
| **Token** | The smallest billing unit for processing text by a large language model. Input Tokens (Prompt Tokens) and Output Tokens (Completion Tokens) are billed separately |
| **Upstream Model Provider** | A third party that actually provides model inference capability, including but not limited to OpenAI, Anthropic, Google, Microsoft Azure, Amazon AWS Bedrock, and domestic model vendors |
| **Upstream Service** | The model inference interface and its supporting services provided by an Upstream Model Provider |
| **Routing** | The mechanism by which the Platform distributes user requests to the corresponding upstream service based on model identifier, availability, latency and cost strategy |
| **User Content** | The input content (prompts, files, images, etc.) submitted by the user through this Service and the output content returned by the Service |
| **Enterprise User** | A user who registers in the name of an organization and completes enterprise verification |
| **Account Balance** | The available fund quota that the user has pre-charged but not yet consumed |
| **Metering Data** | The log data recorded and generated by the Platform for billing purposes, such as Token consumption, request counts and latency |

---

## Article 3 Account Registration, Verification and Security

**3.1 Obligation of Truthful Information**

3.1.1 You shall provide true, accurate, complete and valid registration and verification information, and update it within **5 business days** of any change.

3.1.2 You shall bear the consequences (including but not limited to service suspension, account freezing, inability to refund the balance, and third-party claims) arising from false, invalid or impersonated information caused by you.

**3.2 Identity Verification**

3.2.1 Pursuant to the Cybersecurity Law of the PRC, the Administrative Measures for Internet Information Services, the Interim Measures for the Management of Generative AI Services and other regulations, users of domestic services must complete **identity verification** (identity verification for natural persons; business license verification for enterprises) before calling the Service.

3.2.2 We may, as required by regulators, require you to submit additional industry qualifications, application scenario descriptions, content security management systems and other materials, and may refuse to activate the Service before approval.

**3.3 Account Security**

3.3.1 **You bear full responsibility for the safekeeping of all account credentials, including account name, password, API Key and two-factor authentication credentials. Once issued, an API Key is equivalent to your identity credential.**

3.3.2 You should at least take the following measures: do not hard-code API Keys in client code or public code repositories; issue independent Keys for different applications; rotate them regularly; configure IP allowlists and usage alerts; revoke immediately in the console upon discovering a leak.

3.3.3 **You bear all call volume and fees arising from your poor safekeeping, device intrusion, Key leakage or use by third parties.** We are not liable for fee losses caused by Key leakage. You should notify us immediately upon discovering a leak, and we will assist in revoking the credential; fees already incurred before your notice will not be refunded.

**3.4 Uniqueness and Transfer Restrictions of Accounts**

3.4.1 One account is limited to use by one legal entity. **Without our prior written consent, you may not rent, lend, sell, gift or transfer the account or API Key in any form.**

3.4.2 We may identify account sharing or resale based on login IP, device fingerprint, calling characteristics, etc., and take the measures under Article 13 of this Agreement.

**3.5 Account Cancellation**

You may apply to cancel your account in the console at any time. Before cancellation, you should settle all payable amounts and back up your own data. After cancellation, we will delete or anonymize your personal information as required by laws and regulations, except for transaction records that must be retained by law.

---

## Article 4 Service Scope and Content

**4.1 Service Content**

4.1.1 We provide an **aggregation and forwarding service for model invocation capability**. Specifically:

- Unified API protocol access (compatible with OpenAI format and mainstream SDKs);
- Intelligent routing and failover across multiple models and upstreams;
- Prepaid account system, usage metering, billing and invoicing;
- Console management, usage monitoring, alerting and log query;
- Optional value-added services: content security review, dedicated instances, private deployment, model fine-tuning, compliance consulting.

4.1.2 **We are not the developer or owner of the models themselves.** Except for services explicitly labeled "self-developed models", all model capabilities involved in this Service are provided by Upstream Model Providers. Our role in this Service is that of an **integrator and reseller of the Service**, not the original provider of the models.

**4.2 Service Forms**

| Form | Description | Billing |
|---|---|---|
| Public Cloud API | Multi-tenant shared resource pool, postpaid settlement by Token | Pay-as-you-go |
| Dedicated Instance | Exclusive compute quota, guaranteed latency and concurrency | Subscription + pay-as-you-go |
| Private Deployment | Deployed in the user's own environment, data does not leave the domain | Project-based + annual maintenance |
| Developer Edition | Includes free trial quota, for individual developers | Pay-as-you-go |

**4.3 Service Regions**

4.3.1 We may open different model catalogs to users in different registration regions based on Upstream Model Providers' regional authorization restrictions, export control requirements and local laws.

4.3.2 **You may not use technical means to bypass regional restrictions to call models not opened to your region.** We may intercept and handle abnormal cross-border calling behavior.

**4.4 Model On/Off-boarding**

4.4.1 Upstream Model Providers may add, update, discontinue or deprecate specific models at any time. We will notify you in advance to the extent reasonably feasible and suggest alternative models.

4.4.2 **Service adjustments caused by upstream model off-boarding, capability changes or price adjustments do not constitute a breach by us.** We will endeavor to provide a migration window of at least **30 calendar days**, but where the upstream's transition period is shorter, the actual upstream arrangement shall prevail.

**4.5 Free Quota and Trials**

Free quota is for evaluation and testing only. We may adjust the quota, restrict available models or terminate trials at any time, and make no commitment regarding the availability of services within the free quota. The free quota is non-refundable, non-transferable and non-cashable.

---

## Article 5 Usage Rules and Prohibited Conduct

**5.1 General Compliance**

You undertake to use this Service only for lawful and legitimate purposes, to comply with the laws and regulations of the PRC, those of your location and of the place of service use, and all applicable policies of Upstream Model Providers. **You bear sole and full legal liability for all content submitted through this Service and the consequences arising therefrom.**

**5.2 Content-Level Prohibitions**

You may not use this Service to generate, store, disseminate or otherwise process the following content:

1. Content that opposes the basic principles established by the Constitution, endangers national security, honor and interests, incites subversion of state power or overthrow of the socialist system;
2. Content that incites division of the country, undermines national unity, advocates terrorism or extremism, incites ethnic hatred or discrimination, or undermines ethnic solidarity;
3. Content that undermines national religious policy, or advocates cults and feudal superstition;
4. Content that spreads rumors or false information and disrupts economic or social order;
5. Content that insults or slanders others, or infringes upon others' rights of reputation, portrait, privacy or personal information;
6. Obscene, pornographic, gambling, violent, murderous, terrorist or crime-instructing content;
7. **Any content involving the sexual exploitation of or sexualization of minors** — upon discovery, we will immediately terminate the Service and report to the competent authority, with no grace period;
8. Content that infringes upon others' intellectual property rights, trade secrets or other lawful rights and interests;
9. Content that, in violation of the Interim Measures for the Management of Generative AI Services and the Provisions on the Administration of Deep Synthesis of Internet Information Services, fails to label generated content as required by law;
10. Use for illegal activities such as telecom network fraud, money laundering, illegal fundraising, pyramid selling, illegal stock recommendation or illegal lending.

**5.3 Technical-Level Prohibitions**

You may not engage in the following, nor assist or incite others to do so:

1. Reverse engineering, decompiling or disassembling this Service or the Upstream Service, or attempting to obtain source code, model weights or system prompts;
2. Using automated scripts, crawlers or bulk registration to maliciously register accounts, scrape free quota or obtain benefits;
3. **Reselling, sub-licensing or re-distributing this Service or API Keys to third parties in any form** (except channel agents authorized in writing by us);
4. Circumventing, evading or destroying our rate-limiting, content review, authentication, regional restriction or billing metering technical measures;
5. Conducting stress testing, penetration testing or denial-of-service attacks against the Service, or using abnormally high concurrent requests that affect the Platform and other users;
6. Concealing the true source of calls through forged request characteristics, tampered Headers or proxy pools;
7. Using this Service to train models that directly compete with upstream models (Distillation or model distillation) unless explicitly authorized by the upstream provider;
8. Extracting, caching or mirroring upstream model outputs to build datasets or services substantially identical to this Service.

**5.4 Additional Requirements for Specific Scenarios**

5.4.1 **Public-facing application scenarios**: If you integrate this Service into a generative AI application open to the public (including websites, Apps, mini-programs, smart hardware), you should complete the required **algorithm filing, generative AI service filing** and content labeling obligations on your own, and obtain our separate written confirmation. We may provide compliance guidance but do not assume your filing obligations thereby.

5.4.2 **High-risk decision scenarios**: You may not use the output of this Service as the **sole** basis for decisions in high-risk scenarios such as medical diagnosis, legal opinions, financial investment decisions, judicial adjudication or personnel recruitment. Such scenarios should be reviewed by qualified professionals.

5.4.3 **Minor-related products**: If your product is directed at minors or may be used by minors, you should obtain guardian consent in accordance with law and implement additional content security measures.

5.4.4 **Sensitive personal information**: Without lawful authorization, you may not submit through this Service others' sensitive personal information, biometric information, medical and health information, financial account information or other specially protected data.

**5.5 Violation Handling**

If you violate this Article, we may, at our discretion and depending on the circumstances, take one or more of the following measures without bearing breach liability: warning and requiring rectification within a time limit; restricting call rate or quota; suspending part or all of the Service; freezing the account; terminating this Agreement; deleting violating content; reporting to and cooperating with regulators or competent authorities in investigation; pursuing your breach and tort liabilities.

---

## Article 6 Top-up, Billing and Settlement

**6.1 Billing Unit and Basis**

6.1.1 This Service uses **Token** as the basic billing unit, billing **Input Tokens** and **Output Tokens** separately, with prices subject to the Platform's Pricing Page.

6.1.2 **Metering is based on our Platform's metering data.** We record the model identifier, input/output Token counts, timestamps and result status of each request, and generate the bill accordingly. You may query details in the console.

6.1.3 Prices may differ for the same model across different routing paths and different upstream providers; we bill according to the **actual routing result** and list the corresponding price tiers on the Pricing Page.

**6.2 Price Adjustment**

We may adjust service prices based on upstream price changes, exchange rate fluctuations and cost structure changes. Price adjustments will be published **15 calendar days** in advance; adjustments are not retroactive, and usage before publication is settled at the original price.

**6.3 Prepayment and Account Balance**

6.3.1 This Service adopts a **prepaid model**: you should first top up to form an account balance, which is deducted in real time upon calling. When the balance is insufficient, the Service will automatically stop; we do not provide credit advances (except enterprise users with separate written arrangements).

6.3.2 **Account Balance is non-transferable, non-cashable and may not be used for purposes other than this Service.**

6.3.3 **Refund Rules**:

- For un-consumed top-up balances, you may apply for a refund, but the fees charged by third-party payment channels and the taxes corresponding to invoices already issued will be deducted; the review period is **10 business days**.
- **Consumed Token fees are non-refundable**, regardless of whether you actually used the output (e.g., you abandoned use due to poor prompt design, changed requirements or dissatisfaction with results).
- Where account termination is caused by your violation of this Agreement, the balance, after deduction of payable fees and possible third-party claims, may be refunded; where serious illegality is constituted, we may lawfully defer the refund and cooperate with competent authorities.

6.3.4 The balance is valid for **12 months** from the top-up date. Before expiry we will remind you via in-site message/email; unused balances after expiry may be reactivated upon application; if unused continuously for **3 months**, we may handle it after deducting reasonable management fees.

**6.4 Failed Requests and Billing**

6.4.1 Requests that fail due to **our** platform errors (gateway exceptions, routing failures that did not reach upstream) are not billed, and any deducted fees are automatically returned.

6.4.2 **Requests for which an Upstream Model Provider returned an error, timeout, or content intercepted by the upstream safety policy (Refusal / Content Filter) and that already incurred upstream consumption are still billed according to actual consumption**:

- Where the upstream has returned a content filtering result (e.g., safety interception, refusal), input Token consumption typically still occurs and is billed as Input Tokens;
- Where the upstream returned a `5xx` error or timeout, it is generally not billed; if the upstream has billed, we will return the equivalent amount after verification;
- You may submit a billing dispute through the console; the dispute acceptance period is **30 calendar days** from bill generation, after which the bill is deemed accepted.

6.4.3 Streaming requests interrupted are metered by the Tokens actually transmitted.

**6.5 Discounts and Offers**

Prompt Caching, Batch, off-peak calling, etc. may enjoy discounts; the specific discount rates are subject to the Pricing Page and upstream policies. **Discounts vary with upstream policies and do not constitute a long-term commitment.**

**6.6 Invoicing and Taxation**

We issue VAT invoices (special or general VAT invoices, depending on your taxpayer qualification) based on your actual consumption amount. Invoice applications must be submitted within the calendar year to which the bill belongs; cross-year re-issuance is not provided. Costs of re-issuance or cancellation due to incorrect invoicing information you provided are borne by you.

**6.7 Arrears Handling**

After the balance is exhausted, the Service will be suspended. For enterprise users on a monthly post-settlement model, if payment is overdue by more than **15 calendar days**, we may suspend the Service; if overdue by more than **30 calendar days**, we may terminate the Service, pursue breach liability, and charge a late penalty of **0.05% per day**.

---

## Article 7 Service Levels, Quotas and Availability

**7.1 Availability Target**

7.1.1 We commit to a monthly availability of no less than **99.9%** for the **Platform gateway** (authentication, routing, metering modules); the specific calculation method and compensation standard are detailed in the Service Level Agreement (SLA).

7.1.2 **The above commitment does not cover the availability of the Upstream Model Providers themselves.** The availability of upstream services is indirectly guaranteed by the upstream provider to **you** (as the end user) under its own SLA; we do not assume guarantee liability for the upstream SLA.

**7.2 SLA Exclusions**

The following circumstances are not counted as downtime: upstream model provider failures, rate-limiting or policy changes; Internet backbone failures, DNS pollution, cross-border link congestion; your own application, network or configuration issues; our planned maintenance (72 hours' notice, no more than 4 hours each); force majeure; bans due to your violation.

**7.3 SLA Compensation**

When the SLA is not met, we will compensate in the form of **service credit vouchers**, with the compensation cap at **100% of your actual consumption amount in the month**, and **no cash refund is provided**. Service credit vouchers are non-transferable, non-cashable, and valid for 6 months.

**7.4 Quotas and Rate-Limiting**

7.4.1 We set rate limits (RPM: requests per minute; TPM: Tokens per minute) and concurrency caps by account tier; specific quotas are published in the console and can be requested for increase.

7.4.2 When a single request exceeds the model's context length limit, the request will be rejected; we are not responsible for effect loss due to truncation or chunking.

7.4.3 To ensure overall Platform stability, we may implement global scheduling, degradation or temporary rate-limiting. If degradation is needed, we will prioritize protecting higher-tier users and paid dedicated instances.

---

## Article 8 Data, Content and Personal Information Protection

**8.1 Ownership of User Content**

The input content you submit through this Service, and the output content generated by the Service based on that input, belong to **you or your lawful authorizer**. We do not claim any ownership of User Content.

**8.2 Data Processing Role**

In providing this Service, with respect to the personal-information-containing data you submit through the Service:

- **You are the personal information processor**, bearing full responsibility for the legal basis (notice and consent, contract necessity, etc.);
- **We are the entrusted processor**, processing data only upon your instructions and not using it for purposes beyond this Agreement.

Enterprise users may separately execute a Data Processing Agreement (DPA) with us, specifying the processing purpose, period, method, security measures and audit rights.

**8.3 Data Retention Policy**

| Data Type | Default Retention | Purpose |
|---|---|---|
| Request/response body content | **Not retained by default** (enterprise users may separately agree to disable logs) | Real-time forwarding only |
| Request metadata (time, model, Token count, status code, latency) | 12 months | Billing, reconciliation, security audit |
| Account and verification information | Duration of account + legally required period | Identity recognition, real-name compliance |
| Security audit logs | 6 months | Retention as required by the Cybersecurity Law |

> Note: If you use upstream official-channel models, the body content will inevitably be transmitted to the Upstream Model Provider, whose retention policy is governed by the upstream privacy policy.

**8.4 Cross-Border Data Transfer**

8.4.1 When using overseas model nodes, your input content will be transmitted to overseas upstream services and may be processed and stored overseas.

8.4.2 **Before using such models, you should complete the compliance procedures required for data export on your own** (where applicable, including filing of the standard contract for cross-border personal information transfer, security assessment or certification), and fulfill sufficient notice obligations to your end users in your privacy policy. Your act of selecting an overseas model at the Platform constitutes your explicit instruction for such cross-border transfer.

8.4.3 We recommend and support you in achieving data non-export through "domestic nodes + domestic models"; you may also reduce export risk through server-side data masking, field replacement and other technical means.

**8.5 Security Measures**

We adopt security measures including but not limited to: transport-layer encryption (TLS 1.3), static data encryption, least-privilege access control, key escrow and rotation, intrusion detection, log audit, and employee confidentiality agreements. We conduct regular security assessments and penetration testing.

**8.6 Security Incident Notice**

When a data breach, tampering, loss or other security incident occurs or is likely to occur, we will promptly take remedial measures, report to regulators as required by laws and regulations, and notify you via in-site message or email.

**8.7 Personal Information Protection**

The collection, use, storage, sharing of personal information and the exercise of your rights are detailed in the Privacy Policy. **The Privacy Policy is an inseparable part of this Agreement.**

---

## Article 9 Third-Party Services and Upstream Model Terms

**9.1 Pass-through of Upstream Terms**

9.1.1 **You acknowledge and agree that when you call upstream models through this Service, you must also comply with the usage policies, terms and acceptable use policies of the Upstream Model Providers**, including but not limited to OpenAI Usage Policies, Anthropic Usage Policies, Google Generative AI Prohibited Use Policy, Microsoft Azure Acceptable Use Policy, Amazon AWS Acceptable Use Policy, and the service specifications of various domestic model vendors.

9.1.2 The substance of the above upstream terms is summarized in Article 5 of this Agreement and can be consulted at the links listed in Appendix B. Where the superior terms conflict with this Agreement, for the part concerning upstream model services, **the stricter one shall prevail**.

9.1.3 Your violation of upstream policies also constitutes a breach under this Agreement.

**9.2 Impact of Upstream Policy and Authorization Changes**

9.2.1 Upstream Model Providers may change policies, adjust prices, restrict regions, restrict uses or terminate authorization to us at any time.

9.2.2 **Unavailability of specific models, need to switch to alternative models or restricted service caused by upstream changes does not constitute a breach by us.** We will make reasonable efforts to notify in advance and provide a migration plan.

**9.3 Liability Boundary for Upstream Interruptions**

**Any failure, rate-limiting, ban, content interception, data breach or breach by an Upstream Model Provider is not our fault. We do not bear joint liability for the acts or omissions of upstream parties, but will make reasonable efforts to assist you in communicating with upstream and taking remedial measures.**

**9.4 Resale Authorization Statement**

We declare that our provision of upstream model invocation capability to you is based on lawful authorization arrangements with upstream providers or their authorized distributors. **We do not provide unlimited assurance of the continuing validity of upstream authorization.** If authorization terminates, we will notify you in advance to the extent permitted by regulations and upstream requirements, and assist with migration or refund according to the un-consumed balance.

**9.5 Third-Party Links and Content**

The Platform may contain links to third-party websites or resources. We are not responsible for the accuracy, legality or availability of third-party content.

---

## Article 10 Intellectual Property Rights

**10.1 Platform Intellectual Property**

The intellectual property rights of the software, gateway programs, interface design, documentation, trademarks (including the Chinese and English brand names and graphic logos of **Urouters** and **优特斯**), domain name (urouters.com), technical solutions and algorithm strategies of this Service all belong to us or the respective right holders. Without written permission, you may not copy, modify, disseminate, reverse engineer or use them for any commercial purpose.

**10.2 Trademark Use**

Without prior written consent, you may not use the Chinese or English names, trademarks or logos of "Urouters" or "优特斯" in any promotional materials or product interfaces, or otherwise imply a cooperation, endorsement or affiliation with us.

**10.3 Risk Notice for Generated Content**

10.3.1 Large language model outputs are **probabilistic and non-deterministic**. **We make no express or implied warranty as to the accuracy, completeness, timeliness, applicability or non-infringement of the outputs.**

10.3.2 **Content generated by large models may be similar to prior works of others.** We cannot guarantee that generated content is original or will not infringe third-party intellectual property rights. You should complete rights clearance on your own before commercial use of generated content.

10.3.3 **You may not claim exclusive rights to the output content for the same prompt.**

**10.4 Feedback**

Any product suggestions, defect reports, improvement opinions, etc. you submit to us ("Feedback") are deemed to grant us a perpetual, irrevocable, royalty-free right to use, modify and integrate such Feedback worldwide without paying consideration to you. The Feedback does not contain your confidential information.

---

## Article 11 Disclaimers and Limitation of Liability

**11.1 Service Provided "As Is" and "As Available"**

To the maximum extent permitted by applicable law, we provide this Service on an "AS IS" and "AS AVAILABLE" basis, **making no express or implied warranties**, including but not limited to warranties of merchantability, fitness for a particular purpose, uninterrupted use, error-free operation, virus-free, or accurate results.

**11.2 Non-Professional Advice**

Any content output by this Service does not constitute medical, legal, tax, accounting or investment advice. **You should not use the output as a substitute for professional advice.** Any decisions and consequences arising from reliance on the output are borne by you.

**11.3 Exclusion of Damages**

To the maximum extent permitted by applicable law, **we are not liable for any of the following losses**: loss of profit, loss of revenue, loss of goodwill, loss of data, loss of anticipated savings, business interruption, cost of procuring substitute services, and any indirect, incidental, special, punitive or consequential loss — **whether or not such loss was foreseeable, and whether or not we were advised of the possibility of such loss**.

**11.4 Cap on Aggregate Liability**

**To the maximum extent permitted by applicable law, our aggregate liability to you for all claims under or relating to this Agreement shall not exceed the total service fees actually paid by you and not refunded in the 12 months preceding the event giving rise to the claim.**

**11.5 Exceptions**

The limitations in Articles 11.3 and 11.4 do not apply to the following: personal injury or property damage caused by our intentional misconduct or gross negligence; our infringement of your intellectual property rights; liabilities that mandatory law prohibits limiting or excluding.

**11.6 Force Majeure**

Where service interruption or non-performance is caused by force majeure (including natural disasters, war, epidemic, government acts, regulatory directives, large-scale cyber attacks, global outage of an Upstream Model Provider, Internet infrastructure failures, etc.), we are exempted to the extent of the facts, but will make reasonable efforts to reduce the impact and notify you.

**11.7 User Indemnification Obligation**

**If, due to your violation of this Agreement, violation of laws and regulations, or infringement of third-party rights, we are claimed by a third party, punished by a regulator, held liable by an Upstream Model Provider or suffer other losses, you shall fully indemnify us for all such losses (including but not limited to compensation, fines, attorney fees, litigation/arbitration fees, notarization fees and reasonable investigation costs), and shall actively cooperate with our defense.**

---

## Article 12 Changes, Suspension and Termination of Service

**12.1 Your Right to Terminate**

You may stop using this Service and apply to cancel your account at any time. After termination, you should settle fees, handle the balance and back up data as agreed in Article 6.

**12.2 Our Right to Suspend and Terminate**

12.2.1 We have the right to **immediately suspend or terminate** the Service to you without bearing breach liability under any of the following circumstances:

1. You violate Article 5 (Usage Rules and Prohibited Conduct) or Article 14 (Export Control and Sanctions) of this Agreement;
2. You fail to pass or maintain identity verification;
3. You fail to pay fees beyond the agreed period;
4. Your usage behavior exposes the Platform to regulatory risk, upstream ban risk or major security risk;
5. You enter bankruptcy, liquidation, dissolution proceedings, or lose performance capacity;
6. Laws and regulations, regulators or Upstream Model Providers require us to stop providing Service to you.

12.2.2 For items 1, 4 and 6 of Article 12.2.1, we may simultaneously **freeze the account balance** until the relevant risk or dispute is resolved.

**12.3 Consequences of Termination**

After termination: your API Key becomes invalid immediately; the un-consumed balance is handled as agreed in Article 6; we delete or anonymize your data as required by Article 8 and laws and regulations; Articles 8, 10, 11, 13, 14, 15, 17 and other provisions that should continue to be effective by their nature continue to be effective.

**12.4 Our Right to Early Termination**

For services with no fixed term agreed, we may terminate this Agreement with **30 calendar days'** advance notice. In this case, we will refund the full un-consumed balance (excluding consumed portions).

---

## Article 13 Breach and Handling

**13.1 Gradient of Handling Measures**

We will adopt handling measures in proportion to the breach and give rectification opportunities where possible:

| Severity | Typical Scenario | Handling Measure |
|---|---|---|
| General breach | First minor rate excess, information not updated in time | In-site reminder, rectification within time limit |
| Serious breach | Repeated rate excess, minor content violation, late payment | Rate-limiting, service suspension, quota freeze |
| Severe breach | Reselling API Keys, malicious quota scraping, bypassing risk control, major content violation | Immediate service termination, account freeze, liability pursuit |
| Suspected illegality | Minor sexual exploitation, fraud, terrorism, sanction violation | Immediate termination, evidence preservation, report to competent authority |

**13.2 Investigation and Defense**

13.2.1 Before making a major handling decision, we will (where the circumstances permit and do not affect the investigation) inform you of the reason via in-site message or email and give you a **5 business day** defense period.

13.2.2 Where it concerns public safety, minor protection, sanction compliance or explicit regulatory requirements, we have the right to **execute first and inform later**.

**13.3 Appeal Channel**

If you disagree with the handling result, you may submit an appeal to support@urouters.com. We will respond within **10 business days**. The appeal does not affect the execution of the handling measure.

---

## Article 14 Export Control, Sanctions and Cross-Border Compliance

**14.1 Your Representations and Warranties**

You represent, warrant and undertake that:

1. You and your affiliates, actual controllers and ultimate beneficial owners **are not** subjects sanctioned or restricted by any competent authority such as the United Nations, the PRC, the United States (OFAC SDN List) or the European Union;
2. You are not located in, established in, or actually operating from a comprehensively sanctioned country or region;
3. You will not use the output or capability of this Service for **weapons development, military use, nuclear/biological/chemical proliferation, missile technology** or other export-controlled uses;
4. You will not, directly or indirectly through this Service, transship, resell or transfer any controlled technology, data or service to sanctioned subjects or sanctioned regions.

**14.2 Compliance Review Rights**

We have the right (but no obligation) to conduct compliance screening of users' registration location, billing address, payment source and calling characteristics. Upon discovering suspected violations, we may suspend the Service, require compliance explanations or supplementary materials.

**14.3 Cooperation Obligations**

You shall cooperate with us and the Upstream Model Providers in compliance investigations and provide the required evidence within **5 business days**. Refusal to cooperate entitles us to terminate the Service.

**14.4 Special Notice**

**The export control and sanctions lists are dynamically changing. You should continuously verify your own compliance status during your use of this Service. Even if we have not conducted screening or screening found no issues, it does not relieve you of your obligations and liabilities under Article 14.1.**

---

## Article 15 Governing Law and Dispute Resolution

**15.1 Governing Law**

15.1.1 The formation, validity, interpretation, performance and dispute resolution of this Agreement are governed by the **laws of the People's Republic of China** (excluding conflict-of-laws rules).

15.1.2 For the model services under this Agreement, the legal relationship between us and the Upstream Model Providers is governed by the laws of the corresponding jurisdiction; such arrangement does not affect the application of the laws of the PRC to this Agreement.

15.1.3 Where the laws of the PRC contain mandatory provisions on specific matters (such as personal information protection, management of generative AI services), such provisions prevail.

**15.2 Dispute Resolution**

15.2.1 Any dispute arising from or relating to this Agreement shall first be resolved through friendly negotiation between the parties.

15.2.2 If negotiation fails, either party may file a lawsuit with the **people's court with jurisdiction over the domicile of Shenzhen Urouters Intelligent Co., Ltd. (Shenzhen)**; the court of first instance is the people's court of the district where it is registered; where the subject matter exceeds the first-instance jurisdictional standard of the basic people's court, the Shenzhen Intermediate People's Court has jurisdiction.

15.2.3 During dispute resolution, except for the dispute itself, both parties shall continue to perform the other provisions of this Agreement.

**15.3 Language Version**

This Agreement is governed by the **Chinese version**. We may provide English or other language translations for reference only; in the event of any conflict between the translation and the Chinese version, **the Chinese version shall prevail**.

**15.4 Severability**

If any provision of this Agreement is deemed invalid or unenforceable, it shall not affect the validity of the other provisions. The parties shall replace it with a valid provision closest to the original commercial purpose.

---

## Article 16 Notices and Service of Documents

16.1 Notices we send to you may be served by any of the following means, deemed served upon dispatch: in-site message (served upon sending), registered email (deemed served 24 hours after sending), console announcement (served upon publication), SMS (deemed served upon sending).

16.2 **You are obligated to keep your registered email and mobile number valid and check notices promptly.** Consequences arising from your failure to check notices in time are borne by you.

16.3 Notices you send to us should be sent to:

- Service and technical support: tech@urouters.com
- Legal and compliance matters: legal@urouters.com
- Business and contract matters: bd@urouters.com
- Abuse reporting: abuse@urouters.com

16.4 For notices concerning service termination, account freezing or material clause changes, we will use two or more means of service simultaneously.

---

## Article 17 Miscellaneous

17.1 **Entire Agreement**: This Agreement (including all appendices and incorporated documents) constitutes the entire agreement between the parties regarding this Service, superseding all prior oral or written communications and representations.

17.2 **Assignment**: Without our prior written consent, you may not assign your rights and obligations under this Agreement. We may assign this Agreement to an affiliate in the event of merger, reorganization, asset sale or affiliate adjustment, with prior notice to you.

17.3 **No Waiver**: Our failure or delay in exercising any right under this Agreement does not constitute a waiver of that right.

17.4 **Independent Parties**: The parties are independent contracting parties; this Agreement does not constitute any agency, partnership, joint venture or employment relationship.

17.5 **Headings**: The headings of the articles are for ease of reading only and do not affect the interpretation of the articles.

17.6 **Survival**: After termination of this Agreement, provisions that should continue to be effective by their nature (such as intellectual property, confidentiality, limitation of liability, dispute resolution) continue to be effective.

---

## Appendix A Core Prohibited List of the Acceptable Use Policy (AUP)

The following are absolutely prohibited uses, which upon discovery will result in **immediate service termination, no appeal, and reporting to the competent authority in accordance with law**:

| No. | Prohibited Use |
|---|---|
| 1 | Any generation or dissemination of content involving the sexual exploitation or sexualization of minors |
| 2 | Generation, acquisition or dissemination of Child Sexual Abuse Material (CSAM) |
| 3 | Assisting in terrorist activities or violent extremism |
| 4 | Operational guidance for manufacturing weapons, explosives, hazardous chemicals or biological agents |
| 5 | Conducting telecom network fraud, phishing attacks, malware writing and dissemination |
| 6 | Money laundering, terrorist financing, sanction evasion |
| 7 | Unauthorized facial recognition, biometric collection and identity impersonation |
| 8 | Large-scale generation of false information, automated manipulation of public opinion or traffic inflation |
| 9 | Generation of non-consensual deepfake content for deceptive purposes |
| 10 | Any use violating the acceptable use policies of Upstream Model Providers |

---

## Appendix B List of Upstream Model Providers and Sub-processors

| Provider | Cloud Platform / Channel | Typical Models | Policy Link |
|---|---|---|---|
| OpenAI | Azure OpenAI Service | GPT series | openai.com/policies/usage-policies |
| Anthropic | Amazon Bedrock / Official API | Claude series | anthropic.com/legal/aup |
| Google | Vertex AI | Gemini series | policies.google.com/terms/generative-ai/use-policy |
| xAI | Official API | Grok series | x.ai/legal |
| Mistral AI | Official API | Mistral series | mistral.ai/terms |
| Domestic Vendors | Official API | Tongyi / Doubao / Hunyuan / DeepSeek / Zhipu / Kimi, etc. | Each vendor's official publication |

> We may add, replace or remove Upstream Providers. Changes to the list will be published on the Platform; material changes will be notified separately.
