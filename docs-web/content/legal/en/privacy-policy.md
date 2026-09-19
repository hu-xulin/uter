# URouters Large Model Service Platform Privacy Policy

| Item | Content |
|---|---|
| Service Brand | **Urouters 优特斯** |
| Platform Name | **URouters Large Model Service Platform** |
| Official Website | https://urouters.com |
| Document Name | URouters Large Model Service Platform Privacy Policy |
| Version | V1.0 |
| Effective Date | August 8, 2026 |
| Last Updated | August 8, 2026 |
| Personal Information Processor | **Shenzhen Urouters Intelligent Co., Ltd.** |
| Registered Address | Shenzhen, Guangdong Province, the People's Republic of China |
| Personal Information Protection Officer Email | privacy@urouters.com |
| Customer Service Email | support@urouters.com |

> **This Policy, together with the URouters Large Model Service Platform Terms of Service, constitutes the complete agreement between you and Shenzhen Urouters Intelligent Co., Ltd.** This Policy is a part of that Agreement; its rules on the processing of personal information supplement Article 8 (Data, Content and Personal Information Protection) of the Terms of Service; in the event of any inconsistency with respect to the processing of personal information, **this Policy shall prevail.**

---

## Summary

To help you understand quickly, we first summarize the core of this Policy in one paragraph. **The Summary does not replace the main text; the complete rights and obligations are governed by the main text.**

| What you care about most | Our answer |
|---|---|
| What personal information do you collect? | We collect only the account information, identity verification information, payment information and call logs necessary to provide the Service — 4 categories in total. **We do not collect your contacts, photo album, location, microphone or other information unrelated to our business.** |
| Do you keep the prompt content I send to the models? | **By default, we do not retain the body content of requests and responses.** We only record the metadata used for billing and security audit (time, model identifier, Token count, status code, latency). |
| Will you use my data to train models? | **No.** We do not train large models ourselves, nor do we use your request content for any model training, fine-tuning or improvement purposes. |
| Will my data go overseas? | Only when **you actively choose to call overseas model nodes** will the request content be transmitted to overseas upstream services in real time, and it is not retained domestically. See Chapter 4; such transfer is actively instructed and initiated by you. |
| What if my end users submit personal information to my application? | **You are the processor, and we are the entrusted processor.** We process only upon your instructions and not for our own purposes. See Chapter 2. |
| How do I delete my data? | You may delete it yourself in the console; or email privacy@urouters.com, and we will respond within **15 business days**. |

---

## Table of Contents

1. Introduction and Scope
2. Key Concepts and Role Definitions
3. How We Collect and Use Personal Information
4. How We Entrust Processing, Share, Transfer and Publicly Disclose
5. Cross-Border Data Transfer
6. How We Store and Protect Personal Information
7. Your Rights Regarding Personal Information
8. Cookies and Similar Technologies
9. Protection of Minors
10. Special Notes on Generative AI Services
11. Updates to this Policy
12. How to Contact Us
13. Definitions

---

## Chapter 1 Introduction and Scope

**1.1 Who We Are**

The URouters Large Model Service Platform (hereinafter the "Platform") is operated by **Shenzhen Urouters Intelligent Co., Ltd.** (hereinafter "we" or "优特斯"). Registered in Shenzhen, Guangdong Province, the People's Republic of China, we are the **personal information processor** of the personal information collected by this Platform.

**1.2 Scope of this Policy**

1.2.1 This Policy applies to our processing of your personal information when you use the Platform's services through the official website urouters.com, the console, developer documentation, SDK and API interfaces.

1.2.2 **This Policy does not apply to the following circumstances**:

1. **The upstream model services you call through this Platform**: the privacy rules of upstream model providers for their own processing activities are independently formulated and published by them, which we cannot control and for which we bear no responsibility;
2. **Third-party websites or services linked from outside this Platform**;
3. **Where you, as a developer or enterprise customer, provide services to your end users through this Platform — your own processing of your end users' personal information** — in such activities you are the processor; see Chapter 2.

