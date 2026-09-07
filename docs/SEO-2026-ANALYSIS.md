# Analyse SEO juin 2026 — Plan d'amélioration de `@consilioweb/payload-seo-analyzer`

> **Généré le** : 2026-06-23
> **Méthode** : workflow multi-agents (5 agents de recherche web-sourcés → débat contradictoire à 4 lentilles adverses → synthèse + arbitrage)
> **Cible** : plugin v1.7.1
> **Statut** : rapport validé (affirmations sur le code vérifiées manuellement : `KEYWORD_DENSITY_MIN=0.5`, `CORNERSTONE_MIN_WORDS=1500`, `TITLE_LENGTH_MAX=60`, `aiGenerate.ts` = heuristique pur)

---

## 1. Résumé exécutif

En juin 2026 le SEO s'est recentré sur trois réalités : (1) **le contenu utile, original et démontrant une expérience de première main (E-E-A-T, Trust en tête) est le facteur de montée n°1** — le Helpful Content System est fondu dans le core algorithm ; (2) **l'enjeu de visibilité glisse du "ranking" vers la "citation"** dans les réponses IA (AI Overviews sur ~25 % des requêtes, 38-58 % de clics organiques en moins sur ces requêtes) ; (3) **les pénalités les plus violentes viennent des spam policies** (scaled content abuse, site reputation abuse) et des **erreurs techniques déterministes** (noindex/canonical cassés). À l'inverse, plusieurs leviers historiques sont morts : densité de mot-clé cible, longueur de title comme facteur, voix passive / mots de transition, llms.txt, FAQ rich results.

