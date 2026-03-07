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
│   │   ├── translator.js   ← Moteur de traduction intelligent
│   │   ├── ui.js           ← Interface : onglets, dictionnaire, corrections
│   │   ├── admin.js        ← Panneau admin, import CSV, conflits
│   │   └── audio.js        ← Prononciation Web Speech API
│   └── data/
│       └── database.js     ← BDD : mots, phrases, conjugaisons, patterns
├── docs/                   ← Documentation complémentaire
├── .gitignore
└── README.md
```

### Ordre de chargement des scripts

```
database.js  →  translator.js  →  ui.js  →  admin.js  →  audio.js
   (data)          (moteur)       (vue)      (actions)    (son)
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

En production, remplacer dans `src/js/admin.js` :

```javascript
// ❌ Démo seulement
if (pwd === 'admin') { ... }

// ✅ Production : vérification serveur (fetch POST)
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
