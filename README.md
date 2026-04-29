# account-service

Microservice **NestJS** pour gérer les **boîtes mail virtuelles** (Postfix / Dovecot) et l’**auto-configuration** des clients (Thunderbird, Outlook). Il s’appuie sur **MariaDB/MySQL** avec le schéma classique `virtual_domains`, `virtual_users`, `virtual_aliases`.

Les mots de passe sont hashés en **`{SHA512-CRYPT}$6$…`** (OpenSSL `passwd -6`), compatible Dovecot.

---

## Schéma SQL

Applique le script [`sql/schema-mariadb.sql`](sql/schema-mariadb.sql) sur ta base (ex. `servermail`).

- `virtual_domains` : domaines hébergés  
- `virtual_users` : `domain_id`, `email`, `password`  
- `virtual_aliases` : `domain_id`, `source`, `destination` (source unique)

---

## Variables d’environnement

| Variable | Rôle | Défaut |
|----------|------|--------|
| `DB_HOST` | Hôte MariaDB | `localhost` |
| `DB_PORT` | Port | `3306` |
| `DB_USER` | Utilisateur | `mailuser` |
| `DB_PASS` | Mot de passe (remplace `DB_SECRET` si absent) | — |
| `DB_SECRET` | Mot de passe (rétrocompatibilité) | `admin` |
| `DB_NAME` | Base | `servermail` |
| `DB_POOL_LIMIT` | Connexions simultanées du pool MySQL (résilience timeouts / redémarrage MariaDB) | `10` |
| `PORT` | Port HTTP | `3000` |
| `MAIL_SERVER_FQDN` | Serveur IMAP/SMTP (ex. `mail.inbtp.ac.cd`) | `mail.inbtp.ac.cd` |
| `IMAP_PORT` | Port IMAP SSL | `993` |
| `SMTP_PORT` | Port SMTP SSL | `465` |
| `MAIL_DISPLAY_NAME` | Libellé affiché (autoconfig) | `INBTP Courrier` |
| `ACCOUNT_API_KEY` | Clé pour les routes CRUD (`X-API-Key`) — **requis en production** | — |

---

## Autoconfig (public)

| Route | Usage |
|-------|--------|
| `GET /mail/config-v1.1.xml` | Thunderbird (Mozilla autoconfig) |
| `GET` / `POST /autodiscover/autodiscover.xml` | Outlook (Autodiscover) |

Dans le stack **Traefik** du dépôt parent, ces URL sont exposées sur :

- `https://autoconfig.inbtp.ac.cd/mail/config-v1.1.xml`
- `https://autodiscover.inbtp.ac.cd/autodiscover/autodiscover.xml`

L’**API d’administration** reste sur `https://services.inbtp.ac.cd/mail/...` (préfixe `/mail` retiré par Traefik) avec **JWT** (Traefik) + en-tête **`X-API-Key`**.

---

## API sécurisée (CRUD) — guide développeur

### Accès et prérequis

Deux couches s’additionnent en production (stack Traefik du monorepo) :

1. **Traefik** appelle d’abord l’**auth-service** (`forwardAuth`) : la requête doit porter un JWT valide.

   `Authorization: Bearer <JWT>`

2. Ce service exige en plus la clé d’API métier :

   `X-API-Key: <ACCOUNT_API_KEY>`

   (variable d’environnement `ACCOUNT_API_KEY` côté conteneur `mail` — alignée avec la valeur que vous mettez dans le `.env` racine.)

**URLs de base**

| Contexte | Base vers l’API CRUD |
|------------|----------------------|
| Conteneur / `localhost` (dev) | `http://localhost:3000` |
| Production (exemple) | `https://services.inbtp.ac.cd/mail` — Traefik retire le préfixe `/mail` : l’application reçoit les chemins **`/mail-accounts`** et **`/mail-aliases`** à la racine du service. |

