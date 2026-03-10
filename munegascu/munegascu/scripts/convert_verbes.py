#!/usr/bin/env python3
"""
convert_verbes.py — Münegascu
═══════════════════════════════════════════════════════════════
Convertit un CSV de verbes monégasques avec conjugaisons complètes
vers le format JSON attendu par database.js.

FORMATS D'ENTRÉE ACCEPTÉS
──────────────────────────
Format A — CSV étendu (une ligne par verbe, 6 personnes par temps) :
  fr,mc,present_p1,present_p2,...,present_p6,imparfait_p1,...

Format B — CSV tabulaire (une ligne par forme conjuguée) :
  fr,mc,temps,personne,forme
  être,Esse,présent,1,Sùn
  être,Esse,présent,2,Sei
  ...

Format C — JSON brut (à normaliser) :
  { "être": { "mc": "Esse", "conj": { "présent": [...] } } }

EXEMPLES D'UTILISATION
───────────────────────
  python convert_verbes.py verbes.csv verbes.js
  python convert_verbes.py verbes.csv verbes.js --format tabulaire
  python convert_verbes.py verbes.json verbes.js --format json
  python convert_verbes.py --exemple    # génère un CSV exemple
  python convert_verbes.py --exemple-json  # génère un JSON exemple
"""

import csv
import io
import json
import re
import sys
import argparse
from pathlib import Path


# ─────────────────────────────────────────────────────────────
# CONSTANTES
# ─────────────────────────────────────────────────────────────

TEMPS = ["présent", "imparfait", "futur", "conditionnel", "subjonctif", "impératif"]
TEMPS_ALIAS = {
    "present": "présent", "presnt": "présent", "pres": "présent",
    "imparfait": "imparfait", "imperf": "imparfait", "imp": "imparfait",
    "futur": "futur", "fut": "futur", "future": "futur",
    "conditionnel": "conditionnel", "cond": "conditionnel",
    "subjonctif": "subjonctif", "subj": "subjonctif", "sub": "subjonctif",
    "imperatif": "impératif", "impératif": "impératif", "imper": "impératif",
}

PRONS_MC = ["Mi", "Ti", "Elu/Ela", "Nui", "Vui", "Eri/Ere"]

# Exemple de formes fléchies FR associées aux verbes (optionnel, enrichi)
FORMES_FR_EXEMPLE = {
    "parler": ["parle", "parles", "parle", "parlons", "parlez", "parlent"],
}


# ─────────────────────────────────────────────────────────────
# CORRECTION ENCODAGE (même logique que convert_monegasque.py)
# ─────────────────────────────────────────────────────────────

def fix_encoding(raw_bytes: bytes) -> str:
    # BOM UTF-8 présent → décodage direct (fichier sain)
    if raw_bytes[:3] == b'\xef\xbb\xbf':
        return raw_bytes.decode('utf-8-sig')
    # UTF-8 propre sans séquences corrompues
    try:
        text = raw_bytes.decode('utf-8')
        if 'Ã' not in text:
            return text
    except UnicodeDecodeError:
        pass
    # Double encodage Latin-1/UTF-8 (fichiers corrompus type Ã©→é)
    try:
        text = raw_bytes.decode('latin-1')
        return text.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    return raw_bytes.decode('utf-8', errors='replace')


def normalise_temps(t: str) -> str:
    t = t.strip().lower()
    return TEMPS_ALIAS.get(t, t)


def clean(s: str) -> str:
    return s.strip() if s else ""


# ─────────────────────────────────────────────────────────────
# PARSERS PAR FORMAT
# ─────────────────────────────────────────────────────────────

def parse_etendu(text: str) -> dict:
    """
    Format CSV étendu : une ligne par verbe.
    En-tête : fr, mc, présent_p1..p6, imparfait_p1..p6, futur_p1..p6,
               conditionnel_p1..p6, subjonctif_p1..p6, impératif_p1..p6
    (42 colonnes + fr + mc = 44)
    """
    reader = csv.reader(io.StringIO(text))
    headers = [h.strip().lower() for h in next(reader)]

    i_fr = _col(headers, ['fr', 'francais', 'français'])
    i_mc = _col(headers, ['mc', 'monegasque', 'monégasque'])

    if i_fr is None or i_mc is None:
        raise ValueError("Colonnes 'fr' et 'mc' introuvables.")

    # Détecter colonnes de conjugaison : temps_p1 ... temps_p6
    conj_cols = {}
    for i, h in enumerate(headers):
        m = re.match(r'^(.+?)_p(\d)$', h)
        if m:
            temps_raw, p = m.group(1), int(m.group(2))
            temps = normalise_temps(temps_raw)
            conj_cols.setdefault(temps, {})[p - 1] = i

    verbs = {}
    for row in reader:
        if not row or not any(row): continue
        fr = clean(row[i_fr]).lower()
        mc = clean(row[i_mc])
        if not fr or not mc: continue

        conj = {}
        for temps, pcols in conj_cols.items():
            forms = []
            for p in range(6):
                idx = pcols.get(p)
                forms.append(clean(row[idx]) if idx is not None and idx < len(row) else "—")
            conj[temps] = forms

        # Temps manquants → remplis avec "—"
        for t in TEMPS:
            if t not in conj:
                conj[t] = ["—"] * 6

        verbs[fr] = {"mc": mc, "conj": conj}

    return verbs


