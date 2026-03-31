# IR Learner Exporter

## Fonction

Cet add-on affiche une interface web dans la barre latérale Home Assistant via Ingress. Il permet de :

- saisir les métadonnées du profil IR,
- générer automatiquement la matrice complète des combinaisons clim,
- importer un JSON existant,
- compléter les codes IR Base64 manuellement ou via apprentissage,
- exporter un fichier JSON proche des bases Broadlink/AC comme `1133.json`.

## Génération massive

Le générateur fabrique automatiquement les noms de commandes selon la formule :

- `off`
- `ifeel_auto_auto`
- `mode_temperature_fan_swing`

Exemples :

- `cool_24_auto_auto`
- `cool_24_high_swing`
- `dry_22_low_top`

Le nombre de combinaisons est :

`modes × températures × ventilations × swings` (+ commandes spéciales éventuelles).

## Import / export

- Import : colle un JSON existant dans la zone d’import pour recharger la structure et les commandes.
- Export : le JSON final est écrit dans `/config/<nom>.json` et `/data/<nom>.json`.
- Un fichier `/config/latest.json` est aussi mis à jour.

## Emplacement des fichiers

Le JSON exporté est écrit dans :

- `/config/<nom>.json` dans le conteneur, correspondant au dossier public `addon_config` de l’add-on.
- `/data/<nom>.json` pour une copie interne persistante.

## Intégration apprentissage IR

Le endpoint `/api/learn` est encore un stub. Il faut le relier à ton backend réel, par exemple :

- Broadlink Python,
- bridge MQTT,
- ESPHome / ESP IR receiver,
- commande shell qui renvoie un code Base64.

## Installation locale

1. Copie le dossier de l’add-on dans ton dépôt local d’add-ons.
2. Recharge les add-ons.
3. Installe l’add-on.
4. Ouvre l’interface avec **OPEN WEB UI**.
5. Génère la matrice complète.
6. Remplis les codes.
7. Exporte le JSON.

## Notes techniques

- Ingress activé avec `ingress: true`.
- Port interne `8099`.
- Sortie publique via `addon_config` en lecture/écriture.