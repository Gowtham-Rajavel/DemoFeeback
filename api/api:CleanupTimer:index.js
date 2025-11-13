const sql = require('mssql');

module.exports = async function (context, myTimer) {
  context.log('CleanupTimer run at', new Date().toISOString());
  const connStr = process.env.SQL_CONNECTION_STRING;
  if(!connStr) {
    context.log.error('Missing SQL_CONNECTION_STRING');
    return;
  }
  try {
    await sql.connect(connStr);
    const res = await sql.query`DELETE FROM Submissions WHERE SubmissionDate < DATEADD(day, -90, SYSUTCDATETIME()); SELECT @@ROWCOUNT AS deleted;`;
    context.log(`Deleted rows: ${res.recordset[0].deleted}`);
  } catch (err) {
    context.log.error('Cleanup error', err);
  } finally {
    try { await sql.close(); } catch(e){}
  }
};
