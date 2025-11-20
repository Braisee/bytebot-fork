# LawEye - Guide de démarrage

## Prérequis

1. **Docker** et **Docker Compose** installés
2. **LM Studio** installé et lancé sur votre machine hôte
3. Les modèles LLM suivants chargés dans LM Studio :
   - **Orchestrateur** : `magistral-small-2509` (ou celui que vous préférez)
   - **Position** : `qwen2.5-vl:32b` ou `Qwen3-vl-30b` (ou autre modèle vision)

## Étapes de démarrage

### 1. Lancer LM Studio

1. Ouvrez **LM Studio** sur votre machine
2. Chargez votre modèle orchestrateur (par ex. `magistral-small-2509`)
3. Chargez votre modèle position (par ex. `qwen2.5-vl:32b`)
4. Assurez-vous que le **serveur local** est actif sur le port **1234**
   - Onglet "Server" dans LM Studio
   - Port : `1234`
   - Cliquez sur "Start Server"

### 2. Lancer les services Docker

Depuis la racine du projet, allez dans le dossier `docker` :

```bash
cd docker
```

#### Option A : Configuration par défaut

```bash
docker-compose -f docker-compose-desktop-only.yml up --build
```

#### Option B : Configuration personnalisée

Vous pouvez définir les variables d'environnement dans un fichier `.env` ou directement dans la commande :

```bash
# Variables d'environnement personnalisées
LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1 \
MODEL_ORCHESTRATOR=magistral-small-2509 \
MODEL_POSITION=qwen2.5-vl:32b \
docker-compose -f docker-compose-desktop-only.yml up --build
```

**Variables d'environnement disponibles :**
- `LM_STUDIO_BASE_URL` : URL de l'API LM Studio (par défaut: `http://host.docker.internal:1234/v1`)
- `MODEL_ORCHESTRATOR` : Nom du modèle orchestrateur dans LM Studio (par défaut: `magistral-small-2509`)
- `MODEL_POSITION` : Nom du modèle position dans LM Studio (par défaut: `qwen2.5-vl:32b`)

### 3. Accéder à l'interface

Une fois tous les services démarrés, accédez à l'interface LawEye :

**URL :** http://localhost:9993

### 4. Utilisation

1. **Tapez une tâche** dans le champ de saisie (ex: "Cliquer sur l'icône Firefox")
2. **Cliquez sur "Créer la tâche"**
3. **Observez** :
   - La vue desktop en temps réel (VNC)
   - Les logs d'exécution dans le panneau de droite
   - Les actions effectuées par les LLM

## Ports utilisés

- **9990** : bytebot-desktop (VNC + API)
- **9992** : LawEye backend (API REST)
- **9993** : LawEye UI (Interface web)

## Vérification du bon fonctionnement

### Vérifier les services

```bash
# Voir les logs de tous les services
docker-compose -f docker-compose-desktop-only.yml logs -f

# Voir les logs d'un service spécifique
docker-compose -f docker-compose-desktop-only.yml logs -f laweye
docker-compose -f docker-compose-desktop-only.yml logs -f laweye-ui
docker-compose -f docker-compose-desktop-only.yml logs -f bytebot-desktop
```

### Vérifier la santé du backend

```bash
curl http://localhost:9992/health
```

### Vérifier la connexion à LM Studio

Les logs de `laweye` devraient afficher :
```
[LlmService] Desktop service initialized with base URL: http://bytebot-desktop:9990
```

Si vous voyez des erreurs de connexion à LM Studio :
- Vérifiez que LM Studio est bien lancé
- Vérifiez que le serveur est actif sur le port 1234
- Vérifiez que les modèles sont bien chargés

## Arrêter les services

```bash
# Arrêter les services
docker-compose -f docker-compose-desktop-only.yml down

# Arrêter et supprimer les volumes
docker-compose -f docker-compose-desktop-only.yml down -v
```

## Dépannage

### Erreur : "Failed to connect to LM Studio"

- Vérifiez que LM Studio est lancé
- Vérifiez que le serveur est actif (onglet "Server" dans LM Studio)
- Vérifiez que le port est bien 1234
- Sur Windows, assurez-vous que `host.docker.internal` fonctionne (normalement automatique)

### Erreur : "Failed to connect to bytebot-desktop"

- Vérifiez que le container `bytebot-desktop` est bien lancé
- Vérifiez les logs : `docker-compose -f docker-compose-desktop-only.yml logs bytebot-desktop`

### L'UI ne se charge pas

- Vérifiez que le port 9993 n'est pas déjà utilisé
- Vérifiez les logs : `docker-compose -f docker-compose-desktop-only.yml logs laweye-ui`
- Vérifiez que le build s'est bien passé (regardez les logs lors du `docker-compose up --build`)

### Les modèles ne répondent pas

- Vérifiez dans LM Studio que les modèles sont bien chargés et disponibles
- Vérifiez les noms des modèles dans les variables d'environnement (ils doivent correspondre exactement aux noms dans LM Studio)
- Vérifiez les logs de `laweye` pour voir les erreurs détaillées
