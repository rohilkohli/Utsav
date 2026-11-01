# Deploy Utsav

Utsav builds a React client and an Express server into `dist/`. The server serves both from one origin. Use Node 24 in production; the Docker image already does.

## Production requirements

- A Google Cloud/Firebase project with Firestore and Google sign-in configured.
- A dedicated runtime service account with `roles/datastore.user`.
- A Gemini key stored in Secret Manager; grant the runtime account access to that specific secret.
- Runtime Firebase web configuration from `env.example.yaml`.
- Optional: a server-side Places API (New) key for vendor discovery.

Production requires Firestore. Do not enable `USE_IN_MEMORY_STORE=true` in production. On Cloud Run, use the attached service account's Application Default Credentials rather than shipping a service-account JSON key.

## Build the image

```bash
docker build -t utsav .
```

The multi-stage Dockerfile installs locked dependencies, copies client/server source and public assets, builds the app, and runs the server as a non-root user on port 8080.

## Configure Cloud Run

Install and authenticate the Google Cloud CLI for your project. Enable the required services:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

Create a dedicated account, grant Firestore access, and grant access to the Gemini secret. Replace `YOUR_PROJECT_ID` with your project ID:

```bash
gcloud iam service-accounts create utsav-run \
  --display-name="Utsav runtime"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:utsav-run@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:utsav-run@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Create `GEMINI_API_KEY` and its value in Secret Manager before granting access. Keep secret values out of Git, commands saved in shell history, and public documentation.

Copy the public runtime template to the ignored `env.yaml` and fill in your Firebase web configuration:

```bash
cp env.example.yaml env.yaml
```

Deploy using the source-based Cloud Run workflow:

```bash
gcloud run deploy utsav \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --max-instances 3 \
  --service-account="utsav-run@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --env-vars-file env.yaml
```

Use the region appropriate to your users and project. The example region is Mumbai; network latency depends on the deployment and user's connection.

## Firebase and shared snapshots

1. Add the deployed HTTPS domain under Firebase Authentication → Settings → Authorized domains.
2. With the Firebase CLI installed and authorized, deploy the checked-in client-deny Firestore rules using an explicit project:

   ```bash
   firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

   `firebase.json` points to `firestore.rules`. A checked-in default project alias is unnecessary.

3. Enable Firestore TTL for the `shares` collection group's `expiresAt` timestamp:

   ```bash
   gcloud firestore fields ttls update expiresAt \
     --collection-group=shares \
     --enable-ttl \
     --project=YOUR_PROJECT_ID
   ```

The application rejects expired snapshots even while asynchronous TTL deletion is pending.

## Verify a deployment

- Request `/api/health` and confirm `status: "ok"`.
- Load the app and check public runtime Firebase configuration at `/api/config`.
- Create a plan, sign in, edit and refresh it, then open a read-only shared snapshot in a fresh browser.
- Test the `/api/voice/ws` relay with microphone permission over HTTPS when Gemini Live is configured.
- Check logs and browser console for authentication, CSP, model-availability, or permission errors.

The repository's fallback tests do not establish that a particular live Google project has the required APIs, permissions, quota, or model availability.
