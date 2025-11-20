# Guide : Tester les LLM avec les endpoints de test

Ce guide explique comment utiliser les endpoints de test pour tester vos LLM (orchestrateur et position) depuis Postman ou curl.

## Endpoints disponibles

### 1. POST `/test-llm/orchestrator` - Tester l'Orchestrateur LLM

Teste l'orchestrateur LLM (`getNextAction()`) qui analyse un screenshot et décide de la prochaine action.

**Configuration Postman :**
- **Method** : `POST`
- **URL** : `http://localhost:9992/test-llm/orchestrator`

**Headers :**
```
Content-Type: application/json
```

**Body (raw, JSON) - Option 1 : Screenshot automatique**
```json
{
  "taskDescription": "Cliquer sur l'icône Firefox"
}
```

**Body (raw, JSON) - Option 2 : Screenshot fourni**
```json
{
  "taskDescription": "Cliquer sur l'icône Firefox",
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "history": [
    {
      "action": "Took screenshot",
      "result": "Screenshot captured"
    }
  ]
}
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Orchestrator LLM responded successfully",
  "data": {
    "response": {
      "action": "click",
      "description": "Firefox browser icon on desktop",
      "thinking": "I can see the Firefox icon on the desktop. I need to click on it to open the browser."
    },
    "duration": "1234ms",
    "screenshotUsed": "taken",
    "screenshotLength": 123456
  }
}
```

**Exemple curl :**
```bash
curl -X POST http://localhost:9992/test-llm/orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "taskDescription": "Cliquer sur l'\''icône Firefox"
  }'
```

**Exemple PowerShell :**
```powershell
Invoke-RestMethod -Uri "http://localhost:9992/test-llm/orchestrator" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (@{
    taskDescription = "Cliquer sur l'icône Firefox"
  } | ConvertTo-Json)
```

---

### 2. POST `/test-llm/position` - Tester le Position LLM

Teste le Position LLM (`findPosition()`) qui trouve les coordonnées précises d'un élément sur un screenshot.

**Configuration Postman :**
- **Method** : `POST`
- **URL** : `http://localhost:9992/test-llm/position`

**Body (raw, JSON) - Option 1 : Screenshot automatique**
```json
{
  "description": "Firefox browser icon on desktop"
}
```

**Body (raw, JSON) - Option 2 : Screenshot fourni**
```json
{
  "description": "Firefox browser icon on desktop",
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "retries": 3
}
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Position LLM found position successfully",
  "data": {
    "position": {
      "normalized": {
        "x": 0.125,
        "y": 0.15
      },
      "pixels": {
        "x": 160,
        "y": 144
      }
    },
    "description": "Firefox browser icon on desktop",
    "duration": "2345ms",
    "screenshotUsed": "taken",
    "screenshotLength": 123456
  }
}
```

**Exemple curl :**
```bash
curl -X POST http://localhost:9992/test-llm/position \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Firefox browser icon on desktop"
  }'
```

**Exemple PowerShell :**
```powershell
Invoke-RestMethod -Uri "http://localhost:9992/test-llm/position" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (@{
    description = "Firefox browser icon on desktop"
  } | ConvertTo-Json)
```

---

### 3. POST `/test-llm/full-test` - Test complet (Orchestrateur + Position)

Teste le flux complet : orchestrateur puis position (si action = "click").

**Configuration Postman :**
- **Method** : `POST`
- **URL** : `http://localhost:9992/test-llm/full-test`

**Body (raw, JSON) :**
```json
{
  "taskDescription": "Cliquer sur l'icône Firefox"
}
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Full LLM test completed successfully",
  "results": [
    {
      "step": "screenshot",
      "status": "success",
      "data": {
        "imageLength": 123456
      }
    },
    {
      "step": "orchestrator",
      "status": "success",
      "data": {
        "response": {
          "action": "click",
          "description": "Firefox browser icon on desktop",
          "thinking": "..."
        },
        "duration": "1234ms"
      }
    },
    {
      "step": "position",
      "status": "success",
      "data": {
        "position": {
          "normalized": {
            "x": 0.125,
            "y": 0.15
          },
          "pixels": {
            "x": 160,
            "y": 144
          }
        },
        "description": "Firefox browser icon on desktop",
        "duration": "2345ms"
      }
    }
  ]
}
```

**Exemple curl :**
```bash
curl -X POST http://localhost:9992/test-llm/full-test \
  -H "Content-Type: application/json" \
  -d '{
    "taskDescription": "Cliquer sur l'\''icône Firefox"
  }'
```

---

### 4. GET `/test-llm/help` - Aide

Affiche la documentation de tous les endpoints de test LLM.

