# Guide de test des services Desktop

Ce guide explique comment tester les services desktop sans utiliser l'IA.

## Endpoints disponibles

Base URL: `http://localhost:9992/test-desktop`

### 1. Aide / Documentation

```bash
GET /test-desktop/help
```

Affiche tous les endpoints disponibles et leur utilisation.

### 2. Prendre un screenshot

```bash
GET /test-desktop/screenshot
```

**Exemple avec curl:**
```bash
curl http://localhost:9992/test-desktop/screenshot
```

**Réponse:**
```json
{
  "success": true,
  "message": "Screenshot taken successfully",
  "data": {
    "imageLength": 125000,
    "imagePreview": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "fullImage": "data:image/png;base64,..."
  }
}
```

### 3. Cliquer à des coordonnées

```bash
POST /test-desktop/click
Content-Type: application/json

{
  "x": 640,
  "y": 480,
  "button": "left",  // optionnel: "left" | "right" | "middle" (défaut: "left")
  "clickCount": 1    // optionnel: 1 = single, 2 = double, etc. (défaut: 1)
}
```

**Exemple avec curl (Single click):**
```bash
curl -X POST http://localhost:9992/test-desktop/click \
  -H "Content-Type: application/json" \
  -d '{"x": 640, "y": 480, "button": "left"}'
```

**Exemple avec curl (Double click):**
```bash
curl -X POST http://localhost:9992/test-desktop/click \
  -H "Content-Type: application/json" \
  -d '{"x": 640, "y": 480, "button": "left", "clickCount": 2}'
```

**Exemple: Cliquer au centre de l'écran (1280x960)**
```bash
curl -X POST http://localhost:9992/test-desktop/click \
  -H "Content-Type: application/json" \
  -d '{"x": 640, "y": 480}'
```

**Exemple: Double click sur une icône**
```bash
curl -X POST http://localhost:9992/test-desktop/click \
  -H "Content-Type: application/json" \
  -d '{"x": 125, "y": 150, "clickCount": 2}'
```

**Réponse (Single click):**
```json
{
  "success": true,
  "message": "single clicked successfully at (640, 480)",
  "data": {
    "coordinates": { "x": 640, "y": 480 },
    "button": "left",
    "clickCount": 1,
    "clickType": "single"
  }
}
```

**Réponse (Double click):**
```json
{
  "success": true,
  "message": "double clicked successfully at (640, 480)",
  "data": {
    "coordinates": { "x": 640, "y": 480 },
    "button": "left",
    "clickCount": 2,
    "clickType": "double"
  }
}
```

### 4. Taper du texte

```bash
POST /test-desktop/type
Content-Type: application/json

{
  "text": "Hello World",
  "delay": 50  // optionnel: délai entre chaque caractère en ms
}
```

**Exemple avec curl:**
```bash
curl -X POST http://localhost:9992/test-desktop/type \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World", "delay": 50}'
```

**Réponse:**
```json
{
  "success": true,
  "message": "Text typed successfully",
  "data": {
    "text": "Hello World",
    "textLength": 11,
    "delay": 50
  }
}
```

### 5. Obtenir la position du curseur

```bash
GET /test-desktop/cursor-position
```

**Exemple avec curl:**
```bash
curl http://localhost:9992/test-desktop/cursor-position
```

**Réponse:**
```json
{
  "success": true,
  "message": "Cursor position retrieved successfully",
  "data": {
    "coordinates": {
      "x": 640,
      "y": 480
    }
  }
}
```

### 6. Test complet

```bash
POST /test-desktop/full-test
Content-Type: application/json

{
  "text": "Test"  // optionnel
}
```

Exécute une séquence de tests :
1. Prendre un screenshot
2. Obtenir la position du curseur
3. Cliquer au centre de l'écran (640, 480)
4. Taper le texte fourni (si présent)

**Exemple avec curl:**
```bash
curl -X POST http://localhost:9992/test-desktop/full-test \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello"}'
```

**Réponse:**
```json
{
  "success": true,
  "message": "Full test completed successfully",
  "results": [
    { "step": "screenshot", "status": "running" },
    { "step": "screenshot", "status": "success", "data": { "imageLength": 125000 } },
    { "step": "cursor_position", "status": "running" },
    { "step": "cursor_position", "status": "success", "data": { "coordinates": { "x": 640, "y": 480 } } },
    { "step": "click_center", "status": "running" },
    { "step": "click_center", "status": "success", "data": { "coordinates": { "x": 640, "y": 480 } } },
    { "step": "type_text", "status": "running" },
    { "step": "type_text", "status": "success", "data": { "text": "Hello" } }
  ]
}
```

## Exemples avec Postman / Insomnia

### Guide étape par étape pour Postman

#### 1. Créer une nouvelle requête

1. Ouvrez Postman
2. Cliquez sur "New" → "HTTP Request"
3. Donnez un nom à la requête (ex: "Click Desktop")

#### 2. Configurer la requête de click

**Étape 1 : Méthode et URL**
- Méthode : `POST` (dans le menu déroulant à gauche)
- URL : `http://localhost:9992/test-desktop/click`

**Étape 2 : Headers**
- Cliquez sur l'onglet "Headers"
- Ajoutez :
  - Key: `Content-Type`
  - Value: `application/json`

