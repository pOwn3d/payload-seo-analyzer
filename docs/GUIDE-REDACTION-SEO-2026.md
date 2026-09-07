# Guide de rédaction SEO 2026 — ConsilioWEB

Guide opérationnel pour rédiger des articles de blog (collection Payload `posts`) qui obtiennent un **score excellent** dans notre module d'audit maison `@consilioweb/payload-seo-analyzer`.

> Ce guide n'est pas une liste de « bonnes pratiques SEO » génériques. **Chaque chiffre vient directement du code des règles de scoring.** Si vous suivez ce guide, vous scorez mécaniquement bien. Le panneau SEO apparaît dans la sidebar de l'éditeur Payload, en temps réel, pendant que vous écrivez.

---

## Comment le score est calculé (à lire une fois)

Le module lance ~70 vérifications réparties en groupes (titre, meta, contenu, lisibilité, maillage, images, etc.). Chaque vérification a :

- un **statut** : `pass` (réussi), `warning` (à améliorer), `fail` (échoué) ;
- un **poids** (`weight`, de 0 à 5) ;
- une **catégorie** : `critical`, `important`, ou `bonus`.

**Formule du score (0-100)** :

```
points gagnés  = Σ (poids du check selon son statut)
   pass    → 100 % du poids
   warning →  50 % du poids   (WARNING_MULTIPLIER = 0.5)
   fail    →   0 % du poids
score = round( points gagnés / points max possibles × 100 )
```

**Niveaux** (constantes `SCORE_*`) :

| Score | Niveau | Couleur |
|------|--------|---------|
| **≥ 91** | excellent | vert foncé |
| **71-90** | good (bon) | vert |
| **41-70** | ok (correct) | orange |
| **< 41** | poor (faible) | rouge |

**Conséquences pratiques** :

1. Un `warning` n'annule pas le check, il vaut **la moitié des points**. Viser le `pass` partout.
2. Les checks de **poids 0** (E-E-A-T, GEO, densité de mot-clé, voix passive, mots de transition…) **ne font PAS bouger le score SEO**. Ils alimentent un **indicateur séparé « AI-readiness »** (lisibilité par les IA). On les traite quand même : c'est le différenciateur 2026.
3. Les checks `critical` de poids 3 (meta description, densité sur-optimisée, contenu placeholder, contenu trop court) sont les plus punitifs : un `fail` y coûte cher.

**Indicateur AI-readiness (sous-score séparé)** : agrégé des groupes `geo` + `eeat` + le check `schema-coverage`. Chaque check compte pareil (pass=1, warning=0.5, fail=0). Mêmes seuils de niveau (≥91 excellent, etc.).

---

## 1. TL;DR — checklist express avant publication

Cochez tout avant de cliquer « Publier ». Chaque ligne renvoie à un check réel du module.

**Critiques (poids 3 — ne JAMAIS échouer)**
- [ ] **Meta title** rempli, mot-clé présent (`title-keyword`, poids 3)
- [ ] **Meta description** remplie, **120-160 caractères**, mot-clé présent (`meta-desc-*`, poids 3)
- [ ] **≥ 200 mots minimum absolu** ; **≥ 800 mots** visés pour un article (`quality-substantial` + `content-wordcount`)
- [ ] **Aucun contenu placeholder** (pas de « lorem ipsum », « TODO », « à compléter »…) (`content-no-placeholder`, `quality-no-duplicate`)
- [ ] **Densité du mot-clé ≤ 2,5 %** (au-delà = warning, **> 3 % = fail critique**) (`content-keyword-density`)
- [ ] **Pas de titre vide (H2-H6)** (`a11y-empty-headings`, poids 3)

**Importants (poids 2)**
- [ ] **Un seul H1**, mot-clé dans le H1 (`h1-unique`, `h1-keyword`)
- [ ] **Mot-clé dans au moins un H2** (`h2-keyword`)
- [ ] **Mot-clé dans le 1er paragraphe** (100 premiers mots) (`content-keyword-intro`)
- [ ] **Flesch FR ≥ 40** (le plafond réel de vos scores — voir §8) (`readability-flesch`)
- [ ] **≤ 30 % de phrases de plus de 25 mots** (`readability-long-sentences`)
- [ ] **Aucun paragraphe > 150 mots** (`readability-long-paragraphs`)
- [ ] **Aucune section > 400 mots sans sous-titre** (`readability-long-sections`)
- [ ] **≥ 1 lien interne** (≥ 3 = excellent) (`linking-internal`)
- [ ] **≥ 1 image** avec **alt sur ≥ 80 %** des images (`images-alt`, `images-present`)
- [ ] **Aucune ancre générique** (« cliquez ici », « en savoir plus »…) (`linking-generic-anchors`)
- [ ] **H1 ≠ meta title** (formulations différentes) (`h1-title-different`)
- [ ] **Densité de liens < 30 %** du texte (`a11y-link-density`)

