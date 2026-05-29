const { Webhooks } = require('@octokit/webhooks');

/**
 * Creates a middleware to handle GitHub webhooks and trigger graph analysis.
 * 
 * @param {string} secret GitHub webhook secret for HMAC validation.
 * @param {IntelligenceSDK} sdk Instance of IntelligenceSDK.
 * @param {string} projectRoot Local path to the project root.
 * @param {string} repositoryId Unique identifier for the repository in the store.
 * @returns {Function} Express-compatible middleware.
 */
function createWebhookMiddleware(secret, sdk, projectRoot, repositoryId) {
  const webhooks = new Webhooks({ secret });

  webhooks.on('push', async ({ payload }) => {
    try {
      const branch = payload.ref.replace('refs/heads/', '');
      const summary = await sdk.scanCommit(projectRoot, repositoryId, branch);
      
      if (payload.commits && payload.commits.length > 0) {
        const firstCommit = payload.commits[0];
        const evidence = await sdk.getVerificationEvidence(repositoryId, summary.commitId, firstCommit.message);
        console.log('Generated Verification Evidence for AI consumption:', JSON.stringify(evidence));
      }
    } catch (error) {
      console.error('Error handling push event:', error);
    }
  });

  webhooks.on('pull_request', async ({ payload }) => {
    try {
      if (['opened', 'synchronize'].includes(payload.action)) {
        const branch = payload.pull_request.head.ref;
        const summary = await sdk.scanCommit(projectRoot, repositoryId, branch);
        
        const evidence = await sdk.getVerificationEvidence(repositoryId, summary.commitId, payload.pull_request.title);
        console.log('Generated Verification Evidence for AI consumption:', JSON.stringify(evidence));
      }
    } catch (error) {
      console.error('Error handling pull_request event:', error);
    }
  });

  return webhooks.middleware;
}

module.exports = { createWebhookMiddleware };
