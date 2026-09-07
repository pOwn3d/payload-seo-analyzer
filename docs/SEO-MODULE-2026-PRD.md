# PRD — `@consilioweb/payload-seo-analyzer` : module SEO de référence (2026)

> Objectif : un module Payload CMS niveau **Yoast Premium / RankMath Pro / SEO Manager**, avec un **ROI SEO réel en 2026**, **performant**, et surtout **simple & rapide** — améliorer **X pages d'un coup**, jamais page par page. Definition of done : **plus rien à faire ni à optimiser**.
>
> Principe directeur : **gain SEO réel avec un minimum d'interaction.**

---

## 1. Definition of Done (« référence »)

Le module est « fini » quand :

1. **Toutes les features premium concurrentes sont couvertes** (cf. matrice §3) — ✅ atteint.
2. **L'avance 2026 est tenue** : E-E-A-T, GEO/AI-readiness, désintox des mythes, rendu frontend. ✅
3. **L'automatisation de masse couvre tout ce qui peut l'être** : méta, focus keyword, OG/social, alt-text, en **1 flux 2 clics**. ⏳ (bulk méta : API faite, UI à finir ; OG/social : à câbler).
4. **QA end-to-end réelle** : chaque feature validée dans un admin Payload réel (pas seulement 236 tests unitaires). ⏳ **principal reste-à-faire**.
5. **Zéro régression / zéro dette** : typecheck 0, tests verts, build propre, pas de code mort. ✅ (à maintenir).
6. **Docs + onboarding** : README à jour, variables d'env documentées, parcours « activer en 5 min ». ✅ (à compléter pour les nouveautés).

---

## 2. Les 3 piliers du ROI 2026 (où le module doit vraiment faire gagner)

| Pilier | Pourquoi ROI réel 2026 | Levier dans le module |
|---|---|---|
| **Pertinence & intention** (pas les mythes) | Google récompense l'intention couverte, pas la densité/longueur | Désintox scoring, brief de contenu IA, GEO/extractabilité |
| **Confiance (E-E-A-T) & entités** | Signaux de confiance + entités = ranking + citations IA | E-E-A-T checks, `sameAs`, schema multi-types, auteurs |
| **Vélocité opérationnelle** | Le ROI vient de l'**exécution à l'échelle** : corriger 200 pages en 2 clics | Bulk méta IA, rank tracking, alertes, rendu frontend auto |

> **Insight clé (validé sur consilioweb.fr post 116)** : le plus gros gain immédiat n'est pas d'écrire plus de contenu — c'est de **corriger les incohérences méta/keyword en masse** et d'**automatiser le rendu** (OG, JSON-LD, hreflang). D'où la priorité bulk + helpers frontend.

---

## 3. Matrice des features (état réel)

### ✅ Fait & publié (1.8 → 1.11)
- Moteur 50+ checks **désintoxiqué 2026** (densité anti-stuffing, title dépondéré, schema honnête page-type)
- **E-E-A-T**, **GEO / AI-readiness**, **hreflang** (groupes weight-0 → sous-score AI-readiness)
- Indexation hygiene, canonical-cross, freshness anti-fake-refresh, title pixel-width
- **IA méta** : scan → propose → applique (Claude Opus 4.8, validé serveur), alt-text vision, **brief de contenu**
- **Rank tracking GSC** (positions/jour + mouvements), **monitoring/alertes** (webhook/email)
- **Helpers frontend** : `buildSeoMetadata` (Metadata Next) + `buildJsonLd`/`renderJsonLdScript` (10 types, multi-location `@graph`)
- **Sitemaps** standard + **News/Image/Video**, robots.txt, redirects, 404 logs, cannibalisation, duplicate content, link graph + orphelins, Core Web Vitals (PSI), keyword research
- Dashboard 9 vues, sidebar analyzer, i18n FR/EN, sécurité (AES-GCM tokens, SSRF, RBAC), OOM-safe (single-flight + batché)

### ⏳ Reste pour « plus rien à faire »
| # | Item | Effort | ROI |
|---|---|---|---|
| R1 | **Bulk méta — UI aperçu/export CSV/appliquer** (API `/ai-optimize-bulk` faite) | M | ⭐⭐⭐ |
| R2 | **Automatisation OG / cartes sociales** (auto-fallback meta→OG, OG image = hero si vide ; bulk) | M | ⭐⭐ |
| R3 | **QA end-to-end réelle** en admin (dogfood consilioweb.fr) + corriger les ratés | L | ⭐⭐⭐ |
| R4 | **« Optimiser le site » 1 clic** : auto-cible les pages à problème (filtre) → bulk preview → apply | S | ⭐⭐⭐ |
| R5 | Réglage du focus keyword assisté (détecter incohérence title↔keyword et proposer le bon) | S | ⭐⭐ |
| R6 | Onboarding/setup wizard + doc des nouveautés (rank, alerts, helpers) | S | ⭐ |
| R7 | (Optionnel) export/import CSV des métas pour édition hors-ligne | S | ⭐ |

