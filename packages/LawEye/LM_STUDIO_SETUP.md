# Guide : Configuration LM Studio pour LawEye

## Problème

LM Studio ne charge pas automatiquement les modèles. Vous devez les charger manuellement avant que LawEye puisse les utiliser.

## Étapes de configuration

### 1. Vérifier les modèles configurés dans LawEye

Par défaut, LawEye utilise :
- **Orchestrateur** : `magistral-small-2509`
- **Position** : `qwen2.5-vl:32b`

Vous pouvez voir les modèles configurés dans les logs du container `laweye` :
```bash
docker logs laweye | grep "model:"
```

Vous devriez voir :
```
[LlmService] Orchestrator model: magistral-small-2509
[LlmService] Position model: qwen2.5-vl:32b
```

### 2. Charger les modèles dans LM Studio

1. **Ouvrez LM Studio** sur votre machine
2. Allez dans l'onglet **"Chat"** ou **"Models"**
3. **Chargez votre modèle orchestrateur** :
   - Recherchez `magistral-small-2509` dans la liste des modèles
   - Cliquez sur "Load" ou "Load into VRAM"
   - Attendez que le modèle soit chargé (vous verrez une indication de charge)

4. **Chargez votre modèle position** :
   - Recherchez `qwen2.5-vl:32b` ou `Qwen3-vl-30b` dans la liste
   - **⚠️ IMPORTANT** : Le nom doit correspondre **exactement** au nom dans LM Studio
   - Cliquez sur "Load" ou "Load into VRAM"
   - Attendez que le modèle soit chargé

**Note importante** : LM Studio peut charger plusieurs modèles en même temps, mais ils doivent tous être chargés avant que LawEye puisse les utiliser.

### 3. Vérifier le nom exact du modèle dans LM Studio

Le nom du modèle dans LM Studio peut être différent de ce que vous attendez. Pour vérifier :

1. Dans LM Studio, allez dans l'onglet **"Server"**
2. En bas de la fenêtre, vous devriez voir **"Available Models"** ou une liste des modèles chargés
3. Notez le **nom exact** du modèle tel qu'il apparaît dans LM Studio

Exemples de noms possibles :
- `qwen2.5-vl:32b` (format Ollama)
- `Qwen/Qwen3-VL-30B-GGUF` (format Hugging Face)
- `qwen3-vl-30b` (nom simplifié)

### 4. Configurer les variables d'environnement

Si le nom du modèle dans LM Studio est différent du nom par défaut, vous devez créer un fichier `.env` ou modifier le `docker-compose`.

#### Option A : Créer un fichier `.env`

Créez un fichier `.env` dans le dossier `docker/` :

```bash
cd docker
```

Créer le fichier `.env` :
```env
# URL de l'API LM Studio
LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1

# Nom exact du modèle orchestrateur dans LM Studio
MODEL_ORCHESTRATOR=magistral-small-2509

# Nom exact du modèle position dans LM Studio
# Remplacez par le nom exact que vous voyez dans LM Studio
MODEL_POSITION=qwen2.5-vl:32b
```

**Si votre modèle s'appelle différemment**, par exemple `Qwen/Qwen3-VL-30B-GGUF`, mettez :
```env
MODEL_POSITION=Qwen/Qwen3-VL-30B-GGUF
```

#### Option B : Modifier directement dans docker-compose

Éditez `docker/docker-compose-desktop-only.yml` et modifiez la section `environment` du service `laweye` :

```yaml
laweye:
  # ... autres configurations ...
  environment:
    - BYTEBOT_DESKTOP_BASE_URL=http://bytebot-desktop:9990
    - LM_STUDIO_BASE_URL=${LM_STUDIO_BASE_URL:-http://host.docker.internal:1234/v1}
    - MODEL_ORCHESTRATOR=${MODEL_ORCHESTRATOR:-magistral-small-2509}
    - MODEL_POSITION=${MODEL_POSITION:-Qwen/Qwen3-VL-30B-GGUF}  # Remplacez par le nom exact
```

### 5. Démarrer le serveur LM Studio

1. Dans LM Studio, allez dans l'onglet **"Server"**
2. Assurez-vous que le **port est `1234`** (par défaut)
3. Cliquez sur **"Start Server"**
4. Vous devriez voir : **"Server is running on http://localhost:1234"**

### 6. Redémarrer LawEye

Après avoir configuré les variables d'environnement, redémarrez le container `laweye` :

```bash
cd docker
docker-compose -f docker-compose-desktop-only.yml restart laweye
```

Ou pour reconstruire complètement :
```bash
docker-compose -f docker-compose-desktop-only.yml up -d --build laweye
```

### 7. Vérifier que les modèles sont utilisés

Vérifiez les logs du container `laweye` :
```bash
docker logs laweye
```

Vous devriez voir :
```
[LlmService] LM Studio service initialized with URL: http://host.docker.internal:1234/v1
[LlmService] Orchestrator model: magistral-small-2509
[LlmService] Position model: qwen2.5-vl:32b  # ou le nom que vous avez configuré
```

## Dépannage

### Le modèle n'apparaît pas dans LM Studio

1. **Vérifiez que le modèle est téléchargé** :
   - Allez dans l'onglet "Models" dans LM Studio
   - Recherchez le modèle dans la liste
   - Si vous ne le voyez pas, cliquez sur "Download" pour le télécharger

2. **Vérifiez le format du modèle** :
   - LawEye utilise l'API OpenAI-compatible de LM Studio
   - Assurez-vous que le modèle supporte l'API Chat Completions
   - Les modèles GGUF fonctionnent généralement bien

### Erreur "Model not found" dans les logs

Si vous voyez une erreur comme `"Model 'qwen2.5-vl:32b' not found"` :

1. **Vérifiez le nom exact du modèle** dans LM Studio (voir étape 3)
2. **Mettez à jour la variable d'environnement** `MODEL_POSITION` avec le nom exact
3. **Redémarrez le container** `laweye`

### Le modèle ne répond pas

1. **Vérifiez que le modèle est chargé** dans LM Studio
2. **Vérifiez que le serveur LM Studio est actif** (onglet "Server")
3. **Vérifiez que le port est `1234`**
4. **Vérifiez les logs LM Studio** pour voir s'il y a des erreurs

### Comment voir quels modèles sont chargés dans LM Studio

Dans LM Studio :
1. Onglet **"Server"** → En bas, vous verrez la liste des modèles disponibles
2. Les modèles chargés ont un indicateur de charge (mémoire utilisée)
3. Vous pouvez aussi voir les modèles chargés dans l'onglet **"Chat"** → En haut à droite

## Exemple de configuration complète

### Fichier `.env` dans `docker/` :

```env
# Configuration LM Studio
LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1

# Modèles - Remplacez par les noms exacts dans LM Studio
MODEL_ORCHESTRATOR=magistral-small-2509
MODEL_POSITION=Qwen/Qwen3-VL-30B-GGUF
```

### Commande pour démarrer :

```bash
cd docker
docker-compose -f docker-compose-desktop-only.yml up -d --build
```

## Vérification finale

1. ✅ LM Studio est lancé
2. ✅ Les modèles sont chargés dans LM Studio
3. ✅ Le serveur LM Studio est actif sur le port 1234
4. ✅ Les variables d'environnement sont configurées correctement
5. ✅ Le container `laweye` est redémarré avec la nouvelle config
6. ✅ Les logs montrent les bons noms de modèles

Une fois tout cela fait, LawEye devrait pouvoir utiliser les modèles depuis LM Studio ! 🎉