**1.3 Our Basic Commitments**

We commit to the principles of lawfulness, legitimacy, necessity and good faith, collecting personal information in a **minimum necessary** manner; not using personal information unrelated to the Service for any purpose; not using your personal information for **model training**; and not selling your personal information to any third party.

---

## Chapter 2 Key Concepts and Role Definitions

> This Chapter is the core of this Policy. As **a large-model API service platform for developers and enterprise customers**, the business chain involves two layers: "you" and "your end users". Accurately understanding each party's legal role is the premise for determining rights and obligations.

**2.1 Two-Layer Data Relationship**

```
Your end user --(submits information to your app)--> Your app --(calls Platform API)--> Platform --> Upstream Model Provider
       ↑                                                                  ↑
   【You】 as processor                                           【You】 as processor, 【we】 as entrusted processor
```

**2.2 Our Two Roles**

| Scenario | Data Involved | Your Role | Our Role | Applicable Rules |
|---|---|---|---|---|
| **Scenario A: You register, verify, top up and log in to the Platform** | Your phone number, email, ID/business license information, payment information, login logs | Individual | **Personal Information Processor** | Chapters 3–7 of this Policy in full |
| **Scenario B: You submit request content through the API that contains personal information** | Prompts, uploaded files, model-returned content | **Personal Information Processor** | **Entrusted Processor** | We process only upon your instructions, not for our own purposes; applies Article 2.3 of this Policy |

**2.3 Special Provisions as Entrusted Processor**

2.3.1 In Scenario B:

1. **You should obtain lawful authorization from your end users on your own** (notice and consent or other legitimate basis), and fulfill sufficient notice obligations in your own privacy policy;
2. We process data according to your instructions; the purpose, method and period of processing are determined by your calling behavior;
3. **We do not use such data for any purpose other than Scenario A in Article 2.2**, including but not limited to commercial exploitation, model training, user profiling, and data resale;
4. In the event of a security incident, we will promptly notify you, and you will fulfill the notification and reporting obligations to your end users and regulators;
5. You may separately execute a Data Processing Agreement (DPA) with us, specifying processing details and audit arrangements.

2.3.2 **We recommend and support you to desensitize personal information before submission.** If the data you submit involves sensitive personal information (such as biometrics, medical and health, financial accounts, whereabouts, or personal information of minors under the age of 14), you should ensure that you have obtained **separate consent** and completed a personal information protection impact assessment.

2.3.3 Except as otherwise provided by law, we **will not actively access** your request content. Only under the following circumstances may we view it within the minimum necessary scope: for troubleshooting technical faults with your authorization; upon lawful requests from regulators or judicial authorities; upon discovering content suspected of serious illegality or endangering public safety.

---

## Chapter 3 How We Collect and Use Personal Information

**3.1 List of Personal Information We Collect**

We collect only the following 4 categories of personal information directly related to the Service:

| Category | Specific Fields | Required | Collection Scenario |
|---|---|---|---|
| **① Account Information** | Mobile phone number, email, account password (encrypted storage), nickname/enterprise name | Required | Registration, login |
| **② Identity Verification Information** | Natural person: name, ID number (verified by a third-party identity verification institution); Enterprise: enterprise name, unified social credit code, legal representative name, business license image | Required | Fulfilling real-name obligation under the Cybersecurity Law and the Interim Measures for the Management of Generative AI Services |
| **③ Payment and Invoicing Information** | Top-up order number, payment channel, transaction amount, invoicing entity and tax number | Required | Top-up, invoicing |
| **④ Logs and Metadata** | IP address, device identifier (User-Agent), access time, model identifier, input/output Token count, request status code, response latency, API Key identifier | Required | Providing service, billing, security audit |

**3.2 Information We Will Not Collect**

