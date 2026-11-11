# Deploying InvoiceFlow to AWS

## Architecture

```
                         ┌──────────────── CloudFront (HTTPS, dXXXX.cloudfront.net) ───────────────┐
 Browser ──HTTPS──▶      │  default (*)        → S3 bucket (React build)  + SPA rewrite function   │
                         │  /api/*, /sanctum/* → EC2 :8080, adds X-Origin-Verify header, no cache  │
                         └──────────────────────────────────────┬────────────────────────────────────┘
                                                                │ only CloudFront IP ranges (security group)
   EC2 t3.micro, Mumbai (ap-south-1)                            ▼
   ├─ host nginx :80  → car-listing-api (untouched)   ┌──────────────────────────────┐
   └─ Docker          → invoiceflow-api :8080 ────────│ RDS MySQL 8.4 (shared)       │
        (php-fpm + nginx, image from ghcr.io)         │  └─ database "invoiceflow"   │
                                                      └──────────────────────────────┘
 GitHub Actions: CI ✓ → build image → ghcr.io → SSM runs update.sh on EC2 → build React → S3 → invalidate CloudFront
```

Why it's built this way:
- **One HTTPS origin for the browser.** CloudFront serves the SPA and forwards `/api/*` and `/sanctum/*` to Laravel, so Sanctum's cookies are first-party, exactly as in local development behind the Vite proxy. No CORS, no third-party cookie problems.
- **Small server, no builds on it.** Images are built in GitHub Actions and pulled from GitHub's container registry.
- **Shared RDS, separate database.** InvoiceFlow has its own database and a user that can only access it. No second MySQL server on a 1 GB machine, and RDS takes the backups.
- **No long-lived secrets in CI.** GitHub gets temporary AWS credentials through OIDC, and deploys run through AWS Systems Manager, so there are no access keys, no SSH key and no open SSH port for CI.
- **The origin can't be bypassed.** Port 8080 only accepts CloudFront's IP ranges, and Laravel rejects any request without the secret `X-Origin-Verify` header that only our distribution adds.

---

## Setup (once)

Values you'll collect along the way. Keep them in a note:

| Name | Example |
|---|---|
| `ACCOUNT_ID` | `123456789012` (top-right menu in the AWS console) |
| `INSTANCE_ID` | `i-0abc…` (EC2 → Instances) |
| `BUCKET_NAME` | `invoiceflow-web-123456789012` |
| `DISTRIBUTION_ID` / `CLOUDFRONT_DOMAIN` | `E2ABC…` / `d1234abcd.cloudfront.net` |
| `ORIGIN_SECRET` | output of `openssl rand -hex 32` |

Work in the **Mumbai (ap-south-1)** region throughout (CloudFront and IAM are global).

### 1. Two code changes, then merge

**a) Faker is needed in production for the demo seeder.** The production image installs without dev packages, and the seeder and factories use Faker. Move it to the main dependencies:

```bash
docker compose exec api composer require fakerphp/faker
```

If Composer asks whether to move it from `require-dev` to `require`, answer **yes**. Commit `composer.json` and `composer.lock`.

