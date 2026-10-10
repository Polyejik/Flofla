# FLOFLA — secure checkout API (draft, not deployed)

Architecture: GitHub Pages frontend → Cloudflare Worker → YooKassa API; Cloudflare D1 stores orders. No credentials in GitHub.

## Deployment checklist
1. Register Cloudflare account; create Worker and D1 database in an EU/RU-compatible setup **only after legal assessment of Russian personal-data localization**. For Russian customers, primary collection/recording/storage in a Russian database may be mandatory; **do not deploy D1 for real Russian buyer personal data without compliance review**. For production, replace D1 with a Russian-hosted DB/API if required.
2. Add the database binding `DB` in wrangler.toml; apply schema.sql.
3. Set secrets `YK_SHOP_ID`, `YK_SECRET_KEY`; set `SITE_ORIGIN`, `RETURN_URL`, `YK_VAT_CODE` after verifying actual VAT status.
4. Set verified products, prices, and active availability in catalog.json; currently empty deliberately.
5. Confirm fiscalization service can issue correct advance, transfer, and refund receipts for IP USN income; sample receipt only creates advance receipt. Do not take real payments until the transfer receipt is implemented/tested.
6. Add stock reservations, delivery quote and carrier integration, anti-bot/rate limiting, operational notifications and refund workflow before production.
7. Configure YooKassa HTTP webhook to /webhooks/yookassa, test duplicate/out-of-order notifications and verify status against API.
8. Add checkout UI only after above, and publish legal documents with verified seller details.

## API
GET /health; GET /catalog; POST /checkout {sku,quantity,email,name,phone,deliveryAddress}; POST /webhooks/yookassa.
This is an engineering foundation, not a live payment service. Never publish real API credentials in repository.