**We will not collect or request the following permissions or information:** contacts, call records, SMS content, photo album and images (except those you actively upload), precise geographic location, microphone and camera, clipboard content, or the installation list of other applications on your device.

**3.3 Processing Purpose and Legal Basis**

| Processing Activity | Processing Purpose | Legal Basis (PIPL) |
|---|---|---|
| Account registration and login | Establish and maintain the service relationship | Article 13(1)(ii): necessary for concluding and performing a contract |
| Identity verification | Fulfilling statutory obligations | Article 13(1)(iii): necessary to perform statutory duties or obligations |
| Billing and invoicing | Settling service fees, fulfilling tax obligations | Same as above |
| Metering and call logs | Billing reconciliation, fault troubleshooting, service quality improvement | Article 13(1)(ii) |
| Security risk control and anti-fraud | Identifying malicious calls, resale, account theft, risk-control bypass, etc. | Article 13(1)(ii); where automated decision-making is involved, Article 24 applies |
| Service notices and agreement change notifications | Fulfilling notification obligations | Article 13(1)(ii)(iii) |
| Marketing pushes (**not required**) | Product updates, promotional activities | Requires your **separate consent**; you may unsubscribe at any time |

**3.4 About Identity Verification**

3.4.1 Pursuant to Article 24 of the Cybersecurity Law of the PRC, the Administrative Measures for Internet Information Services and the Interim Measures for the Management of Generative AI Services, you must complete identity verification before calling this Service.

3.4.2 Identity verification is completed by a qualified third-party verification institution. **We retain only the verification result and desensitized identifier after passing verification, and do not retain the complete document image** (except as otherwise provided by law).

3.4.3 If identity verification is not completed, we cannot activate the Service for you; the un-consumed top-up balance may then be refunded under Article 6 of the Terms of Service.

**3.5 Circumstances Where Consent Is Not Required**

Pursuant to Article 13 of the Personal Information Protection Law (PIPL), we may process your personal information without your consent under the following circumstances: necessary for concluding or performing a contract to which you are a party; necessary to perform statutory duties or obligations; necessary to respond to public health emergencies or to protect the life, health and property safety of natural persons in emergencies; processing within a reasonable scope for news reporting or public supervision in the public interest; processing your personal information that you have voluntarily made public or that is otherwise lawfully public within a reasonable scope as prescribed by law; and other circumstances prescribed by laws and administrative regulations.

**3.6 Explanation of Automated Decision-Making**

3.6.1 We use an automated risk-control system to identify abnormal calling behavior (such as API Key resale, malicious traffic inflation, region-restriction bypass). Such automated decisions are **used only for service security and compliance purposes and will not be used for credit evaluation of you or differentiated pricing**.

3.6.2 Pursuant to Article 24 of the PIPL, if such automated decision-making has a significant impact on your rights and interests (such as restricting or terminating the Service), **you have the right to request an explanation from us and to refuse a decision made solely by automated means**. You may do so via privacy@urouters.com.

---

## Chapter 4 How We Entrust Processing, Share, Transfer and Publicly Disclose

**4.1 Entrusted Processing**

To provide you with the Service, we may entrust the following types of partners to process your personal information:

| Type of Entrusted Party | Processing Purpose | Information Types Involved |
|---|---|---|
| Cloud infrastructure provider (domestic) | Server hosting, data storage, network transmission | All four categories |
| Identity verification institution | Identity/enterprise information verification | ② Identity verification information |
| Third-party payment institution | Payment settlement | ③ Payment and invoicing information |
| Electronic invoice service provider | Invoice issuance | ③ Payment and invoicing information |
| SMS/email service provider | Sending verification codes and service notices | ① Account information |
| Security risk-control service provider | Anti-fraud and anomaly identification | ④ Logs and metadata |
| **Upstream Model Provider** | **Model inference** | **Your request content (only when you initiate a call)** |

