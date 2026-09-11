# call-agent-web

Public landing for **Treena** (https://usetreena.com).

Hosted on Cloudflare Pages project `call-agent`. Source of truth is Nathan’s Astra static landing (localhost:4173 / `outputs/relay`), Relay→Treena rename applied. Do not restyle from the Pages screenshot rebuild.

Deploy:

```sh
npx wrangler pages deploy public --project-name=call-agent
```
