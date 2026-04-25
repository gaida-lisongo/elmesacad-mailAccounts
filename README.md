# account-service

Microservice **NestJS** pour provisionner des comptes messagerie (Dovecot / politique `SHA512-CRYPT`) en écrivant dans la base **MySQL** de ton serveur mail (table `users` : `email`, `password`, `maildir`).

> **Sécurité** : l’API n’inclut pas d’authentification applicative. En production, protège le service (reverse proxy, API key, VPN, règles réseau) avant toute exposition sur Internet.

---

## Prérequis côté serveur

- **MySQL** (ou MariaDB) avec une table `users` cohérente avec le schéma attendu, par ex. :

  - `email` (unique)
  - `password` (hash type `{SHA512-CRYPT}…`)
  - `maildir` (chemin relatif type `domaine.fr/utilisateur/`)

- **`openssl` présent sur la machine (ou dans l’image Docker)** : le service l’invoque pour générer le hash (`openssl passwd -6`).

---

## Configuration (variables d’environnement)

| Variable   | Rôle | Défaut (si non défini) |
|------------|------|------------------------|
| `DB_HOST`  | Hôte MySQL | `localhost` |
| `DB_PORT`  | Port (entier positif) | `3306` |
| `DB_USER`  | Utilisateur MySQL | `mailuser` |
| `DB_SECRET`| Mot de passe MySQL | `admin` |
| `DB_NAME`  | Base de données | `mailserver` |
| `PORT`     | Port d’écoute HTTP du service | `3000` |

En local, un fichier `.env` à la racine du service est pris en charge par `@nestjs/config`.

---

## Installation et lancement (développement)

```bash
cd account-service
npm install
npm run start:dev
```

Compilation production :

```bash
npm run build
npm run start:prod
```

L’URL de base, par défaut, est : `http://localhost:3000` (ou la valeur de `PORT`).

---

## Consommer l’API (référence)

Tous les points d’entrée ci‑dessous sont sous le préfixe **`/mail-accounts`**. Le corps des requêtes est en **JSON** ; envoie l’en‑tête `Content-Type: application/json` lorsque tu envoies un body.

**Base d’URL (exemple)** : `http://<hôte>:<PORT>/mail-accounts`

### `GET /mail-accounts`

Liste les comptes (email + maildir) connus en base.

**Réponse 200 (succès)**

```json
{
  "ok": true,
  "rows": [
    { "email": "user@example.com", "maildir": "example.com/user/" }
  ]
}
```

---

### `POST /mail-accounts`

Crée un compte : insert dans `users` avec mot de passe hashé pour Dovecot.

**Corps**

| Champ        | Type   | Obligatoire |
|-------------|--------|-------------|
| `email`     | string | oui         |
| `password`  | string | oui         |

**Réponse succès** (Nest utilise en général **201 Created** pour les `POST` par défaut).

**Exemple de corps de réponse**

```json
{
  "ok": true,
  "status": "created",
  "account": {
    "email": "user@example.com",
    "maildir": "example.com/user/"
  }
}
```

**Exemple cURL**

```bash
curl -sS -X POST "http://localhost:3000/mail-accounts" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"motDePasseSecurise"}'
```

---

### `PUT /mail-accounts`

Met à jour le **mot de passe** d’un compte existant (même algorithme de hash que pour la création).

**Corps**

| Champ        | Type   | Obligatoire |
|-------------|--------|-------------|
| `email`     | string | oui         |
| `password`  | string | oui         |

**Exemple de succès**

```json
{
  "ok": true,
  "updated": true
}
```

**Exemple cURL**

```bash
curl -sS -X PUT "http://localhost:3000/mail-accounts" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"nouveauMotDePasse"}'
```

---

### `DELETE /mail-accounts`

Supprime l’enregistrement en base pour l’adresse indiquée.

**Corps**

| Champ   | Type   | Obligatoire |
|--------|--------|-------------|
| `email`| string | oui         |

**Exemple de succès**

```json
{
  "ok": true,
  "deleted": true
}
```

**Exemple cURL**

```bash
curl -sS -X DELETE "http://localhost:3000/mail-accounts" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

> Certains clients ou proxies n’apprécient pas un corps sur `DELETE` : en cas de souci, préfère un outil qui envoie bien le body (comme `curl` ci‑dessus) ou fais évoluer l’API (ex. `DELETE /mail-accounts/:email`) si besoin.

---

## Erreurs (format unifié)

En cas d’échec, le corps ressemble à :

```json
{
  "ok": false,
  "code": "validation_error",
  "message": "Description lisible"
}
```

**Codes `code` possibles (non exhaustif selon l’évolution du code)** : `validation_error`, `db_unreachable`, `db_auth_failed`, `db_missing_config`, `maildir_permission_failed`, `internal_error`, etc.

**Exemples de statuts HTTP** :

- **400** : erreur de validation (email invalide, doublon, mot de passe manquant, etc. selon le cas)
- **503** : base injoignable (réseau, mauvais hôte/port)
- **500** : erreur d’authentification MySQL, configuration, ou autre erreur interne

---

## Image Docker (build & run)

### Construire l’image

À la racine de `account-service` :

```bash
docker build -t account-service:local .
```

### Lancer un conteneur

Passe les variables de connexion MySQL (et le port d’écoute si besoin). Exemple si MySQL est sur la machine hôte (Linux) :

```bash
docker run --rm -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=3306 \
  -e DB_USER=mailuser \
  -e DB_SECRET=ton_mot_de_passe \
  -e DB_NAME=mailserver \
  account-service:local
```

> Sur Linux, `host.docker.internal` n’existe pas toujours ; utilise `--add-host=host.docker.internal:host-gateway` (Docker 20.10+) ou l’IP de ton hôte, ou mets le service sur le même réseau Docker que MySQL.

Le fichier **`Dockerfile`** est fourni à la racine de ce service ; l’image inclut **OpenSSL** pour la génération des hashes.

---

## Tests (optionnel)

```bash
npm run test
npm run test:e2e
```

---

## Projet

Généré avec [Nest](https://github.com/nestjs/nest) ; ce README remplace le texte d’exemple par la documentation d’intégration de ce microservice.
