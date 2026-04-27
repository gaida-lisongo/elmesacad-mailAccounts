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

## API sécurisée (CRUD)

Toutes les routes ci-dessous exigent l’en-tête :

`X-API-Key: <ACCOUNT_API_KEY>`

Sous le préfixe applicatif `/mail-accounts` (en direct sur le conteneur) — derrière Traefik : `/mail/mail-accounts/...` selon le strip du préfixe.

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/mail-accounts` | Liste des utilisateurs (id, email, domaine) — pas de mot de passe |
| `GET` | `/mail-accounts/:id` | Détail |
| `GET` | `/mail-accounts/exists?email=` | Vérifie l’existence d’un email |
| `POST` | `/mail-accounts` | Corps : `{ "email", "password" }` — crée l’entrée (domaine auto-créé si besoin) |
| `PUT` | `/mail-accounts/:id` | Corps : `{ "email"?, "password"? }` — met à jour |
| `DELETE` | `/mail-accounts/:id` | Suppression |

**Aliases** (même clé `X-API-Key`) — préfixe `/mail-aliases` :

| Méthode | Chemin | Corps / note |
|---------|--------|----------------|
| `GET` | `/mail-aliases` | Liste |
| `POST` | `/mail-aliases` | `{ "source", "destination" }` (emails complets) |
| `DELETE` | `/mail-aliases/:id` | Suppression |

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