def parse_tabulaire(text: str) -> dict:
    """
    Format CSV tabulaire : une ligne par forme conjuguée.
    En-tête : fr, mc, temps, personne (1-6), forme
    """
    reader = csv.reader(io.StringIO(text))
    headers = [h.strip().lower() for h in next(reader)]

    i_fr   = _col(headers, ['fr', 'francais', 'français'])
    i_mc   = _col(headers, ['mc', 'monegasque', 'monégasque'])
    i_t    = _col(headers, ['temps', 'tense', 'time'])
    i_p    = _col(headers, ['personne', 'person', 'p'])
    i_form = _col(headers, ['forme', 'form', 'conjugaison', 'conjugation'])

    if any(x is None for x in [i_fr, i_mc, i_t, i_p, i_form]):
        raise ValueError("Colonnes requises : fr, mc, temps, personne, forme")

    verbs = {}
    for row in reader:
        if not row or not any(row): continue
        fr    = clean(row[i_fr]).lower()
        mc    = clean(row[i_mc])
        temps = normalise_temps(row[i_t])
        try:
            p = int(clean(row[i_p])) - 1  # 1-6 → 0-5
        except ValueError:
            continue
        forme = clean(row[i_form])
        if not fr or not forme: continue

        verbs.setdefault(fr, {"mc": mc, "conj": {t: ["—"] * 6 for t in TEMPS}})
        if temps in verbs[fr]["conj"] and 0 <= p <= 5:
            verbs[fr]["conj"][temps][p] = forme

    return verbs


def parse_json(text: str) -> dict:
    """
    Format JSON : objet keyed par infinitif FR.
    { "être": { "mc": "Esse", "conj": { "présent": [...6...] } } }
    """
    data = json.loads(text)
    verbs = {}
    for fr, v in data.items():
        mc   = v.get("mc", "")
        conj = {}
        for temps_raw, forms in v.get("conj", {}).items():
            temps = normalise_temps(temps_raw)
            conj[temps] = (forms + ["—"] * 6)[:6]
        for t in TEMPS:
            if t not in conj:
                conj[t] = ["—"] * 6
        verbs[fr.lower()] = {"mc": mc, "conj": conj}
    return verbs


def _col(headers, candidates):
    for c in candidates:
        if c in headers:
            return headers.index(c)
    return None


# ─────────────────────────────────────────────────────────────
# GÉNÉRATION DU FICHIER JS
# ─────────────────────────────────────────────────────────────

def verbs_to_js(verbs: dict, mode: str = "merge") -> str:
    """
    Génère un fichier JS à injecter dans database.js.
    mode='merge'   → fusionne avec DB_VERBS existante
    mode='replace' → remplace complètement DB_VERBS
    mode='module'  → export ES module (pour usage futur)
    """
    lines = [
        "/**",
        " * verbes_import.js — généré par convert_verbes.py",
        " * À inclure APRÈS database.js dans index.html",
        " *",
        " * Usage : <script src=\"src/data/verbes_import.js\"></script>",
        " */",
        "",
    ]

    if mode == "merge":
        lines += [
            "// Fusion des verbes importés dans DB_VERBS",
            "(function() {",
            "  const imported = {",
        ]
        for fr, v in verbs.items():
            mc_esc = v['mc'].replace('"', '\\"')
            lines.append(f'    "{fr}": {{ mc: "{mc_esc}", conj: {{')
            for t in TEMPS:
                forms = v['conj'].get(t, ['—'] * 6)
                forms_js = ', '.join(f'"{f.replace(chr(34), chr(39))}"' for f in forms)
                lines.append(f'      "{t}": [{forms_js}],')
            lines.append('    }},')
        lines += [
            "  };",
            "  // Fusionne : les nouveaux verbes s'ajoutent, les existants sont préservés",
            "  Object.assign(DB_VERBS, imported);",
            "",
            "  // Génère automatiquement les formes fléchies pour le moteur",
            "  _registerVerbForms(imported);",
            "",
            "  console.log(`[Münegascu] ${Object.keys(imported).length} verbe(s) importé(s).`);",
            "})();",
        ]

    elif mode == "replace":
        lines += [
            "// Remplacement complet de DB_VERBS",
            "const DB_VERBS_IMPORT = {",
        ]
        for fr, v in verbs.items():
            mc_esc = v['mc'].replace('"', '\\"')
            lines.append(f'  "{fr}": {{ mc: "{mc_esc}", conj: {{')
            for t in TEMPS:
                forms = v['conj'].get(t, ['—'] * 6)
                forms_js = ', '.join(f'"{f.replace(chr(34), chr(39))}"' for f in forms)
                lines.append(f'    "{t}": [{forms_js}],')
            lines.append('  }},')
        lines.append("};")

    return '\n'.join(lines)