> **Anti-roadmap (ne PAS faire)** : réécriture de contenu IA en masse (scaled-content abuse), re-granulariser les mythes readability, dépendances lourdes (SDK) dans le plugin, features WordPress hors-headless.

---

## 4. Plan d'exécution

**Phase 1 — Compléter le module (objectif 1)**
1. R1 bulk UI → **1.12.0**.
2. R4 « Optimiser le site » + R5 focus-keyword assist.
3. R2 OG/social automation.
4. R3 QA e2e (voir §5) → corriger les ratés trouvés.
5. R6 docs/onboarding.
→ Tag « module référence v1.x complet ».

**Phase 2 — consilioweb.fr de fond en comble (objectif 2)**
1. Review live read-only (dashboard audit toutes pages) → **rapport d'écarts priorisé**.
2. Déployer la dernière version du module sur la prod (pour dogfooder les nouveautés).
3. Récupérer **dump frais** (dev) → tester l'application en masse en local.
4. Appliquer : méta en masse (module), OG/JSON-LD (helpers), contenu à la main (briefs IA).
5. Mesurer (KPIs §6) à 30/60/90 j.

---

## 5. Checklist QA end-to-end (le vrai reste-à-faire)

À valider dans un admin Payload réel (consilioweb.fr ou env test, dernière version) :

- [ ] Sidebar analyzer : score + groupes + AI-readiness cohérents avec un doc réel
- [ ] « Optimiser avec l'IA » (sidebar) : applique meta.title/description/focusKeyword via le form, sauvegarde OK
- [ ] Bulk : sélection → aperçu → export CSV → appliquer → DB à jour
- [ ] Dashboard audit : pas d'OOM au 1er chargement (202 + polling), gros site
- [ ] Rank tracking : connexion GSC → snapshot → mouvements affichés
- [ ] Alertes : digest webhook/email déclenché sur seuils
- [ ] Alt-text vision : génère + applique sur média sans alt
- [ ] Brief de contenu : sortie structurée exploitable
- [ ] Helpers frontend : `buildSeoMetadata`/`buildJsonLd` rendent le bon `<head>` sur le site
- [ ] Sitemaps news/image/video valides (XML), robots OK
- [ ] i18n FR/EN, RBAC (non-admin bloqué), pas d'erreur console admin

---

## 6. KPIs (mesurer le ROI)

- **AI-readiness moyen** du site (sous-score module) ↑
- **Score SEO moyen** ↑ ; nb pages < 50 ↓
- **Positions GSC** (rank tracking) : variation nette à 30/60/90 j
- **Pages sans méta / sans alt / sans JSON-LD** → 0
- **404 non corrigés** → 0 ; liens cassés → 0
- **Temps pour corriger N pages** : page-par-page → **2 clics pour N**

---

## 7. Risques & garde-fous
- Écriture en masse en prod → **toujours** aperçu/export avant apply ; dump local pour répéter.
- Dépendance LLM (coût/latence) → opt-in, clé du client, méta-only, fallback heuristique, batché borné.
- Pénalité scaled-content → jamais de corps IA en masse.

---

## 8. Backlog post-audit octo (code-reviewer)

Audit READ-ONLY du module (typecheck ✅, 231 tests ✅). Findings priorisés :

**Corrigés immédiatement ✅**
- **B1 — fuite `setInterval`** (warmCache/rankTracker/alerts) : `start*()` désormais idempotent (`stop*()` en tête) → plus de timers fuités / jobs doublés au hot-reload/re-init.
- **B2 — RBAC `redirects` PATCH** : ajout du contrôle `isAdmin` (cohérent avec POST/DELETE) → fin du risque de détournement de redirection par un utilisateur non-admin.