We have or will require the above entrusted parties by written agreement to comply with the same personal information protection standards, sign confidentiality agreements, not process beyond the entrusted purpose, and delete or return data upon termination of the entrustment relationship.

**4.2 Special Notes on Upstream Model Providers**

4.2.1 Upstream Model Providers are a necessary link in the Platform's service chain. **When you initiate an API call, the request content is transmitted to the corresponding Upstream Model Provider to complete inference.**

4.2.2 Regarding the processing of such data by upstream model providers:

- **Some** upstream providers act as our entrusted parties in this link, bound by the agreement between us and them;
- **Some** upstream providers may act as **independent personal information processors**, whose processing activities are governed by their own published privacy policies and API terms of use. We have made reasonable efforts to select providers with higher data-processing standards, but **cannot control their specific processing behavior**.

4.2.3 **If you are unwilling to bear the above risks, please select the Platform's domestic model nodes, or desensitize the request content before use.**

**4.3 Sharing**

Except under the following circumstances, we **will not share your personal information with any third party**:

1. We have obtained your **separate consent**;
2. As required by laws and regulations or compulsory requirements of regulators or judicial authorities (we will notify you to the extent permitted by law);
3. Necessary to protect public interests or the major legitimate rights and interests of you or other individuals, where it is difficult to obtain your consent;
4. Necessary to perform the contract between you and us (such as transmitting request content to upstream providers).

**4.4 Transfer**

We will not transfer your personal information to any third party. If a merger, division, dissolution, acquisition or asset transfer occurs, we will inform you of the name and contact information of the recipient, and require the recipient to continue to perform the obligations under this Policy; if the recipient changes the original processing purpose or method, we will re-obtain your consent.

**4.5 Public Disclosure**

We will not publicly disclose your personal information. Where disclosure is legally required, we will take security protection measures and inform you of the purpose, type and possible scope of the disclosure.

**4.6 Exceptions**

Pursuant to Article 13 of the PIPL and related provisions, we do not need to separately obtain your consent under the following circumstances: directly related to national security or national defense security; directly related to public security, public health or major public interests; directly related to the investigation, prosecution, trial and execution of judgments of crimes; necessary to protect the major legitimate rights and interests of you or other individuals where it is difficult to obtain consent; your personal information voluntarily made public to the public; personal information collected from lawfully publicly disclosed information; and other circumstances prescribed by laws and regulations.

---

## Chapter 5 Cross-Border Data Transfer

**5.1 Trigger Condition**

The Platform defaults to domestic nodes and domestic models, **with data not leaving the country**.

**Only when you actively choose to call overseas model nodes** will your request content be transmitted to overseas Upstream Model Providers and may be processed and stored overseas.

**5.2 Our Processing Principles**

5.2.1 Such transfer is **actively selected and initiated by you**. Your act of selecting an overseas model in the console constitutes your explicit instruction for cross-border data transfer.

5.2.2 We **do not retain your request and response body content domestically**; the outbound transfer is real-time forwarding and does not constitute incremental storage of domestic data (only the necessary metadata for billing and audit is retained, and such metadata is stored within the territory of China).

5.2.3 **Pursuant to Section 3 of Chapter 3 of the PIPL and the Measures for the Security Assessment of Data Outbound Transfer, you should complete the required cross-border data compliance procedures before submitting request content containing personal information to this Platform**, including but not limited to: execution and filing of the standard contract for cross-border personal information transfer, personal information protection certification, or security assessment filing (where the filing threshold is met).

5.2.4 We recommend and support you in reducing outbound risk through the following means: selecting domestic models; implementing data desensitization, field replacement and pseudonymization on the client; and avoiding outbound transfer of sensitive personal information altogether.

**5.3 Exceptions to Cross-Border Transfer**

Data involving critical information infrastructure operators, important data, or data prohibited from outbound transfer by laws and regulations **must not be processed through the Platform's overseas nodes**. You bear the consequences of violating this provision.

---