# ─────────────────────────────────────────────────────────────
# GÉNÉRATION D'EXEMPLES
# ─────────────────────────────────────────────────────────────

EXEMPLE_CSV_ETENDU = """fr,mc,présent_p1,présent_p2,présent_p3,présent_p4,présent_p5,présent_p6,imparfait_p1,imparfait_p2,imparfait_p3,imparfait_p4,imparfait_p5,imparfait_p6,futur_p1,futur_p2,futur_p3,futur_p4,futur_p5,futur_p6,conditionnel_p1,conditionnel_p2,conditionnel_p3,conditionnel_p4,conditionnel_p5,conditionnel_p6,subjonctif_p1,subjonctif_p2,subjonctif_p3,subjonctif_p4,subjonctif_p5,subjonctif_p6,impératif_p1,impératif_p2,impératif_p3,impératif_p4,impératif_p5,impératif_p6
chanter,Cantà,Cantu,Canti,Canta,Cantemu,Cantèi,Cantannu,Cantava,Cantavi,Cantava,Cantavamu,Cantavai,Cantavannu,Canterò,Canterai,Canterà,Canteremu,Canterei,Canterannu,Canteria,Canteresti,Canteria,Canteriamu,Canteresti,Canteriannu,Canti,Canti,Canti,Cantemu,Cantèi,Cantinnu,—,Canta,Canti,Cantemu,Cantèi,—
finir,Finì,Finiscu,Finisci,Finisce,Finemu,Finèi,Finiscannu,Finia,Finii,Finia,Finiamu,Finiai,Finiannu,Finirò,Finirai,Finirà,Finiremu,Finirei,Finirannu,Finiria,Finiresti,Finiria,Finiriamu,Finiresti,Finiriannu,Finisca,Finisci,Finisca,Finemu,Finèi,Finiscannu,—,Finisci,Finisca,Finemu,Finèi,—
"""

EXEMPLE_CSV_TABULAIRE = """fr,mc,temps,personne,forme
chanter,Cantà,présent,1,Cantu
chanter,Cantà,présent,2,Canti
chanter,Cantà,présent,3,Canta
chanter,Cantà,présent,4,Cantemu
chanter,Cantà,présent,5,Cantèi
chanter,Cantà,présent,6,Cantannu
chanter,Cantà,imparfait,1,Cantava
chanter,Cantà,imparfait,2,Cantavi
chanter,Cantà,imparfait,3,Cantava
chanter,Cantà,imparfait,4,Cantavamu
chanter,Cantà,imparfait,5,Cantavai
chanter,Cantà,imparfait,6,Cantavannu
chanter,Cantà,futur,1,Canterò
chanter,Cantà,futur,2,Canterai
chanter,Cantà,futur,3,Canterà
chanter,Cantà,futur,4,Canteremu
chanter,Cantà,futur,5,Canterei
chanter,Cantà,futur,6,Canterannu
"""

EXEMPLE_JSON = """{
  "chanter": {
    "mc": "Cantà",
    "conj": {
      "présent":      ["Cantu","Canti","Canta","Cantemu","Cantèi","Cantannu"],
      "imparfait":    ["Cantava","Cantavi","Cantava","Cantavamu","Cantavai","Cantavannu"],
      "futur":        ["Canterò","Canterai","Canterà","Canteremu","Canterei","Canterannu"],
      "conditionnel": ["Canteria","Canteresti","Canteria","Canteriamu","Canteresti","Canteriannu"],
      "subjonctif":   ["Canti","Canti","Canti","Cantemu","Cantèi","Cantinnu"],
      "impératif":    ["—","Canta","Canti","Cantemu","Cantèi","—"]
    }
  },
  "finir": {
    "mc": "Finì",
    "conj": {
      "présent":      ["Finiscu","Finisci","Finisce","Finemu","Finèi","Finiscannu"],
      "imparfait":    ["Finia","Finii","Finia","Finiamu","Finiai","Finiannu"],
      "futur":        ["Finirò","Finirai","Finirà","Finiremu","Finirei","Finirannu"],
      "conditionnel": ["Finiria","Finiresti","Finiria","Finiriamu","Finiresti","Finiriannu"],
      "subjonctif":   ["Finisca","Finisci","Finisca","Finemu","Finèi","Finiscannu"],
      "impératif":    ["—","Finisci","Finisca","Finemu","Finèi","—"]
    }
  }
}
"""


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Convertit des verbes monégasques (CSV/JSON) vers verbes_import.js",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Formats d'entrée :
  etendu     — CSV une ligne par verbe, colonnes présent_p1..p6 etc.
  tabulaire  — CSV une ligne par forme (fr, mc, temps, personne, forme)
  json       — objet JSON {infinitif: {mc, conj: {temps: [p1..p6]}}}