**b) Trust CloudFront as a proxy.** In `api/bootstrap/app.php`, add one line next to `statefulApi()`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->statefulApi();
    $middleware->trustProxies(at: '*'); // behind CloudFront: real client IPs from X-Forwarded-For
})
```

Trusting every proxy is safe here only because the server is unreachable except through CloudFront (step 4). Without it, every request looks like it comes from a CloudFront edge server, so the per-IP login rate limit would lump all users together.

Run `make test-all`, then merge to `main`. CI runs, then the **Deploy** workflow builds the API image and pushes it to `ghcr.io/sajadk/invoiceflow-api`. Its AWS jobs are skipped until step 7.

Then make the image public, so the server can pull it without credentials: GitHub → your profile → **Packages** → `invoiceflow-api` → **Package settings** → *Change visibility* → **Public**.

### 2. Let the instance use Systems Manager

1. IAM → **Roles** → *Create role* → trusted entity **AWS service → EC2** → attach **`AmazonSSMManagedInstanceCore`** → name it `invoiceflow-ec2-ssm`.
2. EC2 → your instance → *Actions* → *Security* → **Modify IAM role** → choose `invoiceflow-ec2-ssm`.
   (If the instance already has a role, attach the policy to that role instead.)
3. After a few minutes it appears under **Systems Manager → Fleet Manager** as *Online*. The SSM agent is already installed on Ubuntu AMIs.

### 3. Prepare the server

SSH in as usual, then:

```bash
curl -fsSL https://raw.githubusercontent.com/sajadk/invoiceflow/main/deploy/setup-server.sh | sudo bash
```

This adds 1 GB of swap, installs Docker, and creates `/opt/invoiceflow` with the compose file, scripts and an `.env` template. It doesn't touch nginx or `car-listing-api`.

Generate the app key:

```bash
sudo docker run --rm ghcr.io/sajadk/invoiceflow-api php artisan key:generate --show
```

Edit `/opt/invoiceflow/.env` (`sudo nano /opt/invoiceflow/.env`) and fill in `APP_KEY`, `DB_PASSWORD` (the `invoiceflow` user's password) and `ORIGIN_SECRET`. Leave the `dXXXX.cloudfront.net` placeholders until step 6.

Start it and load the demo data:

```bash
cd /opt/invoiceflow
sudo ./update.sh                                            # pulls, migrates, waits until healthy
sudo docker compose exec api php artisan db:seed --force    # demo@invoiceflow.test / password
free -m                                                     # check memory with both apps running
```

Optional: reset the demo data every night, so visitors always find it tidy:

```bash
echo '0 23 * * * root /opt/invoiceflow/reset-demo.sh >> /var/log/invoiceflow-reset.log 2>&1' | sudo tee /etc/cron.d/invoiceflow-reset
```

### 4. Open port 8080 to CloudFront only

1. VPC → **Managed prefix lists** → find `com.amazonaws.global.cloudfront.origin-facing` and copy its ID (`pl-…`).
2. EC2 → **Security Groups** → *Create security group* `invoiceflow-cloudfront`, in the instance's VPC, with one inbound rule: **Custom TCP 8080**, source = that prefix list. Use a new group: the CloudFront list counts as dozens of rules and may not fit in an existing group.
3. EC2 → instance → *Actions* → *Security* → **Change security groups** → **add** `invoiceflow-cloudfront` (keep the existing group).

The instance's **Public IPv4 DNS** (`ec2-…ap-south-1.compute.amazonaws.com`) becomes CloudFront's origin. It changes if the instance is stopped and started. If you do that, update the origin in step 6, or attach an Elastic IP so it never changes.

### 5. S3 bucket for the React app

S3 → *Create bucket* `invoiceflow-web-<ACCOUNT_ID>` in ap-south-1. Keep **Block all public access** on: only CloudFront will read it.

### 6. CloudFront distribution

1. **CloudFront → Functions** → *Create function* `invoiceflow-spa-rewrite` (runtime **cloudfront-js-2.0**), paste [`deploy/aws/spa-rewrite.js`](../deploy/aws/spa-rewrite.js), *Save* → *Publish*.
2. **Create distribution:**
   - Origin: the S3 bucket → *Origin access*: **Origin access control settings** → create a new OAC.
   - Viewer protocol policy: **Redirect HTTP to HTTPS**. Cache policy: **CachingOptimized**.
   - Function associations → *Viewer request* → CloudFront Function `invoiceflow-spa-rewrite`.
   - Default root object: `index.html`. Web Application Firewall: **do not enable** (it costs extra).
   - Create, then use the banner's **Copy policy** button and paste it into the bucket's *Permissions → Bucket policy*.
3. **Origins → Create origin** (the API):
   - Domain: the EC2 public IPv4 DNS. Protocol: **HTTP only**, HTTP port **8080**.
   - *Add custom header*: `X-Origin-Verify` = your `ORIGIN_SECRET`.
4. **Behaviors → Create behavior**, twice: path `/api/*`, then `/sanctum/*`:
   - Origin: the EC2 origin. Viewer protocol: **Redirect HTTP to HTTPS**.
   - Allowed methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**.
   - Cache policy: **CachingDisabled**. Origin request policy: **AllViewerExceptHostHeader** (forwards cookies, query strings and the `Origin`/`Referer` headers Sanctum checks).
   - No function association on these behaviours.
5. Note the distribution's **ID** and **domain name**, then put the domain into the server's `.env` (`APP_URL`, `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS`) and restart:

```bash
cd /opt/invoiceflow && sudo ./update.sh
```

### 7. Let GitHub Actions deploy (OIDC)

1. IAM → **Identity providers** → *Add provider* → **OpenID Connect**: URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
2. IAM → **Roles** → *Create role* → **Custom trust policy** → paste [`deploy/aws/github-deploy-trust-policy.json`](../deploy/aws/github-deploy-trust-policy.json) with your `ACCOUNT_ID`. Only workflows on `main` of `sajadk/invoiceflow` can assume it.
3. Skip the managed policies, name the role `invoiceflow-github-deploy`, create it, then *Add permissions → Create inline policy → JSON* → paste [`deploy/aws/github-deploy-permissions.json`](../deploy/aws/github-deploy-permissions.json) with your values filled in.
4. GitHub → repo **Settings → Secrets and variables → Actions → Variables** → add:

| Variable | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/invoiceflow-github-deploy` |
| `EC2_INSTANCE_ID` | `i-…` |
| `WEB_BUCKET` | the bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E…` |
| `CLOUDFRONT_DOMAIN` | `d….cloudfront.net` |

These are identifiers, not secrets, so they're *variables*. The only secret (the origin header) lives in CloudFront and the server's `.env`.

5. **Actions → Deploy → Run workflow**. All three jobs should go green, ending with the smoke test hitting `https://<domain>/api/health` through CloudFront.

### 8. Guardrails

- **Billing → Budgets** → *Create budget* → *Monthly cost budget*, e.g. $5, email alert at 80%.
- **Billing → Credits** shows your remaining credit and the Free plan end date. Before it ends, either upgrade to the Paid plan to keep the demo up, or tear it down (below).

---

## Day to day

- **Deploy:** merge to `main`. CI → Deploy happens automatically.
- **Logs:** `cd /opt/invoiceflow && sudo docker compose logs -f api`
- **Shell / tinker:** `sudo docker compose exec api php artisan tinker`
- **Roll back the API:** in `docker-compose.yml`, temporarily replace `:latest` with a previous commit's tag (each image is also tagged with its short SHA), then `sudo docker compose up -d`.

## Teardown

1. Server: `cd /opt/invoiceflow && sudo docker compose down && sudo rm -rf /opt/invoiceflow /etc/cron.d/invoiceflow-reset`
2. RDS (as `admin`): `DROP DATABASE invoiceflow; DROP USER 'invoiceflow'@'172.31.%';`
3. CloudFront: *Disable* the distribution, wait, then *Delete*. Delete the function and the OAC.
4. S3: empty and delete the bucket.
5. EC2: remove the `invoiceflow-cloudfront` security group from the instance, then delete it.
6. IAM: delete the `invoiceflow-github-deploy` role (and the OIDC provider if nothing else uses it).
7. GitHub: delete the repo variables and the `invoiceflow-api` package.
