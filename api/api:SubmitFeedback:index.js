const sql = require('mssql');

/**
 * SubmitFeedback Azure Function
 * - Expects JSON body: { facultyId, rating, category?, comments? }
 * - Uses environment var: SQL_CONNECTION_STRING
 * - Optional env var: DEBUG=true  (when set, error responses include brief messages)
 */
module.exports = async function (context, req) {
  context.log.info('SubmitFeedback invoked');

  const DEBUG = (process.env.DEBUG === 'true');

  try {
    const body = req.body || {};
    const facultyId = (body.facultyId || '').toString().slice(0,100).trim();
    const rating = Number.parseInt(body.rating, 10);
    const category = (body.category || '').toString().slice(0,100).trim() || null;
    const comments = (body.comments || '').toString().slice(0,2000).trim() || null;

    // Basic validation
    if (!facultyId || Number.isNaN(rating) || rating < 1 || rating > 5) {
      context.log.warn('Validation failed', { facultyId, rating });
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Invalid input. Ensure facultyId and rating (1-5) are provided.' }
      };
      return;
    }

    const connStr = process.env.SQL_CONNECTION_STRING;
    if (!connStr) {
      context.log.error('Missing SQL_CONNECTION_STRING');
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Server not configured (missing DB connection).' }
      };
      return;
    }

    // Connect using ConnectionPool and parameterized query
    const pool = await sql.connect(connStr);

    try {
      const insertQuery = `
        INSERT INTO Submissions (FacultyID, Rating, Category, Comments)
        VALUES (@facultyId, @rating, @category, @comments);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
      `;

      const request = pool.request()
        .input('facultyId', sql.NVarChar(100), facultyId)
        .input('rating', sql.Int, rating)
        .input('category', sql.NVarChar(100), category)
        .input('comments', sql.NVarChar(sql.MAX), comments);

      const result = await request.query(insertQuery);

      const insertedId = (result && result.recordset && result.recordset[0] && result.recordset[0].id) || null;

      context.log.info('Insert successful', { insertedId });

      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { ok: true, id: insertedId, message: 'Feedback submitted' }
      };
    } finally {
      // ensure the pool is closed/released
      try {
        await pool.close();
      } catch (closeErr) {
        context.log.warn('Error closing DB pool', closeErr && closeErr.message);
      }
    }
  } catch (err) {
    // Unexpected error
    context.log.error('Unhandled error in SubmitFeedback', err && (err.stack || err.message || err));

    const respBody = { error: 'Server error' };
    if (process.env.DEBUG === 'true') {
      // Include limited error info only when DEBUG true (do NOT enable in production)
      respBody.detail = (err && err.message) ? err.message : 'unknown error';
    }

    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: respBody
    };
  }
};
