const sql = require('mssql');

module.exports = async function (context, req) {
  context.log('SubmitFeedback invoked');

  const body = req.body || {};
  const facultyId = (body.facultyId || '').slice(0,100).trim();
  const rating = parseInt(body.rating);
  const category = (body.category || '').slice(0,100).trim();
  const comments = (body.comments || '').slice(0,2000).trim();

  if(!facultyId || isNaN(rating) || rating < 1 || rating > 5) {
    context.res = { status: 400, body: { error: 'Invalid input' } };
    return;
  }

  const connStr = process.env.SQL_CONNECTION_STRING;
  if(!connStr) {
    context.log.error('Missing SQL_CONNECTION_STRING');
    context.res = { status: 500, body: { error: 'Server not configured' } };
    return;
  }

  try {
    await sql.connect(connStr);
    const result = await sql.query`INSERT INTO Submissions (FacultyID, Rating, Category, Comments) 
                                   VALUES (${facultyId}, ${rating}, ${category}, ${comments}); SELECT SCOPE_IDENTITY() AS id;`;
    context.res = { status: 200, body: { ok: true, id: result.recordset[0].id } };
  } catch (err) {
    context.log.error('SQL error', err);
    context.res = { status: 500, body: { error: 'DB error' } };
  } finally {
    try { await sql.close(); } catch(e){}
  }
};