Tous les exemples ci-dessous utilisent le préfixe **`/mail-accounts`** et **`/mail-aliases`** tels qu’exposés **par le service** (après strip éventuel de `/mail`).

**En-têtes recommandés**

```http
Authorization: Bearer <JWT>
X-API-Key: <ACCOUNT_API_KEY>
Content-Type: application/json
```

En **développement local** sans Traefik, seul `X-API-Key` est nécessaire si `ACCOUNT_API_KEY` est défini. En **production**, sans clé configurée, l’API refuse l’accès (`401`).

---

### Format des erreurs

En cas d’échec, le corps est en général un JSON du type :

```json
{ "ok": false, "code": "<code>", "message": "<texte>" }
```

| `code` (exemples) | HTTP | Signification |
|-------------------|------|----------------|
| *(guard)* | `401` | `Invalid or missing X-API-Key` ou clé absente en production |
| `validation_error` | `400` | Email / mot de passe invalide, doublon (email ou alias déjà présent), corps incomplet |
| `not_found` | `404` | Id utilisateur ou alias inconnu |
| `db_unreachable` | `503` | Base injoignable (réseau, hôte, timeout) |
| `db_auth_failed` | `500` | Mauvais utilisateur / mot de passe MySQL |
| `db_missing_config` | `500` | Port DB invalide |
| `internal_error` | `500` | Erreur interne |

Les réponses **réussies** incluent en général `"ok": true` et le détail ci-dessous.

**Validité des emails** : format `local@domaine` (trim, insensible à la casse). Mot de passe non vide à la création / changement.

---

### Boîtes mail — `/mail-accounts`

#### `GET /mail-accounts`

Liste toutes les boîtes (sans mot de passe).

**Réponse `200`**

```json
{
  "ok": true,
  "rows": [
    {
      "id": 1,
      "email": "user@example.com",
      "domain_id": 1,
      "domain_name": "example.com"
    }
  ]
}
```

---

#### `GET /mail-accounts/:id`

Détail d’une boîte par identifiant numérique (`id` en base).

