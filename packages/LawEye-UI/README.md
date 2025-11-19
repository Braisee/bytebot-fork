# LawEye UI

Interface utilisateur simplifiée pour LawEye - Contrôle desktop avec LLM locaux.

## Fonctionnalités

- ✅ Envoi de tâches via input
- ✅ Affichage VNC du desktop en temps réel
- ✅ Logs d'erreurs et événements en temps réel
- ✅ WebSocket pour les mises à jour en direct

## Développement

```bash
npm install
npm run dev
```

L'UI sera disponible sur `http://localhost:9993`

## Variables d'environnement

- `NEXT_PUBLIC_LAWEYE_API_URL`: URL du backend LawEye (dev seulement)
- `NEXT_PUBLIC_LAWEYE_WS_URL`: URL WebSocket du backend LawEye (dev seulement)
- `NEXT_PUBLIC_VNC_HOST`: Hostname pour VNC (default: window.location.hostname)
- `NEXT_PUBLIC_VNC_PORT`: Port pour VNC (default: 9990)
- `LAWEYE_API_URL`: URL du backend pour le proxy (production)

## Build

```bash
npm run build
npm start
```