**Étape 3 : Body**
- Cliquez sur l'onglet "Body"
- Sélectionnez `raw`
- Dans le menu déroulant à droite, sélectionnez `JSON`
- Entrez le JSON :
```json
{
  "x": 640,
  "y": 480,
  "button": "left"
}
```

**Étape 4 : Envoyer**
- Cliquez sur "Send"
- Vérifiez la réponse :
```json
{
  "success": true,
  "message": "Clicked successfully at (640, 480)",
  "data": {
    "coordinates": { "x": 640, "y": 480 },
    "button": "left"
  }
}
```

#### 3. Workflow complet dans Postman

**Requête 1 : Screenshot**
- Method: `GET`
- URL: `http://localhost:9992/test-desktop/screenshot`
- Pas de body nécessaire
- Copiez l'image depuis la réponse pour voir où cliquer

**Requête 2 : Click**
- Method: `POST`
- URL: `http://localhost:9992/test-desktop/click`
- Headers: `Content-Type: application/json`
- Body (raw, JSON):
```json
{
  "x": 640,
  "y": 480
}
```

**Requête 3 : Type Text (optionnel)**
- Method: `POST`
- URL: `http://localhost:9992/test-desktop/type`
- Headers: `Content-Type: application/json`
- Body (raw, JSON):
```json
{
  "text": "Hello World",
  "delay": 50
}
```

### Collection Postman prête à importer

Créez une collection avec ces requêtes :

1. **Get Screenshot**
   - Method: `GET`
   - URL: `http://localhost:9992/test-desktop/screenshot`

2. **Click at Position**
   - Method: `POST`
   - URL: `http://localhost:9992/test-desktop/click`
   - Body (JSON):
     ```json
     {
       "x": 640,
       "y": 480,
       "button": "left"
     }
     ```

3. **Click Right Button**
   - Method: `POST`
   - URL: `http://localhost:9992/test-desktop/click`
   - Body (JSON):
     ```json
     {
       "x": 640,
       "y": 480,
       "button": "right"
     }
     ```

4. **Type Text**
   - Method: `POST`
   - URL: `http://localhost:9992/test-desktop/type`
   - Body (JSON):
     ```json
     {
       "text": "Hello World",
       "delay": 50
     }
     ```

5. **Get Cursor Position**
   - Method: `GET`
   - URL: `http://localhost:9992/test-desktop/cursor-position`

6. **Full Test**
   - Method: `POST`
   - URL: `http://localhost:9992/test-desktop/full-test`
   - Body (JSON):
     ```json
     {
       "text": "Test"
     }
     ```

## Exemples avec PowerShell (Windows)

```powershell
# Screenshot
Invoke-RestMethod -Uri http://localhost:9992/test-desktop/screenshot -Method Get

# Click
$body = @{
    x = 640
    y = 480
    button = "left"
} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:9992/test-desktop/click -Method Post -Body $body -ContentType "application/json"

# Type
$body = @{
    text = "Hello World"
    delay = 50
} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:9992/test-desktop/type -Method Post -Body $body -ContentType "application/json"

# Cursor Position
Invoke-RestMethod -Uri http://localhost:9992/test-desktop/cursor-position -Method Get

# Full Test
$body = @{
    text = "Test"
} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:9992/test-desktop/full-test -Method Post -Body $body -ContentType "application/json"
```

## Scénarios de test

### Test 1: Vérifier que le screenshot fonctionne
```bash
curl http://localhost:9992/test-desktop/screenshot
```
Vérifiez que `success: true` et que `imageLength > 0`

### Test 2: Vérifier que le click fonctionne
```bash
# Prendre screenshot avant
curl http://localhost:9992/test-desktop/screenshot > before.json

# Cliquer au centre
curl -X POST http://localhost:9992/test-desktop/click \
  -H "Content-Type: application/json" \
  -d '{"x": 640, "y": 480}'

# Attendre 1 seconde
sleep 1

# Prendre screenshot après
curl http://localhost:9992/test-desktop/screenshot > after.json
```

### Test 3: Vérifier que le type fonctionne
```bash
# Ouvrir un éditeur de texte (via UI ou autre méthode)
# Puis taper du texte
curl -X POST http://localhost:9992/test-desktop/type \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World"}'
```

### Test 4: Test complet
```bash
curl -X POST http://localhost:9992/test-desktop/full-test \
  -H "Content-Type: application/json" \
  -d '{"text": "Test complete"}'
```

## Gestion des erreurs

Tous les endpoints retournent un format standard :

**Succès:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Erreur:**
```json
{
  "success": false,
  "error": "Error message",
  "stack": "Error stack trace (en développement)"
}
```

## Vérification que le service fonctionne

1. Vérifiez que le backend est lancé :
   ```bash
   curl http://localhost:9992/health
   ```

2. Vérifiez que les endpoints de test sont disponibles :
   ```bash
   curl http://localhost:9992/test-desktop/help
   ```

3. Vérifiez que bytebot-desktop est accessible :
   ```bash
   curl http://localhost:9990/health
   ```
   (si un endpoint de health existe)

## Notes

- Tous les endpoints sont synchrones et attendent la fin de l'action
- Les timeouts sont les mêmes que dans le service principal :
  - Screenshot: 30s
  - Click: 10s
  - Type: 15s
- Les logs sont affichés dans les logs du container `laweye`
- Les coordonnées sont en pixels (ex: 640, 480 pour le centre d'un écran 1280x960)

