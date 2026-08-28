# chisl contact-form backend

A single Lambda function. The static site POSTs the contact form as JSON, the
function verifies the reCAPTCHA token and publishes the submission to an SNS
topic, and SNS emails it to you. No database, no API Gateway, no server.

Cost at low volume is effectively zero: Lambda's free tier covers a million
requests a month, and SNS email notifications are free for the first thousand.

```
browser ──POST──▶ Lambda Function URL ──▶ SNS topic ──▶ your inbox
                        │
                        └──▶ Google reCAPTCHA (verify, server-side)
```

## What you need before starting

- An AWS account with permission to create SNS topics, IAM roles, and Lambda functions.
- The [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`).
- A Google account, for the reCAPTCHA keys.

Everything below uses `eu-west-2`. Swap in another region if you prefer — just
keep it consistent, and remember the Function URL will carry that region.

## 1. Create the SNS topic and subscribe to it

```bash
aws sns create-topic --name chisl-contact --region eu-west-2
```

Note the `TopicArn` it prints — you'll need it twice below. Then subscribe your
email address:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-2:YOUR-ACCOUNT-ID:chisl-contact \
  --protocol email \
  --notification-endpoint hello@chisl.io \
  --region eu-west-2
```

AWS sends a confirmation email. **Click the confirm link** — until you do, the
subscription stays pending and messages go nowhere.

## 2. Get reCAPTCHA v3 keys

Go to <https://www.google.com/recaptcha/admin/create>:

- **Label:** chisl
- **Type:** reCAPTCHA v3
- **Domains:** `chisl.io` — add `localhost` too if you want to test locally

You get two keys. The **site key** is public and goes in the site's HTML/JS; the
**secret key** stays server-side and goes in the Lambda's environment.

## 3. Create the execution role

The function needs permission to write logs and publish to the one topic.

```bash
aws iam create-role \
  --role-name chisl-contact-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name chisl-contact-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy \
  --role-name chisl-contact-role \
  --policy-name publish-to-contact-topic \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:eu-west-2:YOUR-ACCOUNT-ID:chisl-contact"
    }]
  }'
```

Scoping `Resource` to the single topic ARN — rather than `"*"` — means a bug or
a compromised function can't publish anywhere else in your account.

## 4. Deploy the function

`index.mjs` imports `@aws-sdk/client-sns`, which the Node 18+ Lambda runtime
already bundles — so the deployment package is just the source file, and there
is no `npm install` step for deployment. (The dev dependency in `package.json`
exists only so editors and linters can resolve the import locally.)

```bash
npm run package   # produces function.zip

aws lambda create-function \
  --function-name chisl-contact \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR-ACCOUNT-ID:role/chisl-contact-role \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --region eu-west-2
```

Then set the environment variables:

```bash
aws lambda update-function-configuration \
  --function-name chisl-contact \
  --region eu-west-2 \
  --environment "Variables={
    TOPIC_ARN=arn:aws:sns:eu-west-2:YOUR-ACCOUNT-ID:chisl-contact,
    RECAPTCHA_SECRET=your-recaptcha-secret-key,
    RECAPTCHA_MIN_SCORE=0.5,
    ALLOWED_ORIGIN=https://chisl.io
  }"
```

| Variable | Required | Notes |
| --- | --- | --- |
| `TOPIC_ARN` | yes | Without it the function returns 500. |
| `RECAPTCHA_SECRET` | no, but strongly recommended | If unset, the spam check is skipped entirely and every submission publishes. |
| `RECAPTCHA_MIN_SCORE` | no | Defaults to `0.5`. Lower catches fewer bots; higher rejects more real people. |
| `ALLOWED_ORIGIN` | no | Comma-separated allowlist. Defaults to `*` (any site). Currently `https://chisl.io,https://styxofdynamite.github.io`. |
| `SMS_MAX_CHARS` | no | Defaults to `300` — two billable SMS segments. The SMS carries email, phone, and a truncated message body; the full text goes to email subscribers. |

## 5. Put an HTTP API in front of it

> **Why not a Lambda Function URL?** The obvious route is a Function URL with
> `--auth-type NONE`. On this AWS account that does not work: the URL returns
> `403 AccessDeniedException` to anonymous callers even with a textbook
> `Principal: "*"` resource policy attached. The same URL switched to
> `AWS_IAM` and called with SigV4 returns `200` — so the function is fine and
> something at the account level is refusing to honour public invocation.
> API Gateway sidesteps it: it invokes Lambda under its own service
> principal, so no public grant on the function is needed.

```bash
LAMBDA_ARN=arn:aws:lambda:eu-west-2:YOUR-ACCOUNT-ID:function:chisl-contact

API_ID=$(aws apigatewayv2 create-api \
  --name chisl-contact-api \
  --protocol-type HTTP \
  --target "$LAMBDA_ARN" \
  --region eu-west-2 \
  --output text --query ApiId)

aws lambda add-permission \
  --function-name chisl-contact \
  --statement-id apigw-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:eu-west-2:YOUR-ACCOUNT-ID:${API_ID}/*/*" \
  --region eu-west-2

aws apigatewayv2 get-api --api-id "$API_ID" --region eu-west-2 \
  --output text --query ApiEndpoint
```

`create-api --target` quick-creates an `ANY /` route wired to the function on
payload format 2.0, auto-deployed to the `$default` stage — so the endpoint
needs no stage path. The `--source-arn` on the permission scopes invocation to
this one API rather than any API in the account.

CORS is handled in `index.mjs`, not on the API, so preflight passes straight
through to the function and the `ALLOWED_ORIGIN` allowlist is the single place
origins are controlled.

**Current deployed endpoint:** `https://dngcc8ftia.execute-api.eu-west-2.amazonaws.com/`

## 6. Wire the site to it

| File | Value | Status |
| --- | --- | --- |
| `site/js/contact.js` | `ENDPOINT` | ✅ set to the API endpoint above |
| `site/js/contact.js` | `RECAPTCHA_SITE_KEY` | ❌ still the placeholder |
| `site/index.html` | the `recaptcha/api.js` script tag | ❌ still the placeholder |

Commit and push — the Pages workflow redeploys the site automatically.

## 7. Test it

Straight at the API, bypassing the browser:

```bash
curl -i -X POST https://dngcc8ftia.execute-api.eu-west-2.amazonaws.com/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","phone":"+447700900123","projectType":"New website","message":"Testing the pipe."}'
```

With `RECAPTCHA_SECRET` set you should get `400 {"error":"Missing spam-check
token"}` — that's the spam check doing its job, and it confirms the function is
live. Unset the secret temporarily (or submit through the real form) to get a
`200 {"ok":true}` and an email.

If nothing arrives on a 200, the SNS subscription is almost certainly still
unconfirmed — check for the AWS confirmation email from step 1.

## Updating the function later

```bash
npm run package
aws lambda update-function-code \
  --function-name chisl-contact \
  --zip-file fileb://function.zip \
  --region eu-west-2
```

## Troubleshooting

- **CORS error in the browser console** — `ALLOWED_ORIGIN` doesn't match the
  site's origin exactly. It's scheme + host, no trailing slash: `https://chisl.io`.
- **403 "Spam check failed"** — the score fell below `RECAPTCHA_MIN_SCORE`, or
  the site key and secret key are from different reCAPTCHA registrations.
- **502 "Could not send notification"** — the role can't publish. Check the
  topic ARN in the inline policy matches `TOPIC_ARN`.
- **Anything else** — `aws logs tail /aws/lambda/chisl-contact --follow --region eu-west-2`.
