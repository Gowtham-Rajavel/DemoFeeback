const sql = require('mssql');

/**
 * CleanupTimer Azure Function
 * - Runs daily (cron schedule in function.json) and deletes rows older than 90 days
 * - Uses env var: SQL_CONNECTION_STRING
 */
module.exports = async function (context, myTimer) {
  context.log.info('CleanupTimer invoked at', new Date().toISOString());

  const connStr = process.env.SQL_CONNECTION_STRING;
  if (!connStr) {
    context.log.error('Missing SQL_CONNECTION_STRING');
    return;
  }

  try {
    const pool = await sql.connect(connStr);
    try {
      // Delete older than 90 days (UTC)
      const deleteQuery = `
        DELETE FROM Submissions
        WHERE SubmissionDate < DATEADD(day, -90, SYSUTCDATETIME());
        SELECT @@ROWCOUNT AS deleted;
      `;

      const result = await pool.request().query(deleteQuery);
      const deleted = (result && result.recordset && result.recordset[0] && result.recordset[0].deleted) || 0;
      context.log.info(`Cleanup complete. Rows deleted: ${deleted}`);
    } finally {
      try { await pool.close(); } catch(e) { context.log.warn('Error closing pool', e && e.message); }
    }
  } catch (err) {
    context.log.error('CleanupTimer error', err && (err.stack || err.message));
  }
};