## Chapter 6 How We Store and Protect Personal Information

**6.1 Storage Location**

Your personal information is stored on servers **within the territory of the People's Republic of China** (located in domestic data centers). Except as stated in Article 5.1, we do not transmit your personal information overseas.

**6.2 Storage Period**

We follow the principle of **minimum necessary period**, as follows:

| Information Type | Storage Period | Basis |
|---|---|---|
| Request and response **body content** | **Not retained by default** (released upon real-time forwarding) | Minimum necessary principle |
| Call metadata (time, model, Token count, status code, latency) | **12 months** | Billing reconciliation and audit needs |
| Account and identity verification information | During the existence of the account, deleted or anonymized within **6 months** after account cancellation | Service relationship and regulatory verification needs |
| Payment and invoicing records | Pursuant to the E-Commerce Law and the Measures for the Administration of Accounting Archives, **no less than 3 years** from completion of the transaction | Statutory obligation |
| Network security logs | **No less than 6 months** | Article 21 of the Cybersecurity Law |
| Security incident handling records | **3 years** | Compliance traceability needs |

**Beyond the above periods, we will delete or anonymize the data and not use it for any purpose.**

**6.3 Security Protection Measures**

We adopt security measures that meet industry standards to protect your personal information:

| Layer | Measures |
|---|---|
| Transmission security | Site-wide HTTPS / TLS 1.3 encryption; mandatory key authentication for APIs |
| Storage security | Sensitive fields (ID numbers, passwords) encrypted at storage; least-privilege database access |
| Access control | Tiered employee authorization, operation audit trail; API Key supports IP allowlist and rotation |
| Security audit | Regular vulnerability scanning, penetration testing, log audit |
| Organizational management | Employee confidentiality agreements, specialized training for data-processing positions, immediate recovery of permissions upon departure |
| Compliance assessment | Personal information protection impact assessment (PIA) pursuant to Article 55 of the PIPL |

**6.4 Handling of Security Incidents**

Where a personal information leak, tampering or loss occurs or is likely to occur, we will:

1. Immediately activate the emergency plan and take remedial measures;
2. Report to the department performing personal information protection duties pursuant to Article 57 of the PIPL;
3. Promptly inform you by in-site message, email or SMS: the basic facts of the incident, possible impact, remedial measures we have taken, suggestions for you to prevent risks on your own, and our contact information;
4. Where it is difficult to notify each individual, publish an announcement by reasonable and effective means.

**6.5 Inherent Risk Tip on Information Security**

The Internet environment is not absolutely secure. **Please use account passwords of sufficient complexity, keep your API Key safe, and do not hard-code keys on the client.** If information leakage is caused by your own poor safekeeping, we bear no responsibility for the resulting consequences.

---

## Chapter 7 Your Rights Regarding Personal Information

Pursuant to Chapter 4 of the PIPL, you enjoy the following rights regarding your own personal information. We will respond within **15 business days** of receiving your request and verifying your identity (where the situation is complex, it may be extended to 30 business days with notice to you).

| Right | How to Exercise | Notes |
|---|---|---|
| **Access and Copy** | Self-service view in console "Account Settings → Personal Information"; or email request | We will provide a copy in a structured, common format |
| **Correct and Supplement** | Self-service modification in console; identity reverification required for real-name information | We will correct promptly after verification |
| **Delete** | Self-service deletion in console; or email request | Applies to Article 47 of the PIPL: processing purpose achieved or no longer necessary; we stop service or storage period expires; you withdraw consent; we process unlawfully; other circumstances prescribed by laws and regulations |
| **Withdraw Consent** | Console "Privacy Settings"; or email request | Withdrawal does not affect the validity of processing activities already conducted based on consent before withdrawal |
| **Cancel Account** | Self-service cancellation in console | Settle fees and back up data before cancellation; account is unrecoverable after cancellation |
| **Portability** | Email request | Where conditions prescribed by the national cyberspace authority are met, we provide a portability channel |
| **Restrict or Refuse Processing** | Email request | E.g., refuse a decision made solely by automated means that has a major impact on you |
| **Explanation** | Email request | You have the right to request an explanation of this Policy and the personal information processing rules |
| **Complaint and Report** | privacy@urouters.com | We will respond within 15 business days |

