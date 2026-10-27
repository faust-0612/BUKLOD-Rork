import { partitionConnectInboxThreads } from '../src/lib/connectInboxClassification';

describe('Connect first-message Requests', () => {
  const conversations = [
    { thread_id: 'a', unread_count: 2 },
    { thread_id: 'b', unread_count: 0 },
    { thread_id: 'c', unread_count: 5 },
  ];

  it('separates pending first-contact requests without duplicating threads', () => {
    const result = partitionConnectInboxThreads(conversations, ['a', 'a', 'c']);
    expect(result.requests.map(thread => thread.thread_id)).toEqual(['a', 'c']);
    expect(result.personal.map(thread => thread.thread_id)).toEqual(['b']);
  });

  it('does not classify an existing conversation as a request merely because it is unread', () => {
    const result = partitionConnectInboxThreads(conversations, []);
    expect(result.requests).toEqual([]);
    expect(result.personal).toEqual(conversations);
  });

  it('keeps a request pending even after its message was read, until it is accepted by a reply', () => {
    const result = partitionConnectInboxThreads(conversations, ['b']);
    expect(result.requests).toEqual([conversations[1]]);
    expect(result.personal).toHaveLength(2);
  });
});
