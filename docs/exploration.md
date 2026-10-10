# Journal d'exploration des skills

Une entrée par usage de skill (PRD § 9, objectif O2).

## 2026-10-10 — `/setup-matt-pocock-skills` (étape 0)

- **A aidé** : en quatre fichiers, le tracker GitHub, les étiquettes de triage et la disposition des docs du domaine étaient réglés, et toutes les skills d'ingénierie y trouvent leur configuration.
- **Friction** : les gabarits sont en anglais. La skill ne crée pas les étiquettes sur GitHub, alors que `/to-spec` en a besoin, d'où une création manuelle de quatre étiquettes. Elle pose une question par section, même quand l'exploration a déjà tranché.
- **À changer** : créer les étiquettes manquantes dans le même passage.

## 2026-10-10 — `/grill-with-docs` (`grilling` + `domain-modeling`, étape 1)

- **A aidé** :
  - Quatre sous-agents ont établi les faits en parallèle : sondes Node, sondes Python/Go/Rust, sources primaires et lecture de FibCalc.
  - Ils ont trouvé de vrais obstacles :
    - Rust ne lie pas avec MSVC sur cette machine;
    - Python écrit `\r\n` sous Windows;
    - argparse peut colorer ses erreurs;
    - tsc 7 exige `"type": "module"`;
    - `node --test` ne prend pas un dossier;
    - les conversions de `N` sont trop permissives dans les quatre langages.
  - Le grilling a forcé des trous à se combler :
    - une grammaire des arguments commune;
    - un texte d'usage identique;
    - le périmètre de `--time`;
    - les codes de sortie, alignés sur FibCalc;
    - une vérification indépendante de F(100 000) par les périodes de Pisano;
    - un découpage en un ticket par langage, puisque le contrat ne se découpe pas en tranches.
  - Le glossaire a fixé indice, terme, liste et comparaison.
- **Friction** : la skill attend un humain qui tranche à chaque ronde. Ici, l'utilisateur a délégué les décisions, donc l'agent a éprouvé et validé son propre PRD, et le regard extérieur que la skill doit apporter a manqué. Les sous-agents ont coûté environ 380 000 jetons.
- **À changer** : lancer la collecte de faits avant la première ronde, et garder au moins une ronde de décisions pour l'humain.