**7.1 Request Acceptance Channel**

- Email: privacy@urouters.com
- Console: Account Settings → Privacy and Data → Exercise of Rights
- We may need you to provide necessary information to verify your identity; **verification is used only for identity confirmation and will not additionally expand the scope of information collection**.

**7.2 Circumstances Where We May Decline to Respond**

We may be unable to respond to your request and will explain the reason under the following circumstances: related to our performance of obligations prescribed by laws and regulations; directly related to national security or national defense security; directly related to public security, public health or major public interests; directly related to the investigation, prosecution, trial and execution of judgments of crimes; sufficient evidence that you are acting in bad faith or abusing rights; response would cause serious harm to the legitimate rights and interests of you or other individuals or organizations; involves trade secrets.

**7.3 External Remedies**

If you believe our processing activities infringe your legitimate rights and interests, and negotiation with us fails, you have the right to complain or report to the **department performing personal information protection duties**. You may:

- Report to the **National Cyber and Information Security Notification Center** or the **12377 Illegal and Bad Information Reporting Center**;
- Complain to the **Shenzhen Office of Cyberspace Administration** or the **Shenzhen Communications Administration**;
- File a lawsuit with the **people's court with jurisdiction**.

---

## Chapter 8 Cookies and Similar Technologies

8.1 We use Cookie and local storage (LocalStorage) technologies to implement the following necessary functions: maintaining login status, recording language and interface preferences, and preventing cross-site request forgery (CSRF).

8.2 This Platform **does not use** Cookies for cross-site advertising tracking or personalized advertising delivery.

8.3 You may manage or delete Cookies through browser settings. **Disabling necessary Cookies may prevent you from logging in normally or using console functions.**

---

## Chapter 9 Protection of Minors

9.1 This Platform **does not provide services to minors**. Pursuant to Article 1.5 of the URouters Large Model Service Platform Terms of Service, users should be at least **18 years of age** and have full capacity for civil conduct.

9.2 We will not actively collect minors' personal information, nor require minors to provide any personal information. If you are a minor, please do not register for or use this Platform's services.

9.3 Pursuant to Article 31 of the PIPL, **the personal information of minors under the age of 14 is sensitive personal information**. If we discover that we have mistakenly collected a minor's personal information, we will delete it immediately; guardians are welcome to contact us via privacy@urouters.com.

9.4 **Note for users who are developers**: If the application you develop based on this Platform is directed at minors or may be used by minors, **you should obtain the separate consent of their guardians on your own**, and design dedicated information processing rules and content security measures for minors. This obligation is borne by you; this Platform does not intervene in the legal relationship between you and your end users.

---

## Chapter 10 Special Notes on Generative AI Services

**10.1 We Do Not Train Models**

10.1.1 We ourselves **do not develop or train large models**. The role of this Platform is the aggregator and forwarder of model capability.

10.1.2 **We will not use your request content to train or fine-tune any model**, nor use it to improve model performance, build training datasets or perform data annotation.

10.1.3 Whether an Upstream Model Provider uses your data to train its models **depends on that upstream's own policy and your contractual arrangements**. We recommend that you consult the corresponding upstream's privacy policy; for providers that explicitly commit not to use customer data for training, we will mark them in the model catalog.

**10.2 Labeling Obligations for Generated Content**

10.2.1 Pursuant to Article 12 of the Interim Measures for the Management of Generative AI Services and Article 17 of the Provisions on the Administration of Deep Synthesis of Internet Information Services, **as the service provider providing generative AI services to end users, you should add explicit labels to generated content as required by law, or add implicit labels in file metadata.**