**Réponse `200`**

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "domain_id": 1,
    "domain_name": "example.com"
  }
}
```

**Erreur** : `404` si aucun utilisateur pour cet `id`.

---

#### `GET /mail-accounts/exists?email=...`

Vérifie si une adresse est déjà enregistrée.

**Paramètre requête**

| Nom | Exemple | Description |
|-----|---------|-------------|
| `email` | `user@example.com` | Adresse complète (obligatoire pour un résultat utile) |

**Réponse `200`**

```json
{ "ok": true, "exists": true, "email": "user@example.com" }
```

Si l’email est vide ou mal formé, le service peut renvoyer une erreur de validation (`400`).

---

#### `POST /mail-accounts`

Crée une boîte. Le **domaine** est créé dans `virtual_domains` s’il n’existe pas encore.

**Corps JSON**

| Champ | Obligatoire | Description |
|-------|-------------|---------------|
| `email` | oui | Adresse complète `local@domaine` |
| `password` | oui | Mot de passe en clair (stocké haché en SHA512-CRYPT côté serveur) |

**Exemple**

```json
{ "email": "nouveau@example.com", "password": "MotDePasseSûr" }
```

**Réponse `201`**

```json
{
  "ok": true,
  "status": "created",
  "id": 42,
  "user": { "email": "nouveau@example.com", "domain": "example.com" }
}
```

**Erreurs** : `400` si email/mot de passe invalides, ou **doublon** d’email (`validation_error` / message du type *Email or alias already exists.*).

---

#### `PUT /mail-accounts/:id`

Met à jour l’email et/ou le mot de passe. Il faut **au moins** un des deux champs.

**Paramètre d’URL** : `id` (entier) — identifiant de la boîte.

**Corps JSON** (tous optionnels, mais au moins un requis)

| Champ | Description |
|-------|-------------|
| `email` | Nouvelle adresse complète (peut déplacer vers un autre domaine) |
| `password` | Nouveau mot de passe en clair |

**Exemples de corps**

```json
{ "password": "NouveauSecret" }
```

```json
{ "email": "autre@example.com" }
```

```json
{ "email": "autre@example.com", "password": "NouveauSecret" }
```

**Réponse `200`**

```json
{ "ok": true, "updated": true, "id": 42 }
```

**Erreurs** : `400` si ni email ni mot de passe ; `404` si `id` inconnu.

---

#### `DELETE /mail-accounts/:id`

Supprime la boîte (ligne `virtual_users`).

**Paramètre d’URL** : `id` (entier).

**Réponse `200`**

```json
{ "ok": true, "deleted": true, "id": 42 }
```

**Erreur** : `404` si `id` inconnu.

---

### Alias — `/mail-aliases`

Redirections **source** → **destination** (adresses complètes). Même en-têtes `Authorization` + `X-API-Key`.

#### `GET /mail-aliases`

Liste tous les alias.

**Réponse `200`**

```json
{
  "ok": true,
  "rows": [
    {
      "id": 1,
      "source": "contact@example.com",
      "destination": "user@example.com",
      "domain_name": "example.com"
    }
  ]
}
```

---

#### `POST /mail-aliases`

Crée un alias. Le domaine de `source` est créé si besoin.

**Corps JSON**

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `source` | oui | Adresse qui reçoit le courrier (ex. `alias@example.com`) |
| `destination` | oui | Adresse cible (ex. `vraie@example.com`) |

**Exemple**

```json
{ "source": "contact@inbtp.ac.cd", "destination": "secretariat@inbtp.ac.cd" }
```

**Réponse `201`**

```json
{
  "ok": true,
  "status": "created",
  "alias": { "source": "contact@inbtp.ac.cd", "destination": "secretariat@inbtp.ac.cd" }
}
```

**Erreur** : `400` si la **source** existe déjà (doublon).

---

#### `DELETE /mail-aliases/:id`

Supprime un alias.

**Paramètre d’URL** : `id` (entier).

**Réponse `200`**

```json
{ "ok": true, "deleted": true, "id": 7 }
```

**Erreur** : `404` si `id` inconnu.

---

### Exemple cURL (production)

Remplacez le domaine, le token et la clé.

```bash
BASE="https://services.inbtp.ac.cd/mail"
JWT="<votre_jwt>"
API_KEY="<ACCOUNT_API_KEY>"

curl -sS -X GET "$BASE/mail-accounts" \
  -H "Authorization: Bearer $JWT" \
  -H "X-API-Key: $API_KEY"
```

```bash
curl -sS -X POST "$BASE/mail-accounts" \
  -H "Authorization: Bearer $JWT" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@inbtp.ac.cd","password":"secret"}'
```

---

## Développement

```bash
cd account-service
cp .env.example .env   # à créer si besoin, voir variables ci-dessus
npm install
npm run start:dev
```

---

## Docker

```bash
docker build -t inbtp/elmesacad-mail:local .
```

L’image inclut **OpenSSL** (hash SHA512-CRYPT) et un **HEALTHCHECK** sur `GET /`.

## CI / Docker Hub

Le workflow [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) pousse `inbtp/elmesacad-mail:latest`.

---

## Pile `docker-compose` (racine du monorepo)

Voir [`../docker-compose.yml`](../docker-compose.yml) : Traefik, `auth`, `titulaire`, `student`, `mail` (ce service) avec hôtes `services`, `autoconfig`, `autodiscover` pour l’`inbtp.ac.cd`).

---

## DNS (production)

Enregistrements **A** (ou **AAAA**) pointant vers le VPS :

- `services.inbtp.ac.cd`
- `autoconfig.inbtp.ac.cd`
- `autodiscover.inbtp.ac.cd`
- (et `mail.inbtp.ac.cd` pour le relais IMAP/SMTP dans les XML)
