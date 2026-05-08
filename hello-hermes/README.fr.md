# Hello Hermes Agent ☤

C'est un espace de travail pour explorer et analyser [Hermes Agent](https://github.com/nousresearch/hermes-agent) `v0.10.0 (v2026.4.16)` `1dd6b5d5`.

> ## Prononciation
> 
> Note : Le nom « Hermes » dans ce projet fait référence à la divinité grecque.
> 
> ✔️ **Hermes** : `/ˈhɜːrmiːz/` — Le dieu grec du langage et de l'écriture, messager des dieux.
> 
> ✖️ **Hermès** : `/ɛʁ.mɛs/` — Marque de luxe française.

## 1 Analyse du code source Hermes Agent

```sh
git clone --depth 1 --branch v2026.4.16 https://github.com/nousresearch/hermes-agent
```

| Domaine d'intérêt | Lecture recommandée |
|-------------------|---------------------|
| 🚀 Démarrage rapide | Partie 1 (Flux) |
| 🗄️ Persistance des données | Partie 2 (Données) |
| 🔧 Développement de nouveaux outils/plugins | Partie 3 (Extension) |
| 🐛 Débogage et dépannage | Partie 4 (Débogage) |
| 🏗️ Comprendre la conception du système | Partie 5 (Relations de classes) |
| 📝 Ingénierie des prompts | Partie 6 (Catalogue des prompts) |


## 2 Utilisation de Hermes Agent

### Installation

```sh
# Linux / macOS / WSL2 / Android (Termux)
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
# Windows
powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1 | iex"
```

### Mise à jour

```sh
hermes update
hermes version
```

### Configuration

```sh
# Lancer l'assistant de configuration
hermes setup

# Voir/modifier la configuration
code ~/.hermes/
```

```yaml
model:
  default: kr/claude-sonnet-4.5
  provider: custom
  base_url: http://localhost:20128/v1
```

### Utilisation
```sh
# Démarrer le chat interactif
hermes
```

## 3 Débogage avec points d'arrêt PyCharm

### 1. Compilation

```sh
cd hermes-agent
rm -rf venv
uv venv venv --python 3.14.3
# macOS: source venv/bin/activate
# Windows: venv\Scripts\activate
uv pip install -e ".[dev,cli,pty,mcp]"
```

### 2. Répertoire `.run/`

Les exemples de configurations se trouvent dans le répertoire racine `.run/`

| Fichier `.run/` | Emplacement `.idea/` correspondant | Objectif |
|---|---|---|
| `main.run.xml` | _(reste dans `.run/`)_ | Configuration d'exécution partagée |
| `workspace.xml` | `workspace.xml` | Exemple de RunManager local |
| `misc.xml` | `misc.xml` | Exemple de liaison d'interpréteur |
| `modules.xml` | `modules.xml` | Exemple d'enregistrement de module |
| `hello-hermes.iml` | `hello-hermes.iml` | Exemple de liaison SDK |

> **Confusion courante** : `.run/main.run.xml` correspond à `RunManager > configuration name="main"` dans `.idea/workspace.xml`, pas à un fichier du même nom copié dans `.idea/`. Si vous devez copier dans `.idea/`, utilisez `.run/workspace.xml`.

### 3. Débogage avec points d'arrêt

1. Sauvegardez `.idea/`, copiez les fichiers du même nom depuis `.run/` vers celui-ci
2. Remplacez les espaces réservés suivants par vos valeurs locales :

```xml
<env name="HERMES_HOME" value="<YOUR_HERMES_HOME>" />
<env name="PYTHONPATH" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="WORKING_DIRECTORY" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="PARAMETERS" value='chat --quiet -q "<YOUR_DEBUG_PROMPT>"' />
<option name="sdkName" value="<YOUR_PYCHARM_SDK_NAME>" />
<orderEntry type="jdk" jdkName="<YOUR_PYCHARM_SDK_NAME>" jdkType="Python SDK" />
```

<img src="images/pycharm-debug.png" alt="pycharm-debug" style="height:500px; display: block; margin-left: 0;"/>

| Élément | Valeur |
|---|---|
| Point d'entrée | `$PROJECT_DIR$/hermes-agent/hermes_cli/main.py` |
| Répertoire de travail | `<YOUR_PROJECT_DIR>/hermes-agent` |
| Paramètres par défaut | `chat --quiet -q "<YOUR_DEBUG_PROMPT>"` |
| Variables d'environnement | `HERMES_HOME`, `PYTHONPATH`, `PYTHONIOENCODING=utf-8`, `PYTHONUNBUFFERED=1` |

`chat --quiet -q` utilise le chemin de requête unique, évitant le TUI interactif pour prévenir `NoConsoleScreenBufferError` dans la fenêtre d'exécution de PyCharm. `HERMES_HOME` est explicitement spécifié pour réutiliser la configuration locale et les clés ; `PYTHONPATH` / `WORKING_DIRECTORY` sont fixés à `hermes-agent/` pour correspondre à l'environnement réel de ligne de commande.

Pour déboguer d'autres requêtes, modifiez simplement `PARAMETERS` :

```sh
chat --quiet -q "Read the current repo and explain the startup flow"
chat --quiet -q "Return only JSON: {status, summary}"
chat --quiet --toolsets web,terminal -q "Check the latest Python release and write notes to notes/python.md"
```

Pour une présentation complète de la chaîne d'appels de la requête unique, de la chaîne de démarrage, des branches d'outils et des chemins de persistance d'état, consultez : [Analyse de l'architecture Hermes (partie 4) : Débogage · Présentation complète des liens](./Hermes%20架构解析%20(四)：调试篇%20·%20完整链路走查.md)

### 4 Débogage de sessions multi-tours

Lors de l'exécution de conversations complètes multi-tours, utilisez le paramètre `--resume` / `-r` pour reprendre les sessions précédentes et maintenir le contexte complet :

```sh
# Tour 1 : Requête initiale (retourne session_id)
python hermes-agent/hermes_cli/main.py chat --quiet -q "Summarize the repository structure in 5 bullets"
# Sortie : session_id: 20260413_194556_5aebb2

# Tour 2 : Reprendre la session, continuer à poser des questions
python hermes-agent/hermes_cli/main.py chat --quiet --resume 20260413_194556_5aebb2 -q "Based on your summary, what are the main entry points?"

# Tour 3 : Reprendre à nouveau la même session
python hermes-agent/hermes_cli/main.py chat --quiet -r 20260413_194556_5aebb2 -q "How would I add a new tool to the system?"
```

**Gestion des sessions** :

| Commande | Effet |
|---|---|
| `-r <SESSION_ID>` / `--resume <SESSION_ID>` | Reprendre une session spécifique |
| `-c` / `--continue` | Reprendre la session CLI la plus récente |
| `-c "nom de session"` | Reprendre par nom (nécessite un nommage préalable avec `hermes sessions rename`) |
| `hermes sessions list` | Voir toutes les sessions |
| `hermes sessions export output.jsonl --session-id <ID>` | Exporter une session spécifique |

---

## 4 Ressources Hermes Agent

- **Dépôt officiel** : <https://github.com/nousresearch/hermes-agent>
- **Site officiel** : <https://hermes-agent.nousresearch.com>
- **Documentation de démarrage** : <https://hermes-agent.nousresearch.com/docs/getting-started/quickstart>

<img src="images/hello-hermes.png" alt="hello-hermes" style="height:800px; display: block; margin-left: 0;" />