Exemples :
  python convert_verbes.py verbes.csv verbes_import.js
  python convert_verbes.py verbes.csv verbes_import.js --format tabulaire
  python convert_verbes.py verbes.json verbes_import.js --format json
  python convert_verbes.py --exemple             # génère exemple_verbes_etendu.csv
  python convert_verbes.py --exemple-tabulaire   # génère exemple_verbes_tabulaire.csv
  python convert_verbes.py --exemple-json        # génère exemple_verbes.json
        """
    )
    parser.add_argument('input',  nargs='?', help='Fichier source (.csv ou .json)')
    parser.add_argument('output', nargs='?', help='Fichier JS de sortie (ex: verbes_import.js)')
    parser.add_argument('--format', choices=['etendu', 'tabulaire', 'json'], default='etendu')
    parser.add_argument('--mode', choices=['merge', 'replace'], default='merge',
                        help='merge = fusionne avec DB_VERBS ; replace = remplace tout')
    parser.add_argument('--exemple',           action='store_true', help='Génère exemple_verbes_etendu.csv')
    parser.add_argument('--exemple-tabulaire', action='store_true', help='Génère exemple_verbes_tabulaire.csv')
    parser.add_argument('--exemple-json',      action='store_true', help='Génère exemple_verbes.json')
    args = parser.parse_args()

    # Génération d'exemples
    if args.exemple:
        with open('exemple_verbes_etendu.csv', 'w', encoding='utf-8-sig') as f:
            f.write(EXEMPLE_CSV_ETENDU.lstrip())
        print("✅  exemple_verbes_etendu.csv créé")
        print("    Colonnes : fr, mc, présent_p1..p6, imparfait_p1..p6, futur_p1..p6,")
        print("               conditionnel_p1..p6, subjonctif_p1..p6, impératif_p1..p6")
        return

    if args.exemple_tabulaire:
        with open('exemple_verbes_tabulaire.csv', 'w', encoding='utf-8-sig') as f:
            f.write(EXEMPLE_CSV_TABULAIRE.lstrip())
        print("✅  exemple_verbes_tabulaire.csv créé")
        print("    Colonnes : fr, mc, temps, personne (1-6), forme")
        return

    if args.exemple_json:
        with open('exemple_verbes.json', 'w', encoding='utf-8') as f:
            f.write(EXEMPLE_JSON.lstrip())
        print("✅  exemple_verbes.json créé")
        return

    if not args.input or not args.output:
        parser.print_help()
        sys.exit(1)

    # Lecture
    with open(args.input, 'rb') as f:
        raw = f.read()

    if args.format == 'json':
        text = raw.decode('utf-8', errors='replace')
    else:
        text = fix_encoding(raw)

    # Parsing
    print(f"\n🔄  Conversion : {args.input}  →  {args.output}  [format: {args.format}]\n")
    try:
        if args.format == 'etendu':
            verbs = parse_etendu(text)
        elif args.format == 'tabulaire':
            verbs = parse_tabulaire(text)
        else:
            verbs = parse_json(text)
    except Exception as e:
        print(f"❌  Erreur de parsing : {e}", file=sys.stderr)
        sys.exit(1)

    if not verbs:
        print("⚠️  Aucun verbe trouvé.", file=sys.stderr)
        sys.exit(1)

    # Écriture JS
    js = verbs_to_js(verbs, mode=args.mode)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(js)

    # Résumé
    print("─" * 50)
    print(f"✅  {len(verbs)} verbe(s) converti(s)")
    for fr, v in verbs.items():
        t_ok = sum(1 for t in TEMPS if any(f != '—' for f in v['conj'].get(t, [])))
        print(f"   {fr:20} → {v['mc']:20} ({t_ok}/6 temps)")
    print(f"📁  Fichier écrit : {args.output}")
    print("─" * 50)
    print()
    print("📌  Ajouter dans index.html APRÈS database.js :")
    print(f'   <script src="{args.output}"></script>')


if __name__ == '__main__':
    main()
