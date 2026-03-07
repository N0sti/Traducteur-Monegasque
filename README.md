# 🇲🇨 Traducteur Monégasque — Münegascu

> Application web de traduction français ↔ monégasque, entièrement autonome (un seul fichier HTML), avec moteur de traduction intelligent, prononciation audio, gestion communautaire des corrections et panneau d'administration sécurisé.

---

## Présentation

Le **monégasque** (*münegascu*) est une langue ligurienne proche du génois, patrimoine linguistique officiel de la Principauté de Monaco depuis 1997. Cette application vise à rendre la langue accessible au plus grand nombre, tout en permettant à une communauté de contributeurs d'enrichir progressivement la base de données.

L'application est un **fichier HTML unique**, sans dépendance serveur, sans base de données externe, sans installation. Elle s'ouvre directement dans un navigateur moderne.

---

## Fonctionnalités

### 🔤 Traducteur intelligent (français ↔ monégasque)

- **Traduction bidirectionnelle** : bouton ⇄ pour inverser la direction
- **Moteur à plusieurs niveaux** :
  1. Reconnaissance de phrases complètes stockées
  2. Reconnaissance de structures grammaticales (« je m'appelle X », « je ne… pas », « je suis X »…)
  3. Résolution de formes verbales fléchies (« suis », « vais », « mange »… → forme conjuguée en monégasque)
  4. Traduction mot à mot avec résolution de groupes (2-3 tokens)
  5. Détection automatique des noms propres (conservés tels quels, surlignés en violet)
- **Badge de confiance** : ✅ élevée / ⚡ moyenne / ⚠️ faible
- **Analyse tokenisée** : chaque mot est coloré selon son statut (traduit, déduit par grammaire, nom propre, non trouvé)
- **Prononciation audio** via Web Speech API (voix italienne par défaut pour le monégasque, française pour le français) — aucune clé API requise

### 📚 Dictionnaire & Phrases

- **Plus de 250 mots** répartis en 14 catégories : salutations, nature, famille, chiffres, quotidien, cuisine, corps, couleurs, adjectifs, verbes, Monaco, animaux, saisons, pronoms
- **35+ phrases usuelles** complètes
- Filtrage par catégorie, recherche textuelle en temps réel
- Basculement entre vue « Mots » et vue « Phrases »
- Clic sur un mot → chargé directement dans le traducteur

### 📐 Grammaire

Section de référence complète :

- Alphabet et prononciation (graphèmes spéciaux : ü, ö, sc, gi, ci…)
- Articles définis et indéfinis (avec élision)
- Genre et nombre des noms
- Pronoms personnels (sujet, COD, COI)
- Prépositions essentielles
- Adjectifs démonstratifs et possessifs
- Interrogatifs
- Adverbes courants
- Structure de la phrase (affirmative, négative, interrogative, exclamative)

### 🔀 Conjugueur

- **18 verbes** conjugués : être, avoir, aller, faire, aimer, vouloir, pouvoir, dire, parler, manger, boire, venir, savoir, voir, donner, appeler, habiter, trouver
- **6 temps** : présent, imparfait, futur, conditionnel, subjonctif, impératif
- Prononciation 🔊 disponible sur chaque forme conjuguée
- Recherche libre ou sélection rapide par clic

### ✏️ Corrections participatives (communauté)

Tout utilisateur peut proposer une correction sur une traduction :

1. Traduire une phrase
2. Cliquer sur **« Corriger cette traduction »**
3. Saisir la correction proposée et soumettre
4. La suggestion est enregistrée et soumise à validation admin

### ⚙️ Panneau Administrateur

Accessible via le bouton **Admin** en haut à droite (mot de passe requis).

**Gestion des suggestions :**
- Liste de toutes les corrections soumises par les utilisateurs
- Pour chaque suggestion : affichage du texte original, de la traduction actuelle et de la correction proposée
- Actions disponibles : modifier la correction, valider (intégration immédiate en base) ou rejeter
- Une correction validée met à jour le dictionnaire en temps réel

**Import CSV :**
- Glisser-déposer ou sélection d'un fichier `.csv`
- Format attendu : `fr,mc,phonetic,cat`
- Résolution interactive des conflits (mots déjà présents dans la base)

**Ajout manuel :**
- Formulaire pour ajouter un mot directement (français, monégasque, phonétique, catégorie)

**Export CSV :**
- Téléchargement de l'intégralité du dictionnaire au format CSV

### 📥 Import CSV avec résolution de conflits (style Git)

Quand un fichier CSV contient des mots déjà présents en base, une fenêtre de résolution s'ouvre :

- **Résolution globale** : « Prendre tous les CSV », « Garder tous les existants », « Ignorer tous les conflits »
- **Résolution individuelle** : pour chaque conflit, les deux versions (base vs CSV) sont affichées côte à côte — cliquer pour choisir
- La résolution applique les choix et intègre les mots sans conflit automatiquement

---

## Utilisation

### Ouvrir l'application

Aucune installation requise. Ouvrir le fichier `traducteur-monegasque.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari).

```
Double-clic sur traducteur-monegasque.html
```

### Traduire

1. Sélectionner l'onglet **Traducteur**
2. Saisir un mot ou une phrase dans la zone de texte gauche
3. Cliquer sur **Traduire** (ou appuyer sur Entrée)
4. La traduction apparaît à droite, accompagnée de l'analyse tokenisée

### Inverser la direction

Cliquer sur le bouton **⇄** entre les deux zones pour passer de français→monégasque à monégasque→français.

### Écouter la prononciation

Cliquer sur le bouton **🔊 Écouter** pour entendre la traduction. Choisir une voix dans le sélecteur (voix italienne recommandée pour le monégasque). Les boutons 🔊 sur les cartes du dictionnaire permettent aussi d'écouter chaque mot individuellement.

### Proposer une correction

1. Effectuer une traduction
2. Cliquer sur **✏️ Corriger cette traduction** (apparaît sous la zone de traduction)
3. Saisir la correction
4. Cliquer sur **Soumettre** → la suggestion est envoyée à l'administrateur

### Accéder à l'administration

1. Cliquer sur **⚙️ Admin** (en haut à droite)
2. Entrer le mot de passe (`admin` en mode démo)
3. Gérer les suggestions, importer un CSV, ajouter ou supprimer des mots

### Importer un CSV

Format du fichier (encodage UTF-8, séparateur virgule) :

```csv
fr,mc,phonetic,cat
balcon,Barcun,barkœ̃,habitat
terrasse,Terassa,terasa,habitat
prince,Principu,printʃipy,monaco
```

- `fr` : mot en français **(obligatoire)**
- `mc` : traduction en monégasque **(obligatoire)**
- `phonetic` : transcription phonétique *(optionnel)*
- `cat` : catégorie *(optionnel, défaut : « import »)*

---

## Architecture technique

| Élément | Détail |
|---|---|
| Type de fichier | HTML5 single-file (CSS + JS inline) |
| Dépendances externes | Google Fonts (Playfair Display, Lato) |
| Audio | Web Speech API (natif navigateur, sans clé) |
| Stockage | Mémoire vive (in-memory) — pas de localStorage |
| Serveur requis | Non |
| Compatibilité | Chrome 90+, Firefox 88+, Edge 90+, Safari 14+ |

### Moteur de traduction — niveaux de résolution

```
Entrée
  │
  ├─ 1. Correspondance phrase exacte → résultat direct
  │
  ├─ 2. Pattern grammatical (regex) → construction MC
  │       ex: "je m'appelle X" → "Me ciamu X"
  │
  ├─ 3. Forme verbale fléchie → conjugaison MC
  │       ex: "mange" → "Mangia" (présent, 3e pers.)
  │
  ├─ 4. Multi-token (2-3 mots) → entrée dictionnaire
  │
  ├─ 5. Token seul → entrée dictionnaire
  │
  └─ 6. Nom propre (majuscule hors début) → conservé
         Token inconnu → affiché en rouge
```

### Détection des noms propres

Un mot est considéré comme nom propre si :
- Il commence par une majuscule
- Il n'est **pas** en début de phrase (premier token ou après `.!?`)
- Il n'est **pas** présent dans le dictionnaire source

Il est alors conservé tel quel dans la traduction et surligné en violet dans l'analyse.

---

## Contributeurs & Modération

Le système participatif fonctionne en deux temps :

| Rôle | Actions |
|---|---|
| **Utilisateur** | Consulter, traduire, proposer des corrections |
| **Administrateur** | Valider/rejeter les corrections, importer du vocabulaire, gérer la base |

Les corrections validées par l'admin sont intégrées immédiatement dans le dictionnaire actif (en mémoire). Pour une persistance permanente, exporter le dictionnaire via **💾 Exporter CSV** après validation, puis réimporter le fichier à la prochaine session.

---

## Sécurité

> Le mot de passe admin est `admin` dans la version de démonstration. Pour un déploiement réel, remplacer la ligne suivante dans le code JavaScript :

```javascript
// Ligne à modifier dans le JS :
if(pwd==='admin'){
```

Par une vérification serveur ou un hash SHA-256 côté client.

---

## Limites connues

- Les données sont **en mémoire** : elles sont réinitialisées à chaque rechargement de page. Exporter le CSV avant de fermer pour conserver les ajouts.
- La voix monégasque n'existe pas nativement dans les navigateurs : la voix **italienne** est utilisée comme approximation phonétique (le monégasque étant d'origine ligurienne/génoise).
- Le moteur de traduction est **basé sur des règles** (non neuronal) : les phrases complexes ou idiomatiques peuvent être partiellement traduites.
- Les formes verbales reconnues couvrent principalement le présent de l'indicatif.

---

## Feuille de route

- [ ] Persistance via `localStorage` (opt-in)
- [ ] Ajout de formes verbales conjuguées à tous les temps
- [ ] Reconnaissance de formes contractées (« j'ai », « c'est »…)
- [ ] Accord automatique des adjectifs (genre/nombre)
- [ ] Mode quiz / apprentissage
- [ ] Export vers Anki (flashcards)
- [ ] API REST pour synchronisation multi-sessions

---

## Références linguistiques

- *Grammaire du Monégasque* — Charles Castellan
- *Dictionnaire Monégasque-Français* — Robert Arrighi
- Institut Monégasque de la Statistique et des Études Économiques (IMSEE)
- Enseignement du monégasque — Direction de l'Éducation Nationale, de la Jeunesse et des Sports de Monaco

---

*🇲🇨 Viva Mùnegu — Longue vie à Monaco*