10.2.2 We may provide technical support for labeling capability, but **do not replace you in fulfilling the statutory labeling obligation**.

**10.3 Content Security**

10.3.1 We may deploy content security review capability on the server side to intercept obviously illegal inputs and outputs. Such review is based on **the content itself** and does not target your personal identity.

10.3.2 If you use this Platform's generative capability in scenarios with **public opinion attributes or social mobilization capacity** as defined by the Provisions on the Administration of Algorithm Recommendation for Internet Information Services and the Interim Measures for the Management of Generative AI Services, you should fulfill the **algorithm filing** and **security assessment** obligations pursuant to law.

**10.4 Risks of Output Content**

The output of large language models is probabilistic and non-deterministic, and **may contain factual errors, bias or inappropriate content**. Please do not use the output as the sole basis for professional decisions such as medical, legal or financial investment.

---

## Chapter 11 Updates to this Policy

11.1 We may update this Policy based on changes in laws and regulations, business adjustments or technology upgrades. The updated Policy will be prominently published on the Platform with the update date marked.

11.2 For the following **material changes**, we will **prominently notify you** by in-site message, email or pop-up, and re-obtain your consent where necessary:

1. The purpose, type or method of processing personal information changes materially;
2. The main objects of sharing, transfer or public disclosure of personal information change;
3. Your rights regarding the processing of personal information and how to exercise them change materially;
4. The purpose, recipient or type of cross-border data transfer changes;
5. The personal information security impact assessment indicates a high risk.

11.3 Upon expiry of the publication period, your continued use of this Service is deemed as acceptance of the updated Policy; if you do not accept it, you may stop using it and cancel your account.

**Version History**

| Version | Effective Date | Revision Notes |
|---|---|---|
| V1.0 | August 8, 2026 | First release |

---

## Chapter 12 How to Contact Us

| Matter | Contact |
|---|---|
| Personal Information Protection Officer | privacy@urouters.com |
| Exercise of Personal Information Rights and Complaints | privacy@urouters.com |
| Service and Technical Support | tech@urouters.com |
| Abuse and Violation Reporting | abuse@urouters.com |
| Business and Contracts | bd@urouters.com |
| Mailing Address | T2, Ali Center, Nanshan District, Shenzhen, Guangdong Province, the People's Republic of China |

We will respond within **15 business days** of receiving your question or complaint.

---

## Chapter 13 Definitions

| Term | Meaning |
|---|---|
| **Personal Information** | Various kinds of information recorded electronically or otherwise relating to identified or identifiable natural persons, excluding information that has been anonymized |
| **Sensitive Personal Information** | Personal information that, once leaked or illegally used, is likely to cause damage to the dignity of a natural person or endanger personal or property safety, including biometrics, religious beliefs, specific identity, medical and health, financial accounts, whereabouts and other information, as well as the personal information of minors under the age of 14 |
| **Personal Information Processor** | An organization or individual that independently determines the purpose and method of processing personal information |
| **Entrusted Processor** | An organization or individual that accepts entrustment from a personal information processor and processes personal information according to its instructions |
| **De-identification** | The process by which personal information is processed so that a specific natural person cannot be identified without the aid of additional information |
| **Anonymization** | The process by which personal information is processed such that a specific natural person cannot be identified and cannot be restored |
| **Automated Decision-Making** | Activities that use computer programs to automatically analyze and evaluate an individual's behavioral habits, interests, hobbies or economic, health or credit status, and make decisions |
| **Cross-Border Data Transfer** | Transmitting or storing personal information collected and generated during operations within the territory of China to a location outside China, or allowing overseas institutions, organizations or individuals to access or retrieve such information |
| **Upstream Model Provider** | A third party that actually provides large-model inference capability, including but not limited to OpenAI, Anthropic, Google, Alibaba Cloud, ByteDance, Tencent, DeepSeek, Zhipu, etc. |
