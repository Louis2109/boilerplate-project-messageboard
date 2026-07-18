'use strict';

module.exports = function (app) {
  const boards = Object.create(null);
  let nextId = 1;

  function createId() {
    return String(nextId++);
  }

  function createDate() {
    return new Date().toISOString();
  }

  function getBoard(boardName) {
    if (!boards[boardName]) {
      boards[boardName] = [];
    }

    return boards[boardName];
  }

  function findThread(boardName, threadId) {
    return getBoard(boardName).find(thread => thread._id === threadId) || null;
  }

  function findReply(thread, replyId) {
    return thread.replies.find(reply => reply._id === replyId) || null;
  }

  function sanitizeReply(reply) {
    return {
      _id: reply._id,
      text: reply.text,
      created_on: reply.created_on
    };
  }

  function sanitizeThread(thread, replyLimit) {
    const replies = thread.replies
      .slice()
      .sort((left, right) => new Date(left.created_on) - new Date(right.created_on));

    const visibleReplies = typeof replyLimit === 'number' ? replies.slice(-replyLimit) : replies;

    return {
      _id: thread._id,
      text: thread.text,
      created_on: thread.created_on,
      bumped_on: thread.bumped_on,
      replies: visibleReplies.map(sanitizeReply)
    };
  }

  function sanitizeThreadWithReplies(thread) {
    return {
      _id: thread._id,
      text: thread.text,
      created_on: thread.created_on,
      bumped_on: thread.bumped_on,
      replies: thread.replies
        .slice()
        .sort((left, right) => new Date(left.created_on) - new Date(right.created_on))
        .map(sanitizeReply)
    };
  }

  app.route('/api/threads/:board')
    .post(function (req, res) {
      const boardName = req.params.board;
      const text = String(req.body.text || '').trim();
      const deletePassword = String(req.body.delete_password || '').trim();

      if (!text || !deletePassword) {
        return res.status(400).send('missing required fields');
      }

      const now = createDate();
      const thread = {
        _id: createId(),
        text,
        created_on: now,
        bumped_on: now,
        reported: false,
        delete_password: deletePassword,
        replies: []
      };

      getBoard(boardName).push(thread);

      return res.json(thread);
    })
    .get(function (req, res) {
      const boardName = req.params.board;

      const threads = getBoard(boardName)
        .slice()
        .sort((left, right) => new Date(right.bumped_on) - new Date(left.bumped_on))
        .slice(0, 10)
        .map(thread => sanitizeThread(thread, 3));

      return res.json(threads);
    })
    .delete(function (req, res) {
      const boardName = req.params.board;
      const threadId = String(req.body.thread_id || '').trim();
      const deletePassword = String(req.body.delete_password || '').trim();
      const thread = findThread(boardName, threadId);

      if (!thread || thread.delete_password !== deletePassword) {
        return res.send('incorrect password');
      }

      boards[boardName] = getBoard(boardName).filter(currentThread => currentThread._id !== threadId);

      return res.send('success');
    })
    .put(function (req, res) {
      const boardName = req.params.board;
      const threadId = String(req.body.thread_id || '').trim();
      const thread = findThread(boardName, threadId);

      if (!thread) {
        return res.send('reported');
      }

      thread.reported = true;
      return res.send('reported');
    });
    
  app.route('/api/replies/:board')
    .post(function (req, res) {
      const boardName = req.params.board;
      const threadId = String(req.body.thread_id || '').trim();
      const text = String(req.body.text || '').trim();
      const deletePassword = String(req.body.delete_password || '').trim();
      const thread = findThread(boardName, threadId);

      if (!thread || !text || !deletePassword) {
        return res.status(400).send('missing required fields');
      }

      const now = createDate();
      const reply = {
        _id: createId(),
        text,
        created_on: now,
        delete_password: deletePassword,
        reported: false
      };

      thread.replies.push(reply);
      thread.bumped_on = now;

      return res.json(sanitizeThreadWithReplies(thread));
    })
    .get(function (req, res) {
      const boardName = req.params.board;
      const threadId = String(req.query.thread_id || '').trim();
      const thread = findThread(boardName, threadId);

      if (!thread) {
        return res.status(404).json({ error: 'thread not found' });
      }

      return res.json(sanitizeThreadWithReplies(thread));
    })
    .delete(function (req, res) {
      const boardName = req.params.board;
      const threadId = String(req.body.thread_id || '').trim();
      const replyId = String(req.body.reply_id || '').trim();
      const deletePassword = String(req.body.delete_password || '').trim();
      const thread = findThread(boardName, threadId);

      if (!thread) {
        return res.send('incorrect password');
      }

      const reply = findReply(thread, replyId);

      if (!reply || reply.delete_password !== deletePassword) {
        return res.send('incorrect password');
      }

      reply.text = '[deleted]';
      return res.send('success');
    })
    .put(function (req, res) {
      const boardName = req.params.board;
      const threadId = String(req.body.thread_id || '').trim();
      const replyId = String(req.body.reply_id || '').trim();
      const thread = findThread(boardName, threadId);

      if (!thread) {
        return res.send('reported');
      }

      const reply = findReply(thread, replyId);

      if (reply) {
        reply.reported = true;
      }

      return res.send('reported');
    });

};
