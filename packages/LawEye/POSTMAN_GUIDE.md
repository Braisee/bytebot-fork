# Guide Postman pour tester les Desktop Services

## Quick Start : Cliquer avec Postman

### Configuration minimale (Single click)

1. **Méthode** : `POST`
2. **URL** : `http://localhost:9992/test-desktop/click`
3. **Headers** :
   - `Content-Type: application/json`
4. **Body** (raw, JSON) :
```json
{
  "x": 640,
  "y": 480,
  "button": "left"
}
```

### Double click

Même configuration, mais ajoutez `clickCount: 2` :
```json
{
  "x": 640,
  "y": 480,
  "button": "left",
  "clickCount": 2
}
```

## Guide détaillé

### Étape 1 : Créer une nouvelle requête

1. Ouvrez Postman
2. Cliquez sur **"New"** → **"HTTP Request"**
3. Donnez un nom : **"Click Desktop"**

### Étape 2 : Configurer la requête

#### 1. Méthode et URL
- Dans le menu déroulant à gauche, sélectionnez **`POST`**
- Dans le champ URL, entrez : `http://localhost:9992/test-desktop/click`

#### 2. Headers
- Cliquez sur l'onglet **"Headers"**
- Dans le tableau, ajoutez :
  - **Key** : `Content-Type`
  - **Value** : `application/json`
  - (Postman peut le faire automatiquement si vous utilisez raw JSON)

#### 3. Body
- Cliquez sur l'onglet **"Body"**
- Sélectionnez **`raw`**
- Dans le menu déroulant à droite (normalement "Text"), sélectionnez **`JSON`**
- Collez ce JSON :
```json
{
  "x": 640,
  "y": 480,
  "button": "left"
}
```

#### 4. Envoyer
- Cliquez sur le bouton **"Send"** (bleu)
- Attendez la réponse

### Réponse attendue

**Succès :**
```json
{
  "success": true,
  "message": "Clicked successfully at (640, 480)",
  "data": {
    "coordinates": {
      "x": 640,
      "y": 480
    },
    "button": "left"
  }
}
```

**Erreur :**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Exemples de coordonnées

### Pour un écran 1280x960 :

**Centre de l'écran :**
```json
{
  "x": 640,
  "y": 480
}
```

**Coin supérieur gauche :**
```json
{
  "x": 100,
  "y": 100
}
```

**Coin inférieur droit :**
```json
{
  "x": 1180,
  "y": 860
}
```

**Icône Firefox (exemple) :**
```json
{
  "x": 125,
  "y": 150
}
```

**Icône VSCode (exemple) :**
```json
{
  "x": 225,
  "y": 150
}
```

## Boutons de souris

**Click gauche (par défaut) :**
```json
{
  "x": 640,
  "y": 480,
  "button": "left"
}
```

**Click droit :**
```json
{
  "x": 640,
  "y": 480,
  "button": "right"
}
```

**Click milieu :**
```json
{
  "x": 640,
  "y": 480,
  "button": "middle"
}
```

### 4. Double click

**Double click (2 clics) :**
```json
{
  "x": 640,
  "y": 480,
  "button": "left",
  "clickCount": 2
}
```

**Triple click (3 clics) :**
```json
{
  "x": 640,
  "y": 480,
  "button": "left",
  "clickCount": 3
}
```

**Single click (par défaut, peut être omis) :**
```json
{
  "x": 640,
  "y": 480,
  "button": "left",
  "clickCount": 1
}
```
ou simplement :
```json
{
  "x": 640,
  "y": 480
}
```

## Workflow recommandé

### 1. Prendre un screenshot pour visualiser

**Requête :**
- Method: `GET`
- URL: `http://localhost:9992/test-desktop/screenshot`

**Réponse :**
- Copiez le champ `fullImage` (base64)
- Décodez-le ou utilisez-le dans un viewer pour voir où cliquer
- Notez les coordonnées (x, y) où vous voulez cliquer

### 2. Cliquer à la position

Utilisez les coordonnées obtenues à l'étape 1.

**Requête :**
- Method: `POST`
- URL: `http://localhost:9992/test-desktop/click`
- Body:
```json
{
  "x": 125,
  "y": 150,
  "button": "left"
}
```

### 3. Vérifier le résultat

Reprenez un screenshot pour voir si le click a fonctionné.

## Astuces Postman

### Variables d'environnement

Vous pouvez créer un environnement Postman avec :
- Variable `base_url` : `http://localhost:9992`
- Puis utiliser `{{base_url}}/test-desktop/click`

### Sauvegarder les requêtes

1. Créez une **Collection** : "LawEye Desktop Tests"
2. Ajoutez toutes vos requêtes dans cette collection
3. Vous pouvez les réutiliser facilement

### Tests automatiques

Dans l'onglet "Tests" de Postman, ajoutez :
```javascript
pm.test("Click successful", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.eql(true);
});

pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});
```

## Dépannage

### Erreur 404
- Vérifiez que l'URL est correcte : `http://localhost:9992/test-desktop/click`
- Vérifiez que le backend est lancé : `curl http://localhost:9992/health`

### Erreur 400 "Invalid coordinates"
- Vérifiez que x et y sont des nombres (pas des strings)
- Exemple correct : `"x": 640` (pas `"x": "640"`)

### Le click ne fonctionne pas
- Vérifiez que bytebot-desktop est lancé : `docker ps | grep bytebot-desktop`
- Vérifiez les logs : `docker logs laweye --tail 50`
- Testez d'abord le screenshot pour voir si la connexion fonctionne

## Autres endpoints utiles

### Obtenir la position du curseur

**GET** `http://localhost:9992/test-desktop/cursor-position`

Utile pour connaître où se trouve le curseur avant de cliquer.

### Taper du texte

**POST** `http://localhost:9992/test-desktop/type`

Body:
```json
{
  "text": "Hello World",
  "delay": 50
}
```

### Test complet

**POST** `http://localhost:9992/test-desktop/full-test`

Body:
```json
{
  "text": "Test"
}
```

Exécute : Screenshot → Click centre → Type texte

