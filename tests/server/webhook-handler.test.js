const { createWebhookMiddleware } = require('../../src/server/webhook-handler');

// Mock @octokit/webhooks
jest.mock('@octokit/webhooks', () => {
  return {
    Webhooks: jest.fn().mockImplementation(() => {
      const listeners = {};
      return {
        on: jest.fn((event, callback) => {
          listeners[event] = callback;
        }),
        middleware: jest.fn().mockReturnValue((req, res, next) => {}),
        // Helper to trigger listener in tests
        _trigger: (event, payload) => {
          if (listeners[event]) {
            return listeners[event](payload);
          }
        }
      };
    })
  };
});

const { Webhooks } = require('@octokit/webhooks');

describe('webhook-handler', () => {
  let mockSdk;
  let webhooksInstance;
  const secret = 'test-secret';
  const projectRoot = '/test/root';
  const repositoryId = 'test-repo-id';

  beforeEach(() => {
    mockSdk = {
      scanCommit: jest.fn().mockResolvedValue({ commitId: 'c1' }),
      getVerificationEvidence: jest.fn().mockResolvedValue({ taskDescription: 'evidence' }),
    };
    Webhooks.mockClear();
  });

  test('createWebhookMiddleware initializes Webhooks and returns middleware', () => {
    const middleware = createWebhookMiddleware(secret, mockSdk, projectRoot, repositoryId);
    
    expect(Webhooks).toHaveBeenCalledWith({ secret });
    webhooksInstance = Webhooks.mock.results[0].value;
    expect(webhooksInstance.on).toHaveBeenCalledWith('push', expect.any(Function));
    expect(webhooksInstance.on).toHaveBeenCalledWith('pull_request', expect.any(Function));
    expect(typeof middleware).toBe('function');
  });

  test('handles push event correctly', async () => {
    createWebhookMiddleware(secret, mockSdk, projectRoot, repositoryId);
    webhooksInstance = Webhooks.mock.results[0].value;
    
    const pushPayload = {
      payload: {
        ref: 'refs/heads/main',
        commits: [
          { message: 'feat: add something', id: 'c1' }
        ]
      }
    };
    
    const pushHandler = webhooksInstance.on.mock.calls.find(call => call[0] === 'push')[1];
    await pushHandler(pushPayload);
    
    expect(mockSdk.scanCommit).toHaveBeenCalledWith(projectRoot, repositoryId, 'main');
    expect(mockSdk.getVerificationEvidence).toHaveBeenCalledWith(repositoryId, 'c1', 'feat: add something');
  });

  test('handles pull_request opened event correctly', async () => {
    createWebhookMiddleware(secret, mockSdk, projectRoot, repositoryId);
    webhooksInstance = Webhooks.mock.results[0].value;
    
    const prPayload = {
      payload: {
        action: 'opened',
        pull_request: {
          head: { ref: 'feature-branch' },
          title: 'PR Title'
        }
      }
    };
    
    const prHandler = webhooksInstance.on.mock.calls.find(call => call[0] === 'pull_request')[1];
    await prHandler(prPayload);
    
    expect(mockSdk.scanCommit).toHaveBeenCalledWith(projectRoot, repositoryId, 'feature-branch');
    expect(mockSdk.getVerificationEvidence).toHaveBeenCalledWith(repositoryId, 'c1', 'PR Title');
  });

  test('handles pull_request synchronize event correctly', async () => {
    createWebhookMiddleware(secret, mockSdk, projectRoot, repositoryId);
    webhooksInstance = Webhooks.mock.results[0].value;
    
    const prPayload = {
      payload: {
        action: 'synchronize',
        pull_request: {
          head: { ref: 'updated-branch' },
          title: 'Updated PR Title'
        }
      }
    };
    
    const prHandler = webhooksInstance.on.mock.calls.find(call => call[0] === 'pull_request')[1];
    await prHandler(prPayload);
    
    expect(mockSdk.scanCommit).toHaveBeenCalledWith(projectRoot, repositoryId, 'updated-branch');
    expect(mockSdk.getVerificationEvidence).toHaveBeenCalledWith(repositoryId, 'c1', 'Updated PR Title');
  });

  test('logs error if scanCommit fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSdk.scanCommit.mockRejectedValue(new Error('Scan failed'));
    
    createWebhookMiddleware(secret, mockSdk, projectRoot, repositoryId);
    webhooksInstance = Webhooks.mock.results[0].value;
    
    const pushPayload = {
      payload: {
        ref: 'refs/heads/main',
        commits: [{ message: 'feat: add something', id: 'c1' }]
      }
    };
    
    const pushHandler = webhooksInstance.on.mock.calls.find(call => call[0] === 'push')[1];
    await pushHandler(pushPayload);
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error handling push event'), expect.any(Error));
    consoleSpy.mockRestore();
  });
});
