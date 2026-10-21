/* Remove abandoned payment attempts from a local/demo database.
 * Paid and failed payment history is deliberately retained.
 */
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'beautycare',
    charset: 'utf8mb4'
  });

  try {
    await connection.beginTransaction();
    const [pendingPayments] = await connection.query(
      "SELECT id FROM payments WHERE LOWER(status) IN ('created','pending')"
    );
    const paymentIds = pendingPayments.map((row) => Number(row.id));

    let deletedEvents = 0;
    let deletedPayments = 0;
    if (paymentIds.length > 0) {
      const placeholders = paymentIds.map(() => '?').join(',');
      const [events] = await connection.query(
        `DELETE FROM payment_events WHERE payment_id IN (${placeholders})`,
        paymentIds
      );
      deletedEvents = Number(events.affectedRows || 0);

      const [payments] = await connection.query(
        `DELETE FROM payments WHERE id IN (${placeholders})`,
        paymentIds
      );
      deletedPayments = Number(payments.affectedRows || 0);
    }

    const [orders] = await connection.query(
      "DELETE FROM orders WHERE LOWER(status) IN ('created','pending') AND NOT EXISTS (SELECT 1 FROM payments WHERE payments.order_id = orders.id)"
    );
    const [subscriptions] = await connection.query(
      "DELETE FROM subscriptions WHERE LOWER(status) IN ('created','pending') AND NOT EXISTS (SELECT 1 FROM payments WHERE payments.subscription_id = subscriptions.id)"
    );

    await connection.commit();
    console.log(
      JSON.stringify({
        deletedPaymentEvents: deletedEvents,
        deletedPayments,
        deletedPendingOrders: Number(orders.affectedRows || 0),
        deletedPendingSubscriptions: Number(subscriptions.affectedRows || 0)
      })
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`[payments:cleanup-pending] ${error.message}`);
  process.exitCode = 1;
});