**Configuration Postman :**
- **Method** : `GET`
- **URL** : `http://localhost:9992/test-llm/help`

**Exemple curl :**
```bash
curl http://localhost:9992/test-llm/help
```

---

## Workflow recommandé avec Postman

### Scénario 1 : Tester l'orchestrateur seul

1. **POST** `/test-llm/orchestrator`
   - Body : `{"taskDescription": "Cliquer sur Firefox"}`
   - L'endpoint prendra un screenshot automatiquement

2. **Vérifier la réponse** :
   - `success: true`
   - `data.response.action` (doit être "click", "type", "wait", "screenshot", ou "done")
   - `data.response.description` (si action = "click")

### Scénario 2 : Tester le Position LLM seul

1. **POST** `/test-llm/position`
   - Body : `{"description": "Firefox browser icon on desktop"}`
   - L'endpoint prendra un screenshot automatiquement

2. **Vérifier la réponse** :
   - `success: true`
   - `data.position.normalized` (x et y entre 0 et 1)
   - `data.position.pixels` (x et y en pixels)

### Scénario 3 : Test complet (orchestrateur → position)

1. **POST** `/test-llm/full-test`
   - Body : `{"taskDescription": "Cliquer sur Firefox"}`
   - L'endpoint va :
     - Prendre un screenshot
     - Appeler l'orchestrateur
     - Si action = "click", appeler le Position LLM

2. **Vérifier la réponse** :
   - `success: true`
   - `results[].step` : "screenshot", "orchestrator", "position"
   - `results[].status` : "success" ou "failed"

---

## Paramètres de configuration

Les endpoints utilisent les variables d'environnement suivantes :

- **`LM_STUDIO_BASE_URL`** : URL de l'API LM Studio (par défaut: `http://host.docker.internal:1234/v1`)
- **`MODEL_ORCHESTRATOR`** : Nom du modèle orchestrateur (par défaut: `magistral-small-2509`)
- **`MODEL_POSITION`** : Nom du modèle position (par défaut: `qwen2.5-vl:32b`)

---

## Gestion des erreurs

En cas d'erreur, les endpoints retournent :

```json
{
  "success": false,
  "error": "Description de l'erreur",
  "stack": "Stack trace (en dev seulement)"
}
```

**Erreurs courantes :**

1. **"Failed to connect to LM Studio"**
   - Vérifiez que LM Studio est lancé
   - Vérifiez que le serveur est actif sur le port 1234
   - Vérifiez `LM_STUDIO_BASE_URL` dans les variables d'environnement

2. **"No response from orchestrator LLM"**
   - Vérifiez que le modèle orchestrateur est chargé dans LM Studio
   - Vérifiez que le nom du modèle correspond à `MODEL_ORCHESTRATOR`

3. **"Failed to find position after 3 attempts"**
   - La description n'est peut-être pas assez précise
   - Essayez de fournir une description plus détaillée
   - Vérifiez que le modèle position est chargé dans LM Studio

4. **"Failed to connect to bytebot-desktop"**
   - Vérifiez que `bytebot-desktop` est lancé
   - Vérifiez que `BYTEBOT_DESKTOP_BASE_URL` est correctement configuré

---

## Notes importantes

1. **Screenshots automatiques** : Si vous ne fournissez pas de `screenshot`, l'endpoint en prendra un automatiquement depuis le desktop. Cela peut prendre 1-2 secondes.

2. **Retry automatique** : Le Position LLM a un système de retry (3 tentatives par défaut) si la première tentative échoue.

3. **Coordonnées normalisées** : Le Position LLM retourne des coordonnées normalisées (0-1), puis elles sont converties en pixels (1280x960 par défaut).

4. **Performance** : Les appels LLM peuvent prendre plusieurs secondes (5-30s selon le modèle et la complexité).

---

## Exemples d'utilisation

### Exemple 1 : Tester avec un screenshot spécifique

1. Obtenir un screenshot :
   ```bash
   curl http://localhost:9992/test-desktop/screenshot
   ```

2. Copier le champ `fullImage` de la réponse

3. Tester l'orchestrateur avec ce screenshot :
   ```json
   {
     "taskDescription": "Ouvrir Firefox",
     "screenshot": "[COLLER ICI LE fullImage]"
   }
   ```

### Exemple 2 : Tester avec historique

```json
{
  "taskDescription": "Ouvrir Firefox",
  "history": [
    {
      "action": "Took screenshot",
      "result": "Screenshot captured"
    },
    {
      "action": "Click on Firefox icon",
      "result": "Clicked at (160, 144)"
    }
  ]
}
```

---

Souhaitez-vous plus d'exemples ou des scénarios spécifiques à tester ?

