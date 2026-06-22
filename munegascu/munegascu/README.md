# 🇲🇨 Münegascu — Traducteur Monégasque

> Application web de traduction français ↔ monégasque — dictionnaire, grammaire, conjugaison, prononciation, modération communautaire.

---

## Structure du projet

```
munegascu/
├── index.html              ← Page principale (HTML pur, sans framework)
├── src/
│   ├── css/
│   │   └── main.css        ← Tous les styles (variables, composants, responsive)
│   ├── js/
│   │   ├── security.js     ← Module de sécurité central (auth, validation, anti-XSS)
│   │   ├── translator.js   ← Moteur de traduction intelligent
│   │   ├── ui.js           ← Interface : onglets, dictionnaire, corrections
│   │   ├── admin.js        ← Panneau admin, import CSV, conflits
│   │   ├── history.js      ← Historique des traductions de session
│   │   ├── quiz.js         ← Mode quiz / flashcards
│   │   ├── spellcheck.js   ← Correction orthographique inline (FR opt-in, MC local)
│   │   └── audio.js        ← Prononciation Web Speech API
│   └── data/
│       ├── database.js        ← BDD principale : mots, phrases, conjugaisons, patterns
│       └── database_extra.js  ← Mots supplémentaires, fusionnés automatiquement dans DB_WORDS
├── docs/                   ← Documentation complémentaire
├── .gitignore
└── README.md
```

### Ordre de chargement des scripts

```
security.js → database.js → database_extra.js → translator.js → ui.js → admin.js → history.js → quiz.js → spellcheck.js → audio.js
   (sécu)         (data)          (data+)             (moteur)      (vue)    (actions)  (histo)     (quiz)    (orthographe)   (son)
```

---

## Démarrage rapide

### Local (sans serveur)
```bash
# Option 1 : double-clic sur index.html (Chrome, Edge, Safari)

# Option 2 : serveur local Python
python3 -m http.server 8080
# → http://localhost:8080
```

> ⚠️ Firefox peut bloquer les modules JS en `file://`. Préférer un serveur local.

### Avec VS Code
Installer l'extension **Live Server**, clic droit sur `index.html` → *Open with Live Server*.

---

## Mise en ligne

### Option 1 — GitHub Pages (gratuit, recommandé)

```bash
# 1. Créer un dépôt GitHub public nommé "munegascu"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE_PSEUDO/munegascu.git
git push -u origin main

# 2. Dans GitHub : Settings → Pages → Source : main / (root)
# → Disponible sur : https://VOTRE_PSEUDO.github.io/munegascu
```

### Option 2 — Netlify (gratuit, déploiement automatique)

```bash
# Via CLI
npm install -g netlify-cli
netlify deploy --dir . --prod
# → URL personnalisée : https://munegascu.netlify.app
```

Ou via l'interface web : glisser le dossier `munegascu/` sur [app.netlify.com](https://app.netlify.com).

### Option 3 — Vercel (gratuit)

```bash
npm install -g vercel
vercel --prod
# → https://munegascu.vercel.app
```

### Option 4 — Hébergement classique (FTP/SFTP)

Transférer tous les fichiers sur votre hébergeur en conservant la structure :
```
public_html/
├── index.html
└── src/
    ├── css/main.css
    ├── js/translator.js
    ├── js/ui.js
    ├── js/admin.js
    ├── js/audio.js
    └── data/database.js
```

---

## Mot de passe admin

Le mot de passe n'est jamais stocké en clair : `src/js/security.js` conserve
uniquement un hash PBKDF2 (sel aléatoire, 600 000 itérations) dans
`ADMIN_CREDENTIAL`, comparé en temps constant.

Un mot de passe initial aléatoire a déjà été généré pour ce dépôt — voir
`NOUVEAU_MOT_DE_PASSE_ADMIN.txt`. **Changez-le avant tout déploiement réel** :

```javascript
// 1. Dans la console du navigateur :
await Security.generateCredential('votre_nouveau_mot_de_passe')
// → affiche "salt_hex:hash_hex"

// 2. Collez ce résultat dans src/js/security.js :
const ADMIN_CREDENTIAL = 'salt_hex:hash_hex';
```

Pour un déploiement à plusieurs administrateurs ou avec révocation d'accès,
remplacer ce mécanisme client par une vérification serveur (l'authentification
front-end seule reste un compromis adapté à un usage mono-admin sans backend) :

```javascript
// ✅ Production multi-admin : vérification serveur
const res = await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ pwd }) });
if ((await res.json()).ok) { ... }
```

---

## Ajouter des mots

**Via CSV** (panneau admin) :
```csv
fr,mc,phonetic,cat
balcon,Barcun,barkœ̃,habitat
terrasse,Terassa,terasa,habitat
```

**Via le script Python** (depuis un dictionnaire brut) :
```bash
python scripts/convert_monegasque.py source.csv dictionnaire.csv
```
Puis importer `dictionnaire.csv` via le panneau admin.

---

## Licence

- Code : **MIT**
- Données linguistiques : **CC BY-SA 4.0**