**Verdict sur le module** : moteur sérieux et bien architecturé (50+ checks, parsing Lexical natif, 9 vues), mais **il récompense activement des mythes dans son scoring** — le code contient `KEYWORD_DENSITY_MIN = 0.5` (pénalise un contenu naturel sous 0,5 %, ce qui **pousse au keyword stuffing réprimé par Google**), `CORNERSTONE_MIN_WORDS = 1500` (longueur magique), `TITLE_LENGTH` en caractères, et un check schema "readiness" qui **ne lit aucun JSON-LD**. Le module est aussi **structurellement aveugle aux trois leviers 2026** : E-E-A-T/auteur, données structurées validées par type, et extractibilité IA. La priorité n'est pas d'ajouter 50 checks : c'est **désintoxiquer le score d'abord, puis ajouter les bons signaux**, en commençant par le seul anti-pattern crash actionnable on-page (hygiène d'indexation cross-page).

---

## 2. Méthodologie

Synthèse de **5 agents de recherche thématiques web-sourcés** (technique/CWV, contenu/E-E-A-T, GEO, données structurées, anti-patterns/pénalités) confrontés à un **débat contradictoire de 4 lentilles adverses** (chasseur de mythes, alignement Google officiel, avocat du SEO génératif, ingénieur Payload ROI). Les claims contestés ont été vérifiés en recherche live (juin 2026) par les lentilles. Deux affirmations sur le code ont été **vérifiées directement dans la source** : `aiGenerate.ts` (heuristique pur, « No external AI API needed ») et `constants.ts` (`KEYWORD_DENSITY_MIN=0.5`, `CORNERSTONE_MIN_WORDS=1500`, `TITLE_LENGTH_MAX=60`).

---

## 3. Panorama SEO juin 2026 — les piliers

### (a) Technique & performance / Core Web Vitals
Ce qui compte vraiment : **accessibilité technique propre** (codes HTTP corrects, canonical cohérents, indexation maîtrisée, sitemap valide) = prérequis filtrant. **Rendu server-first** (HTML initial contenant le contenu critique, liens en `<a href>`) pour indexation rapide et économie de crawl budget. **CWV** (LCP ≤ 2,5 s, INP < 200 ms, CLS ≤ 0,1) restent un signal — mais **tie-breaker secondaire au contenu, pas levier dominant** (Page Experience déprécié comme système nommé en 2023). INP est le plus échoué (43 % des sites). *Seuils inchangés : la rumeur d'un resserrement LCP à 2,0 s n'est pas confirmée par Google.*

### (b) Contenu, E-E-A-T & Helpful Content
**Trust est le pilier dominant** ; Experience (contenu vécu, données de première main) est « the single biggest visibility lever ». Leviers réels : **auteur identifié** (byline + bio + Person schema + sameAs), **originalité** (données/recherche/analyse propres), **autorité topique** (clusters, couverture de l'intention et des questions de suivi), **fraîcheur réelle** (refresh de fond, pas changement de date). La densité de mot-clé et la longueur magique sont mortes ; ce qui compte est la **couverture de l'intention**, pas la répétition.

### (c) GEO / moteurs génératifs IA
Position officielle Google : « optimizing for generative AI is still SEO » — **vrai pour AI Overviews/AI Mode (ancrés dans le core), partiel pour ChatGPT/Perplexity** qui pondèrent des signaux différents (~11 % d'overlap de domaines entre eux, 83 % des citations AI Overviews hors top 10 organique, 65-85 % des prompts ChatGPT sans keyword correspondant). Leviers d'extractibilité : **réponse directe en tête de section (BLUF)**, unités auto-suffisantes, headings en question, tableaux/listes, E-E-A-T/entités. **À NE PAS confondre** : structurer en unités extractibles (utile, prouvé) ≠ llms.txt / réécriture AI-specific dupliquée (inutile, debunké).

### (d) Données structurées & entités
Le schema ne fait pas le ranking mais **déclenche des rich results (CTR) et sert de signal de confiance/vérification d'entité pour l'IA**. Ce qui compte : **bon type par type de page** (Article/BlogPosting, Product+Offer, LocalBusiness, BreadcrumbList, Person), **validation des champs requis**, et **résolution d'entité** via `Organization` + `sameAs` (Wikidata QID, LinkedIn…). **FAQPage/HowTo** : markup valide et toujours lu par l'IA, **mais zéro rich result** (FAQ supprimés le 7 mai 2026, HowTo desktop depuis 2023). Ne jamais recommander de le supprimer ; signaler seulement l'absence de rich result.

---

## 4. CE QUI FAIT MONTER — facteurs priorisés

| # | Facteur 2026 | Poids | Actionnable dans le module ? |
|---|---|---|---|
| 1 | Contenu original + expérience de première main (Trust/Experience) | Très élevé | **Partiel** — détecter présence d'auteur/sources/données (signal de transparence, pas garantie) |
| 2 | Auteur identifié + Person schema + sameAs | Élevé | **Oui, 100 % offline** (champ author + Lexical + Schema Builder) |
| 3 | Entité Organization + sameAs (Wikidata/LinkedIn) | Élevé | **Oui, déclaratif** (settings + `buildOrganizationSchema`) |
| 4 | Hygiène d'indexation (canonical/noindex corrects) | Élevé (prérequis) | **Oui, offline** (cross-collection via score-history) |
| 5 | Schema valide par type de page | Élevé | **Oui, offline** (dictionnaire de champs requis) |
| 6 | Autorité topique / couverture de l'intention | Élevé | **Partiel** (co-occurrence offline ; LLM = dépendance externe à assumer) |
| 7 | Extractibilité IA (answer-first, Q/R, tableaux) | Moyen-élevé (non-Google) | **Oui, offline** (parsing Lexical) — en score séparé |
| 8 | hreflang sans erreur (multi-locale) | Élevé (sites concernés) | **Oui, offline** (locales Payload) |
| 9 | Fraîcheur réelle | Moyen | **Oui, trivial** (`updatedAt` vs date affichée) |
| 10 | CWV (LCP/INP/CLS) | Faible (tie-breaker) | **Via API externe** (PSI/CrUX), informationnel |

---

## 5. CE QUI FAIT CHUTER EN FLÈCHE — anti-patterns par sévérité

### CRASH (chute brutale / désindexation / action manuelle)
- **noindex / canonical cassé déployé par erreur** sur pages stratégiques → cause technique n°1 de désindexation massive. **Le seul crash actionnable on-page.** Recovery 1-3 semaines une fois corrigé.
- **Scaled content abuse** (production de masse sans valeur, IA/humain/hybride indifférent) → cible n°1 des spam updates 2025-2026.
- **Site reputation abuse / expired domain abuse** (parasite SEO, PBN) → policy formalisée nov. 2024, élargie 2026.
- **Doorway pages / thin content auto-généré** sans supervision → spam policy.
- **Review schema auto-attribué / AggregateRating fabriqué** → risque d'action manuelle.

### MAJOR
- **Cannibalisation** (plusieurs URL sur la même intention) → empêche la consolidation des signaux.
- **CSR pur du contenu principal + liens non-`<a href>`** → indexation retardée/manquante.
- **Keyword stuffing** (y compris pousser une densité cible) → signal de manipulation.
- **hreflang incomplet** → une seule erreur fait ignorer tout le cluster.
- **Contenu 100 % IA non revu, sans auteur/données originales** → note « Lowest » des QRG.
- **Ignorer le zero-click** (stratégie 100 % position+CTR) → surestime le trafic attendu.

### MINOR
- **Investir dans FAQPage/HowTo en attendant un rich result** → ROI nul (mais ne pas retirer le markup).
- **Créer un llms.txt / chunking / réécriture AI-specific** comme levier de ranking → effort gaspillé.
- **Faux refresh** (changer la date sans toucher le fond) → Google détecte la vraie date.
- **Disavow préventif** de backlinks → perte de signaux, déconseillé par Google hors action manuelle.
- **Sur-investir la perf** au détriment du contenu → tie-breaker, pas levier.

---

## 6. MYTHES & PRATIQUES DATÉES DANS LE MODULE À CORRIGER

> **Section vérifiée dans le code source.** C'est le cœur du chantier. Le module ne se contente pas d'ignorer l'état de l'art : il **récompense activement des mythes dans son scoring**.

| Mythe en production | Localisation code | Pourquoi c'est daté | Quoi faire à la place |
|---|---|---|---|
| **Plancher densité 0,5 %** (pénalise un texte naturel sous le seuil) | `constants.ts:42` `KEYWORD_DENSITY_MIN=0.5` + `content.ts` (fail/warning poids 2) | Mueller : « keyword density is not a ranking factor, never has been ». **Pire : le plancher pousse au stuffing réprimé par les spam policies.** | **Supprimer** le plancher 0,5 % et tout statut négatif en-dessous. Garder **uniquement** l'alerte anti-stuffing (`>2,5/3 %`). |
| **Distribution KW par tiers** (présence dans 2/3 du texte) | `content.ts` | Variante déguisée de la densité ; « gaming keyword variations » explicitement découragé par Google. | **Retirer du score** (non-scorant ou supprimé). |
| **Cornerstone = 1500+ mots** ; word counts « magiques » | `constants.ts:33` `CORNERSTONE_MIN_WORDS=1500`, `MIN_WORDS_*` | Google : pas de nombre de mots idéal. Récompense le volume, pas la valeur — inverse de helpful content. | Reformuler en **détection de thin content** (plancher bas) sans cible haute récompensée. |
| **Title 30-60 caractères, noté « critical » poids 3** | `constants.ts:13-14`, `title.ts` | Pas un facteur de ranking ; Google **réécrit 60 %+ des titles en SERP** ; troncature en pixels (~580-600px), pas en caractères. | **Dépondérer** (informatif, jamais critical). Optionnel : estimation pixel offline en **info secondaire**. Ne PAS sur-investir. |
| **Voix passive max 15 % + mots de transition min 15 %**, scorés | `readability.ts` (poids 1-2) | Heuristiques de lisibilité héritées de Yoast, **jamais des facteurs de ranking** (Yoast lui-même le dit). | Passer en **conseil informationnel non-scoré** (poids 0). |
| **schema "readiness" = title+desc+image présents** | `schema.ts` (1 seul check) | **Ne lit AUCUN JSON-LD** : un site sans structured data passe « vert ». Faux positif structurel. | **Remplacer** par validation réelle + matrice de couverture par type (voir P0). |
| **Power words / number-in-title / sentiment** avec stats CTR fabriquées en commentaire | `title.ts` (« +36 % CTR ») | Folklore headline-analyzer ; effet CTR éventuel, jamais ranking ; chiffres non sourcés. | Garder au mieux en **bonus poids 1 informationnel**, retirer les stats inventées. |

**Mythes que la recherche elle-même a corrigés (à ne pas réintroduire)** : llms.txt comme levier, multiplicateurs de citation IA chiffrés (tableaux 4,2x…) comme constantes de scoring, GEO comme discipline séparée nécessitant un schema spécial, LCP resserré à 2,0 s.

**Erreur factuelle de la recherche corrigée par le code** : plusieurs recommandations proposent d'utiliser `/ai-generate` comme un LLM pour la « couverture sémantique ». **C'est faux** — `aiGenerate.ts` est **purement heuristique** (« No external AI API needed »). Toute analyse d'entités par LLM = **nouvelle dépendance externe payante**, à assumer comme telle.

---

## 7. ANALYSE DE CONCORDANCE

### 7.1 Consensus fort (les 4 lentilles d'accord)

1. **Tuer la densité de mot-clé** (et surtout le plancher 0,5 %) — unanime, urgent. La lentille Google note que le code **fait échouer** une page sous 0,5 %, donc c'est **P0 contraire aux spam policies**, pas un simple « daté ».
2. **Le check schema "readiness" est du théâtre** (ne lit aucun JSON-LD) → remplacer par validation + couverture par type. Unanime, **100 % offline, ROI élevé**.
3. **Hygiène d'indexation cross-page (R44)** = meilleure recommandation du lot. Seul crash actionnable on-page, 100 % offline, réutilise score-history. Unanime P0.
4. **E-E-A-T auteur + sameAs/entités (R13/R35)** = levier réel 2026, le module n'a rien, 100 % offline — **mais à présenter comme signal de transparence, pas comme facteur de ranking garanti** (E-E-A-T n'est pas un score algorithmique).
5. **NE PAS implémenter llms.txt comme levier** ni le **tracking de citation IA** en maison. Unanime.
6. **Nettoyer les mythes AVANT d'ajouter** (R53) — les 4 lentilles déplorent l'asymétrie : 53 ajouts, ~0 suppression chiffrée.
7. **Déduplication** : CWV ×4-5, schema ×5, E-E-A-T ×7, title-pixels ×4 → en réalité ~3 chantiers, pas 17 recos.

### 7.2 Points contestés (positions + arbitrage)

**C1 — Longueur de title en pixels (R2)**
- *Avocat GEO / données structurées* : amélioration de précision réelle (troncature en pixels).
- *Chasseur de mythes + Google + Ingénieur* : demi-mythe ; Google réécrit 60 %+ des titles ; raffiner une métrique cosmétique sur-pondérée donne une fausse rigueur scientifique.
- **Arbitrage** : **DÉPRIORISER le title-length d'abord** (le retirer de « critical »). La pixelisation est un *nice-to-have informatif P2*, jamais une correction de facteur de ranking. La vraie faute est le poids 3 « critical ».

**C2 — Score AI-readiness séparé + groupe GEO (R23/R31)**
- *Avocat GEO* : recos les plus stratégiques, devraient être P0 (divergence prouvée des moteurs, 83 % des citations hors top 10).
- *Chasseur de mythes* : risque de cargo-cult Yoast en version IA ; les seuils chiffrés (40-75 mots, multiplicateurs) sont contestés.
- **Arbitrage** : **implémenter le groupe GEO offline en P1, en score SÉPARÉ**, avec heuristiques structurelles (answer-first, Q/R, tableaux, headings en question) **comme conseils directionnels non-scorés sur des seuils durs**. La direction est juste, les chiffres précis ne sont pas des constantes de scoring.

**C3 — llms.txt en opt-in (R29)**
- *Avocat GEO* : ne pas l'enterrer ; réel usage dans la **couche agentique** (Cursor, Claude Code, MCP, assistants in-product) — à positionner « pour agents/IDE », pas « pour ranker ».
- *3 autres lentilles* : oppose net ; même en opt-in, ça légitime un non-standard, crée de la dette, contredit le message du plugin.
- **Arbitrage** : **NE PAS livrer comme feature SEO/GEO.** Acceptable uniquement comme **génération opt-in explicitement étiquetée « documentation machine / agents », hors de tout score**, si et seulement si le coût de maintenance est nul. Par défaut : documenter comme « volontairement non implémenté ».

**C4 — Priorité des CWV (R1) : P0 ou P1 ?**
- *Recherche* : P0, INP signal primaire.
- *Toutes les lentilles* : surcoté ; tie-breaker, pas dominant ; CrUX n'a pas de field data sur les pages éditoriales à faible trafic ; à NE PAS injecter dans le score on-page.
- **Arbitrage** : **P1 maximum**, via API PSI/CrUX, **check informationnel à la demande**, jamais dans le score SEO. Seuils config-driven.

**C5 — GSC API OAuth (R6) : P0 ou plus tard ?**
- *Recherche + chasseur de mythes* : pivot factuel majeur, P0.
- *Ingénieur* : chantier L sous-estimé — OAuth + **stockage chiffré des refresh tokens non couvert par le RBAC v1.7.0** ; le CSV manuel couvre 80 % du besoin.
- **Arbitrage** : **P1, après les gains offline.** Valeur réelle mais sécurité des tokens = chantier à part entière. Ne pas le mettre devant schema/E-E-A-T/indexation.

**C6 — Détection scaled content / contenu IA (R50)**
- *Recherche* : prévention de pénalité.
- *Google + ingénieur* : détection fiable quasi-impossible en mono-page ; **risque de propager le mythe « IA = pénalité »**.
- **Arbitrage** : **cibler l'ABUS (pages quasi-dupliquées en masse, thin templatisé), jamais l'origine IA.** Cadrer en « alerte heuristique faible », pas « prévention de pénalité ». P2.

### 7.3 Tableau de synthèse

| Recommandation | Statut | Verdict final |
|---|---|---|
| Tuer densité + plancher 0,5 % (R3) | Consensus | **P0 — urgent (contraire aux spam policies)** |
| Hygiène indexation cross-page (R44) | Consensus | **P0 — meilleur ROI, offline** |
| Validation + couverture schema par type (R4/R34) | Consensus | **P0 — remplace le théâtre, offline** |
| E-E-A-T auteur + sameAs/entités (R13/R35) | Consensus | **P0/P1 — offline, en signal de transparence** |
| Faux refresh (R18) | Consensus | **P1 — trivial, offline** |
| hreflang (R5) | Consensus (conditionnel) | **P1 — offline, actif uniquement si multi-locale** |
| FAQPage/HowTo « no rich result » (R36) | Consensus | **P1 — disclaimer, ne PAS retirer le markup** |
| Groupe GEO + score AI séparé (R23/R31) | Contesté | **P1 — offline, non-scoré sur seuils durs** |
| Title en pixels (R2) | Contesté | **P2 — après dépondération de title-length** |
| CWV via PSI/CrUX (R1) | Contesté | **P1 — informationnel, hors score** |
| GSC API OAuth (R6) | Contesté | **P1 — après offline, sécurité tokens** |
| Détection scaled content (R50) | Contesté | **P2 — alerte faible, cibler l'abus pas l'IA** |
| Multi-langues ES/DE/IT (R11) | Quasi-consensus contre | **NE PAS faire — externaliser les seuils par locale seulement** |
| llms.txt (R29) | Contesté | **NE PAS livrer comme feature SEO** |
| Tracking citation IA en maison (R32) | Consensus | **NE PAS faire — point d'import tiers optionnel au mieux** |

---

## 8. PLAN D'AMÉLIORATION DU MODULE — roadmap en 3 vagues

> Ordre dicté par le ROI ingénieur : crash-prevention + nettoyage trivial → offline à fort impact → API externes en dernier.

### VAGUE P0 — Quick wins (désintoxication + crash-prevention, 100 % offline)

**P0.1 — Nettoyer le scoring des mythes**
- *Quoi* : supprimer `KEYWORD_DENSITY_MIN=0.5` et les statuts fail/warning sous le plancher ; retirer `content-keyword-distribution` du score ; dépondérer `title-length` (retirer « critical », poids → informatif) ; passer voix passive / mots de transition en poids 0 ; reformuler `CORNERSTONE_MIN_WORDS` en détection thin content sans récompense de volume ; retirer les stats CTR fabriquées des commentaires.
- *Pourquoi 2026* : le module pousse actuellement au keyword stuffing (anti-spam policy) et gonfle artificiellement le score sur des non-facteurs.
- *Faisabilité* : **oui, offline.** *Effort* : **S.**
- *Où* : `constants.ts`, `content.ts`, `title.ts`, `readability.ts`, `cornerstone.ts`.
- *Migration* : noter le changement de scoring au changelog — la collection `score-history` montrera une variation ; éviter une fausse alerte de « chute ».

**P0.2 — Hygiène d'indexation cross-page**
- *Quoi* : nouveau check cross-collection — alerter si une page importante (home, pillar, produit) passe en `noindex`, si un `canonical` pointe vers une autre URL que self de façon suspecte, ou si un déploiement bascule en masse des pages en `noindex` (comparer à `score-history`). Ajouter le piège **robots.txt vs noindex** (double blocage empêchant Google de voir le noindex).
- *Pourquoi 2026* : seul anti-pattern crash actionnable, perte de trafic catastrophique.
- *Faisabilité* : **oui, offline.** *Effort* : **M.**
- *Où* : étendre `technical.ts` (aujourd'hui mono-page) + collection `score-history`.

**P0.3 — Validation schema réelle + couverture par type**
- *Quoi* : remplacer le check « readiness » par (1) validation des champs requis par type via dictionnaire statique (Article=headline/author/datePublished/image ; Product=offers ; LocalBusiness=address ; BreadcrumbList=itemListElement) ; (2) matrice de couverture selon `ctx.pageType` (déjà détecté via `detectSchemaType`) ; (3) flag FAQPage/HowTo « valide mais zéro rich result » **sans recommander la suppression**. Ajouter Event/Recipe/Video aux types éligibles.
- *Pourquoi 2026* : corrige un faux positif structurel ; le schema est signal de confiance pour l'IA.
- *Faisabilité* : **oui, offline.** *Effort* : **M.**
- *Où* : `schema.ts`, `schemaGenerator.ts`, vue Schema Builder.

### VAGUE P1 — Différenciateurs (offline d'abord, API externes ensuite)

**P1.1 — Groupe E-E-A-T + entités (offline)**
- *Quoi* : nouveau groupe `eeat` — présence d'auteur attribué (champ relation `author`), bio/lien profil, `datePublished`+`dateModified`, liens externes vers sources, données chiffrées. Étendre `buildOrganizationSchema` pour exiger/générer `sameAs` (Wikidata QID, LinkedIn, Crunchbase) depuis les settings ; ajouter un champ Person auteur + `sameAs`.
- *Pourquoi 2026* : levier de montée n°1 + signal de citation IA (author schema 3× plus cité). **Formulé en signal de transparence, jamais en garantie d'expertise.**
- *Faisabilité* : **oui, 100 % offline.** *Effort* : **M.**
- *Où* : nouveau `rules/eeat.ts`, `schemaGenerator.ts`, settings, Schema Builder.

**P1.2 — Fraîcheur réelle + faux refresh (offline)**
- *Quoi* : comparer date affichée vs `updatedAt` Payload, flaguer un décalage suspect ; alerte fraîcheur sur cornerstone ancien.
- *Faisabilité* : **oui, trivial** (`freshness.ts` a déjà `daysSince()`). *Effort* : **S.**
- *Où* : `freshness.ts`.

**P1.3 — Groupe GEO + score AI-readiness séparé (offline)**
- *Quoi* : nouveau `rules/geo.ts` — answer-first en tête de section, présence de blocs Q/R, headings en question, tableaux Lexical. Agréger en un **sous-score AI-readiness distinct** du score SEO (geo + eeat + couverture schema).
- *Pourquoi 2026* : 83 % des citations AI Overviews hors top 10 → un score SEO unique masque la perf IA.
- *Faisabilité* : **oui, offline** (réutilise `extractListsFromLexical`, `allHeadings`, `fullText`). *Effort* : **M.** **Conseils non-scorés sur seuils durs** (40-75 mots = direction, pas constante).
- *Où* : `rules/geo.ts`, SEO Dashboard.

**P1.4 — Audit hreflang (offline, conditionnel)**
- *Quoi* : réciprocité des return tags, auto-référence, validité ISO 639-1/3166-1, cohérence sitemap ; générer les `xhtml:link` dans le sitemap.xml dynamique (déjà présent v1.7.0). **Activer uniquement si plusieurs locales Payload** (ne pas polluer les sites vitrine FR mono-locale, cœur de cible du template).
- *Faisabilité* : **oui, offline.** *Effort* : **M.**
- *Où* : nouveau `rules/hreflang.ts`, génération sitemap.

**P1.5 — CWV réels via PSI/CrUX (API externe)**
- *Quoi* : endpoint interrogeant l'API PageSpeed Insights par URL, stockage dans la collection `performance`, affichage LCP/INP/CLS avec INP en focus. **Informationnel, hors du score SEO.** Seuils **config-driven** (ne pas hardcoder 2,0 s).
- *Faisabilité* : **oui via API externe (clé PSI gratuite).** *Effort* : **L.** *Limite à documenter* : pas de field data CrUX sur pages à faible trafic → fallback lab moins fiable.
- *Où* : nouvel endpoint, vue Performance, collection `performance`.

**P1.6 — GSC API OAuth (API externe)**
- *Quoi* : OAuth GSC pour automatiser impressions/clics/position (remplace/complète le CSV manuel) ; déverrouille cannibalisation par **requête réelle**.
- *Faisabilité* : **oui via API externe.** *Effort* : **L** (sous-estimé : **stockage chiffré des refresh tokens non couvert par RBAC v1.7.0** = chantier sécurité, rotation, révocation).
- *Où* : vue Performance, vue Cannibalization, nouvelle gestion de secrets.

### VAGUE P2 — Ambitieux / faible ROI relatif

- **P2.1 — Title en pixels** (info secondaire, après dépondération) — `title.ts`, *S*.
- **P2.2 — Cannibalisation par intention** (regrouper focus keywords proches + croiser requêtes GSC réelles) — vue Cannibalization, *M*, dépend de P1.6.
- **P2.3 — Audit d'images Media** (poids/format WebP/AVIF, dimensions, lazy) — corrige le LCP à la source ; **jeter les proxys faibles** (taille Lexical, nb requêtes) — collection Media, *M*.
- **P2.4 — Détection abus de masse** (pages quasi-dupliquées, thin templatisé) — **alerte faible, cibler l'abus pas l'IA** — `quality.ts` cross-collection, *M*.
- **P2.5 — Externaliser les seuils de lisibilité par locale** (refactor utile) **sans livrer ES/DE/IT** — `constants.ts`, *S*.
- **P2.6 — Détection SSR/CSR** (fetch du HTML serveur) — *attention : un fetch serveur d'une page Next.js SSR renvoie déjà le bon HTML ; la détection CSR réelle exige le runtime navigateur* → valeur limitée, zone SSRF (durcie v1.7.0). *M*, P2 honnête.

---

## 9. ANTI-ROADMAP — ce qu'il NE faut PAS implémenter

1. **llms.txt comme levier SEO/GEO** — Google ne le supporte pas (Mueller : comparé au meta keywords), 97 % des fichiers reçoivent zéro requête, 0,1 % du trafic crawler IA. Le livrer, même en opt-in, légitime un non-standard et contredit le message du plugin. *(Exception tolérée : génération étiquetée « documentation agents/IDE », hors score, si coût de maintenance nul.)*
2. **Tracking de citation IA en maison** — exige scraping/API continu de ChatGPT/Perplexity/Gemini ; c'est un produit à part entière (Otterly, Ahrefs Brand Radar). Au mieux : **point d'import de métriques tierces**, jamais une construction maison.
3. **Multi-langues ES/DE/IT** — chaque langue = sa formule de lisibilité, pour alimenter des checks **déjà non-ranking** (Flesch, voix passive). Industrialiser du cargo-cult dans 3 langues. Externaliser les seuils par locale suffit.
4. **Couverture sémantique « via /ai-generate »** — `/ai-generate` est **heuristique**, pas un LLM. Une vraie analyse d'entités par LLM = dépendance externe payante, non-déterministe, facture variable → **à réserver à un opt-in explicitement facturé**, jamais dans le score automatique.
5. **Scorer les multiplicateurs de citation IA chiffrés** (tableaux 4,2×, +40 % Cite Sources) — études à faible échantillon, non reproduites, 46× d'écart entre moteurs. **Direction oui, constantes de scoring non.**
6. **Hardcoder LCP à 2,0 s** — non confirmé par Google. Seuils config-driven, défaut 2,5 s.
7. **Détecter « c'est de l'IA »** — Google ne pénalise pas l'IA en soi ; tout check « détection IA » propage un mythe.
8. **Agrégat CWV site-wide automatique** — N appels PSI, quota et latence prohibitifs ; à la demande seulement.

---

## 10. Mesures de succès / KPIs

**Crédibilité du moteur (désintoxication)**
- Nombre de mythes scorés : objectif **0** (densité plancher, distribution, title « critical », voix passive/transitions scorés, cornerstone 1500 récompensé) — *baseline : ≥ 6*.
- Part du poids total alloué à des facteurs **confirmés ou actionnables** : objectif **> 90 %**.
- Taux de faux positifs schema (page « verte » sans JSON-LD) : objectif **0 %** (actuellement structurel).

**Couverture de l'état de l'art 2026**
- Présence des 3 leviers absents : E-E-A-T/auteur, validation schema par type, extractibilité IA — objectif **3/3**.
- Sites multi-locale avec audit hreflang sans erreur : objectif **100 %** des locales réciproques validées.

**Impact crash-prevention**
- Pages stratégiques en `noindex`/canonical cassé détectées **avant déploiement** : objectif **100 %** via alerte cross-collection + score-history.

**Hygiène produit**
- Recommandations livrées vs anti-roadmap respectée : **0 feature de l'anti-roadmap livrée comme levier**.
- Chantiers à dépendance externe (PSI, GSC) : **hors du score on-page**, sécurité des tokens auditée avant livraison.

---

## Conclusion

Le plugin a une base technique saine mais un **score pollué par des mythes qu'il faut couper avant d'ajouter quoi que ce soit**. Le chemin gagnant est impitoyablement clair et majoritairement **offline / faible effort** : nettoyer le scoring (P0.1), prévenir le crash d'indexation (P0.2), rendre le schema honnête (P0.3), puis brancher E-E-A-T/entités et l'extractibilité IA. Les chantiers API externes (CWV, GSC) sont légitimes mais **secondaires et hors du score**. Tout le reste — llms.txt, tracking IA maison, multi-langues, scoring GEO sur chiffres non prouvés — est du gaspillage à écarter explicitement.

### Fichiers de référence pour l'implémentation
- `src/constants.ts` (mythes : `KEYWORD_DENSITY_MIN`, `CORNERSTONE_MIN_WORDS`, `TITLE_LENGTH_*`)
- `src/endpoints/aiGenerate.ts` (heuristique pur, pas un LLM)
- Groupes de règles à modifier/créer : `content.ts`, `title.ts`, `readability.ts`, `schema.ts`, `technical.ts`, `freshness.ts`, `cornerstone.ts`, + nouveaux `eeat.ts`, `geo.ts`, `hreflang.ts`
