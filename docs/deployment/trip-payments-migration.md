# Trip payments migration rollout

## Before deployment

1. Take a database backup and verify that it can be restored in a disposable environment.
2. Review the additive migration `20261013130000_create_trip_payments` and validate the generated Prisma schema.
3. Deploy the migration before deploying API code that reads or writes `trip_payments`:

   ```sh
   npx prisma migrate deploy --schema libs/database/prisma/schema.prisma
   ```

4. Start the client, driver and admin APIs after the migration succeeds. The API records cash only; digital providers are not configured by this change.

## Verify

- Confirm the `trip_payments` table, unique trip constraint, foreign keys and checks exist.
- Complete a controlled test trip and verify it creates one invoice and one `pending` cash payment with the persisted trip fare.
- Confirm collection as the assigned driver and verify the payment becomes `confirmed` with `confirmed_by`, `confirmed_at` and one `cash_payment_confirmed` audit record.
- Retry the same confirmation and verify it returns the existing record without a second audit record.
- Reconcile older completed trips manually. Do not infer that an existing invoice means cash was collected or backfill those trips as paid.

## Rollback

The migration is additive. If the new APIs must be rolled back, redeploy the previous API versions and leave the new table and data intact. Do not drop the table or remove payment records as part of application rollback. Resolve any collected cash records through the normal reconciliation process.

No database migration or production rollout was performed while preparing this change.
