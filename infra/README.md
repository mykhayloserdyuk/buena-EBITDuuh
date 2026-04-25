# Google Cloud Infra

This Terraform project creates one private Google Cloud Storage bucket for the repository's `raw-data/` files:

- Project: `bigberlin-hack26ber-3239`
- Bucket: `buena-ebitduuh-raw-data`
- Raw data path: `gs://buena-ebitduuh-raw-data/raw-data`
- Sync service account: `github-raw-data-sync@bigberlin-hack26ber-3239.iam.gserviceaccount.com`

Raw files are uploaded with `gcloud storage rsync`; they are not managed as Terraform objects, because storing every PDF, email, CSV, and XML object in Terraform state would make the state noisy and fragile.

## Terraform

```sh
cd infra
terraform init
terraform plan
terraform apply
```

## Raw-data sync

```sh
gcloud storage rsync ../raw-data gs://buena-ebitduuh-raw-data/raw-data --recursive
```

The GitHub Action does the same sync manually from the Actions tab. It expects one repository secret named `GCP_SA_KEY`, containing a JSON key for `github-raw-data-sync@bigberlin-hack26ber-3239.iam.gserviceaccount.com`.