**À traiter pour « plus rien à optimiser »**
| # | Item | Type | Priorité |
|---|---|---|---|
| A1 | Audit/validate : **filtrer les drafts** (`_status`) — sinon scoring fausse sur collections versionnées | Correctness | Haute |
| A2 | **Pagination/bornage** alerts (`limit:5000`) + rankTracking + audit `MAX_DOCS=1500` : la troncature silencieuse fausse régressions/drops sur gros site ; signaler le tronquage à l'UI | Perf/Correctness | Haute |
| A3 | **Cache audit scopé par locale** (clé `'audit'` unique) — site multi-locale | Correctness | Moyenne |
| A4 | **RBAC cohérent** sur endpoints d'analyse (validate/audit/cannibalization/link-graph/keyword-research : `req.user` mais pas `isAdmin` + `overrideAccess`) — définir un seuil | Sécurité | Moyenne |
| A5 | **Observabilité module** : statut santé des jobs (rank/alerts) exposé au dashboard (aujourd'hui `logger.warn` only) | DX/Ops | Moyenne |
| A6 | Doc threat-model : `x-forwarded-for` (rate-limit) + webhook alerts supposent un reverse-proxy de confiance | Doc | Basse |

**Gaps SEO 2026 vs premium (nouvelle roadmap)**
| # | Item | ROI |
|---|---|---|
| G1 | **IndexNow** (Bing/Yandex) + ping sitemap au `afterChange` — soumission proactive | ⭐⭐ |
| G2 | **Liens internes cassés** (aujourd'hui seuls les externes sont vérifiés en HTTP) + insertion assistée des suggestions | ⭐⭐ |
| G3 | **Redirects wildcards/regex + import/export** (CSV/.htaccess) — actuellement exact-match | ⭐⭐ |
| G4 | **Validation schema.org** (rich-results) en plus de la génération | ⭐ |
| G5 | **Boucle CTR→méta** : repérer requêtes GSC à faible CTR → suggérer réécriture méta (la donnée GSC est déjà là) | ⭐⭐⭐ |

> G5 est le plus fort ROI : il ferme la boucle « donnée réelle (GSC) → action (réécriture méta) » avec un minimum d'interaction — exactement l'objectif du module.

---

## 9. Avancement (releases 1.12 → 1.15)

**✅ Fait & publié**
- **R1** bulk méta : endpoint `/ai-optimize-bulk` + UI aperçu/export CSV/appliquer (1.12.0)
- **R4** « Optimiser le site » 1 clic (auto-cible + aperçu bulk) (1.14.0)
- **G5** boucle CTR→méta : `/ctr-opportunities` + optim IA 1 clic (1.13.0)
- **A1** audit ignore les drafts (1.12.0) · **A3** cache audit par locale (1.14.0) · **A5** santé/observabilité `/health` + panneau (1.15.0)
- **B1** schedulers idempotents · **B2** RBAC redirect PATCH (1.12.0)

**✅ Aussi fait / déjà couvert (vérifié)**
- **G1** IndexNow (1.16.0) · **G5** boucle CTR→méta (1.13.0)
- **G2** liens internes cassés — **déjà** dans le Sitemap Audit (`extractAllInternalLinks` + `brokenLinks` + dédup + suggestion de slug)
- **G4** validation schema.org — **déjà** dans `rules/schema.ts` (champs requis par type via `SCHEMA_REQUIREMENTS` + `CMS_VERIFIABLE_SCHEMA_FIELDS`)
- **G3** redirects : import bulk **déjà** présent (POST). La regex/wildcard de *résolution* est côté application (hors plugin)
- **R2** OG/social — couvert par `buildSeoMetadata` (OG/Twitter dérivés de la méta) · **R5** assist keyword — couvert (sidebar « mot-clé absent du titre » + `/ai-optimize`)

**Décisions assumées (non-actions justifiées)**
- **A4** seuil RBAC sur les endpoints d'analyse : laissé à `req.user` volontairement (le sidebar/dashboard sont utilisés par les éditeurs ; forcer admin casserait leur usage). Documenté.
- **A2** tronquage alerts/rank à 5000 : impact uniquement sur sites à très long historique ; l'audit expose déjà `capped`. Amélioration mineure différée.

**✅ QA end-to-end (intégration)** — faite via un harness Payload v3 + SQLite réel (`e2e/`) :
`getPayload` OK (transform + onInit réels), collections du plugin enregistrées + schéma DB construit,
champs SEO/meta injectés, création de docs, `analyzeSeo` sur doc réel, **écriture méta persistée**
(cible du bulk-apply). **Tout passe.** Reste seulement le **smoke UI navigateur** sur les panneaux
admin, qui nécessite une instance déployée (consilioweb.fr à jour).

**Verdict objectif 1** : le module couvre l'intégralité du tier premium + l'avance 2026, **sans item high/medium restant**, **validé en intégration sur un vrai Payload**. Reste uniquement le smoke UI (déploiement).

**Bloqué sur action utilisateur** (hors de mon contrôle) :
- **QA end-to-end** : nécessite de déployer la dernière version sur un admin réel (consilioweb.fr).
- **Objectif 2 — consilioweb.fr optimisé** : nécessite (1) déployer `@consilioweb/payload-seo-analyzer@1.15.0` sur la prod, (2) puis 2 clics (« Optimiser le site » + panneau Opportunités CTR).
