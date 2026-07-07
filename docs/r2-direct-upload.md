# Direct R2 Uploads

Admin image uploads use a server-owned manifest, then upload file bytes directly from the browser to Cloudflare R2 with a presigned R2 S3-compatible `PUT` URL. The Worker signs URLs and finalizes the manifest; it no longer receives the image body on the main upload path.

Required deployment env/secrets:

```env
NUXT_R2_ACCOUNT_ID=
NUXT_R2_BUCKET_NAME=cuphotoclub-blob
NUXT_R2_ACCESS_KEY_ID=
NUXT_R2_SECRET_ACCESS_KEY=
```

The R2 bucket also needs CORS for browser `PUT` requests:

```powershell
npx wrangler r2 bucket cors set cuphotoclub-blob --file config/r2-cors.json
```

Use an R2 API token scoped to object read/write for the target bucket.