**Bonus (poids 1 — chaque point compte vers le 91+)**
- [ ] **Meta title 30-60 caractères** (`title-length`)
- [ ] **1 power word** + **1 mot émotionnel** dans le title (`title-power-words`, `title-sentiment`)
- [ ] **Chiffre dans le title** + **format question** si pertinent (`title-has-number`, `title-is-question`)
- [ ] **Slug ≤ 75 caractères**, mot-clé présent, pas de stop words (`slug-*`)
- [ ] **≥ 1 lien externe** vers une source fiable (`linking-external`)
- [ ] **Images en WebP/AVIF** avec dimensions et nom de fichier descriptif (`image-format`, `image-dimensions`, `image-filename`)
- [ ] **Au moins une liste** (puces / numérotée) (`content-has-lists`)

**AI-readiness (poids 0 mais sous-score séparé — le différenciateur 2026)**
- [ ] **Auteur attribué** avec **profil/sameAs** (LinkedIn) (`eeat-author`, `eeat-author-entity`)
- [ ] **Dates de publication + mise à jour** présentes (`eeat-dates`)
- [ ] **≥ 1 source externe citée** (`eeat-sources`)
- [ ] **Données chiffrées** (un `%` OU ≥ 3 nombres à 2+ chiffres) (`eeat-original-data`)
- [ ] **Réponse directe dès la 1re phrase** (≤ 30 mots) (`geo-answer-first`)
- [ ] **Au moins un H2/H3 formulé en question** (`geo-question-headings`)
- [ ] **Mention de l'année en cours** dans le texte (`freshness-year-ref`)

---

## 2. Nombre de mots cible par type d'article

Le module adapte le seuil minimum selon le type de page. Pour un **article de blog** (`isPost = true`, donc `pageType = blog`), le seuil utilisé est `MIN_WORDS_POST`.

| Type d'article | Cible recommandée | Seuil `pass` du module | Justification (code) |
|----------------|-------------------|------------------------|-----------------------|
| **Guide pilier / cornerstone** | **1 200-2 000 mots** | ≥ 800 (`content-wordcount`) + ≥ 600 si coché cornerstone (`CORNERSTONE_MIN_WORDS`) | Sujet exhaustif, couvre tout le cluster. Cocher `isCornerstone` active 4 checks supplémentaires (voir §6). |
| **Article standard** | **800-1 200 mots** | **≥ 800** (`MIN_WORDS_POST`) | En dessous de 800 → `warning` sur `content-wordcount` (poids 2). |
| **Actu / brève** | **500-800 mots** | min absolu : ≥ 200 (`MIN_WORDS_QUALITY_WARN`) ; idéal ≥ 800 | < 200 mots → `warning` critique (`quality-substantial`, poids 3). < 50 mots → `fail`. < 100 mots → `fail` sur `content-wordcount`. |

Seuils exacts en mémoire (constantes) :

- `MIN_WORDS_THIN = 100` → en dessous, `content-wordcount` passe en **fail**.
- `MIN_WORDS_QUALITY_FAIL = 50` → en dessous, `quality-substantial` est **fail** (critique, poids 3).
- `MIN_WORDS_QUALITY_WARN = 200` → en dessous, `quality-substantial` est **warning**.
- `MIN_WORDS_POST = 800` → seuil `pass` pour un article.
- `THIN_AGING_MIN_WORDS = 500` → un article < 500 mots ET vieux de plus de 180 jours est **fail** (poids 3, `freshness-thin-aging`).

> **Note honnête (intégrée dans le module)** : le nombre de mots n'est PAS un facteur de classement Google. Ces seuils sont un **plancher anti-contenu-mince**, pas une incitation à diluer. Écrivez assez pour traiter le sujet complètement, sans remplissage.

---

## 3. Le TITRE — H1 et meta title

