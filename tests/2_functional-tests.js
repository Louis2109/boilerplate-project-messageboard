const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
  const board = 'copilot-board';
  const threadPassword = 'threadpass';
  const replyPassword = 'replypass';

  let threadId;
  let replyThreadId;
  let replyId;

  function request(method, path, data) {
    return new Promise((resolve, reject) => {
      let req = chai.request(server)[method](path);

      if (data) {
        req = req.send(data);
      }

      req.end(function(err, res) {
        if (err) {
          return reject(err);
        }

        return resolve(res);
      });
    });
  }

  test('Creating a new thread', async function() {
    const res = await request('post', `/api/threads/${board}`, {
      text: 'First thread',
      delete_password: threadPassword
    });

    assert.equal(res.status, 200);
    assert.property(res.body, '_id');
    assert.equal(res.body.text, 'First thread');
    assert.equal(res.body.reported, false);
    assert.isArray(res.body.replies);

    threadId = res.body._id;
  });

  test('Viewing the 10 most recent threads with only 3 replies each', async function() {
    for (let index = 1; index <= 10; index += 1) {
      const res = await request('post', `/api/threads/${board}`, {
        text: `Filler thread ${index}`,
        delete_password: `filler-${index}`
      });

      assert.equal(res.status, 200);
    }

    for (let index = 1; index <= 4; index += 1) {
      const res = await request('post', `/api/replies/${board}`, {
        thread_id: threadId,
        text: `Reply ${index}`,
        delete_password: replyPassword
      });

      assert.equal(res.status, 200);
    }

    const res = await request('get', `/api/threads/${board}`);

    assert.equal(res.status, 200);
    assert.isArray(res.body);
    assert.lengthOf(res.body, 10);

    const activeThread = res.body.find(thread => thread._id === threadId);

    assert.isObject(activeThread);
    assert.equal(activeThread.replies.length, 3);
    assert.deepEqual(
      activeThread.replies.map(reply => reply.text),
      ['Reply 2', 'Reply 3', 'Reply 4']
    );
    assert.notProperty(activeThread, 'reported');
    assert.notProperty(activeThread, 'delete_password');
  });

  test('Reporting a thread', async function() {
    const res = await request('put', `/api/threads/${board}`, {
      thread_id: threadId
    });

    assert.equal(res.status, 200);
    assert.equal(res.text, 'reported');
  });

  test('Deleting a thread with the incorrect password', async function() {
    const res = await request('delete', `/api/threads/${board}`, {
      thread_id: threadId,
      delete_password: 'wrong-password'
    });

    assert.equal(res.status, 200);
    assert.equal(res.text, 'incorrect password');
  });

  test('Deleting a thread with the correct password', async function() {
    const res = await request('delete', `/api/threads/${board}`, {
      thread_id: threadId,
      delete_password: threadPassword
    });

    assert.equal(res.status, 200);
    assert.equal(res.text, 'success');
  });

  test('Creating a new reply', async function() {
    const threadRes = await request('post', `/api/threads/${board}`, {
      text: 'Reply thread',
      delete_password: 'thread-two'
    });

    assert.equal(threadRes.status, 200);
    replyThreadId = threadRes.body._id;

    const replyRes = await request('post', `/api/replies/${board}`, {
      thread_id: replyThreadId,
      text: 'First reply',
      delete_password: replyPassword
    });

    assert.equal(replyRes.status, 200);
    assert.property(replyRes.body, 'replies');
    assert.lengthOf(replyRes.body.replies, 1);
    assert.equal(replyRes.body.replies[0].text, 'First reply');

    replyId = replyRes.body.replies[0]._id;
  });

  test('Viewing a single thread with all replies', async function() {
    const res = await request('get', `/api/replies/${board}?thread_id=${replyThreadId}`);

    assert.equal(res.status, 200);
    assert.equal(res.body._id, replyThreadId);
    assert.equal(res.body.text, 'Reply thread');
    assert.isArray(res.body.replies);
    assert.lengthOf(res.body.replies, 1);
    assert.equal(res.body.replies[0].text, 'First reply');
    assert.notProperty(res.body.replies[0], 'delete_password');
    assert.notProperty(res.body.replies[0], 'reported');
  });

  test('Reporting a reply', async function() {
    const res = await request('put', `/api/replies/${board}`, {
      thread_id: replyThreadId,
      reply_id: replyId
    });

    assert.equal(res.status, 200);
    assert.equal(res.text, 'reported');
  });

  test('Deleting a reply with the incorrect password', async function() {
    const res = await request('delete', `/api/replies/${board}`, {
      thread_id: replyThreadId,
      reply_id: replyId,
      delete_password: 'wrong-password'
    });

    assert.equal(res.status, 200);
    assert.equal(res.text, 'incorrect password');
  });

  test('Deleting a reply with the correct password', async function() {
    const res = await request('delete', `/api/replies/${board}`, {
      thread_id: replyThreadId,
      reply_id: replyId,
      delete_password: replyPassword
    });

    assert.equal(res.status, 200);
    assert.equal(res.text, 'success');

    const threadRes = await request('get', `/api/replies/${board}?thread_id=${replyThreadId}`);

    assert.equal(threadRes.body.replies[0].text, '[deleted]');
  });
});