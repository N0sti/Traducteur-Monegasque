# Notes linguistiques — Traducteur Münegascu

Ce document recense les sources utilisées pour la mise à jour du contenu
linguistique du 22/06/2026, et les points qui restent à valider par un
locuteur natif ou un expert (voir aussi `Relecture-Munegascu.docx` fourni
séparément, qui couvre le contenu antérieur à cette mise à jour).

## Sources principales de cette mise à jour

1. **Grammaire monégasque**, R.P. Louis Frolla, rédigée sur instruction du
   Gouvernement Princier, 1ère édition 1960, réédition Comité National des
   Traditions Monégasques (CNTM). 128 pages — fournie par l'utilisateur
   (scan OCR, fichier `128p_Grammaire-2.pdf`).
2. **Dictionnaire français-monégasque**, R.P. Louis Frolla, 1963, réédition
   CNTM (fac-similé). Fourni par l'utilisateur (`Dico_Fr_Mc_TXT.pdf`).
3. **Dictionnaire monégasque-français**, R.P. Louis Frolla, 1963, réédition
   CNTM (fac-similé). Fourni par l'utilisateur (`Dico_Mc_Fr_TXT_Dico-1.pdf`
   et `Dico_Mc_Fr_TXT_Ouverture.pdf`).
4. Académie des Langues Dialectales de Monaco (ald-monaco.org) : « Éléments
   de grammaire monégasque » et « Écrire en monégasque : l'orthographe »
   (Éliane Mollo & Dominique Salvo), « Petit glossaire monégasque ».

Ces ouvrages sont d'authentiques publications officielles (rééditées avec
l'appui du Gouvernement Princier), bien plus fiables que les sources web
généralistes utilisées dans une précédente itération de ce projet.

## Ce qui a été corrigé

### Pronoms personnels sujets
Toutes les occurrences (`DB_PRONS_MC` dans `database.js`, les entrées de
catégorie "pronom" dans `DB_WORDS`, et le tableau statique de l'onglet
Grammaire dans `index.html`) sont maintenant cohérentes :

| Personne | Avant (non sourcé) | Maintenant (Frolla, Grammaire Ch. V) |
|---|---|---|
| je | Mi | **Min** |
| tu | Ti | **Tü** |
| il/elle | Elu/Ela | **Ëlu/Ëla** |
| nous | Nui | Nui *(déjà correct)* |
| vous | Vui | Vui *(déjà correct)* |
| ils/elles | Eri/Ere | **Ëli/Ële** |

### Chiffres
Plusieurs chiffres étaient de l'italien standard plutôt que du monégasque.
Corrigés contre le Dictionnaire Frolla (entrées vérifiées une par une) :

| FR | Avant | Maintenant |
|---|---|---|
| un | Un | **Ün** |
| quatre | Quatre | **Qatru** |
| cinq | Cinque | **Çinqe** |
| sept | Sette | **Sete** |
| neuf | Nùve | **Nœve** |
| dix | Diese | **Dèije** |
| cent | Centu | **Çentu** |
| mille | Mille | **Mila** |
| non | Nu | **Nun** |

### Les 33 conjugaisons verbales
Entièrement réécrites. L'ancienne base utilisait des terminaisons calquées
sur l'italien standard (`-iamo`, `-isti`, `-erò`...), sans source. Les
nouvelles conjugaisons suivent :
- pour **être, avoir, aller, donner, faire, savoir, pouvoir, vouloir** :
  les tableaux complets et irréguliers donnés par Frolla (pages 41-46,
  69-72 de la Grammaire) ;
- pour **dire, venir** : radical irrégulier au présent, mais désinences
  standard ailleurs (voir « Points à valider » ci-dessous) ;
- pour les **23 autres verbes** : les désinences régulières du tableau
  synoptique (Grammaire Frolla p.67) appliquées à l'infinitif vérifié
  contre le Dictionnaire français-monégasque.

### Articles
Le tableau statique de l'onglet Grammaire utilisait des formes non
sourcées (`U/U'`, `Di/De` pour le pluriel indéfini). Remplacé par les
formes du Chapitre II de la Grammaire Frolla : **u/řu, a/řa** (singulier
défini), **i/ři, ë/řë** (pluriel défini), **ün/üna** (indéfini singulier),
**de** (pluriel indéfini = partitif).

## Points encore incertains — à faire valider par un locuteur natif

- **dire** : l'infinitif est noté « di » par Frolla, mais le présent
  attesté dans le corps de l'ouvrage est « digu » (radical "dig-"), et le
  futur attesté est « digherù ». Aucun tableau complet dédié à ce verbe
  n'est donné — les formes manquantes ont été déduites par analogie avec
  d'autres verbes du 2e groupe, pas vérifiées directement.
- **venir** : même situation. Infinitif « vegnì », présent attesté « vegnu »
  (« Ne vegnu » = j'en viens), futur attesté « vegnerà ». Participe passé
  « vegnüu » signalé par Frolla comme l'unique exception au participe en
  -iu du 3e groupe. Les formes intermédiaires (imparfait, conditionnel,
  subjonctif) sont déduites par régularité, pas attestées individuellement.
- **partir** : le Dictionnaire Frolla donne directement « parte » comme
  infinitif (« le train part de Monaco » = « u tren parte da Munegu »).
  Mais la Grammaire mentionne par ailleurs un verbe distinct « purtì »
  (note de bas de page : « à ne pas confondre avec purtì, partir »).
  Conservé « parte » car c'est la forme du dictionnaire, mais à confirmer.
- **pouvoir / vouloir** : Frolla indique que ces deux verbes ont *deux*
  formes possibles au conditionnel présent (ex. purëssa *ou* purerëssa).
  Une seule des deux formes est actuellement affichée dans l'app ; l'autre
  est notée en commentaire dans le code mais pas montrée à l'utilisateur.
- **Nu vs Nun** (négation) : le Dictionnaire Frolla donne les deux formes
  « non, nun » sans préciser leur usage respectif. La base de données
  utilise maintenant « Nun », mais l'exemple de négation dans l'onglet
  Grammaire (« Nu cümprendu miga ») utilise encore l'ancienne forme « Nu »
  et n'a pas été changé par cohérence avec le reste de cette phrase
  d'exemple, à clarifier avec un locuteur natif.
- **finì (finir), imparfait** : Frolla donne deux formes concurrentes pour
  l'imparfait de ce verbe (« finiscëvu *ou* finivu »). Seule la première
  (avec le suffixe inchoatif -isc-) a été retenue dans le code.

## Fichiers sources fournis (non inclus dans ce zip)

Les PDF originaux (`128p_Grammaire-2.pdf`, `Dico_Fr_Mc_TXT.pdf`,
`Dico_Mc_Fr_TXT_Dico-1.pdf`, `Dico_Mc_Fr_TXT_Ouverture.pdf`) restent la
référence en cas de doute sur une forme. Le dictionnaire français-monégasque
en particulier contient ~800 pages de vocabulaire qui n'ont pas encore été
systématiquement comparées au contenu de `database.js` (764 mots) — un
travail de fond reste possible ici pour qui veut pousser la précision
encore plus loin.