Le **meta title** (champ Meta → Title) et le **H1** (titre de l'article) sont deux choses distinctes. Le module les vérifie séparément et **pénalise s'ils sont identiques**.

### Meta title

| Critère | Règle exacte | Check | Poids |
|---------|--------------|-------|-------|
| Présent | Obligatoire | `title-missing` | 3 (fail si vide) |
| Longueur | **30 à 60 caractères** | `title-length` | 1 (bonus) |
| Mot-clé présent | Le mot-clé doit apparaître | `title-keyword` | **3 (critique)** |
| Position mot-clé | Mot-clé dans la **première moitié** du titre | `title-keyword-position` | 2 |
| Pas de marque dupliquée | Pas de « Marque \| Marque » | `title-duplicate-brand` | 2 |
| Power word | ≥ 1 mot puissant | `title-power-words` | 1 |
| Mot émotionnel | ≥ 1 mot de sentiment | `title-sentiment` | 1 |
| Chiffre | Contient un nombre | `title-has-number` | 1 |
| Question | Commence par un mot interrogatif OU finit par « ? » | `title-is-question` | 1 |

> Le module estime aussi la largeur en **pixels** (~600px = limite SERP), informatif (poids 0). Avec 60 caractères max vous restez en sécurité.

### Power words FR à utiliser (liste exacte du module — `POWER_WORDS.fr`)

> gratuit, exclusif, nouveau, meilleur, secret, ultime, essentiel, complet, rapide, efficace, simple, garanti, prouvé, unique, incontournable, révolutionnaire, indispensable, exceptionnel, professionnel, expert, **guide**, **conseil**, **astuce**, méthode, solution, résultat, facile, puissant, fiable, premium

### Mots émotionnels / sentiment FR à utiliser (liste exacte — check `title-sentiment`)

> erreur, secret, incroyable, danger, urgent, choquant, terrible, extraordinaire, fascinant, étonnant, surprenant, impressionnant, remarquable, crucial, vital, indispensable, interdit, impossible, révolutionnaire

> ⚠️ La détection est **accent-insensible** : « révolutionnaire » est reconnu. Mais restez naturel : un seul power word + un seul mot émotionnel suffisent. N'empilez pas.

### Mots interrogatifs reconnus (check `title-is-question`)

> comment, pourquoi, quand, quel, quelle, quels, quelles, combien, où, qui, que, est-ce — ou un titre qui finit par « ? ».

### Exemples

❌ **Mauvais** : `Le référencement` (14 car., trop court, pas de power word, pas de chiffre)
❌ **Mauvais** : `Tout savoir sur le référencement naturel pour bien positionner votre site web en 2026 et plus` (> 60 car., sera tronqué par Google)
✅ **Bon** : `SEO 2026 : le guide complet en 7 étapes` (40 car., mot-clé « SEO » en tête, power word « guide » + « complet », chiffre « 7 »)
✅ **Bon** : `Pourquoi votre SEO stagne (et 5 solutions)` (43 car., format question, mot-clé en tête, chiffre, déclencheur émotionnel)

### H1 (titre de l'article)

| Critère | Règle | Check | Poids |
|---------|-------|-------|-------|
| Un seul H1 | Exactement 1 | `h1-unique` | 2 |
| Mot-clé dans le H1 | Obligatoire | `h1-keyword` | 2 |
| Différent du meta title | Ne pas être identique | `h1-title-different` | 1 |

> Pour un `post`, le **titre de l'article** est automatiquement traité comme H1 par le module. Variez sa formulation par rapport au meta title (le meta title est optimisé SERP, le H1 est optimisé lecteur).

---

## 4. Meta description

Champ Meta → Description.

| Critère | Règle exacte | Check | Poids |
|---------|--------------|-------|-------|
| Présente | Obligatoire | `meta-desc-missing` | 3 (fail si vide) |
| Longueur | **120 à 160 caractères** | `meta-desc-length` | **3 (critique)** |
| Mot-clé présent | Obligatoire | `meta-desc-keyword` | **3 (critique)** |
| CTA / verbe d'action | Verbe d'action OU formule numérique OU question | `meta-desc-cta` | 2 |

La meta description est le groupe le plus punitif : **3 checks de poids 3**. C'est là que les articles perdent le plus de points quand elle est absente ou hors longueur.

### Verbes d'action FR reconnus (liste exacte — `ACTION_VERBS.fr`)

> découvrez, contactez, obtenez, profitez, demandez, essayez, téléchargez, réservez, commandez, inscrivez, appelez, trouvez, comparez, calculez, estimez, consultez, visitez, explorez, lancez, commencez, transformez, optimisez, améliorez, boostez, créez, rejoignez, bénéficiez, accédez, simplifiez, recevez

Alternatives acceptées comme CTA : une formule « N raisons / étapes / astuces / conseils / erreurs / avantages / clés / points / façons / méthodes / techniques / outils / secrets », ou un mot interrogatif (comment, pourquoi, quand, quel…).

### Exemples

❌ **Mauvais** : `Article sur le SEO.` (19 car., trop court, pas de mot-clé, pas de CTA)
✅ **Bon** (148 car.) : `Découvrez comment améliorer votre SEO en 2026 : 7 étapes concrètes pour gagner des positions, optimiser vos articles et capter plus de trafic qualifié.` (longueur idéale, mot-clé « SEO », verbe « Découvrez » + « améliorer », chiffre)

---

## 5. Slug / URL

Champ slug de l'article.

| Critère | Règle exacte | Check | Poids |
|---------|--------------|-------|-------|
| Présent | Obligatoire | `slug-missing` | 2 (fail si vide) |
| Longueur | **≤ 75 caractères** | `slug-length` | 2 |
| Format | minuscules, chiffres, tirets uniquement (pas de majuscule ni caractère spécial) | `slug-format` | 2 |
| Mot-clé présent | Le mot-clé (slugifié) doit y être | `slug-keyword` | 2 |
| Pas de stop words | Retirer les mots vides | `slug-stopwords` | 1 (bonus) |

### Stop words FR à retirer du slug (liste exacte — `STOP_WORDS.fr`)

> le, la, les, de, des, du, un, une, et, en, pour, avec, dans, sur, par, au, aux, ce, ces, est, sont, qui, que, dont, ou, ne, pas, se, sa, son, ses, nous, vous, ils, leur, leurs

**Exception** : certaines expressions composées gardent leur stop word (`STOP_WORD_COMPOUNDS_MAP.fr`) : « en ligne », « en france », « en production », « en pratique », « sur mesure », « pour tous », « de site », « du web ». Elles ne déclenchent pas de warning.

### Exemples

❌ **Mauvais** : `Comment-Optimiser-le-SEO-de-votre-site` (majuscules + stop words « le », « de »)
✅ **Bon** : `optimiser-seo-site-web` (court, minuscules, mot-clé « seo » présent, pas de stop words)

---

## 6. Structure des titres (Hn)

| Critère | Règle exacte | Check | Poids |
|---------|--------------|-------|-------|
| Un seul H1 | Exactement 1 | `h1-unique` / `h1-missing` | 2 |
| Mot-clé dans H1 | Obligatoire | `h1-keyword` | 2 |
| Hiérarchie | Pas de saut de niveau (pas de H2 → H4 direct) | `heading-hierarchy` | 2 |
| Mot-clé dans ≥ 1 H2 | Obligatoire si des H2 existent | `h2-keyword` | 2 |
| Fréquence | **1 sous-titre tous les ~300 mots** (`WORDS_PER_HEADING = 300`) | `heading-frequency` | 1 |
| Pas de titre vide | Aucun H2-H6 vide | `a11y-empty-headings` | **3 (critique)** |
| Pas de titre en MAJUSCULES | Éviter le tout-capitales | `a11y-all-caps` | 1 |

**Règle de fréquence concrète** : un article de 1 200 mots a besoin d'au moins **4 sous-titres** (1 200 / 300). Sinon `heading-frequency` passe en warning.

### Exemple de structure (article 1 200 mots, mot-clé « audit SEO »)

```
H1  : Audit SEO : la méthode complète pour 2026         (mot-clé en début)
  H2 : Pourquoi réaliser un audit SEO ?                 (question → bonus GEO)
  H2 : Les 7 étapes d'un audit SEO efficace             (mot-clé répété)
    H3 : Étape 1 — Analyser la structure technique
    H3 : Étape 2 — Auditer le contenu
  H2 : Quels outils pour votre audit ?                  (question)
  H2 : Conclusion : par où commencer
```

### Cornerstone / pilier (si vous cochez `isCornerstone`)

Cocher cette case active 4 checks supplémentaires à **gros poids** :

- `cornerstone-wordcount` (poids 4) : **≥ 600 mots**
- `cornerstone-internal-links` (poids 4) : **≥ 5 liens internes** (`CORNERSTONE_MIN_INTERNAL_LINKS`)
- `cornerstone-focus-keyword` (poids 5, critique) : mot-clé renseigné obligatoire
- `cornerstone-meta-description` (poids 5, critique) : meta description **120-160 car.**

⚠️ Ne cochez `isCornerstone` que sur vos **vrais articles piliers** : ces checks sont exigeants et tirent le score vers le bas si non respectés.

---

## 7. Mot-clé principal et secondaires

### Champs Payload

- **`focusKeyword`** : le mot-clé principal (champ unique).
- **`focusKeywords`** : tableau de mots-clés secondaires.

### Placement du mot-clé principal (vérifié par le module)

| Emplacement | Check | Poids |
|-------------|-------|-------|
| Meta title (1re moitié) | `title-keyword` (3) + `title-keyword-position` (2) | 3 / 2 |
| Meta description | `meta-desc-keyword` | 3 |
| H1 | `h1-keyword` | 2 |
| ≥ 1 H2 | `h2-keyword` | 2 |
| **1er paragraphe** (100 premiers mots / ~500 premiers caractères) | `content-keyword-intro` | 2 |
| Slug | `slug-keyword` | 2 |
| Alt d'au moins une image | `images-alt-keyword` | 1 |

### Densité — la règle est INVERSÉE (anti-stuffing uniquement)

Le module **ne récompense PAS** une densité minimale (un plancher de densité est un mythe qui pousse au bourrage de mots-clés). Il **pénalise seulement le sur-bourrage** :

- Densité **≤ 2,5 %** → `pass` (informatif, poids 0). Aucune obligation de répéter le mot-clé.
- Densité **> 2,5 %** (`KEYWORD_DENSITY_WARN`) → **warning** (poids 2).
- Densité **> 3 %** (`KEYWORD_DENSITY_MAX`) → **fail critique** (poids 3).

> Écrivez naturellement. Utilisez des **synonymes** et le **champ lexical** plutôt que de marteler le mot-clé. Une densité de 0,8-1,5 % est parfaite.

### Mots-clés secondaires (`focusKeywords`)

Pour chaque mot-clé secondaire, le module vérifie (tous poids 1, bonus) : présence dans le title, dans la meta description, dans le contenu, dans un H2/H3. Placez chaque mot-clé secondaire dans **au moins un sous-titre** et dans le corps.

---

## 8. LISIBILITÉ — SECTION CRITIQUE (le plafond réel de vos scores)

> **Constat terrain (dogfooding sur consilioweb.fr)** : c'est ICI que les articles existants plafonnent. Flesch FR souvent entre **11 et 35/100** (« texte difficile »), jusqu'à **46 % de phrases de plus de 25 mots** (max visé 30 %), et seulement **~3 % de mots de transition** (visé 15 %). Tous les checks de lisibilité de poids 2 sont donc en warning ou fail → le score SEO est plombé. **Réglez la lisibilité et le score décolle.**

### Les seuils exacts

| Check | Seuil exact | Statut | Poids | Catégorie |
|-------|-------------|--------|-------|-----------|
| `readability-flesch` | **≥ 40** → pass ; 25-39 → warning ; **< 25 → fail** | (`FLESCH_THRESHOLDS.fr`) | **2** | important |
| `readability-long-sentences` | **≤ 30 %** de phrases > 25 mots → pass ; > 30 % → warning | (`LONG_SENTENCE_MAX_RATIO = 0.3`, `longSentenceWords = 25`) | **2** | important |
| `readability-long-paragraphs` | **Aucun** paragraphe > 150 mots (`LONG_PARAGRAPH_WORDS`) | | **2** | important |
| `readability-long-sections` | **Aucune** section > 400 mots sans sous-titre (`LONG_SECTION_THRESHOLD = 400`) | | **2** | important |
| `readability-consecutive-starts` | < 3 phrases consécutives commençant par le même mot | | **1** | bonus |
| `readability-transitions` | **≥ 15 %** des phrases avec mot de transition (`transitionsMin = 0.15`) | | **0** (AI-readiness) | bonus |
| `readability-passive` | **≤ 15 %** de phrases passives (`passiveMax = 0.15`) | | **0** (AI-readiness) | bonus |

### Comprendre le Flesch FR

Formule (Kandel-Moles) utilisée par le module :

```
Flesch FR = 207 − 1,015 × (mots / phrases) − 73,6 × (syllabes / mots)
```

Concrètement, **deux leviers** font monter le score :
1. **Raccourcir les phrases** (moins de mots par phrase).
2. **Utiliser des mots courts** (moins de syllabes par mot).

Cible : **Flesch ≥ 40** pour le `pass`. Visez 50-60 pour une marge de sécurité.

### Techniques concrètes de réécriture

1. **Une idée = une phrase.** Dès qu'une phrase contient « , et », « , qui », « , ce qui », « , car » → coupez-la en deux.
2. **Phrases ≤ 20 mots en moyenne**, ≤ 25 mots au maximum. Au-delà de 25 mots, la phrase compte comme « longue » (max 30 % de longues).
3. **Mots simples** : « utiliser » plutôt que « mettre en œuvre », « car » plutôt que « dans la mesure où ».
4. **Paragraphes courts** : 2-4 phrases, **jamais plus de 150 mots**. Aérez.
5. **Sous-titre tous les 300 mots** : aucune section ne doit dépasser 400 mots sans H2/H3.
6. **Varier les débuts de phrase** : ne pas enchaîner 3 phrases qui commencent par le même mot.
7. **Voix active** : « Google indexe la page » plutôt que « La page est indexée par Google ».

### Mots de transition FR à semer (≥ 15 % des phrases) — liste exacte du module

Le module détecte ces connecteurs en **début de phrase**, ou précédés d'une virgule, ou entourés d'espaces. Visez **au moins 1 phrase sur 7** qui en contient un.

- **Addition** : de plus, en outre, par ailleurs, également, aussi, de même, d'une part, d'autre part, qui plus est, de surcroît, non seulement
- **Opposition** : cependant, néanmoins, toutefois, en revanche, tandis que, alors que, bien que, même si, pourtant, malgré tout, au contraire, or
- **Cause / conséquence** : par conséquent, en effet, ainsi, donc, car, puisque, étant donné que, en raison de, à cause de, grâce à, c'est pourquoi, de ce fait
- **But** : afin de, dans le but de, pour que, de manière à
- **Séquence** : puis, ensuite, enfin, premièrement, deuxièmement, troisièmement, finalement, en conclusion, tout d'abord, d'abord, pour commencer, pour finir
- **Illustration / emphase** : par exemple, c'est-à-dire, autrement dit, en d'autres termes, en fait, en réalité, surtout, notamment, en particulier, à savoir
- **Condition** : à condition que, pourvu que, en cas de, si
- **Conclusion** : bref, en somme, en résumé, pour conclure, en définitive, somme toute, tout compte fait

### Exemples

❌ **Mauvais** (phrase de 41 mots, Flesch en chute, 0 transition) :
> « Le référencement naturel, qui constitue aujourd'hui un levier d'acquisition incontournable pour les entreprises souhaitant développer leur visibilité en ligne, nécessite la mise en œuvre d'une stratégie cohérente intégrant à la fois des aspects techniques et éditoriaux. »

✅ **Bon** (3 phrases courtes, transition « par exemple », voix active) :
> « Le référencement naturel est un levier d'acquisition majeur. Il aide les entreprises à gagner en visibilité. Pour réussir, combinez technique et contenu. Par exemple, optimisez vos balises **et** publiez régulièrement. »

---

## 9. Maillage interne

| Critère | Règle exacte | Check | Poids |
|---------|--------------|-------|-------|
| Liens internes | **≥ 1** (warning si 0) ; **≥ 3 = excellent** | `linking-internal` | 2 |
| Ancres descriptives | **Aucune ancre générique** | `linking-generic-anchors` | 2 |
| Pas de lien vide | Pas de `href=""` ni `href="#"` | `linking-empty` | 2 |
| Densité de liens | Texte des liens **< 30 %** du contenu (> 30 % warning, > 50 % fail) | `a11y-link-density` | 2 |
| Ancres ≥ 3 caractères | Pas d'ancres de 1-2 caractères | `a11y-short-anchors` | 2 |

**Objectif pratique : ≥ 3 liens internes contextuels** par article.

### Ancres génériques INTERDITES (liste exacte — `GENERIC_ANCHORS.fr` + `.en`)

> cliquez ici, cliquer ici, en savoir plus, ici, lire la suite, plus, voir plus, lien — click here, read more, here, more, learn more, this, link

Le check vérifie FR **et** EN. Utilisez une ancre qui **décrit la page cible**.

### Principe de silo / cluster thématique

- Reliez chaque article à votre **page service** pertinente (ex. : un article « audit SEO » → la page « Service Audit SEO »).
- Reliez les articles d'un même thème entre eux (le **cluster**), tous pointant vers le **guide pilier** (cornerstone) du sujet.
- Le pilier renvoie vers chaque article du cluster (≥ 5 liens internes si `isCornerstone`).

### Exemples

❌ **Mauvais** : « Pour en savoir plus, [cliquez ici](/services). »
✅ **Bon** : « Découvrez notre [service d'audit SEO technique](/services/audit-seo) pour aller plus loin. »

---

## 10. Liens externes

| Critère | Règle | Check | Poids |
|---------|-------|-------|-------|
| ≥ 1 lien externe | warning si 0 (sauf pages contact/légal/form) | `linking-external` | 1 (bonus) |
| Sources citées (E-E-A-T) | ≥ 1 lien externe | `eeat-sources` | 0 (AI-readiness) |

Citez **au moins une source faisant autorité** par article : étude, donnée officielle (INSEE, Google, Search Console docs), référence sectorielle reconnue. Cela renforce la crédibilité (E-E-A-T) et alimente le sous-score AI-readiness.

✅ **Bon** : « Selon [l'étude Backlinko 2025](https://backlinko.com/...), les pages en position 1 contiennent en moyenne 1 447 mots. »

---

## 11. Images

| Critère | Règle exacte | Check | Poids |
|---------|--------------|-------|-------|
| ≥ 1 image | warning si 0 ; pour un post : **fail** si 0 image | `images-present` / `images-quantity` | 2 |
| Alt présent | **≥ 80 %** des images (`ALT_TEXT_MIN_RATIO = 0.8`) ; < 80 % = fail | `images-alt` | 2 |
| Alt de qualité | Pas un nom de fichier, pas générique (« image1 », « photo.jpg ») | `a11y-alt-quality` | 2 |
| Alt ≠ titre/H | **Alt différent des titres de la page** | `a11y-alt-duplicates-context` | 1 |
| Mot-clé dans 1 alt | Mot-clé OU alt descriptif ≥ 20 caractères (`ALT_TEXT_MIN_LENGTH`) | `images-alt-keyword` | 1 |
| Format optimisé | **WebP ou AVIF** (sinon warning) | `image-format` | 1 |
| Dimensions | width + height connus | `image-dimensions` | 1 |
| Nom de fichier | Pas générique (`IMG_1234`, `screenshot`, `capture`, `DSC_`, `unnamed`, `untitled`…) | `image-filename` | 1 |

> **Constat terrain** : beaucoup d'articles ont un **alt identique au titre de l'article** (redondant pour les lecteurs d'écran → warning `a11y-alt-duplicates-context`) et des images **non converties en WebP/AVIF**.

### Règles d'or pour l'alt

1. **Décrire l'image**, pas répéter le titre. « Tableau de bord Google Search Console montrant la courbe de clics » ≠ le H1.
2. **Unique** par image.
3. **≥ 20 caractères** si vous n'y mettez pas le mot-clé.
4. Nom de fichier **descriptif** : `audit-seo-dashboard.webp` et non `IMG_0042.jpg`.
5. **WebP/AVIF** systématiquement (conversion à l'upload).

### Exemples

❌ **Mauvais** : fichier `screenshot-2026.png`, alt = « Audit SEO : la méthode complète » (= le H1)
✅ **Bon** : fichier `audit-seo-search-console.webp`, alt = « Courbe de clics dans Google Search Console après un audit SEO »

---

## 12. E-E-A-T (Expertise, Authority, Trust) — sous-score AI-readiness

Ces checks sont **poids 0** (ne bougent pas le score SEO) mais alimentent **l'indicateur AI-readiness**, déterminant pour être cité par les IA en 2026. À ne pas négliger.

| Signal | Règle exacte | Check | Champ Payload |
|--------|--------------|-------|---------------|
| Auteur attribué | `author` non vide | `eeat-author` | `author` |
| Entité auteur (sameAs) | `authorUrl` non vide (LinkedIn / page auteur) | `eeat-author-entity` | `authorUrl` |
| Dates pub + maj | `publishedAt` ET `updatedAt` présents | `eeat-dates` | `publishedAt`, `updatedAt` |
| Sources citées | ≥ 1 lien externe | `eeat-sources` | (liens dans le contenu) |
| Données originales | un `%` OU **≥ 3 nombres de 2+ chiffres** dans le texte | `eeat-original-data` | (contenu) |

> Les checks E-E-A-T ne tournent **que** sur les pages substantielles (pas légal/contact/form/home) et **≥ 100 mots**.

### À faire systématiquement

1. **Attribuer un auteur réel** (pas « Admin ») avec une courte bio.
2. **Renseigner `authorUrl`** : son LinkedIn ou sa page auteur (devient `sameAs` dans le JSON-LD).
3. **Date de mise à jour** : voir aussi le champ `contentLastReviewed` (§13).
4. **Citer ≥ 1 source externe** fiable.
5. **Inclure des données chiffrées** : statistiques, résultats, pourcentages. C'est le levier de visibilité n°1 en 2026 (contenu de première main).

---

## 13. Fraîcheur du contenu (freshness)

| Check | Règle exacte | Statut | Poids |
|-------|--------------|--------|-------|
| `freshness-age` | maj **≤ 180 j** → pass ; > 180 j → warning ; **> 365 j → fail** | (`FRESHNESS_DAYS_WARN = 180`, `FAIL = 365`) | **3** |
| `freshness-reviewed` | `contentLastReviewed` **≤ 180 j** (`REVIEW_DAYS_WARN`) | pass/warning | 2 |
| `freshness-year-ref` | Mentionner **l'année en cours** dans le texte | pass | 2 |
| `freshness-thin-aging` | article < 500 mots ET > 180 j = **fail** | | 3 |
| `freshness-fake-refresh` | date affichée >> date réelle de maj (60 j) | warning | 0 |

**Concrètement** :

- Mettez à jour vos articles **au moins une fois par an** (sinon `fail` poids 3 — très punitif).
- Renseignez **`contentLastReviewed`** (champ « dernière révision ») à chaque relecture.
- **Mentionnez l'année en cours** (« en 2026 ») dans le corps → `freshness-year-ref` passe en `pass`.
- ⚠️ Ne « rafraîchissez » pas une date sans toucher le contenu : le module (et Google) détectent le faux refresh.

---

## 14. Données structurées / JSON-LD (schema)

Le module détecte le **type de schema attendu** selon la page. Pour un article : **`Article`**. Champs requis pour l'éligibilité rich result (poids 1, `schema-coverage`) :

| Type | Champs requis | Champs recommandés |
|------|---------------|--------------------|
| **Article** | `headline`, `image` | author, datePublished, dateModified, publisher |
| **FAQPage** | `mainEntity` | (plus de rich result depuis mai 2026, mais toujours utile pour l'IA) |
| **BreadcrumbList** | `itemListElement` | — |

Le module vérifie ce qu'il peut déduire du CMS (`headline`, `name`, `image`, `url`, `itemListElement`, `mainEntity`). Pour passer le check :

- **Title/H1 rempli** → `headline` OK.
- **Au moins une image** → `image` OK.
- Le module **rappelle** de confirmer les champs qu'il ne peut pas vérifier (author, datePublished…). Renseignez auteur + dates.

> Le JSON-LD est souvent injecté au rendu (frontend) : ce check est **guidance** (poids faible), jamais une pénalité dure. Mais remplir auteur + image + dates le fait passer au vert.

**FAQ** : ajoutez un bloc FAQ (`faq`/`faqBlock`) → génère du `FAQPage` + alimente le GEO (mainEntity). Toujours valide même sans rich result.

---

## 15. GEO / AEO 2026 — optimisation pour les moteurs génératifs (IA)

C'est **le différenciateur 2026** : être extrait et **cité** par AI Overviews, ChatGPT, Perplexity. Checks **poids 0** mais alimentent l'AI-readiness. Ils ne tournent que sur les pages substantielles **≥ 150 mots**.

| Signal | Règle exacte | Check |
|--------|--------------|-------|
| **Réponse en tête (answer-first / BLUF)** | La 1re phrase fait **≤ 30 mots** | `geo-answer-first` |
| **Titres en question** | ≥ 1 H2/H3 formulé en question | `geo-question-headings` |
| **Contenu extractible** | Au moins une **liste OU un tableau** | `geo-extractable-structure` |
| **Contenu découpé** | ~1 sous-titre tous les 300 mots | `geo-chunked` |

### Techniques

1. **Answer-first** : répondez à l'intention en **1 phrase courte (≤ 30 mots)** dès l'intro, avant de développer. Format BLUF (Bottom Line Up Front).
2. **Bloc TL;DR / résumé** en haut d'article.
3. **FAQ** en fin d'article (questions/réponses = format que l'IA adore citer).
4. **Sous-titres en questions** : « Comment faire un audit SEO ? », « Pourquoi mon trafic baisse ? ».
5. **Entités nommées** : citez des marques, outils, lieux, personnes précis.
6. **Listes et tableaux** : structurez énumérations et comparaisons.
7. **`llms.txt`** : fichier à la racine du site listant vos contenus de référence (servi côté frontend / projet, pas via cet article).

### Exemple d'intro answer-first

✅ **Bon** :
> « **Un audit SEO se réalise en 7 étapes : technique, contenu, maillage, backlinks, performance, mobile et suivi.** Voici comment procéder concrètement, avec les outils adaptés à chaque phase. »
> (1re phrase = 23 mots, réponse directe, chiffre, puis développement)

---

## 16. À NE SURTOUT PAS FAIRE — anti-patterns

| Anti-pattern | Pourquoi c'est pénalisé | Check impacté |
|--------------|--------------------------|----------------|
| **Keyword stuffing** (densité > 3 %) | Fail critique poids 3 ; signal de spam Google | `content-keyword-density` |
| **Phrases à rallonge** (> 25 mots, > 30 %) | Plombe le Flesch et `long-sentences` (poids 2 ×) | `readability-flesch`, `readability-long-sentences` |
| **Meta title > 60 caractères** | Tronqué par Google ; warning | `title-length` |
| **Ancres génériques** (« cliquez ici »…) | Warning poids 2 ; mauvais pour l'accessibilité et le SEO | `linking-generic-anchors` |
| **Contenu IA non relu / placeholder** | « lorem ipsum », « TODO », « à compléter » → **fail critique** | `content-no-placeholder`, `quality-no-duplicate` |
| **Alt = titre de l'article** | Redondant pour lecteurs d'écran → warning | `a11y-alt-duplicates-context` |
| **Alt = nom de fichier** (`photo.jpg`) | Warning ; inutile pour l'accessibilité | `a11y-alt-quality` |
| **Zéro lien interne / externe** | Warning sur `linking-internal` (poids 2) + perte AI-readiness | `linking-internal`, `eeat-sources` |
| **Murs de texte** (paragraphes > 150 mots, sections > 400 mots) | Warning poids 2 chacun | `readability-long-paragraphs`, `readability-long-sections` |
| **Dates absentes / périmées** (> 365 j) | **Fail poids 3** | `freshness-age`, `eeat-dates` |
| **Pas de sources / pas de chiffres** | Perte d'AI-readiness (E-E-A-T) | `eeat-sources`, `eeat-original-data` |
| **Contenu mince** (< 200 mots) | Warning/fail critique poids 3 | `quality-substantial`, `content-wordcount` |
| **H1 = meta title** | Warning poids 1 | `h1-title-different` |
| **Plusieurs H1** | Warning poids 2 | `h1-unique` |
| **Titre vide (H2-H6)** | **Fail critique poids 3** | `a11y-empty-headings` |
| **Images > 50 % du contenu en liens** | Fail accessibilité poids 2 | `a11y-link-density` |

---

## 17. Checklist finale avant publication

**Champs Payload remplis**
- [ ] `focusKeyword` (mot-clé principal)
- [ ] `focusKeywords` (secondaires, si pertinents)
- [ ] Meta → Title (30-60 car., mot-clé en tête)
- [ ] Meta → Description (120-160 car., mot-clé, CTA)
- [ ] Meta → Image (OG image)
- [ ] Slug (≤ 75 car., mot-clé, sans stop words)
- [ ] `author` + `authorUrl` (LinkedIn / page auteur)
- [ ] `publishedAt` + `contentLastReviewed`
- [ ] `isCornerstone` coché uniquement si vrai pilier

**Contenu**
- [ ] ≥ 800 mots (article) / ≥ 600 (pilier)
- [ ] Mot-clé dans : title, meta desc, H1, ≥ 1 H2, 1er paragraphe
- [ ] Densité ≤ 2,5 %
- [ ] Un seul H1, hiérarchie Hn propre, ≥ 1 sous-titre / 300 mots
- [ ] Aucun placeholder, aucune section vide

**Lisibilité (le plafond)**
- [ ] Flesch FR ≥ 40 (visez 50+)
- [ ] ≤ 30 % de phrases > 25 mots
- [ ] Aucun paragraphe > 150 mots
- [ ] Aucune section > 400 mots sans sous-titre
- [ ] ≥ 15 % des phrases avec mot de transition
- [ ] Voix active dominante

**Liens et images**
- [ ] ≥ 3 liens internes, ancres descriptives (jamais « cliquez ici »)
- [ ] ≥ 1 lien externe vers une source fiable
- [ ] ≥ 1 image en WebP/AVIF, alt unique et descriptif (≠ titre), nom de fichier parlant

**AI-readiness 2026**
- [ ] Réponse directe (≤ 30 mots) dès l'intro
- [ ] ≥ 1 H2/H3 en question + FAQ en fin d'article
- [ ] ≥ 1 liste ou tableau
- [ ] Données chiffrées (% ou ≥ 3 nombres)
- [ ] Année en cours mentionnée

**Vérification finale**
- [ ] Le panneau SEO de la sidebar affiche un score **≥ 91** (excellent) — ou au minimum **≥ 71** (bon)
- [ ] Le sous-indicateur **AI-readiness** est au vert

---

*Guide aligné sur `@consilioweb/payload-seo-analyzer`. Tous les seuils sont extraits du code des règles (`src/rules/`, `src/constants.ts`, `src/helpers.ts`, `src/i18n.ts`). En cas de doute, le panneau SEO de la sidebar fait foi : il donne le message et l'astuce exacts pour chaque check.*
